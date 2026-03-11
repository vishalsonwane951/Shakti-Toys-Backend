import { Router } from 'express';
import { getAllUsers, getUser, updateUser, deleteUser, toggleWishlist, getWishlist } from '../controllers/userController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', protect, admin, getAllUsers);
router.get('/wishlist', protect, getWishlist);
router.put('/wishlist/:productId', protect, toggleWishlist);
router.get('/:id', protect, admin, getUser);
router.put('/:id', protect, admin, updateUser);
router.delete('/:id', protect, admin, deleteUser);

export default router;
