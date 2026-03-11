import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/shakti-shop';

const categories = [
  { name: 'Toy Cars', slug: 'toy-cars', description: 'Die-cast and plastic toy cars', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400' },
  { name: 'Remote Control Cars', slug: 'rc-cars', description: 'High-speed RC cars', image: 'https://images.unsplash.com/photo-1594787317440-a7b4f7e90bc0?w=400' },
  { name: 'Toy Bikes', slug: 'toy-bikes', description: 'Toy motorcycles and bikes', image: 'https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=400' },
  { name: 'Electronics', slug: 'electronics', description: 'Small gadgets & electronics', image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400' },
  { name: 'Gadgets', slug: 'gadgets', description: 'Cool tech gadgets', image: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400' },
  { name: 'Batteries & Accessories', slug: 'batteries', description: 'Power & accessories', image: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400' }
];

const seedDB = async () => {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  await User.deleteMany();
  await Category.deleteMany();
  await Product.deleteMany();

  const adminUser = await User.create({ name: 'Admin', email: 'admin@shakti.com', password: 'admin123', role: 'admin' });
  await User.create({ name: 'Test User', email: 'user@shakti.com', password: 'user123', role: 'user' });

  const cats = await Category.insertMany(categories);
  console.log('Categories seeded');

  const catMap = {};
  cats.forEach(c => catMap[c.slug] = c._id);

  const products = [
    { name: 'Ferrari Toy Car Red', description: 'Premium die-cast Ferrari replica with detailed interior', price: 299, originalPrice: 499, category: catMap['toy-cars'], images: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600'], stock: 50, brand: 'HotWheels', rating: 4.5, numReviews: 23, isFeatured: true, discount: 40, tags: ['ferrari', 'diecast', 'red car'], specifications: [{key:'Scale', value:'1:24'},{key:'Material', value:'Die-cast Metal'},{key:'Age', value:'3+'}] },
    { name: 'Lamborghini Scale Model', description: 'Authentic Lamborghini Aventador die-cast model', price: 450, originalPrice: 600, category: catMap['toy-cars'], images: ['https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=600'], stock: 30, brand: 'Maisto', rating: 4.7, numReviews: 15, isFeatured: true, discount: 25, tags: ['lamborghini', 'sports car', 'diecast'] },
    { name: 'RC Racing Car Pro', description: 'High-speed remote control racing car with 2.4GHz', price: 1299, originalPrice: 1800, category: catMap['rc-cars'], images: ['https://images.unsplash.com/photo-1594787317440-a7b4f7e90bc0?w=600'], stock: 20, brand: 'Traxxas', rating: 4.8, numReviews: 42, isFeatured: true, discount: 28, tags: ['remote control', 'racing', 'fast'] },
    { name: 'Off-Road RC Monster Truck', description: '4WD monster truck with shock absorbers', price: 999, originalPrice: 1400, category: catMap['rc-cars'], images: ['https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=600'], stock: 15, brand: 'Redcat', rating: 4.6, numReviews: 28, isFeatured: false, discount: 29, tags: ['monster truck', '4wd', 'offroad'] },
    { name: 'Kawasaki Ninja Toy Bike', description: 'Detailed Kawasaki Ninja replica for collectors', price: 350, originalPrice: 499, category: catMap['toy-bikes'], images: ['https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=600'], stock: 40, brand: 'Maisto', rating: 4.4, numReviews: 11, isFeatured: false, discount: 30, tags: ['kawasaki', 'motorcycle', 'ninja'] },
    { name: 'Bluetooth Speaker Mini', description: 'Portable waterproof Bluetooth 5.0 speaker', price: 799, originalPrice: 1200, category: catMap['electronics'], images: ['https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600'], stock: 60, brand: 'JBL', rating: 4.5, numReviews: 55, isFeatured: true, discount: 33, tags: ['bluetooth', 'speaker', 'wireless'] },
    { name: 'Smart LED Strip Lights', description: 'WiFi controlled RGB LED strip 5m with app control', price: 599, originalPrice: 899, category: catMap['electronics'], images: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600'], stock: 80, brand: 'Philips', rating: 4.3, numReviews: 33, isFeatured: false, discount: 33, tags: ['led', 'smart home', 'lights'] },
    { name: 'Digital Pocket Scale', description: 'High precision 500g digital pocket scale', price: 199, originalPrice: 299, category: catMap['gadgets'], images: ['https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600'], stock: 100, brand: 'Generic', rating: 4.1, numReviews: 19, isFeatured: false, discount: 34, tags: ['scale', 'digital', 'precision'] },
    { name: 'AA Batteries Pack 20', description: 'Long-lasting alkaline AA batteries, 20 pack', price: 249, originalPrice: 349, category: catMap['batteries'], images: ['https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600'], stock: 200, brand: 'Duracell', rating: 4.6, numReviews: 88, isFeatured: false, discount: 29, tags: ['batteries', 'aa', 'alkaline'] },
    { name: 'USB-C Fast Charger 65W', description: 'GaN 65W USB-C fast charger for all devices', price: 899, originalPrice: 1299, category: catMap['gadgets'], images: ['https://images.unsplash.com/photo-1583394838336-acd977736f90?w=600'], stock: 45, brand: 'Anker', rating: 4.7, numReviews: 64, isFeatured: true, discount: 31, tags: ['charger', 'usb-c', 'fast charging'] },
    { name: 'Police Car Toy Set', description: 'Friction powered police car with lights and sound', price: 149, originalPrice: 249, category: catMap['toy-cars'], images: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600'], stock: 75, brand: 'Centy', rating: 4.2, numReviews: 30, isFeatured: false, discount: 40, tags: ['police', 'sound', 'kids'] },
    { name: 'RC Helicopter Indoor', description: 'Easy to fly 3-channel RC helicopter for indoors', price: 749, originalPrice: 1099, category: catMap['rc-cars'], images: ['https://images.unsplash.com/photo-1580797536232-2a69e773c69b?w=600'], stock: 25, brand: 'Syma', rating: 4.3, numReviews: 20, isFeatured: false, discount: 32, tags: ['helicopter', 'indoor', 'rc'] }
  ];

  await Product.insertMany(products);
  console.log('Products seeded');
  console.log('✅ Database seeded!\nAdmin: admin@shakti.com / admin123\nUser: user@shakti.com / user123');
  process.exit();
};

seedDB().catch(err => { console.error(err); process.exit(1); });
