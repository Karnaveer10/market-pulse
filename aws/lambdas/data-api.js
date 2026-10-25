const { getPool, ensureSchema } = require('./database');

const ORIGIN_ENV = 'http://localhost:8080';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ENTITIES = {
  products: {
    table: 'products',
    order: 'created_at DESC',
    columns: ['name', 'category', 'price', 'status'],
  },
  campaigns: {
    table: 'campaigns',
    order: 'created_at DESC',
    columns: ['name', 'start_date', 'end_date', 'budget', 'spent', 'status', 'product_id'],
  },
  customers: {
    table: 'customers',
    order: 'created_at DESC',
    columns: ['name', 'email', 'location', 'phones', 'joined_at'],
  },
  channels: {
    table: 'channels',
    order: 'type ASC, created_at DESC',
    columns: ['name', 'type', 'platform'],
  },
};

function response(statusCode, body, origin = '') {
  const origins = new Set((process.env.ALLOWED_ORIGINS || ORIGIN_ENV).split(',').map((value) => value.trim()));
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': origins.has(origin) ? origin : 'null',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
      'Content-Type': 'application/json',
      'Vary': 'Origin',
    },
    body: statusCode === 204 ? '' : JSON.stringify(body),
  };
}

function parseBody(event) {
  if (typeof event.body !== 'string') throw new Error('A JSON request body is required');
  let value;
  try {
    value = JSON.parse(event.body);
  } catch {
    throw new Error('Request body must be valid JSON');
  }
  const rows = Array.isArray(value) ? value : [value];
  if (rows.length < 1 || rows.length > 200 || rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) {
    throw new Error('Request must contain between 1 and 200 JSON objects');
  }
  return rows;
}

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const method = event.httpMethod || event.requestContext?.http?.method || '';
  if (method === 'OPTIONS') return response(204, {}, origin);
  const entity = ENTITIES[event.pathParameters?.entity];
  if (!entity) return response(404, { error: 'Unknown data collection' }, origin);
  if (!['GET', 'POST', 'DELETE'].includes(method)) return response(405, { error: 'Method not allowed' }, origin);
  const publicCatalogRead = method === 'GET' && event.resource?.startsWith('/catalog/');
  if (publicCatalogRead && entity.table === 'customers') return response(404, { error: 'Unknown catalog collection' }, origin);
  if (!publicCatalogRead && !event.requestContext?.authorizer?.claims?.sub) {
    return response(401, { error: 'Sign-in is required' }, origin);
  }

  try {
    const pool = await getPool();
    await ensureSchema(pool);
    if (method === 'GET') {
      const result = await pool.query(`SELECT * FROM ${entity.table} ORDER BY ${entity.order} LIMIT 1000`);
      return response(200, result.rows, origin);
    }

    if (method === 'DELETE') {
      if (entity.table !== 'products') return response(405, { error: 'Delete is not supported for this collection' }, origin);
      const id = event.queryStringParameters?.id || '';
      if (!UUID_PATTERN.test(id)) return response(400, { error: 'A valid record ID is required' }, origin);
      const result = await pool.query('DELETE FROM products WHERE id = $1::uuid RETURNING id', [id]);
      if (result.rowCount === 0) return response(404, { error: 'Record was not found' }, origin);
      return response(200, { deleted: true, id }, origin);
    }

    const rows = parseBody(event);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const inserted = [];
      for (const row of rows) {
        const columns = entity.columns.filter((column) => Object.prototype.hasOwnProperty.call(row, column));
        if (columns.length === 0) throw new Error('Each record must contain at least one supported field');
        const values = columns.map((column) => row[column]);
        const placeholders = values.map((_, index) => `$${index + 1}`);
        const result = await client.query(
          `INSERT INTO ${entity.table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
          values,
        );
        inserted.push(result.rows[0]);
      }
      await client.query('COMMIT');
      return response(201, Array.isArray(JSON.parse(event.body)) ? inserted : inserted[0], origin);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      if (error.message.includes('violates') || error.message.includes('invalid input')) {
        return response(400, { error: 'The record contains invalid or conflicting data' }, origin);
      }
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (/valid JSON|request body|JSON objects|supported field/.test(error.message)) {
      return response(400, { error: error.message }, origin);
    }
    console.error('AWS data request failed', error.message);
    return response(503, { error: 'Data service is temporarily unavailable' }, origin);
  }
};
