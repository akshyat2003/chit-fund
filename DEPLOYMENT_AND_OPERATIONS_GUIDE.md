# Enterprise Chit Fund Platform — Deployment & Operational Guide

## 1. Best 100% Free Production Deployment Options

Since app store / play store publishing is **not required**, the system can be deployed and distributed completely free of cost.

---

### A. Backend & Database Free Hosting Options

#### **Option 1: Render.com (Recommended for instant setup)**
- **API Server**: Host `backend` as a **Web Service** on Render.com (Free Tier).
- **Database**: Connect a free MySQL database host (such as **Aiven for MySQL**, **PlanetScale**, **TiDB Cloud**, or **Clever Cloud Free MySQL**).
- **Deployment**: Connect your GitHub repository to Render. It auto-deploys every time code is updated.

#### **Option 2: Oracle Cloud Infrastructure (OCI) Always Free VM (Best 24/7 Production Choice)**
- **Specs**: 4 Ampere ARM CPUs, 24 GB RAM, 200 GB Storage — **100% FREE FOREVER**.
- **Setup**: Run `docker-compose up -d` on the free instance.
- **Why it's superior**: It never goes to sleep, handles thousands of daily transactions easily, and costs ₹0 forever.

---

### B. Mobile & Web App Free Distribution (No App Store / Play Store Required)

#### **1. Direct Android APK Generation (For Android Smartphones)**
You can build a standalone `.apk` file using Expo EAS Build (Free Tier):
```bash
cd mobile
npx eas build -p android --profile preview
```
- **Distribution**: This command outputs a direct `.apk` download link (e.g., `https://expo.dev/artifacts/eas/...apk`).
- **Field Staff Installation**: Share this download link via WhatsApp or Email to field officers & managers. They simply tap to install the APK directly on their Android phones!

#### **2. Web Application / iOS Access (Progressive Web App - PWA)**
Export the React Native web build:
```bash
cd mobile
npx expo export:web
```
- **Free Web Hosting**: Deploy the generated `web-build/` directory for 100% free on **Vercel**, **Netlify**, or **Cloudflare Pages**.
- **iOS & Desktop Installation**: Open the website link on an iPhone/Safari or Chrome and tap **"Add to Home Screen"**. It installs as a full-screen mobile web app!

---

## 2. Default System Logins & Credentials

The system has been seeded with initial active operational accounts:

| Role | Username / Phone | Password | Access Privileges |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `superadmin` / `9999999999` | `admin123` | System-wide platform metrics, multi-company overview, audit logs |
| **Branch Manager** | `manager1` / `9888888888` | `manager123` | Branch operations, subscriber KYC, group creation, auctions, payouts |
| **Field Officer** | `staff1` / `9777777777` | `staff123` | Assigned subscriber collections, digital receipts, daily cash handover |

---

## 3. Local Development & Running Instructions

### Backend API Server
```bash
cd backend
npm run dev
```
- **Server Address**: `http://localhost:5000`
- **Health Check**: `http://localhost:5000/api/v1/health`

### Database Seeding
To reset or re-seed sample subscribers and chit groups:
```bash
cd backend
npm run prisma:seed
```

---

## 4. Key Financial Formulas Implemented

1. **Foreman Commission**:
   $$\text{Foreman Commission} = \left(\frac{\text{Foreman Commission \%}}{100}\right) \times \text{Chit Value}$$
2. **Total Distributable Dividend**:
   $$\text{Total Dividend} = \text{Winning Bid Discount} - \text{Foreman Commission}$$
3. **Member Dividend Credit**:
   $$\text{Dividend Per Member} = \frac{\text{Total Dividend}}{\text{Max Members}}$$
4. **Net Monthly Due**:
   $$\text{Net Due Amount} = \text{Scheduled Installment} - \text{Dividend Per Member}$$
