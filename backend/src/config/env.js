import dotenv from 'dotenv';

dotenv.config();

const required = ['DATABASE_URL', 'JWT_SECRET'];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  seedAdminUsername: process.env.SEED_ADMIN_USERNAME || 'admin',
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || 'Admin@12345',
  seedAdminName: process.env.SEED_ADMIN_NAME || 'System Admin',
};
