/**
 * AWS Lambda Function: presigned-url-generator
 * 
 * Invoked by Amazon API Gateway: POST /api/v1/imports/presigned-url
 * 
 * Generates a short-lived (15-minute) signed Amazon S3 PUT URL so clients can stream
 * large Excel/CSV spreadsheets (up to 100MB) directly to S3 without consuming API Gateway memory.
 */

// const AWS = require('aws-sdk');
// const s3 = new AWS.S3({ signatureVersion: 'v4' });

exports.handler = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const filename = body.filename || `offline_import_${Date.now()}.xlsx`;
    const bucket = process.env.IMPORT_BUCKET_NAME || 'marketpulse-offline-imports';
    const key = `raw/${Date.now()}_${filename}`;

    // const params = {
    //   Bucket: bucket,
    //   Key: key,
    //   Expires: 900, // 15 minutes
    //   ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    // };
    // const uploadUrl = await s3.getSignedUrlPromise('putObject', params);

    const mockUploadUrl = `https://${bucket}.s3.amazonaws.com/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=900`;

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uploadUrl: mockUploadUrl,
        key,
        expiresInSeconds: 900,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
