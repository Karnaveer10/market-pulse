const { S3Client, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const ExcelJS = require('exceljs');
const Papa = require('papaparse');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { updateEventCache } = require('./redis-cache');
const { persistTelemetryEvent } = require('./event-persistence');

const s3 = new S3Client({});
const sns = new SNSClient({});
const MAX_IMPORT_BYTES = 25 * 1024 * 1024;

function getS3Records(event) {
  if (Array.isArray(event.Records)) {
    return event.Records.map((record) => ({
      bucket: record.s3?.bucket?.name,
      key: decodeURIComponent(String(record.s3?.object?.key || '').replace(/\+/g, ' ')),
    }));
  }
  if (event.source === 'aws.s3' && event.detail?.bucket?.name && event.detail?.object?.key) {
    return [{
      bucket: event.detail.bucket.name,
      key: decodeURIComponent(String(event.detail.object.key).replace(/\+/g, ' ')),
    }];
  }
  return [];
}

async function bodyToBuffer(body) {
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function normalizedHeader(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getField(row, candidates) {
  const values = new Map(Object.entries(row).map(([key, value]) => [normalizedHeader(key), value]));
  for (const candidate of candidates) {
    const value = values.get(normalizedHeader(candidate));
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return undefined;
}

function parseAmount(value) {
  if (value === undefined || value === null || String(value).trim() === '') return 0;
  const amount = Number(String(value).replace(/[₹,$\s,]/g, ''));
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Spreadsheet contains an invalid revenue or cost amount');
  return amount;
}

function parseDate(value) {
  if (!value) return new Date().toISOString();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Spreadsheet contains an invalid date');
  return date.toISOString();
}

function cellValue(cell) {
  const value = cell.value;
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || '').join('');
    if (Object.prototype.hasOwnProperty.call(value, 'result')) return value.result;
    if (Object.prototype.hasOwnProperty.call(value, 'text')) return value.text;
  }
  return value;
}

async function parseRows(buffer, key) {
  if (key.toLowerCase().endsWith('.csv')) {
    const result = Papa.parse(buffer.toString('utf8'), { header: true, skipEmptyLines: 'greedy' });
    if (result.errors.length > 0) throw new Error(`CSV parsing failed: ${result.errors[0].message}`);
    return result.data.filter((row) => Object.values(row).some((value) => String(value || '').trim() !== ''));
  }
  if (!key.toLowerCase().endsWith('.xlsx')) throw new Error('Only .xlsx and .csv files are supported');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('Spreadsheet has no worksheet');
  const headers = worksheet.getRow(1).values.slice(1).map((value) => String(value || '').trim());
  if (headers.every((header) => !header)) throw new Error('Spreadsheet header row is empty');
  const rows = [];
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const source = worksheet.getRow(rowNumber);
    const row = {};
    headers.forEach((header, columnIndex) => {
      if (header) row[header] = cellValue(source.getCell(columnIndex + 1));
    });
    if (Object.values(row).some((value) => String(value || '').trim() !== '')) rows.push(row);
  }
  return rows;
}

async function importObject({ bucket, key }) {
  if (!bucket || !key || !key.startsWith('raw/')) return 0;
  const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  if (Number(head.ContentLength || 0) > MAX_IMPORT_BYTES) throw new Error('Spreadsheet exceeds the 25 MiB import limit');
  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const rows = await parseRows(await bodyToBuffer(object.Body), key);
  if (rows.length === 0) throw new Error('Spreadsheet contains no transaction rows');

  const metadata = head.Metadata || {};
  let imported = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const revenue = parseAmount(getField(row, ['revenue', 'sales', 'amount', 'transaction amount']));
    const cost = parseAmount(getField(row, ['cost', 'spend', 'ad spend']));
    const budget = parseAmount(getField(row, ['campaign budget', 'budget']));
    const candidateType = String(getField(row, ['type', 'event type']) || (revenue > 0 ? 'purchase' : 'visit')).toLowerCase();
    const type = ['visit', 'click', 'lead', 'cart_add', 'purchase'].includes(candidateType) ? candidateType : 'purchase';
    const campaignName = String(getField(row, ['campaign', 'campaign name', 'campaign tag']) || 'Offline Import').slice(0, 200);
    const channelName = String(getField(row, ['channel', 'channel name', 'store', 'store name']) || metadata['channel-name'] || 'Offline').slice(0, 200);
    const payload = {
      type,
      date: parseDate(getField(row, ['date', 'transaction date', 'timestamp'])),
      customer_name: String(getField(row, ['customer', 'customer name', 'customer identifier']) || '').slice(0, 200),
      customer_email: String(getField(row, ['email', 'customer email']) || '').slice(0, 320),
      customer_id: String(getField(row, ['customer id', 'customer uuid']) || ''),
      product_id: String(getField(row, ['product id', 'product uuid']) || ''),
      product_name: String(getField(row, ['product', 'product name', 'product sku']) || '').slice(0, 200),
      campaign_id: metadata['campaign-id'] || null,
      campaign_name: campaignName,
      channel_id: metadata['channel-id'] || null,
      channel_name: channelName,
      revenue,
      cost,
      campaign_budget: budget,
    };
    const fileHash = String(metadata['file-sha256'] || '');
    const sourceId = fileHash
      ? `upload:${metadata['channel-id'] || 'offline'}:${fileHash}#${index + 2}`
      : `s3://${bucket}/${key}#${index + 2}`;
    const inserted = await persistTelemetryEvent({ sourceId, payload, type, revenue, cost, eventAt: new Date(payload.date) });
    const cacheResult = await updateEventCache({
      sourceId,
      campaignId: String(payload.campaign_id || campaignName).slice(0, 128),
      channelId: String(payload.channel_id || channelName).slice(0, 128),
      type,
      revenue,
      cost,
      budget,
    });
    if (Number(cacheResult?.[2]) === 1 && process.env.SNS_BUDGET_ALERTS_TOPIC_ARN) {
      await sns.send(new PublishCommand({
        TopicArn: process.env.SNS_BUDGET_ALERTS_TOPIC_ARN,
        Subject: `MarketPulse budget alert: ${campaignName}`.slice(0, 100),
        Message: JSON.stringify({
          message: `Campaign ${campaignName} has reached at least 90% of its configured budget.`,
          campaign_id: payload.campaign_id || campaignName,
          budget,
          spent: Number(cacheResult[1]),
          currency: 'INR',
        }),
      }));
    }
    if (inserted) imported += 1;
  }
  console.info('Offline file processed', { bucket, key, importedRows: imported });
  return imported;
}

exports.handler = async (event) => {
  const records = getS3Records(event);
  if (records.length === 0) throw new Error('Event does not contain an S3 object-created record');
  let importedRows = 0;
  for (const record of records) importedRows += await importObject(record);
  return { statusCode: 200, body: JSON.stringify({ processedObjects: records.length, importedRows }) };
};
