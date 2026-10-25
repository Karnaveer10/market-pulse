const { getPool, ensureSchema } = require('./database');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const asUuid = (value) => (typeof value === 'string' && UUID_PATTERN.test(value) ? value : null);

async function persistTelemetryEvent({ sourceId, payload, type, revenue, cost, eventAt }) {
  const pool = await getPool();
  await ensureSchema(pool);
  const campaignId = asUuid(payload.campaign_id);
  const channelId = asUuid(payload.channel_id);
  const productId = asUuid(payload.product_id);
  const customerId = asUuid(payload.customer_id);
  const customerEmail = typeof payload.customer_email === 'string' ? payload.customer_email.slice(0, 320) : '';
  const eventIso = eventAt.toISOString();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO telemetry_events (source_id, event_type, revenue, cost, campaign_id, channel_id, event_at, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       ON CONFLICT (source_id) DO NOTHING
       RETURNING source_id`,
      [sourceId, type, revenue, cost, payload.campaign_id || null, payload.channel_id || null, eventIso, JSON.stringify(payload)],
    );

    if (inserted.rowCount > 0) {
      await client.query(
        `INSERT INTO interactions
          (source_id, type, customer_id, product_id, campaign_id, channel_id, revenue, cost, date)
         SELECT $1, $2,
           COALESCE(
             CASE WHEN $3::uuid IS NOT NULL AND EXISTS (SELECT 1 FROM customers WHERE id = $3::uuid) THEN $3::uuid END,
             (SELECT id FROM customers WHERE lower(email) = lower(NULLIF($4, '')) ORDER BY created_at LIMIT 1)
           ),
           CASE WHEN $5::uuid IS NOT NULL AND EXISTS (SELECT 1 FROM products WHERE id = $5::uuid) THEN $5::uuid END,
           CASE WHEN $6::uuid IS NOT NULL AND EXISTS (SELECT 1 FROM campaigns WHERE id = $6::uuid) THEN $6::uuid END,
           CASE WHEN $7::uuid IS NOT NULL AND EXISTS (SELECT 1 FROM channels WHERE id = $7::uuid) THEN $7::uuid END,
           $8, $9, $10::timestamptz::date
         ON CONFLICT (source_id) DO NOTHING`,
        [sourceId, type, customerId, customerEmail, productId, campaignId, channelId, revenue, cost, eventIso],
      );
      if (campaignId && cost > 0) {
        await client.query('UPDATE campaigns SET spent = spent + $1, updated_at = now() WHERE id = $2::uuid', [cost, campaignId]);
      }
    }
    await client.query('COMMIT');
    return inserted.rowCount > 0;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { persistTelemetryEvent };
