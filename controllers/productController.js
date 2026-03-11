import Product from '../models/Product.js';

export const getProducts = async (req, res) => {
  try {
    const { category, search, minPrice, maxPrice, sort, page = 1, limit = 12, featured } = req.query;
    const filter = { isActive: true };
    if (category) filter.category = category;
    if (featured) filter.isFeatured = true;
    if (search) filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { tags: { $in: [new RegExp(search, 'i')] } }
    ];
    if (minPrice || maxPrice) filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);

    const sortObj = sort === 'price_asc' ? { price: 1 } : sort === 'price_desc' ? { price: -1 } : sort === 'rating' ? { rating: -1 } : { createdAt: -1 };

    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter).populate('category', 'name slug').sort(sortObj).limit(Number(limit)).skip((Number(page) - 1) * Number(limit));
    res.json({ products, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

export const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('category', 'name slug').populate('reviews.user', 'name avatar');
    if (!product || !product.isActive) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

export const createProduct = async (req, res) => {
  try {
    const images = req.files ? req.files.map(f => `/uploads/${f.filename}`) : [];
    const specs = req.body.specifications ? JSON.parse(req.body.specifications) : [];
    const tags = req.body.tags ? JSON.parse(req.body.tags) : [];
    const product = await Product.create({ ...req.body, images, specifications: specs, tags });
    res.status(201).json(product);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const newImages = req.files ? req.files.map(f => `/uploads/${f.filename}`) : [];
    const existingImages = req.body.existingImages ? JSON.parse(req.body.existingImages) : product.images;
    const specs = req.body.specifications ? JSON.parse(req.body.specifications) : product.specifications;
    const tags = req.body.tags ? JSON.parse(req.body.tags) : product.tags;
    Object.assign(product, { ...req.body, images: [...existingImages, ...newImages], specifications: specs, tags });
    await product.save();
    res.json(product);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

export const deleteProduct = async (req, res) => {
  try {
    await Product.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Product deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

export const addReview = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const alreadyReviewed = product.reviews.find(r => r.user.toString() === req.user._id.toString());
    if (alreadyReviewed) return res.status(400).json({ message: 'Already reviewed' });
    const { rating, comment } = req.body;
    product.reviews.push({ user: req.user._id, name: req.user.name, rating: Number(rating), comment });
    product.numReviews = product.reviews.length;
    product.rating = product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length;
    await product.save();
    res.status(201).json({ message: 'Review added' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
