import { Router } from 'express';
import { register, login, getProfile, updateProfile, addAddress, updateAddress, toggleWishlist } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import upload from '../middleware/upload.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, upload.single('avatar'), updateProfile);
router.post('/addresses', protect, addAddress);
router.put('/addresses/:addressId', protect, updateAddress);
router.post('/wishlist/:productId', protect, toggleWishlist);

export default router;
