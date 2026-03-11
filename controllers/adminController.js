import User from '../models/User.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';

export const getUsers = async (req, res) => {
  try {
    const users = await User.find({ role: 'user' }).select('-password').sort('-createdAt');
    res.json(users);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

export const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const { name, email, phone, isActive, password } = req.body;
    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (isActive !== undefined) user.isActive = isActive;
    if (password) user.password = password;
    await user.save();
    res.json({ _id: user._id, name: user.name, email: user.email, isActive: user.isActive });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

export const deleteUser = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'User disabled' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

export const getDashboardStats = async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments({ isActive: true });
    const totalUsers = await User.countDocuments({ role: 'user' });
    const totalOrders = await Order.countDocuments();
    const revenue = await Order.aggregate([{ $match: { status: { $ne: 'cancelled' } } }, { $group: { _id: null, total: { $sum: '$totalPrice' } } }]);
    const lowStock = await Product.find({ isActive: true, stock: { $lte: 5 } }).select('name stock').limit(10);
    res.json({ totalProducts, totalUsers, totalOrders, totalRevenue: revenue[0]?.total || 0, lowStock });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
