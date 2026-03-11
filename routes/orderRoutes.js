import { Router } from 'express';
import {
    createOrder,
    createOfflineOrder,
    getMyOrders,
    getOrder,
    getAllOrders,
    updateOrderStatus,
    getAdminStats,
    getPaymentStatus,
    markOrderFailed,
    refundOrder,
} from '../controllers/orderController.js';
import { protect, admin } from '../middleware/auth.js';

const router = Router();

// ── Online order ─────────────────────────────────────────────
router.post('/', protect, createOrder);

// ── Offline / POS order ──────────────────────────────────────
router.post('/offline', protect, admin, createOfflineOrder);

// ── Customer routes ──────────────────────────────────────────
router.get('/my', protect, getMyOrders);

// ── Admin routes ─────────────────────────────────────────────
router.get('/admin/all', protect, admin, getAllOrders);
router.get('/admin/stats', protect, admin, getAdminStats);

// ── Single order ─────────────────────────────────────────────
router.get('/:id', protect, getOrder);

// ── Status & payment ─────────────────────────────────────────
router.put('/:id/status', protect, admin, updateOrderStatus);
router.put('/:id/mark-paid', protect, admin, markOrderFailed);
router.put('/:id/mark-failed',protect,admin, markOrderFailed)
router.put('/:id/refund', protect, admin, refundOrder);
router.get('/:id/payment-status', protect, getPaymentStatus);

export default router;

