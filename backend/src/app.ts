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

const app = express();

app.use(cors({
  origin: (origin, callback) => callback(null, true),
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());
app.use(morgan('dev'));

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

// User Account Administration (FR-AUTH-007, FR-AUTH-013, FR-AUTH-014)
router.get('/auth/users', authenticateToken, requireRoles('SUPER_ADMIN', 'MANAGER'), authController.listUsers);
router.post('/auth/users', authenticateToken, requireRoles('SUPER_ADMIN', 'MANAGER'), authController.createUser);
router.patch('/auth/users/:id/status', authenticateToken, requireRoles('SUPER_ADMIN', 'MANAGER'), authController.updateUserStatus);
router.post('/auth/users/:id/revoke-sessions', authenticateToken, requireRoles('SUPER_ADMIN', 'MANAGER'), authController.revokeUserSessions);

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

// Mount router on multiple common paths for seamless local and Vercel serverless routing
app.use('/api/v1', router);
app.use('/v1', router);
app.use('/api', router);
app.use('/', router);

// Global Error Handler
app.use(errorHandler);

export default app;
