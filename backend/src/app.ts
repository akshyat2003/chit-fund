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

// Healthcheck
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'OK', service: 'Enterprise Chit Fund Platform API', timestamp: new Date() });
});

// Authentication Routes (JWT + Cookies + Sessions + OTP)
app.post('/api/v1/auth/login', authController.login);
app.post('/api/v1/auth/logout', authenticateToken, authController.logout);
app.post('/api/v1/auth/forgot-password', authController.forgotPassword);
app.post('/api/v1/auth/verify-otp', authController.verifyOtp);
app.post('/api/v1/auth/reset-password', authController.resetPassword);
app.get('/api/v1/auth/me', authenticateToken, authController.me);

// Dashboard Statistics Route
app.get('/api/v1/reports/dashboard', authenticateToken, reportController.getDashboardStats);

// Subscriber Routes
app.get('/api/v1/subscribers', authenticateToken, subscriberController.listSubscribers);
app.post('/api/v1/subscribers', authenticateToken, requireRoles('SUPER_ADMIN', 'MANAGER'), subscriberController.createSubscriber);
app.get('/api/v1/subscribers/:id', authenticateToken, subscriberController.getSubscriberById);

// Chit Group Routes
app.get('/api/v1/chit-groups', authenticateToken, chitGroupController.listChitGroups);
app.post('/api/v1/chit-groups', authenticateToken, requireRoles('SUPER_ADMIN', 'MANAGER'), chitGroupController.createChitGroup);
app.post('/api/v1/chit-groups/enroll', authenticateToken, requireRoles('SUPER_ADMIN', 'MANAGER'), chitGroupController.enrollSubscriber);
app.get('/api/v1/chit-groups/:id', authenticateToken, chitGroupController.getChitGroupDetails);

// Collection & Payment Routes
app.post('/api/v1/collections/pay', authenticateToken, collectionController.recordPayment);
app.get('/api/v1/collections/transactions', authenticateToken, collectionController.listTransactions);
app.get('/api/v1/collections/receipts/:receiptNo', authenticateToken, collectionController.getReceiptDetails);

// Auction Routes
app.post('/api/v1/auctions/confirm', authenticateToken, requireRoles('SUPER_ADMIN', 'MANAGER'), auctionController.createAuctionResult);
app.get('/api/v1/auctions/group/:groupId', authenticateToken, auctionController.getGroupAuctions);

// Payout Routes
app.get('/api/v1/payouts', authenticateToken, requireRoles('SUPER_ADMIN', 'MANAGER'), payoutController.listPayouts);
app.patch('/api/v1/payouts/:id/status', authenticateToken, requireRoles('SUPER_ADMIN', 'MANAGER'), payoutController.updatePayoutStatus);

// Reconciliation & Handover Routes
app.post('/api/v1/reconciliation/handover', authenticateToken, reconciliationController.submitCashHandover);
app.get('/api/v1/reconciliation/handovers', authenticateToken, reconciliationController.listHandovers);
app.patch('/api/v1/reconciliation/handovers/:id/verify', authenticateToken, requireRoles('SUPER_ADMIN', 'MANAGER'), reconciliationController.verifyHandover);

// Global Error Handler
app.use(errorHandler);

export default app;
