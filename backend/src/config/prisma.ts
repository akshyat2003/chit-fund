import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// Supabase Connection Pooler (IPv4 compatible for Vercel Serverless Functions)
const SUPABASE_POOLER_URL = "postgresql://postgres.jwtjawjznyqqfywrsfcv:bTgpoQ1wlOiATEB2@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = SUPABASE_POOLER_URL;
}
if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL = SUPABASE_POOLER_URL;
}

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || SUPABASE_POOLER_URL,
    },
  },
});
