const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const secrets = new SecretsManagerClient({});
let poolPromise;
let schemaPromise;

async function getDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (!process.env.DB_SECRET_ARN) throw new Error('DB_SECRET_ARN is not configured');
  const response = await secrets.send(new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN }));
  if (!response.SecretString) throw new Error('Database secret has no SecretString');
  const value = JSON.parse(response.SecretString);
  const host = value.host || process.env.DB_HOST;
  const port = Number(value.port || process.env.DB_PORT || 5432);
  const dbname = value.dbname || value.database || process.env.DB_NAME || 'marketpulse';
  const username = value.username;
  const password = value.password;
  if (!host || !username || !password) throw new Error('Database secret is missing required fields');
  return `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(dbname)}`;
}

async function getPool() {
  if (!poolPromise) {
    poolPromise = getDatabaseUrl().then((connectionString) => new Pool({
      connectionString,
      max: 2,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
    })).catch((error) => {
      poolPromise = undefined;
      throw error;
    });
  }
  return poolPromise;
}

async function ensureSchema(pool) {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS products (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          category TEXT NOT NULL DEFAULT 'Software',
          price NUMERIC(10,2) NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS campaigns (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          budget NUMERIC(12,2) NOT NULL DEFAULT 0,
          spent NUMERIC(12,2) NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
          product_id UUID REFERENCES products(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS customers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          location TEXT NOT NULL DEFAULT '',
          phones TEXT[] NOT NULL DEFAULT '{}',
          joined_at DATE NOT NULL DEFAULT CURRENT_DATE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS channels (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'online' CHECK (type IN ('online', 'offline')),
          platform TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS interactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          source_id TEXT UNIQUE,
          type TEXT NOT NULL CHECK (type IN ('visit', 'click', 'lead', 'cart_add', 'purchase')),
          customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
          product_id UUID REFERENCES products(id) ON DELETE SET NULL,
          campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
          channel_id UUID REFERENCES channels(id) ON DELETE SET NULL,
          revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
          cost NUMERIC(12,2) NOT NULL DEFAULT 0,
          date DATE NOT NULL DEFAULT CURRENT_DATE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS telemetry_events (
          source_id TEXT PRIMARY KEY,
          event_type TEXT NOT NULL,
          revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
          cost NUMERIC(12,2) NOT NULL DEFAULT 0,
          campaign_id TEXT,
          channel_id TEXT,
          event_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          payload JSONB NOT NULL
        )
      `);
      await pool.query('ALTER TABLE telemetry_events ADD COLUMN IF NOT EXISTS event_at TIMESTAMPTZ NOT NULL DEFAULT now()');
      await pool.query('CREATE INDEX IF NOT EXISTS telemetry_events_event_at_idx ON telemetry_events (event_at DESC)');
      await pool.query('CREATE INDEX IF NOT EXISTS interactions_date_idx ON interactions (date DESC)');
      await pool.query('CREATE INDEX IF NOT EXISTS interactions_campaign_idx ON interactions (campaign_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS interactions_channel_idx ON interactions (channel_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS customers_email_idx ON customers (lower(email))');
    })().catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  return schemaPromise;
}

module.exports = { getPool, ensureSchema };
