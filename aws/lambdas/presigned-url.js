const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3 = new S3Client({});
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const CONTENT_TYPES = new Map([
  ['.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ['.csv', 'text/csv'],
]);

function allowedOrigins() {
  return new Set((process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || 'http://localhost:8080')
    .split(',').map((value) => value.trim()).filter(Boolean));
}

function response(statusCode, body, origin) {
  const origins = allowedOrigins();
  const allowOrigin = origins.has('*') ? '*' : origins.has(origin) ? origin : 'null';
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Content-Type': 'application/json',
      'Vary': 'Origin',
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  if (event.httpMethod === 'OPTIONS') return response(204, {}, origin);
  if (event.httpMethod && event.httpMethod !== 'POST') return response(405, { error: 'Method not allowed' }, origin);
  if (!allowedOrigins().has('*') && !allowedOrigins().has(origin)) {
    return response(403, { error: 'Origin is not allowed' }, origin);
  }

  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body || {};
    const rawFilename = String(body.filename || 'offline-import.xlsx').replace(/\\/g, '/');
    const filename = path.posix.basename(rawFilename).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 100);
    const extension = path.posix.extname(filename).toLowerCase();
    const contentType = CONTENT_TYPES.get(extension);
    const sizeBytes = Number(body.sizeBytes);
    if (!contentType) return response(400, { error: 'Only .xlsx and .csv files are accepted' }, origin);
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_UPLOAD_BYTES) {
      return response(400, { error: 'File must be between 1 byte and 25 MiB' }, origin);
    }
    const channelId = String(body.channelId || '').slice(0, 128);
    const fileSha256 = String(body.fileSha256 || '').toLowerCase();
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(channelId)) return response(400, { error: 'A valid channel ID is required' }, origin);
    if (!/^[a-f0-9]{64}$/.test(fileSha256)) return response(400, { error: 'A valid file checksum is required' }, origin);
    if (!process.env.IMPORT_BUCKET_NAME) throw new Error('IMPORT_BUCKET_NAME is not configured');

    const key = `raw/${Date.now()}-${randomUUID()}-${filename}`;
    const uploadHeaders = {
      'Content-Type': contentType,
      'x-amz-meta-channel-id': channelId,
      'x-amz-meta-file-sha256': fileSha256,
      'x-amz-server-side-encryption': 'AES256',
    };
    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: process.env.IMPORT_BUCKET_NAME,
        Key: key,
        ContentType: contentType,
        ContentLength: sizeBytes,
        ServerSideEncryption: 'AES256',
        Metadata: { 'channel-id': channelId, 'file-sha256': fileSha256 },
      }),
      { expiresIn: 300, unhoistableHeaders: new Set(['x-amz-server-side-encryption']) },
    );

    return response(200, { uploadUrl, key, headers: uploadHeaders, contentType, sizeBytes, expiresInSeconds: 300 }, origin);
  } catch (error) {
    console.error('Failed to create upload URL', error.message);
    return response(500, { error: 'Could not create an upload URL' }, origin);
  }
};
