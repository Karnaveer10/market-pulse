const { getPool, ensureSchema } = require('./database');

function response(statusCode, body, origin = '') {
  const origins = new Set((process.env.ALLOWED_ORIGINS || 'http://localhost:8080').split(',').map((value) => value.trim()));
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': origins.has(origin) ? origin : 'null',
      'Access-Control-Allow-Headers': 'Content-Type',
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
  if (!event.body || Buffer.byteLength(event.body) > 8192) return response(400, { error: 'Customer details are required' }, origin);

  let input;
  try {
    input = JSON.parse(event.body);
  } catch {
    return response(400, { error: 'Request body must be valid JSON' }, origin);
  }
  const name = typeof input.name === 'string' ? input.name.trim().slice(0, 200) : '';
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase().slice(0, 320) : '';
  const phone = typeof input.phone === 'string' ? input.phone.trim().slice(0, 40) : '';
  const location = typeof input.location === 'string' ? input.location.trim().slice(0, 200) : '';
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return response(400, { error: 'A name and valid email address are required' }, origin);
  }

  try {
    const pool = await getPool();
    await ensureSchema(pool);
    const existing = await pool.query(
      'SELECT id, name, email FROM customers WHERE lower(email) = $1 ORDER BY created_at LIMIT 1',
      [email],
    );
    if (existing.rowCount > 0) return response(200, existing.rows[0], origin);
    const created = await pool.query(
      `INSERT INTO customers (name, email, phones, location)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email`,
      [name, email, phone ? [phone] : [], location],
    );
    return response(201, created.rows[0], origin);
  } catch (error) {
    console.error('Customer registration failed', error.message);
    return response(503, { error: 'Customer service is temporarily unavailable' }, origin);
  }
};
