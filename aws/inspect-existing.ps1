param(
  [string]$Profile = 'marketpulse-free',
  [string]$StackAccount = '901454175401'
)

$ErrorActionPreference = 'Stop'
$Region = 'ap-south-1'

if ($Profile -eq 'marketpulse-free') {
  $availableProfiles = aws configure list-profiles 2>$null
  if (-not ($availableProfiles -contains 'marketpulse-free')) {
    $Profile = 'default'
  }
}

function Invoke-AwsJson {
  param(
    [Parameter(Mandatory)][string[]]$Arguments,
    [string]$RequestRegion = $Region,
    [string]$NotFoundPattern = ''
  )

  $awsCommand = Get-Command aws -ErrorAction Stop
  $processInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $processInfo.FileName = $awsCommand.Source
  $processInfo.UseShellExecute = $false
  $processInfo.CreateNoWindow = $true
  $processInfo.RedirectStandardOutput = $true
  $processInfo.RedirectStandardError = $true
  $processInfo.Arguments = (@($Arguments) + @('--region', $RequestRegion, '--profile', $Profile, '--output', 'json')) -join ' '

  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $processInfo
  [void]$process.Start()
  $stdoutTask = $process.StandardOutput.ReadToEndAsync()
  $stderrTask = $process.StandardError.ReadToEndAsync()
  $process.WaitForExit()
  $raw = $stdoutTask.GetAwaiter().GetResult()
  $stderr = $stderrTask.GetAwaiter().GetResult()
  if ($process.ExitCode -ne 0) {
    $message = $stderr.Trim()
    if ($NotFoundPattern -and $message -match $NotFoundPattern) { return $null }
    throw "AWS read-only inspection failed ($($Arguments -join ' ')): $($message.Trim())"
  }
  if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
  return $raw | ConvertFrom-Json
}

$identity = Invoke-AwsJson -Arguments @('sts', 'get-caller-identity')
if ($identity.Account -ne $StackAccount) {
  throw "Profile '$Profile' is not the account recorded in PLAN.md. No inspection was performed."
}

$plan = Invoke-AwsJson -Arguments @('freetier', 'get-account-plan-state') -RequestRegion 'us-east-1'
if ($plan.accountId -ne $StackAccount -or $plan.accountPlanType -ne 'FREE' -or
    $plan.accountPlanStatus -ne 'ACTIVE' -or $plan.accountPlanRemainingCredits.amount -le 0) {
  throw 'The target account does not have an active Free plan with credits remaining. No inspection was performed.'
}

$bucketName = 'marketpulse-offline-imports-901454175401'
$bucketExists = [bool]((Invoke-AwsJson -Arguments @('s3api', 'list-buckets')).Buckets | Where-Object Name -eq $bucketName)
$bucket = $null
if ($bucketExists) {
  $encryption = Invoke-AwsJson -Arguments @('s3api', 'get-bucket-encryption', '--bucket', $bucketName) -NotFoundPattern 'ServerSideEncryptionConfigurationNotFoundError'
  $cors = Invoke-AwsJson -Arguments @('s3api', 'get-bucket-cors', '--bucket', $bucketName) -NotFoundPattern 'NoSuchCORSConfiguration'
  $lifecycle = Invoke-AwsJson -Arguments @('s3api', 'get-bucket-lifecycle-configuration', '--bucket', $bucketName) -NotFoundPattern 'NoSuchLifecycleConfiguration'
  $publicAccess = Invoke-AwsJson -Arguments @('s3api', 'get-public-access-block', '--bucket', $bucketName) -NotFoundPattern 'NoSuchPublicAccessBlockConfiguration'
  $notifications = Invoke-AwsJson -Arguments @('s3api', 'get-bucket-notification-configuration', '--bucket', $bucketName)
  $encryptionAlgorithms = @($encryption.ServerSideEncryptionConfiguration.Rules | ForEach-Object { $_.ApplyServerSideEncryptionByDefault.SSEAlgorithm } | Where-Object { $_ })
  $corsOrigins = @($cors.CORSRules | ForEach-Object { $_.AllowedOrigins } | Where-Object { $_ })
  $corsMethods = @($cors.CORSRules | ForEach-Object { $_.AllowedMethods } | Where-Object { $_ })
  $lifecycleRules = if ($lifecycle -and $lifecycle.Rules) {
    @($lifecycle.Rules | ForEach-Object { [ordered]@{ Id = $_.ID; Status = $_.Status; Prefix = $_.Prefix; ExpirationDays = $_.Expiration.Days } })
  } else { @() }
  $bucket = [ordered]@{
    Name = $bucketName
    EncryptionAlgorithms = $encryptionAlgorithms
    CorsOrigins = $corsOrigins
    CorsMethods = $corsMethods
    LifecycleRules = $lifecycleRules
    PublicAccessBlock = $publicAccess.PublicAccessBlockConfiguration
    NotificationDestinations = [ordered]@{
      EventBridgeEnabled = [bool]$notifications.EventBridgeConfiguration.EventBridgeEnabled
      LambdaArns = @($notifications.LambdaFunctionConfigurations | ForEach-Object { $_.LambdaFunctionArn } | Where-Object { $_ })
      QueueArns = @($notifications.QueueConfigurations | ForEach-Object { $_.QueueArn } | Where-Object { $_ })
      TopicArns = @($notifications.TopicConfigurations | ForEach-Object { $_.TopicArn } | Where-Object { $_ })
    }
  }
}

$queueUrls = (Invoke-AwsJson -Arguments @('sqs', 'list-queues', '--queue-name-prefix', 'marketpulse-telemetry')).QueueUrls
$queues = foreach ($name in @('marketpulse-telemetry-queue', 'marketpulse-telemetry-dlq')) {
  $url = $queueUrls | Where-Object { ($_ -split '/')[-1] -eq $name } | Select-Object -First 1
  if ($url) {
    $attributes = Invoke-AwsJson -Arguments @('sqs', 'get-queue-attributes', '--queue-url', $url, '--attribute-names', 'All')
    $values = $attributes.Attributes
    $redrive = if ($values.RedrivePolicy) { $values.RedrivePolicy | ConvertFrom-Json } else { $null }
    [ordered]@{
      Name = $name
      Arn = $values.QueueArn
      VisibilityTimeout = $values.VisibilityTimeout
      MessageRetentionPeriod = $values.MessageRetentionPeriod
      RedriveTargetArn = $redrive.deadLetterTargetArn
      RedriveMaxReceiveCount = $redrive.maxReceiveCount
      Encryption = if ($values.SqsManagedSseEnabled -eq 'true') { 'SQS-managed' } elseif ($values.KmsMasterKeyId) { 'KMS' } else { 'none' }
    }
  }
}

$topicArn = ((Invoke-AwsJson -Arguments @('sns', 'list-topics')).Topics | Where-Object { $_.TopicArn -match ':marketpulse-campaign-budget-alerts$' } | Select-Object -First 1).TopicArn
$topic = $null
if ($topicArn) {
  $attributes = (Invoke-AwsJson -Arguments @('sns', 'get-topic-attributes', '--topic-arn', $topicArn)).Attributes
  $subscriptions = (Invoke-AwsJson -Arguments @('sns', 'list-subscriptions-by-topic', '--topic-arn', $topicArn)).Subscriptions
  $topic = [ordered]@{
    Arn = $topicArn
    DisplayName = $attributes.DisplayName
    ConfirmedSubscriptions = $attributes.SubscriptionsConfirmed
    PendingSubscriptions = $attributes.SubscriptionsPending
    ProtocolCounts = @($subscriptions | Group-Object Protocol | ForEach-Object { [ordered]@{ Protocol = $_.Name; Count = $_.Count } })
  }
}

$function = $null
$functionExists = [bool]((Invoke-AwsJson -Arguments @('lambda', 'list-functions')).Functions | Where-Object FunctionName -eq 'marketpulse-stream-processor')
if ($functionExists) {
  $config = Invoke-AwsJson -Arguments @('lambda', 'get-function-configuration', '--function-name', 'marketpulse-stream-processor')
  $eventSources = (Invoke-AwsJson -Arguments @('lambda', 'list-event-source-mappings', '--function-name', 'marketpulse-stream-processor')).EventSourceMappings
  $roleName = ($config.Role -split '/')[-1]
  $attachedPolicies = (Invoke-AwsJson -Arguments @('iam', 'list-attached-role-policies', '--role-name', $roleName)).AttachedPolicies
  $inlinePolicies = (Invoke-AwsJson -Arguments @('iam', 'list-role-policies', '--role-name', $roleName)).PolicyNames
  $function = [ordered]@{
    Name = $config.FunctionName
    Runtime = $config.Runtime
    Handler = $config.Handler
    RoleArn = $config.Role
    Timeout = $config.Timeout
    MemorySize = $config.MemorySize
    TracingMode = $config.TracingConfig.Mode
    EnvironmentVariableNames = @($config.Environment.Variables.PSObject.Properties | ForEach-Object { $_.Name } | Where-Object { $_ })
    SubnetIds = @($config.VpcConfig.SubnetIds | Where-Object { $_ })
    SecurityGroupIds = @($config.VpcConfig.SecurityGroupIds | Where-Object { $_ })
    Layers = @($config.Layers | ForEach-Object { $_.Arn } | Where-Object { $_ })
    EventSourceMappings = @($eventSources | ForEach-Object { [ordered]@{ SourceArn = $_.EventSourceArn; State = $_.State; BatchSize = $_.BatchSize; FunctionResponseTypes = @($_.FunctionResponseTypes | Where-Object { $_ }) } })
    AttachedPolicyNames = @($attachedPolicies | ForEach-Object { $_.PolicyName })
    InlinePolicyNames = @($inlinePolicies)
  }
}

$api = Invoke-AwsJson -Arguments @('apigateway', 'get-rest-api', '--rest-api-id', 'awhhbnom53') -NotFoundPattern 'NotFoundException|Not Found'
$apiRoutes = @()
if ($api) {
  $resources = (Invoke-AwsJson -Arguments @('apigateway', 'get-resources', '--rest-api-id', 'awhhbnom53', '--embed', 'methods')).items
  $apiRoutes = @(foreach ($resource in $resources) {
    foreach ($method in $resource.resourceMethods.PSObject.Properties) {
      $integration = Invoke-AwsJson -Arguments @('apigateway', 'get-integration', '--rest-api-id', 'awhhbnom53', '--resource-id', $resource.id, '--http-method', $method.Name) -NotFoundPattern 'NotFoundException|Not Found'
      [ordered]@{
        Path = $resource.path
        Method = $method.Name
        Authorization = $method.Value.authorizationType
        IntegrationType = $integration.type
        IntegrationHttpMethod = $integration.httpMethod
        IntegrationUri = $integration.uri
      }
    }
  })
  $api = [ordered]@{ Id = $api.id; Name = $api.name; Routes = $apiRoutes }
}

$eventBridgeRules = (Invoke-AwsJson -Arguments @('events', 'list-rules', '--event-bus-name', 'default')).Rules |
  Where-Object { $_.EventPattern -and $_.EventPattern.Contains($bucketName) }
$s3EventRoutes = foreach ($rule in $eventBridgeRules) {
  $targets = (Invoke-AwsJson -Arguments @('events', 'list-targets-by-rule', '--event-bus-name', 'default', '--rule', $rule.Name)).Targets
  [ordered]@{ Rule = $rule.Name; State = $rule.State; TargetArns = @($targets | ForEach-Object { $_.Arn }) }
}

$logGroup = ((Invoke-AwsJson -Arguments @('logs', 'describe-log-groups', '--log-group-name-prefix', '/aws/lambda/marketpulse-stream-processor')).logGroups | Where-Object logGroupName -eq '/aws/lambda/marketpulse-stream-processor' | Select-Object -First 1)
if ($logGroup) {
  $logGroup = [ordered]@{ Name = $logGroup.logGroupName; RetentionInDays = $logGroup.retentionInDays; LogGroupClass = $logGroup.logGroupClass; KmsKeyId = $logGroup.kmsKeyId }
}

[ordered]@{
  AccountId = $identity.Account
  Region = $Region
  AccountPlan = [ordered]@{ Type = $plan.accountPlanType; Status = $plan.accountPlanStatus; CreditsRemaining = $plan.accountPlanRemainingCredits.amount; Expires = $plan.accountPlanExpirationDate }
  S3ImportBucket = $bucket
  SqsQueues = @($queues)
  SnsBudgetTopic = $topic
  StreamProcessorLambda = $function
  ExistingRestApi = $api
  S3EventBridgeRoutes = @($s3EventRoutes)
  StreamProcessorLogGroup = $logGroup
} | ConvertTo-Json -Depth 12
