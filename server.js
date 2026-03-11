import dotenv from "dotenv";
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
const app = express();
connectDB();


const whitelist = [
  'http://localhost:3000',
  'http://localhost:5173',                          // ✅ Add Vite dev port
  'https://shaktitoyss.netlify.app',
  /https:\/\/[a-z0-9-]+--shaktitoyss\.netlify\.app/ // ✅ Allow ALL Netlify preview URLs
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    // ✅ Check both strings and regex patterns
    const allowed = whitelist.some(w => 
      typeof w === 'string' ? w === origin : w.test(origin)
    );

    if (allowed) callback(null, true);
    else callback(new Error(`CORS policy: origin ${origin} not allowed`));
  },
  credentials: true
}));

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'OK', name: 'Shakti Shop API' }));

app.use((err, req, res, next) => {
  const code = err.status || 500;
  res.status(code).json({ message: err.message || 'Server Error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
