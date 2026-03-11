import { Router } from 'express';
import { getUsers, updateUser, deleteUser, getDashboardStats } from '../controllers/adminController.js';
import { protect, admin } from '../middleware/auth.js';

const router = Router();

router.get('/stats', protect, admin, getDashboardStats);
router.get('/users', protect, admin, getUsers);
router.put('/users/:id', protect, admin, updateUser);
router.delete('/users/:id', protect, admin, deleteUser);

export default router;
