import pg from 'pg';
import { env } from './env.js';

const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  ssl: env.nodeEnv === 'production' ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error', err);
});

export const query = (text, params) => pool.query(text, params);

export default pool;
