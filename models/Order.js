import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  orderItems: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    image: String,
    price: Number,
    quantity: Number
  }],
  shippingAddress: {
    name: String,
    phone: String,
    street: String,
    city: String,
    state: String,
    pincode: String
  },
  paymentMethod: { 
    type: String, 
    enum: ['UPI', 'UPI_SCANNER', 'CARD', 'COD', 'CASH', 'OFFLINE_CARD', 'OFFLINE_UPI'], 
    default: 'COD' 
  },
  paymentResult: {
    id: String,
    status: String,
    updateTime: String,
    transactionId: String
  },
  itemsPrice: { type: Number, required: true },
  taxPrice: { type: Number, default: 0 },
  shippingPrice: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  discountPercent: { type: Number, default: 0 },
  totalPrice: { type: Number, required: true },
  isPaid: { type: Boolean, default: false },
  paidAt: Date,
  orderType: { type: String, enum: ['online', 'offline'], default: 'online' },
  customerName: { type: String },
  customerPhone: { type: String },
  customerEmail: { type: String },
  invoiceNumber: { type: String, unique: true, sparse: true },
  notes: { type: String },
  status: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'completed', 'failed'], // added 'failed'
    default: 'pending'
  },
  deliveredAt: Date,
  cancelledAt: Date,
  failedAt: Date,            // NEW field for markFailed
  failureReason: String,     // NEW field for markFailed
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Auto-generate invoice number before save
orderSchema.pre('save', async function(next) {
  if (!this.invoiceNumber) {
    const prefix = this.orderType === 'offline' ? 'INV-OFF' : 'INV-ONL';
    const count = await mongoose.model('Order').countDocuments({ orderType: this.orderType });
    this.invoiceNumber = `${prefix}-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

export default mongoose.model('Order', orderSchema);