// import asyncHandler from "express-async-handler";
// import crypto from 'crypto'
// import Order from '../models/Order.js'
// import Product from '../models/Product.js'


// /* ── Stock deduct helper ── */
// async function deductStock(orderItems) {
//   for (const item of orderItems) {
//     const product = await Product.findById(item.product);
//     if (product) {
//       product.stock = Math.max(0, product.stock - item.quantity);
//       await product.save();
//     }
//   }
// }

// // ─────────────────────────────────────────────────────────────
// //  @POST /api/payment/webhook
// //
// //  Generic UPI webhook handler.
// //  Supports Razorpay-style payload out of the box.
// //  Extend with your gateway's signature verification as needed.
// // ─────────────────────────────────────────────────────────────
// const upiWebhook = asyncHandler(async (req, res) => {
//   // ── Optional: verify Razorpay signature ──────────────────
//   // const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
//   // if (secret) {
//   //   const sig = req.headers["x-razorpay-signature"];
//   //   const body = JSON.stringify(req.body);
//   //   const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
//   //   if (sig !== expected) { return res.status(400).json({ message: "Invalid signature" }); }
//   // }

//   const payload = req.body;

//   // ── Normalise across gateway formats ─────────────────────
//   let orderId, status, transactionId, upiRef;

//   // Razorpay format
//   if (payload.event === "payment.captured" || payload.event === "payment.failed") {
//     const p = payload.payload?.payment?.entity || {};
//     orderId       = p.notes?.orderId || p.description;
//     status        = payload.event === "payment.captured" ? "SUCCESS" : "FAILED";
//     transactionId = p.id;
//     upiRef        = p.acquirer_data?.upi_transaction_id || "";
//   }
//   // Simple / custom gateway format
//   else {
//     orderId       = payload.orderId || payload.order_id;
//     status        = (payload.status || payload.txnStatus || "").toUpperCase();
//     transactionId = payload.transactionId || payload.txnId || "";
//     upiRef        = payload.upiRef || payload.rrn || "";
//   }

//   if (!orderId) {
//     return res.status(400).json({ message: "orderId missing in webhook payload" });
//   }

//   const order = await Order.findById(orderId);
//   if (!order) return res.status(404).json({ message: "Order not found" });

//   // Prevent double-processing
//   if (order.paymentStatus === "SUCCESS") {
//     return res.json({ message: "Already processed", paymentStatus: "SUCCESS" });
//   }

//   const success = ["SUCCESS", "CREDIT", "COMPLETED", "CAPTURED"].includes(status);
//   const failed  = ["FAILED", "FAILURE", "DECLINED", "EXPIRED"].includes(status);

//   if (success) {
//     await deductStock(order.orderItems);
//     order.paymentStatus     = "SUCCESS";
//     order.upiTransactionId  = transactionId;
//     order.upiRef            = upiRef;
//     order.paymentVerifiedAt = new Date();
//     console.log(`✅  UPI SUCCESS — Order ${orderId} | txn: ${transactionId}`);
//   } else if (failed) {
//     order.paymentStatus = "FAILED";
//     console.log(`❌  UPI FAILED  — Order ${orderId}`);
//   } else {
//     return res.json({ message: "Status PENDING, ignored" });
//   }

//   await order.save();
//   res.json({ message: "Webhook processed", paymentStatus: order.paymentStatus });
// });

// // ─────────────────────────────────────────────────────────────
// //  @POST /api/payment/manual-verify   (admin: manually mark paid)
// // ─────────────────────────────────────────────────────────────
// const manualVerify = asyncHandler(async (req, res) => {
//   const { orderId, transactionId, note } = req.body;
//   const order = await Order.findById(orderId);
//   if (!order) { res.status(404); throw new Error("Order not found"); }
//   if (order.paymentStatus === "SUCCESS") {
//     return res.json({ message: "Already paid", paymentStatus: "SUCCESS" });
//   }
//   if (order.paymentStatus === "PENDING") {
//     await deductStock(order.orderItems);
//   }
//   order.paymentStatus     = "SUCCESS";
//   order.upiTransactionId  = transactionId || "MANUAL";
//   order.upiRef            = note || "";
//   order.paymentVerifiedAt = new Date();
//   await order.save();
//   res.json({ message: "Order marked as paid", order });
// });

// module.exports = { upiWebhook, manualVerify };
