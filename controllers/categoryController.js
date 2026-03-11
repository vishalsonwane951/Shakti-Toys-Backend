import Category from '../models/Category.js';

export const getCategories = async (req, res) => {
  try {
    const cats = await Category.find({ isActive: true });
    res.json(cats);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

export const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    const image = req.file ? `/uploads/${req.file.filename}` : '';
    const cat = await Category.create({ name, slug, description, image });
    res.status(201).json(cat);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

export const updateCategory = async (req, res) => {
  try {
    const cat = await Category.findById(req.params.id);
    if (!cat) return res.status(404).json({ message: 'Category not found' });
    const { name, description } = req.body;
    if (name) { cat.name = name; cat.slug = name.toLowerCase().replace(/\s+/g, '-'); }
    if (description) cat.description = description;
    if (req.file) cat.image = `/uploads/${req.file.filename}`;
    await cat.save();
    res.json(cat);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

export const deleteCategory = async (req, res) => {
  try {
    await Category.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Category deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
