param(
  [switch]$Deploy,
  [string]$AdminEmail = '',
  [string]$AlertEmail = '',
  [string]$Profile = 'marketpulse-free',
  [string]$StackName = 'marketpulse-live'
)

$ErrorActionPreference = 'Stop'
$Region = 'ap-south-1'
$ExpectedAccount = '901454175401'

if ($Profile -eq 'marketpulse-free') {
  $availableProfiles = aws configure list-profiles 2>$null
  if (-not ($availableProfiles -contains 'marketpulse-free')) {
    $Profile = 'default'
  }
}

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

Get-ChildItem (Join-Path $PSScriptRoot 'lambdas') -Filter '*.js' | ForEach-Object {
  node --check $_.FullName
  if ($LASTEXITCODE -ne 0) { throw "Lambda syntax validation failed for $($_.Name)." }
}
npm.cmd ls --prefix (Join-Path $PSScriptRoot 'lambdas') --depth=0
if ($LASTEXITCODE -ne 0) { throw 'Lambda dependencies are missing or invalid.' }

$templateValidation = aws cloudformation validate-template --template-body file://aws/cloudformation.yaml --region $Region --profile $Profile --output json
if ($LASTEXITCODE -ne 0) { throw 'CloudFormation template validation failed.' }

if (-not $Deploy) {
  Write-Output 'Lambda syntax/dependency checks and CloudFormation template validation passed. No AWS resources were changed. Add -Deploy to package and deploy after supplying the administrator email.'
  return
}

if ($AdminEmail -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$') {
  throw 'A valid -AdminEmail is required with -Deploy so the initial Cognito administrator can receive its sign-in invitation.'
}
if ($AlertEmail -and $AlertEmail -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$') {
  throw 'AlertEmail must be a valid email address when provided.'
}

$identityJson = aws sts get-caller-identity --region $Region --profile $Profile --output json
if ($LASTEXITCODE -ne 0) { throw "Could not verify AWS profile '$Profile'." }
$identity = $identityJson | ConvertFrom-Json
if ($identity.Account -ne $ExpectedAccount) {
  throw "Profile '$Profile' resolves to an account that does not match the target recorded in PLAN.md. No deployment was started."
}

# Free Tier plan state is account-wide and the API is hosted in us-east-1.
# Fail closed if the plan cannot be verified; never deploy from a paid or expired plan.
$planJson = aws freetier get-account-plan-state --region us-east-1 --profile $Profile --output json 2>&1
if ($LASTEXITCODE -ne 0) { throw 'Could not verify AWS Free Tier plan state. No deployment was started.' }
$plan = $planJson | ConvertFrom-Json
if ($plan.accountId -ne $ExpectedAccount) {
  throw 'Free Tier plan state belongs to a different AWS account. No deployment was started.'
}
if ($plan.accountPlanType -ne 'FREE' -or $plan.accountPlanStatus -ne 'ACTIVE' -or $plan.accountPlanRemainingCredits.amount -le 0) {
  throw "AWS account must have an active Free plan with credits remaining. Current plan: $($plan.accountPlanType)/$($plan.accountPlanStatus). No deployment was started."
}
Write-Output ("Verified active AWS Free plan; credits remaining: {0} {1}; expires: {2}" -f $plan.accountPlanRemainingCredits.amount, $plan.accountPlanRemainingCredits.unit, $plan.accountPlanExpirationDate)

$stackListJson = aws cloudformation list-stacks --region $Region --profile $Profile --output json
if ($LASTEXITCODE -ne 0) { throw 'Could not list CloudFormation stacks; no deployment was started.' }
$existingStack = (($stackListJson | ConvertFrom-Json).StackSummaries | Where-Object { $_.StackName -eq $StackName -and $_.StackStatus -ne 'DELETE_COMPLETE' } | Select-Object -First 1)
$stackOwnedByScript = $false
if ($existingStack) {
  $existingStackJson = aws cloudformation describe-stacks --stack-name $StackName --region $Region --profile $Profile --output json
  if ($LASTEXITCODE -ne 0) { throw "Could not read CloudFormation stack '$StackName'; no deployment was started." }
  $existingStack = ($existingStackJson | ConvertFrom-Json).Stacks[0]
  $ownerTag = $existingStack.Tags | Where-Object { $_.Key -eq 'marketpulse-deployer' } | Select-Object -First 1
  if (-not $ownerTag -or $ownerTag.Value -ne 'aws/deploy.ps1') {
    throw "Stack '$StackName' already exists and is not tagged as managed by aws/deploy.ps1. No stack changes were started."
  }
  $stackOwnedByScript = $true
}

$reuseParameters = @()
$existingImportBucketName = 'marketpulse-offline-imports-901454175401'
$bucketListJson = aws s3api list-buckets --profile $Profile --output json
if ($LASTEXITCODE -ne 0) { throw 'Could not check the existing import bucket; no deployment was started.' }
if ((($bucketListJson | ConvertFrom-Json).Buckets | Where-Object { $_.Name -eq $existingImportBucketName })) {
  $reuseParameters += "ExistingImportBucketName=$existingImportBucketName"
}

$queueListJson = aws sqs list-queues --queue-name-prefix marketpulse-telemetry --region $Region --profile $Profile --output json
if ($LASTEXITCODE -ne 0) { throw 'Could not check the existing telemetry queues; no deployment was started.' }
$queueUrls = ($queueListJson | ConvertFrom-Json).QueueUrls
$existingQueueUrl = $queueUrls | Where-Object { ($_ -split '/')[-1] -eq 'marketpulse-telemetry-queue' } | Select-Object -First 1
$existingDlqUrl = $queueUrls | Where-Object { ($_ -split '/')[-1] -eq 'marketpulse-telemetry-dlq' } | Select-Object -First 1
if ([bool]$existingQueueUrl -ne [bool]$existingDlqUrl) {
  throw 'Only one of the existing telemetry queue/DLQ pair was found. No deployment was started.'
}
if ($existingQueueUrl) {
  $queueAttributesJson = aws sqs get-queue-attributes --queue-url $existingQueueUrl --attribute-names All --region $Region --profile $Profile --output json
  if ($LASTEXITCODE -ne 0) { throw 'Could not read the existing telemetry queue ARN; no deployment was started.' }
  $queueAttributes = ($queueAttributesJson | ConvertFrom-Json).Attributes
  $dlqAttributesJson = aws sqs get-queue-attributes --queue-url $existingDlqUrl --attribute-names QueueArn --region $Region --profile $Profile --output json
  if ($LASTEXITCODE -ne 0) { throw 'Could not read the existing dead-letter queue ARN; no deployment was started.' }
  $existingDlqArn = ($dlqAttributesJson | ConvertFrom-Json).Attributes.QueueArn
  $reuseParameters += "ExistingTelemetryQueueArn=$($queueAttributes.QueueArn)"
  $reuseParameters += "ExistingTelemetryQueueUrl=$existingQueueUrl"
  $reuseParameters += 'ExistingTelemetryQueueName=marketpulse-telemetry-queue'
  $reuseParameters += 'ExistingDeadLetterQueueName=marketpulse-telemetry-dlq'
}

$topicListJson = aws sns list-topics --region $Region --profile $Profile --output json
if ($LASTEXITCODE -ne 0) { throw 'Could not check the existing SNS topic; no deployment was started.' }
$existingTopicArn = (($topicListJson | ConvertFrom-Json).Topics | Where-Object { $_.TopicArn -match ':marketpulse-campaign-budget-alerts$' } | Select-Object -First 1).TopicArn
if ($existingTopicArn) {
  $reuseParameters += "ExistingBudgetAlertsTopicArn=$existingTopicArn"
  $reuseParameters += 'ExistingBudgetAlertsTopicName=marketpulse-campaign-budget-alerts'
}

if (-not $existingImportBucketName -or -not ($reuseParameters | Where-Object { $_ -like 'ExistingImportBucketName=*' })) {
  throw 'An existing S3 bucket is required to stage Lambda packages for this reuse deployment.'
}

$samOutputDirectory = Join-Path $RepoRoot '.aws-sam'
New-Item -Path $samOutputDirectory -ItemType Directory -Force | Out-Null
$packagedTemplate = Join-Path $samOutputDirectory 'packaged-template.yaml'
aws cloudformation package `
  --template-file aws/cloudformation.yaml `
  --s3-bucket $existingImportBucketName `
  --s3-prefix "$StackName-artifacts" `
  --output-template-file $packagedTemplate `
  --region $Region `
  --profile $Profile
if ($LASTEXITCODE -ne 0) { throw 'Lambda artifacts could not be packaged to the existing private S3 bucket.' }

$existingEventSourceMapping = $null
if ($existingQueueUrl) {
  $oldFunctionMappingsJson = aws lambda list-event-source-mappings --function-name marketpulse-stream-processor --region $Region --profile $Profile --output json
  if ($LASTEXITCODE -ne 0) { throw 'Could not check the legacy Lambda queue mapping; no deployment was started.' }
  $existingEventSourceMapping = (($oldFunctionMappingsJson | ConvertFrom-Json).EventSourceMappings | Where-Object { $_.EventSourceArn -eq $queueAttributes.QueueArn -and $_.State -eq 'Enabled' } | Select-Object -First 1)
}

$parameterOverrides = @(
  'DatabaseInstanceClass=db.t4g.micro',
  'CacheNodeType=cache.t4g.micro',
  "AlertEmail=$(if ($AlertEmail) { $AlertEmail } else { $AdminEmail })"
)
$parameterOverrides += $reuseParameters

$originalBucketNotifications = $null
$reuseExistingBucket = [bool]($reuseParameters | Where-Object { $_ -like 'ExistingImportBucketName=*' })
if ($reuseExistingBucket) {
  $bucketNotificationJson = aws s3api get-bucket-notification-configuration --bucket $existingImportBucketName --region $Region --profile $Profile --output json
  if ($LASTEXITCODE -ne 0) { throw 'Could not read S3 notification settings before deployment.' }
  $originalBucketNotifications = $bucketNotificationJson | ConvertFrom-Json
}

$oldQueueVisibilityTimeout = $null
$queueVisibilityChanged = $false
$legacyMappingPauseAttempted = $false
try {
  if ($existingQueueUrl) {
    $oldQueueVisibilityTimeout = $queueAttributes.VisibilityTimeout
    if ([int]$oldQueueVisibilityTimeout -lt 360) {
      $queueSettingsFile = [System.IO.Path]::GetTempFileName()
      try {
        [System.IO.File]::WriteAllText($queueSettingsFile, '{"VisibilityTimeout":"360"}', [System.Text.UTF8Encoding]::new($false))
        $queueVisibilityChanged = $true
        aws sqs set-queue-attributes --queue-url $existingQueueUrl --attributes "file://$queueSettingsFile" --region $Region --profile $Profile
        if ($LASTEXITCODE -ne 0) { throw 'Could not raise the queue visibility timeout for the replacement Lambda.' }
      } finally {
        Remove-Item -LiteralPath $queueSettingsFile -Force -ErrorAction SilentlyContinue
      }
    }
  }

  if ($existingEventSourceMapping) {
    $legacyMappingPauseAttempted = $true
    aws lambda update-event-source-mapping --uuid $existingEventSourceMapping.UUID --no-enabled --region $Region --profile $Profile --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not pause the legacy queue consumer before deployment.' }
    $mappingDisabled = $false
    for ($attempt = 0; $attempt -lt 30 -and -not $mappingDisabled; $attempt++) {
      Start-Sleep -Seconds 2
      $mappingJson = aws lambda get-event-source-mapping --uuid $existingEventSourceMapping.UUID --region $Region --profile $Profile --output json
      if ($LASTEXITCODE -eq 0) { $mappingDisabled = (($mappingJson | ConvertFrom-Json).State -eq 'Disabled') }
    }
    if (-not $mappingDisabled) { throw 'The legacy queue consumer did not pause; deployment was stopped.' }
  }

aws cloudformation deploy `
  --template-file $packagedTemplate `
  --stack-name $StackName `
  --region $Region `
  --profile $Profile `
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND `
  --tags marketpulse-deployer=aws/deploy.ps1 `
  --parameter-overrides $parameterOverrides `
  --no-fail-on-empty-changeset
  if ($LASTEXITCODE -ne 0) { throw 'CloudFormation deployment failed. Check the stack events before retrying.' }
} catch {
  if ($legacyMappingPauseAttempted) {
    aws lambda update-event-source-mapping --uuid $existingEventSourceMapping.UUID --enabled --region $Region --profile $Profile --output json | Out-Null
  }
  if ($queueVisibilityChanged) {
    $restoreQueueFile = [System.IO.Path]::GetTempFileName()
    try {
      $restoreQueueSettings = @{ VisibilityTimeout = [string]$oldQueueVisibilityTimeout } | ConvertTo-Json -Compress
      [System.IO.File]::WriteAllText($restoreQueueFile, $restoreQueueSettings, [System.Text.UTF8Encoding]::new($false))
      aws sqs set-queue-attributes --queue-url $existingQueueUrl --attributes "file://$restoreQueueFile" --region $Region --profile $Profile
    } finally {
      Remove-Item -LiteralPath $restoreQueueFile -Force -ErrorAction SilentlyContinue
    }
  }
  throw
}

$stackJson = aws cloudformation describe-stacks --stack-name $StackName --region $Region --profile $Profile --output json
if ($LASTEXITCODE -ne 0) { throw 'Deployment returned, but stack outputs could not be read.' }
$stack = ($stackJson | ConvertFrom-Json).Stacks[0]
$outputs = @{}
foreach ($output in $stack.Outputs) { $outputs[$output.OutputKey] = $output.OutputValue }

if ($existingQueueUrl) {
  $redrivePolicy = @{ deadLetterTargetArn = $existingDlqArn; maxReceiveCount = 5 } | ConvertTo-Json -Compress
  $queueSettings = @{ VisibilityTimeout = '360'; RedrivePolicy = $redrivePolicy } | ConvertTo-Json -Compress
  $queueSettingsFile = [System.IO.Path]::GetTempFileName()
  try {
    [System.IO.File]::WriteAllText($queueSettingsFile, $queueSettings, [System.Text.UTF8Encoding]::new($false))
    aws sqs set-queue-attributes --queue-url $existingQueueUrl --attributes "file://$queueSettingsFile" --region $Region --profile $Profile
    if ($LASTEXITCODE -ne 0) { throw 'The stack deployed, but the existing queue DLQ redrive policy could not be set.' }
  } finally {
    Remove-Item -LiteralPath $queueSettingsFile -Force -ErrorAction SilentlyContinue
  }
}

if ($reuseExistingBucket) {
  $corsRules = @()
  $existingCorsJson = aws s3api get-bucket-cors --bucket $existingImportBucketName --region $Region --profile $Profile --output json 2>$null
  if ($LASTEXITCODE -eq 0) {
    $corsRules += ($existingCorsJson | ConvertFrom-Json).CORSRules
  }
  $corsRules += [ordered]@{
    AllowedOrigins = @('http://localhost:8080', 'http://localhost:8081', 'http://localhost:8082', 'http://127.0.0.1:8082', $outputs.Ec2PublicUrl) | Where-Object { $_ }
    AllowedMethods = @('GET', 'PUT', 'POST')
    AllowedHeaders = @('*')
    ExposeHeaders = @('ETag')
    MaxAgeSeconds = 3600
  }
  $corsFile = [System.IO.Path]::GetTempFileName()
  try {
    $corsConfiguration = @{ CORSRules = $corsRules } | ConvertTo-Json -Depth 10 -Compress
    [System.IO.File]::WriteAllText($corsFile, $corsConfiguration, [System.Text.UTF8Encoding]::new($false))
    aws s3api put-bucket-cors --bucket $existingImportBucketName --cors-configuration "file://$corsFile" --region $Region --profile $Profile
    if ($LASTEXITCODE -ne 0) { throw 'The stack deployed, but browser CORS could not be configured on the existing import bucket.' }
  } finally {
    Remove-Item -LiteralPath $corsFile -Force -ErrorAction SilentlyContinue
  }

  $notificationConfiguration = [ordered]@{}
  foreach ($property in $originalBucketNotifications.PSObject.Properties) {
    if ($property.Name -ne 'EventBridgeConfiguration' -and $property.Value) { $notificationConfiguration[$property.Name] = $property.Value }
  }
  if ($originalBucketNotifications.EventBridgeConfiguration) {
    $notificationConfiguration.EventBridgeConfiguration = $originalBucketNotifications.EventBridgeConfiguration
  } else {
    $notificationConfiguration.EventBridgeConfiguration = @{}
  }
  $notificationFile = [System.IO.Path]::GetTempFileName()
  try {
    $notificationJson = $notificationConfiguration | ConvertTo-Json -Depth 12 -Compress
    [System.IO.File]::WriteAllText($notificationFile, $notificationJson, [System.Text.UTF8Encoding]::new($false))
    aws s3api put-bucket-notification-configuration --bucket $existingImportBucketName --notification-configuration "file://$notificationFile" --region $Region --profile $Profile
    if ($LASTEXITCODE -ne 0) { throw 'The stack deployed, but EventBridge could not be enabled on the existing import bucket.' }
  } finally {
    Remove-Item -LiteralPath $notificationFile -Force -ErrorAction SilentlyContinue
  }
}

$cognitoUsersJson = aws cognito-idp list-users `
  --user-pool-id $outputs.UserPoolId `
  --filter "email = `"$AdminEmail`"" `
  --region $Region `
  --profile $Profile `
  --output json
if ($LASTEXITCODE -ne 0) { throw 'The AWS stack exists, but Cognito users could not be checked.' }
$existingAdmin = (($cognitoUsersJson | ConvertFrom-Json).Users | Where-Object { $_.Attributes | Where-Object { $_.Name -eq 'email' -and $_.Value -eq $AdminEmail } } | Select-Object -First 1)
if (-not $existingAdmin) {
  $userJson = aws cognito-idp admin-create-user `
  --user-pool-id $outputs.UserPoolId `
  --username $AdminEmail `
  --user-attributes "Name=email,Value=$AdminEmail" "Name=email_verified,Value=true" `
  --desired-delivery-mediums EMAIL `
  --region $Region `
  --profile $Profile `
  --output json
  if ($LASTEXITCODE -ne 0) { throw 'The AWS stack exists, but Cognito could not send the initial administrator invitation.' }
}

$publicConfig = [ordered]@{
  VITE_AWS_API_GATEWAY_URL = $outputs.ApiEndpoint
  VITE_AWS_REGION = $Region
  VITE_AWS_COGNITO_USER_POOL_ID = $outputs.UserPoolId
  VITE_AWS_COGNITO_CLIENT_ID = $outputs.UserPoolClientId
}
$envPath = Join-Path $RepoRoot '.env.local'
$lines = if (Test-Path -LiteralPath $envPath) { @(Get-Content -LiteralPath $envPath) } else { @() }
$writtenKeys = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
$updatedLines = foreach ($line in $lines) {
  $replaced = $false
  foreach ($key in $publicConfig.Keys) {
    if ($line -match "^\s*$([regex]::Escape($key))\s*=") {
      [void]$writtenKeys.Add($key)
      $replaced = $true
      "${key}=`"$($publicConfig[$key])`""
      break
    }
  }
  if (-not $replaced) { $line }
}
foreach ($key in $publicConfig.Keys) {
  if (-not $writtenKeys.Contains($key)) { $updatedLines += "${key}=`"$($publicConfig[$key])`"" }
}
[System.IO.File]::WriteAllLines($envPath, [string[]]$updatedLines, [System.Text.UTF8Encoding]::new($false))

npm run build
if ($LASTEXITCODE -ne 0) { throw 'The configured web application build failed.' }
aws s3 sync dist "s3://$($outputs.WebBucketName)/" --region $Region --profile $Profile --delete
if ($LASTEXITCODE -ne 0) { throw 'Uploading the built web assets to S3 failed.' }

$ssmInfo = $null
for ($attempt = 0; $attempt -lt 30 -and -not $ssmInfo; $attempt++) {
  Start-Sleep -Seconds 10
  $infoJson = aws ssm describe-instance-information --filters "Key=InstanceIds,Values=$($outputs.Ec2InstanceId)" --region $Region --profile $Profile --output json
  if ($LASTEXITCODE -eq 0) {
    $ssmInfo = ($infoJson | ConvertFrom-Json).InstanceInformationList | Select-Object -First 1
  }
}
if (-not $ssmInfo) { throw 'The EC2 instance did not register with Systems Manager within five minutes.' }

$commandParameters = @{ commands = @("aws s3 sync s3://$($outputs.WebBucketName)/ /usr/share/nginx/html --delete --region $Region") } | ConvertTo-Json -Compress
$commandJson = aws ssm send-command --instance-ids $($outputs.Ec2InstanceId) --document-name AWS-RunShellScript --parameters $commandParameters --region $Region --profile $Profile --output json
if ($LASTEXITCODE -ne 0) { throw 'Could not send the static-asset sync to the EC2 host through Systems Manager.' }
$commandId = ($commandJson | ConvertFrom-Json).Command.CommandId
$invocation = $null
for ($attempt = 0; $attempt -lt 30; $attempt++) {
  Start-Sleep -Seconds 5
  $invocationJson = aws ssm get-command-invocation --command-id $commandId --instance-id $($outputs.Ec2InstanceId) --region $Region --profile $Profile --output json 2>$null
  if ($LASTEXITCODE -eq 0) {
    $invocation = $invocationJson | ConvertFrom-Json
    if ($invocation.Status -in @('Success', 'Failed', 'Cancelled', 'TimedOut')) { break }
  }
}
if (-not $invocation -or $invocation.Status -ne 'Success') {
  throw "EC2 web asset sync failed. Systems Manager status: $($invocation.Status)"
}

$distributionJson = aws cloudfront list-distributions --profile $Profile --output json
if ($LASTEXITCODE -eq 0) {
  $distributionId = (($distributionJson | ConvertFrom-Json).DistributionList.Items | Where-Object { $_.DomainName -eq $outputs.CloudFrontUrl.Replace('https://', '') } | Select-Object -First 1).Id
  if ($distributionId) {
    aws cloudfront create-invalidation --distribution-id $distributionId --paths '/*' --profile $Profile | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'CloudFront cache invalidation could not be created.' }
  }
}

Write-Output "Deployment and asset sync completed. Web app: $($outputs.CloudFrontUrl) | EC2 demo: $($outputs.Ec2PublicUrl) | API: $($outputs.ApiEndpoint)"
