import User from '../models/User.js';
import jwt from 'jsonwebtoken';

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '30d' });

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'All fields required' });
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already registered' });
    const user = await User.create({ name, email, password });
    res.status(201).json({ _id: user._id, name: user.name, email: user.email, role: user.role, token: generateToken(user._id) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) return res.status(401).json({ message: 'Invalid credentials' });
    if (!user.isActive) return res.status(401).json({ message: 'Account disabled' });
    res.json({ _id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar, token: generateToken(user._id) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password').populate('wishlist', 'name price images');
    res.json(user);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

export const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const { name, phone, password } = req.body;
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (password) user.password = password;
    if (req.file) user.avatar = `/uploads/${req.file.filename}`;
    await user.save();
    res.json({ _id: user._id, name: user.name, email: user.email, phone: user.phone, avatar: user.avatar, role: user.role, addresses: user.addresses });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

export const addAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const { label, street, city, state, pincode, isDefault } = req.body;
    if (isDefault) user.addresses.forEach(a => a.isDefault = false);
    user.addresses.push({ label, street, city, state, pincode, isDefault });
    await user.save();
    res.json(user.addresses);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

export const updateAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const addr = user.addresses.id(req.params.addressId);
    if (!addr) return res.status(404).json({ message: 'Address not found' });
    if (req.body.isDefault) user.addresses.forEach(a => a.isDefault = false);
    Object.assign(addr, req.body);
    await user.save();
    res.json(user.addresses);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

export const toggleWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const idx = user.wishlist.indexOf(req.params.productId);
    if (idx > -1) user.wishlist.splice(idx, 1);
    else user.wishlist.push(req.params.productId);
    await user.save();
    res.json({ wishlist: user.wishlist });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
