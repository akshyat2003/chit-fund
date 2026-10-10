import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const SUPABASE_DB_URL = "postgresql://postgres:bTgpoQ1wlOiATEB2@db.jwtjawjznyqqfywrsfcv.supabase.co:5432/postgres";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = SUPABASE_DB_URL;
}
if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL = SUPABASE_DB_URL;
}

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || SUPABASE_DB_URL,
    },
  },
});
