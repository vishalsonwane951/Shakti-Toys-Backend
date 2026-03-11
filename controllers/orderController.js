import asyncHandler from 'express-async-handler';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Customer from '../models/Product.js';

/** Deduct stock — validates availability first, then saves each product */
async function deductStock(orderItems) {
  for (const item of orderItems) {
    const product = await Product.findById(item.product);
    if (!product) throw new Error(`Product not found: ${item.product}`);
    if (product.stock < item.quantity) {
      throw new Error(
        `Insufficient stock for "${product.name}" (available: ${product.stock})`
      );
    }
    product.stock -= item.quantity;
    await product.save();
  }
}

/** Restore stock — used on refund or failed payment */
async function restoreStock(orderItems) {
  for (const item of orderItems) {
    await Product.findByIdAndUpdate(item.product, {
      $inc: { stock: item.quantity },
    });
  }
}

/** Upsert walk-in customer record by phone or email */
async function upsertCustomer(name, phone, email, total) {
  if (!phone && !email) return null;
  let customer = await Customer.findOne(phone ? { phone } : { email });
  if (!customer) {
    customer = await Customer.create({ name: name || "Walk-in", phone, email });
  }
  customer.totalOrders += 1;
  customer.totalSpent += total;
  await customer.save();
  return customer._id;
}

/* ═══════════════════════════════════════════════════════════════
   ONLINE ORDER  (from existing app — kept intact)
   @POST /api/orders
═══════════════════════════════════════════════════════════════ */
export const createOrder = asyncHandler(async (req, res) => {
  const {
    orderItems, shippingAddress, paymentMethod,
    itemsPrice, taxPrice, shippingPrice, totalPrice,
    discountAmount, discountPercent,
  } = req.body;

  if (!orderItems?.length) {
    res.status(400); throw new Error("No order items");
  }

  // Validate & deduct stock
  for (const item of orderItems) {
    const product = await Product.findById(item.product);
    if (!product) {
      res.status(404); throw new Error(`Product not found: ${item.name}`);
    }
    if (product.stock < item.quantity) {
      res.status(400); throw new Error(`Insufficient stock for ${product.name}`);
    }
    await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } });
  }

 const order = await Order.create({
    user: req.user._id,
    orderItems,
    shippingAddress,
    paymentMethod,
    itemsPrice,
    taxPrice,
    shippingPrice,
    discountAmount: discountAmount || 0,
    discountPercent: discountPercent || 0,
    totalPrice,
    orderType: "online",
    paymentStatus: paymentMethod !== "COD" ? "SUCCESS" : "PENDING",
    isPaid: paymentMethod !== "COD",
    paidAt: paymentMethod !== "COD" ? Date.now() : undefined,
  });

  res.status(201).json(order);
});

/* ═══════════════════════════════════════════════════════════════
   OFFLINE / WALK-IN ORDER  (merged — best of both)
   @POST /api/orders/offline

   CASH / CARD  → stock deducted immediately, paymentStatus = SUCCESS
   OFFLINE_UPI  → stock held (not deducted), paymentStatus = PENDING
                  Frontend polls /payment-status every 3 s
                  Webhook fires → stock deducted → status = SUCCESS
═══════════════════════════════════════════════════════════════ */
export const createOfflineOrder = asyncHandler(async (req, res) => {
  const {
    orderItems, paymentMethod,
    itemsPrice, taxPrice, shippingPrice,
    discountAmount, discountPercent, totalPrice,
    customerName, customerPhone, customerEmail, notes,
  } = req.body;

  if (!orderItems?.length) {
    res.status(400); throw new Error("No order items");
  }

  const isUPI = paymentMethod === "OFFLINE_UPI";

  // CASH / CARD: validate & deduct stock immediately
  if (!isUPI) {
    await deductStock(orderItems);
  }

  // Upsert customer record
  const customerId = await upsertCustomer(
    customerName, customerPhone, customerEmail, totalPrice
  );

  const order = await Order.create({
    user: req.user._id,
    orderItems,
    paymentMethod: paymentMethod || "CASH",
    paymentStatus: isUPI ? "PENDING" : "SUCCESS",
    itemsPrice,
    taxPrice: taxPrice || 0,
    shippingPrice: shippingPrice || 0,
    discountAmount: discountAmount || 0,
    discountPercent: discountPercent || 0,
    totalPrice,
    orderType: "offline",
    customerName: customerName || "Walk-in Customer",
    customerPhone: customerPhone || "",
    customerEmail: customerEmail || "",
    customer: customerId,
    notes,
    // Legacy compat fields
    isPaid: !isUPI,
    paidAt: !isUPI ? Date.now() : undefined,
    status: !isUPI ? "completed" : "pending",
    deliveredAt: !isUPI ? Date.now() : undefined,
    createdBy: req.user._id,
  });

  res.status(201).json(order);
});

/* ═══════════════════════════════════════════════════════════════
   UPI PAYMENT STATUS POLL
   @GET /api/orders/:id/payment-status
   Polled by frontend UPI modal every 3 seconds.
═══════════════════════════════════════════════════════════════ */
export const getPaymentStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).select(
    "paymentStatus paymentMethod upiTransactionId paymentVerifiedAt totalPrice isPaid"
  );
  if (!order) { res.status(404); throw new Error("Order not found"); }

  res.json({
    orderId: order._id,
    paymentStatus: order.paymentStatus,   // PENDING | SUCCESS | FAILED
    paymentMethod: order.paymentMethod,
    upiTransactionId: order.upiTransactionId,
    paymentVerifiedAt: order.paymentVerifiedAt,
    totalPrice: order.totalPrice,
    isPaid: order.isPaid,
  });
});

/* ═══════════════════════════════════════════════════════════════
   MARK ORDER PAID  (admin manual override)
   @PUT /api/orders/:id/mark-paid
═══════════════════════════════════════════════════════════════ */
export const markOrderPaid = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) { res.status(404); throw new Error("Order not found"); }

  if (order.paymentStatus === "SUCCESS") {
    return res.json({ message: "Already paid", order });
  }

  // Deduct stock now if it was held for UPI
  if (order.paymentStatus === "PENDING") {
    await deductStock(order.orderItems);
  }

  order.paymentStatus = "SUCCESS";
  order.isPaid = true;
  order.paidAt = Date.now();
  order.status = "completed";
  order.deliveredAt = Date.now();
  order.upiTransactionId = req.body.transactionId || "MANUAL";
  order.paymentVerifiedAt = new Date();
  await order.save();

  res.json(order);
});

export const markOrderFailed = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  try {
    // Only update if not already failed
    if (order.paymentStatus === "FAILED") {
      return res.json({ message: "Order already failed", order });
    }

    // Optional: handle restocking only if implemented
    // if (order.paymentStatus === "PENDING") await restockItems(order.orderItems);

    order.paymentStatus = "FAILED";
    order.isPaid = false;
    order.status = "failed";
    order.failedAt = new Date();
    order.failureReason = req.body.reason || "Payment failed";

    await order.save();

    res.json({ message: "Order marked as failed", order });
  } catch (error) {
    console.error("Error in markOrderFailed:", error);
    res.status(500).json({ message: "Failed to mark order as failed", error: error.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   REFUND ORDER
   @PUT /api/orders/:id/refund
═══════════════════════════════════════════════════════════════ */
export const refundOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) { res.status(404); throw new Error("Order not found"); }
  if (order.isRefunded) { res.status(400); throw new Error("Already refunded"); }

  await restoreStock(order.orderItems);

  order.paymentStatus = "REFUNDED";
  order.isRefunded = true;
  order.refundNote = req.body.reason || "";
  order.status = "cancelled";
  order.cancelledAt = Date.now();
  await order.save();

  res.json(order);
});

/* ═══════════════════════════════════════════════════════════════
   UPDATE ORDER STATUS  (from existing app — kept intact)
   @PUT /api/orders/:id/status
═══════════════════════════════════════════════════════════════ */
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) { res.status(404); throw new Error("Order not found"); }

  order.status = req.body.status;

  if (req.body.status === "delivered" || req.body.status === "completed") {
    order.isPaid = true;
    order.paidAt = Date.now();
    order.deliveredAt = Date.now();
    order.paymentStatus = "SUCCESS";
  }
  if (req.body.status === "cancelled") {
    order.cancelledAt = Date.now();
  }

  await order.save();
  res.json(order);
});

/* ═══════════════════════════════════════════════════════════════
   MY ORDERS  (logged-in customer)
   @GET /api/orders/my
═══════════════════════════════════════════════════════════════ */
export const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id })
    .populate("orderItems.product", "name images")
    .sort({ createdAt: -1 });
  res.json(orders);
});


export const getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, orderType } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (orderType) filter.orderType = orderType;
    const total = await Order.countDocuments(filter);
    const orders = await Order.find(filter)
      .populate('user', 'name email')
      .populate('createdBy', 'name')
      .sort('-createdAt')
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));
    res.json({ orders, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
/* ═══════════════════════════════════════════════════════════════
   LIST ALL ORDERS  (admin — merged filters from both versions)
   @GET /api/orders
═══════════════════════════════════════════════════════════════ */
export const getOrders = asyncHandler(async (req, res) => {
  const {
    page = 1, limit = 20,
    status, orderType,
    paymentMethod, paymentStatus,
    from, to, search,
  } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (orderType) filter.orderType = orderType;
  if (paymentMethod) filter.paymentMethod = paymentMethod;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }
  if (search) {
    filter.$or = [
      { customerName: { $regex: search, $options: "i" } },
      { customerPhone: { $regex: search, $options: "i" } },
      { invoiceNumber: { $regex: search, $options: "i" } },
    ];
  }

  const total = await Order.countDocuments(filter);
  const orders = await Order.find(filter)
    .populate("user", "name email")
    .populate("createdBy", "name email")
    .sort({ createdAt: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit));

  res.json({ orders, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

/* ═══════════════════════════════════════════════════════════════
   SINGLE ORDER
   @GET /api/orders/:id
═══════════════════════════════════════════════════════════════ */
export const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate("user", "name email")
    .populate("createdBy", "name email")
    .populate("orderItems.product", "name sku images price");

  if (!order) { res.status(404); throw new Error("Order not found"); }

  // Non-admins can only see their own online orders
  const isOwner = order.user?._id?.toString() === req.user._id.toString();
  if (!isOwner && req.user.role !== "admin") {
    res.status(403); throw new Error("Not authorized");
  }

  res.json(order);
});

/* ═══════════════════════════════════════════════════════════════
   ADMIN STATS  (extended — combines both versions)
   @GET /api/orders/stats
═══════════════════════════════════════════════════════════════ */
export const getAdminStats = asyncHandler(async (req, res) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [
    totalOrders, pendingOrders, deliveredOrders, offlineOrders,
    todayOrders, recentOrders,
    totalRevenueAgg, monthlyRevenue, todayRevenueAgg,
    paymentBreakdown, topProducts,
  ] = await Promise.all([
    Order.countDocuments(),
    Order.countDocuments({ status: "pending" }),
    Order.countDocuments({ status: { $in: ["delivered", "completed"] } }),
    Order.countDocuments({ orderType: "offline" }),
    Order.countDocuments({ createdAt: { $gte: today, $lt: tomorrow }, paymentStatus: "SUCCESS" }),

    Order.find({ paymentStatus: "SUCCESS" })
      .populate("user", "name")
      .populate("createdBy", "name")
      .sort({ createdAt: -1 })
      .limit(5)
      .select("invoiceNumber customerName totalPrice paymentMethod orderType createdAt"),

    // Total revenue (non-cancelled, paid)
    Order.aggregate([
      { $match: { status: { $nin: ["cancelled"] }, paymentStatus: "SUCCESS" } },
      { $group: { _id: null, total: { $sum: "$totalPrice" } } },
    ]),

    // Monthly revenue — last 6 months
    Order.aggregate([
      {
        $match: {
          status: { $nin: ["cancelled"] },
          paymentStatus: "SUCCESS",
          createdAt: { $gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          revenue: { $sum: "$totalPrice" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // Today's revenue
    Order.aggregate([
      { $match: { createdAt: { $gte: today, $lt: tomorrow }, paymentStatus: "SUCCESS" } },
      { $group: { _id: null, total: { $sum: "$totalPrice" } } },
    ]),

    // Payment method breakdown (this month)
    Order.aggregate([
      { $match: { createdAt: { $gte: startMonth }, paymentStatus: "SUCCESS" } },
      { $group: { _id: "$paymentMethod", total: { $sum: "$totalPrice" }, count: { $sum: 1 } } },
    ]),

    // Top 5 products this month
    Order.aggregate([
      { $match: { createdAt: { $gte: startMonth }, paymentStatus: "SUCCESS" } },
      { $unwind: "$orderItems" },
      {
        $group: {
          _id: "$orderItems.product",
          name: { $first: "$orderItems.name" },
          totalQty: { $sum: "$orderItems.quantity" },
          totalRevenue: { $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] } },
        },
      },
      { $sort: { totalQty: -1 } },
      { $limit: 5 },
    ]),
  ]);

  res.json({
    totalOrders,
    totalRevenue: totalRevenueAgg[0]?.total || 0,
    todayRevenue: todayRevenueAgg[0]?.total || 0,
    todayOrders,
    pendingOrders,
    deliveredOrders,
    offlineOrders,
    recentOrders,
    monthlyRevenue,
    paymentBreakdown,
    topProducts,
  });
});

/* ═══════════════════════════════════════════════════════════════
   EXPORTS
═══════════════════════════════════════════════════════════════ */