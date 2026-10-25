const { getPool, ensureSchema } = require('./database');

function response(statusCode, body, origin = '') {
  const origins = new Set((process.env.ALLOWED_ORIGINS || 'http://localhost:8080').split(',').map((value) => value.trim()));
  const allowOrigin = origins.has(origin) ? origin : 'null';
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Content-Type': 'application/json',
      'Vary': 'Origin',
    },
    body: statusCode === 204 ? '' : JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  if (event.httpMethod === 'OPTIONS') return response(204, {}, origin);
  if (event.httpMethod && event.httpMethod !== 'GET') return response(405, { error: 'Method not allowed' }, origin);
  if (!event.requestContext?.authorizer?.claims?.sub) return response(401, { error: 'Sign-in is required' }, origin);

  try {
    const pool = await getPool();
    await ensureSchema(pool);
    const [summary, channels, campaigns, daily, recent] = await Promise.all([
      pool.query(`
        SELECT COUNT(*)::int AS interactions,
          COALESCE(SUM(revenue), 0)::float8 AS revenue,
          COALESCE(SUM(cost), 0)::float8 AS cost,
          COUNT(*) FILTER (WHERE type = 'visit')::int AS visits,
          COUNT(*) FILTER (WHERE type = 'click')::int AS clicks,
          COUNT(*) FILTER (WHERE type = 'purchase')::int AS purchases,
          (SELECT COUNT(*)::int FROM campaigns) AS campaigns,
          (SELECT COUNT(*)::int FROM customers) AS customers
        FROM interactions
      `),
      pool.query(`
        SELECT COALESCE(c.name, 'Unassigned') AS channel,
          COUNT(i.id)::int AS interactions,
          COALESCE(SUM(i.revenue), 0)::float8 AS revenue,
          COUNT(i.id) FILTER (WHERE i.type = 'visit')::int AS visits,
          COUNT(i.id) FILTER (WHERE i.type = 'click')::int AS clicks,
          COUNT(i.id) FILTER (WHERE i.type = 'purchase')::int AS purchases
        FROM interactions i LEFT JOIN channels c ON c.id = i.channel_id
        GROUP BY c.name ORDER BY revenue DESC LIMIT 20
      `),
      pool.query(`
        SELECT COALESCE(c.name, 'Unassigned') AS campaign,
          COUNT(i.id)::int AS interactions,
          COALESCE(SUM(i.revenue), 0)::float8 AS revenue,
          COALESCE(SUM(i.cost), 0)::float8 AS cost
        FROM interactions i LEFT JOIN campaigns c ON c.id = i.campaign_id
        GROUP BY c.name ORDER BY revenue DESC LIMIT 20
      `),
      pool.query(`
        SELECT to_char(date, 'YYYY-MM-DD') AS date,
          COALESCE(SUM(revenue), 0)::float8 AS revenue,
          COUNT(*)::int AS interactions
        FROM interactions
        WHERE date >= current_date - interval '30 days'
        GROUP BY date ORDER BY date
      `),
      pool.query(`
        SELECT i.id, i.source_id, i.type, i.revenue::float8 AS revenue,
          i.date, i.customer_id, i.product_id, i.campaign_id, i.channel_id,
          cu.name AS customer_name, p.name AS product_name,
          ca.name AS campaign_name, ch.name AS channel_name
        FROM interactions i
          LEFT JOIN customers cu ON cu.id = i.customer_id
          LEFT JOIN products p ON p.id = i.product_id
          LEFT JOIN campaigns ca ON ca.id = i.campaign_id
          LEFT JOIN channels ch ON ch.id = i.channel_id
        ORDER BY i.date DESC, i.created_at DESC LIMIT 500
      `),
    ]);
    return response(200, {
      summary: summary.rows[0],
      channels: channels.rows,
      campaigns: campaigns.rows,
      daily: daily.rows,
      recent: recent.rows,
    }, origin);
  } catch (error) {
    console.error('Analytics query failed', error.message);
    return response(503, { error: 'Analytics service is temporarily unavailable' }, origin);
  }
};
