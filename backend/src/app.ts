import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { authenticateToken, requireRoles } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';

import * as authController from './modules/auth/auth.controller.js';
import * as subscriberController from './modules/subscribers/subscriber.controller.js';
import * as chitGroupController from './modules/chit-groups/chitGroup.controller.js';
import * as collectionController from './modules/collections/collection.controller.js';
import * as auctionController from './modules/auctions/auction.controller.js';
import * as payoutController from './modules/payouts/payout.controller.js';
import * as reconciliationController from './modules/reconciliation/reconciliation.controller.js';
import * as reportController from './modules/reports/report.controller.js';
import * as superAdminController from './modules/super-admin/superAdmin.controller.js';

const app = express();

app.use(cors({
  origin: (origin, callback) => callback(null, true),
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());
// In-memory buffer of recent API requests for Super Admin observability
export interface ApiLogEntry {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  ip: string;
  userAgent?: string;
}

const MAX_API_LOGS = 250;
export const apiLogsBuffer: ApiLogEntry[] = [];

// API Traffic & Request Interceptor for Super Admin System Observability
app.use((req, res, next) => {
  const start = Date.now();
  const originalEnd = res.end;

  res.end = function (...args: any[]) {
    const durationMs = Date.now() - start;
    const url = req.originalUrl || req.url;

    // Filter out internal polling/health checks to prevent clutter
    if (!url.includes('/super-admin/api-logs') && !url.includes('/health')) {
      const entry: ApiLogEntry = {
        id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        method: req.method,
        path: url,
        status: res.statusCode,
        durationMs,
        ip: (req.headers['x-forwarded-for'] as string) || req.ip || req.socket.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] ? String(req.headers['user-agent']).slice(0, 100) : undefined,
      };
      apiLogsBuffer.unshift(entry);
      if (apiLogsBuffer.length > MAX_API_LOGS) {
        apiLogsBuffer.pop();
      }
    }
    return (originalEnd as any).apply(res, args);
  };
  next();
});

// Core Router for ChitKart API
const router = express.Router();

// Healthcheck
router.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'ChitKart Management Platform API', timestamp: new Date() });
});

// Authentication Routes (JWT + Cookies + Sessions + OTP)
router.post('/auth/login', authController.login);
router.post('/auth/logout', authenticateToken, authController.logout);
router.post('/auth/refresh-token', authController.refreshToken);
router.post('/auth/change-password', authenticateToken, authController.changePassword);
router.post('/auth/forgot-password', authController.forgotPassword);
router.post('/auth/verify-otp', authController.verifyOtp);
router.post('/auth/reset-password', authController.resetPassword);
router.get('/auth/me', authenticateToken, authController.me);

// User Account Administration (FR-AUTH-007, FR-AUTH-013, FR-AUTH-014, SA-04)
router.get('/auth/users', authenticateToken, requireRoles('SUPER_ADMIN', 'MANAGER'), authController.listUsers);
router.post('/auth/users', authenticateToken, requireRoles('SUPER_ADMIN', 'MANAGER'), authController.createUser);
router.put('/auth/users/:id', authenticateToken, requireRoles('SUPER_ADMIN', 'MANAGER'), authController.updateUser);
router.patch('/auth/users/:id/status', authenticateToken, requireRoles('SUPER_ADMIN', 'MANAGER'), authController.updateUserStatus);
router.delete('/auth/users/:id', authenticateToken, requireRoles('SUPER_ADMIN'), authController.deleteUser);
router.post('/auth/users/:id/revoke-sessions', authenticateToken, requireRoles('SUPER_ADMIN', 'MANAGER'), authController.revokeUserSessions);

// Super Admin User Credential Management Aliases (SA-04)
router.get('/super-admin/users', authenticateToken, requireRoles('SUPER_ADMIN'), authController.listUsers);
router.post('/super-admin/users', authenticateToken, requireRoles('SUPER_ADMIN'), authController.createUser);
router.put('/super-admin/users/:id', authenticateToken, requireRoles('SUPER_ADMIN'), authController.updateUser);
router.delete('/super-admin/users/:id', authenticateToken, requireRoles('SUPER_ADMIN'), authController.deleteUser);

// Dashboard Statistics Route
router.get('/reports/dashboard', authenticateToken, reportController.getDashboardStats);

// Subscriber Routes
router.get('/subscribers', authenticateToken, subscriberController.listSubscribers);
router.post('/subscribers', authenticateToken, requireRoles('SUPER_ADMIN', 'MANAGER'), subscriberController.createSubscriber);
router.get('/subscribers/:id', authenticateToken, subscriberController.getSubscriberById);

// Chit Group Routes
router.get('/chit-groups', authenticateToken, chitGroupController.listChitGroups);
router.post('/chit-groups', authenticateToken, requireRoles('SUPER_ADMIN', 'MANAGER'), chitGroupController.createChitGroup);
router.post('/chit-groups/enroll', authenticateToken, requireRoles('SUPER_ADMIN', 'MANAGER'), chitGroupController.enrollSubscriber);
router.get('/chit-groups/:id', authenticateToken, chitGroupController.getChitGroupDetails);

// Collection & Payment Routes
router.post('/collections/pay', authenticateToken, collectionController.recordPayment);
router.get('/collections/transactions', authenticateToken, collectionController.listTransactions);
router.get('/collections/receipts/:receiptNo', authenticateToken, collectionController.getReceiptDetails);

// Auction Routes
router.post('/auctions/confirm', authenticateToken, requireRoles('SUPER_ADMIN', 'MANAGER'), auctionController.createAuctionResult);
router.get('/auctions/group/:groupId', authenticateToken, auctionController.getGroupAuctions);

// Payout Routes
router.get('/payouts', authenticateToken, requireRoles('SUPER_ADMIN', 'MANAGER'), payoutController.listPayouts);
router.patch('/payouts/:id/status', authenticateToken, requireRoles('SUPER_ADMIN', 'MANAGER'), payoutController.updatePayoutStatus);

// Reconciliation & Handover Routes
router.post('/reconciliation/handover', authenticateToken, reconciliationController.submitCashHandover);
router.get('/reconciliation/handovers', authenticateToken, reconciliationController.listHandovers);
router.patch('/reconciliation/handovers/:id/verify', authenticateToken, requireRoles('SUPER_ADMIN', 'MANAGER'), reconciliationController.verifyHandover);

// Super Admin Module Routes (FR-SA-001 through FR-SA-018)
router.get('/super-admin/dashboard', authenticateToken, requireRoles('SUPER_ADMIN'), superAdminController.getPlatformDashboard);
router.get('/super-admin/companies', authenticateToken, requireRoles('SUPER_ADMIN'), superAdminController.listCompanies);
router.post('/super-admin/companies', authenticateToken, requireRoles('SUPER_ADMIN'), superAdminController.createCompany);
router.get('/super-admin/companies/:id', authenticateToken, requireRoles('SUPER_ADMIN'), superAdminController.getCompanyDetails);
router.patch('/super-admin/companies/:id/status', authenticateToken, requireRoles('SUPER_ADMIN'), superAdminController.updateCompanyStatus);
router.put('/super-admin/companies/:id/settings', authenticateToken, requireRoles('SUPER_ADMIN'), superAdminController.updateCompanySettings);
router.get('/super-admin/subscriptions', authenticateToken, requireRoles('SUPER_ADMIN'), superAdminController.listSubscriptionPlans);
router.get('/super-admin/audit-logs', authenticateToken, requireRoles('SUPER_ADMIN'), superAdminController.getAuditLogs);
router.get('/super-admin/api-logs', authenticateToken, requireRoles('SUPER_ADMIN'), (req, res) => {
  res.json({ success: true, count: apiLogsBuffer.length, data: apiLogsBuffer });
});
router.delete('/super-admin/api-logs', authenticateToken, requireRoles('SUPER_ADMIN'), (req, res) => {
  apiLogsBuffer.length = 0;
  res.json({ success: true, message: 'API request logs buffer cleared successfully' });
});
router.get('/super-admin/system-health', authenticateToken, requireRoles('SUPER_ADMIN'), superAdminController.getSystemHealth);
router.get('/super-admin/platform-settings', authenticateToken, requireRoles('SUPER_ADMIN'), superAdminController.getPlatformSettings);
router.post('/super-admin/support-access', authenticateToken, requireRoles('SUPER_ADMIN'), superAdminController.requestSupportAccess);

// Super Admin Credentials Management (SA-04, SA-05)
router.get('/super-admin/admins', authenticateToken, requireRoles('SUPER_ADMIN'), superAdminController.listSuperAdmins);
router.post('/super-admin/admins', authenticateToken, requireRoles('SUPER_ADMIN'), superAdminController.createSuperAdmin);

// SA-03: Branch Setup & Management
router.get('/super-admin/branches', authenticateToken, requireRoles('SUPER_ADMIN'), superAdminController.listBranches);
router.post('/super-admin/branches', authenticateToken, requireRoles('SUPER_ADMIN'), superAdminController.createBranch);
router.patch('/super-admin/branches/:id', authenticateToken, requireRoles('SUPER_ADMIN'), superAdminController.updateBranch);
router.get('/branches', authenticateToken, superAdminController.listBranches);

// SA-05, SA-06: Role & Permission Management
router.get('/super-admin/roles', authenticateToken, requireRoles('SUPER_ADMIN'), superAdminController.listRolesAndPermissions);
router.put('/super-admin/roles/:role/permissions', authenticateToken, requireRoles('SUPER_ADMIN'), superAdminController.updateRolePermissions);

// SA-12: Compliance Settings
router.get('/super-admin/compliance', authenticateToken, requireRoles('SUPER_ADMIN'), superAdminController.getComplianceRecords);
router.post('/super-admin/compliance', authenticateToken, requireRoles('SUPER_ADMIN'), superAdminController.createComplianceRecord);

// SA-13: Integration Configuration
router.get('/super-admin/integrations', authenticateToken, requireRoles('SUPER_ADMIN'), superAdminController.getIntegrations);
router.put('/super-admin/integrations', authenticateToken, requireRoles('SUPER_ADMIN'), superAdminController.updateIntegrations);

// SA-15: Backup Management
router.get('/super-admin/backups', authenticateToken, requireRoles('SUPER_ADMIN'), superAdminController.getBackups);
router.post('/super-admin/backups/trigger', authenticateToken, requireRoles('SUPER_ADMIN'), superAdminController.triggerManualBackup);

// SA-16, SA-17: Data Import & Export
router.post('/super-admin/import', authenticateToken, requireRoles('SUPER_ADMIN'), superAdminController.importData);
router.get('/super-admin/export/:entity', authenticateToken, requireRoles('SUPER_ADMIN'), superAdminController.exportData);

// SA-19, SA-20: Financial Periods & Archival Policy
router.get('/super-admin/financial-periods', authenticateToken, requireRoles('SUPER_ADMIN'), superAdminController.getFinancialPeriods);
router.post('/super-admin/financial-periods/close', authenticateToken, requireRoles('SUPER_ADMIN'), superAdminController.closeFinancialPeriod);
router.post('/super-admin/financial-periods/reopen', authenticateToken, requireRoles('SUPER_ADMIN'), superAdminController.reopenFinancialPeriod);
router.get('/super-admin/archival-policy', authenticateToken, requireRoles('SUPER_ADMIN'), superAdminController.getArchivalPolicy);

// SA-21, SA-22: Multi-Branch Oversight & Exception Management
router.get('/super-admin/exceptions', authenticateToken, requireRoles('SUPER_ADMIN'), superAdminController.getMultiBranchExceptions);

// Financial Record Immutability Enforcement (FR-SA-018)
router.delete('/collections/transactions/:id', authenticateToken, superAdminController.rejectFinancialRecordMutation);
router.put('/collections/transactions/:id', authenticateToken, superAdminController.rejectFinancialRecordMutation);
router.patch('/collections/transactions/:id', authenticateToken, superAdminController.rejectFinancialRecordMutation);

// Mount router on multiple common paths for seamless local and Vercel serverless routing
app.use('/api/v1', router);
app.use('/v1', router);
app.use('/api', router);
app.use('/', router);

// Global Error Handler
app.use(errorHandler);

export default app;
