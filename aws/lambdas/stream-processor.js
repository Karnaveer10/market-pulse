const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { updateEventCache } = require('./redis-cache');
const { persistTelemetryEvent } = require('./event-persistence');

const sns = new SNSClient({});

function numberValue(value, field) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${field} must be a non-negative number`);
  return parsed;
}

function normalizePayload(record) {
  let payload;
  try {
    payload = JSON.parse(record.body || '{}');
  } catch {
    throw new Error('SQS message body must be valid JSON');
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('SQS message body must be a JSON object');
  const type = String(payload.type || payload.event_type || 'interaction').toLowerCase();
  if (!['visit', 'click', 'lead', 'cart_add', 'purchase', 'interaction'].includes(type)) throw new Error('Unsupported telemetry event type');
  const revenue = numberValue(payload.revenue, 'revenue');
  const cost = numberValue(payload.cost, 'cost');
  const budget = numberValue(payload.campaign_budget ?? payload.budget, 'campaign_budget');
  return { payload, type, revenue, cost, budget };
}

async function processRecord(record) {
  const { payload, type: inputType, revenue, cost, budget } = normalizePayload(record);
  const type = inputType === 'interaction' ? 'click' : inputType;
  const sourceId = String(payload.id || record.messageId || '').slice(0, 128);
  if (!sourceId) throw new Error('SQS message is missing a message ID');
  const campaignId = String(payload.campaign_id || payload.campaign_name || 'unassigned').slice(0, 128);
  const channelId = String(payload.channel_id || payload.channel_name || 'unassigned').slice(0, 128);
  const eventAt = payload.timestamp ? new Date(payload.timestamp) : new Date();
  if (Number.isNaN(eventAt.getTime())) throw new Error('Telemetry timestamp is invalid');
  await persistTelemetryEvent({ sourceId, payload, type, revenue, cost, eventAt });

  const result = await updateEventCache({ sourceId, campaignId, channelId, type, revenue, cost, budget });
  const shouldAlert = Array.isArray(result) && Number(result[2]) === 1;
  if (shouldAlert && process.env.SNS_BUDGET_ALERTS_TOPIC_ARN) {
    const campaignName = String(payload.campaign_name || payload.campaign || campaignId).slice(0, 120);
    await sns.send(new PublishCommand({
      TopicArn: process.env.SNS_BUDGET_ALERTS_TOPIC_ARN,
      Subject: `MarketPulse budget alert: ${campaignName}`.slice(0, 100),
      Message: JSON.stringify({
        message: `Campaign ${campaignName} has reached at least 90% of its configured budget.`,
        campaign_id: campaignId,
        budget,
        spent: Number(result[1]),
        currency: 'INR',
      }),
    }));
  }
  console.info('Telemetry processed', { sourceId, type, budgetAlertSent: shouldAlert });
}

exports.handler = async (event) => {
  const failures = [];
  for (const record of event.Records || []) {
    try {
      await processRecord(record);
    } catch (error) {
      console.error('Telemetry processing failed', { messageId: record.messageId, error: error.message });
      failures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures: failures };
};
