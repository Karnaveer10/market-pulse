const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const sns = new SNSClient({});

function response(statusCode, body, origin = '') {
  const origins = new Set((process.env.ALLOWED_ORIGINS || 'http://localhost:8080').split(',').map((value) => value.trim()));
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': origins.has(origin) ? origin : 'null',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Content-Type': 'application/json',
      'Vary': 'Origin',
    },
    body: statusCode === 204 ? '' : JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  if (event.httpMethod === 'OPTIONS') return response(204, {}, origin);
  if (event.httpMethod !== 'POST') return response(405, { error: 'Method not allowed' }, origin);
  if (!event.requestContext?.authorizer?.claims?.sub) return response(401, { error: 'Sign-in is required' }, origin);
  if (!process.env.SNS_BUDGET_ALERTS_TOPIC_ARN) return response(503, { error: 'SNS topic is not configured' }, origin);

  try {
    const result = await sns.send(new PublishCommand({
      TopicArn: process.env.SNS_BUDGET_ALERTS_TOPIC_ARN,
      Subject: 'MarketPulse test alert',
      Message: 'This is a MarketPulse SNS test alert. Email delivery depends on a confirmed SNS email subscription.',
    }));
    return response(202, { published: true, messageId: result.MessageId }, origin);
  } catch (error) {
    console.error('SNS test publish failed', error.message);
    return response(503, { error: 'SNS could not publish the test alert' }, origin);
  }
};
