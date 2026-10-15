# Enterprise Chit Fund Platform — Supabase, Render & Vercel Deployment Guide

## Supabase Credentials Summary

- **Supabase Project Reference ID**: `jwtjawjznyqqfywrsfcv`
- **Anon Public Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Direct Database Host**: `db.jwtjawjznyqqfywrsfcv.supabase.co`

---

## 1. Push Database Schema to Supabase

Run the following command in your terminal, replacing `[YOUR-DB-PASSWORD]` with the database password you created when creating your Supabase project:

```powershell
# Set your Supabase connection strings
$env:DATABASE_URL="postgresql://postgres.jwtjawjznyqqfywrsfcv:[YOUR-DB-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
$env:DIRECT_URL="postgresql://postgres:[YOUR-DB-PASSWORD]@db.jwtjawjznyqqfywrsfcv.supabase.co:5432/postgres"

cd backend
npx prisma db push
npm run prisma:seed
```

This will automatically create all 16 relational database tables inside your Supabase project and seed the default Super Admin, Manager, Field Officer, and 5 Lakh Chit Group!

---

## 2. Deploy Backend API on Render.com (100% Free)

1. Go to [render.com](https://render.com) and log in with your GitHub account `akshyat2003`.
2. Click **New +** -> **Web Service**.
3. Select your repository: `akshyat2003/chit-fund`.
4. Configure the Web Service:
   - **Name**: `chit-fund-backend`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npx prisma generate && npm run build`
   - **Start Command**: `npm start`
5. Click **Advanced** -> **Add Environment Variable**:
   - `DATABASE_URL`: `postgresql://postgres.jwtjawjznyqqfywrsfcv:[YOUR-DB-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true`
   - `DIRECT_URL`: `postgresql://postgres:[YOUR-DB-PASSWORD]@db.jwtjawjznyqqfywrsfcv.supabase.co:5432/postgres`
   - `JWT_SECRET`: `chitfund_super_secure_jwt_secret_key_2026!@#`
   - `NODE_ENV`: `production`
   - `PORT`: `5000`
6. Click **Create Web Service**. Render will deploy your API to a free HTTPS URL like:
   `https://chit-fund-backend.onrender.com`

---

## 3. Deploy Mobile / Web App on Vercel & Generate APK

### A. Web App / iOS PWA (Vercel — Free)
1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. Click **Add New** -> **Project** and select `akshyat2003/chit-fund`.
3. Set **Root Directory** to `mobile`.
4. Build command: `npx expo export:web`
5. Deploy! Vercel will provide your web app URL (e.g., `https://chit-fund.vercel.app`).

### B. Standalone Android APK (No Play Store)
Run:
```powershell
cd mobile
npm run build:apk
```
Download the resulting `.apk` direct link and send it directly to your users or field officers via WhatsApp or Google Drive. They can tap to install without needing Google Play Store!

---

## 4. Instant Over-The-Air (OTA) Updates (Zero Re-install)

When you add new screens, modules, or fix bugs, you **do not** need users to download a new `.apk`.

Run:
```powershell
cd mobile
npm run update -- -m "Added new loan module"
```
Or for a specific channel:
```powershell
npm run update:preview -- -m "Updated collections view"
```

The next time users open the installed ChitKart app, it checks for updates automatically, downloads the new modules, and updates seamlessly!
