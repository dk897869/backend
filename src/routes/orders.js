import { Router } from "express";
import { pool, query } from "../db/pool.js";

const router = Router();

const VALID_PAYMENT_METHODS = ["card", "upi", "netbanking", "cod", "cash", "stripe"];
const VALID_SERVICE_MODES = ["delivery", "pickup", "dine_in"];

// Helper to check if table exists
const tableExists = async (tableName) => {
  try {
    await query(`SELECT 1 FROM ${tableName} LIMIT 1`);
    return true;
  } catch (err) {
    return false;
  }
};

/**
 * POST /api/orders
 * Body: {
 *   restaurantId, customerName, customerPhone, deliveryAddress,
 *   serviceMode, paymentMethod, paymentReference, items: [{ menuItemId, quantity }]
 * }
 * Validates items against the DB, computes totals server-side, and stores the order.
 */
router.post("/", async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    // Check if required tables exist
    const ordersExist = await tableExists("orders");
    const orderItemsExist = await tableExists("order_items");
    
    if (!ordersExist || !orderItemsExist) {
      return res.status(503).json({ 
        error: "Order system is not fully set up. Please run database migrations." 
      });
    }

    const {
      restaurantId,
      customerName,
      customerPhone,
      deliveryAddress,
      serviceMode = "delivery",
      paymentMethod,
      paymentReference,
      items,
    } = req.body || {};

    if (!restaurantId || !customerName || !customerPhone || !deliveryAddress) {
      return res.status(400).json({ error: "Missing required customer or restaurant fields." });
    }
    if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ error: "Invalid payment method." });
    }
    if (!VALID_SERVICE_MODES.includes(serviceMode)) {
      return res.status(400).json({ error: "Invalid order mode." });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Order must contain at least one item." });
    }

    const [restaurant] = await query(
      `SELECT supports_delivery, supports_pickup, supports_dine_in
       FROM restaurants WHERE id = ? LIMIT 1`,
      [Number(restaurantId)]
    );
    if (!restaurant) return res.status(404).json({ error: "Restaurant not found." });
    if (serviceMode === "delivery" && !restaurant.supports_delivery) {
      return res.status(400).json({ error: "This restaurant does not support delivery." });
    }
    if (serviceMode === "pickup" && !restaurant.supports_pickup) {
      return res.status(400).json({ error: "This restaurant does not support pickup." });
    }
    if (serviceMode === "dine_in" && !restaurant.supports_dine_in) {
      return res.status(400).json({ error: "This restaurant does not support dine in." });
    }

    // Fetch authoritative prices from the DB for the requested items.
    const itemIds = items.map((i) => Number(i.menuItemId)).filter((x) => !Number.isNaN(x));
    if (itemIds.length === 0) {
      return res.status(400).json({ error: "No valid items in the order." });
    }

    const placeholders = itemIds.map(() => "?").join(",");
    const dbItems = await query(
      `SELECT id, name, price FROM menu_items WHERE id IN (${placeholders}) AND restaurant_id = ?`,
      [...itemIds, Number(restaurantId)]
    );

    const priceMap = new Map(dbItems.map((it) => [it.id, it]));

    let subtotal = 0;
    const lineItems = [];
    for (const item of items) {
      const dbItem = priceMap.get(Number(item.menuItemId));
      if (!dbItem) {
        return res
          .status(400)
          .json({ error: `Item ${item.menuItemId} not found for this restaurant.` });
      }
      const qty = Math.max(1, Number(item.quantity) || 1);
      const lineTotal = Number(dbItem.price) * qty;
      subtotal += lineTotal;
      lineItems.push({
        menuItemId: dbItem.id,
        itemName: dbItem.name,
        unitPrice: Number(dbItem.price),
        quantity: qty,
        lineTotal,
      });
    }

    const deliveryFee = serviceMode === "delivery" && subtotal <= 500 ? 40 : 0;
    const taxes = Math.round(subtotal * 0.05 * 100) / 100;
    const total = Math.round((subtotal + deliveryFee + taxes) * 100) / 100;

    // COD stays pending; everything else is treated as paid (mock payment).
    const paymentStatus = ["cod", "cash"].includes(paymentMethod) ? "pending" : "paid";

    await conn.beginTransaction();

    const [orderRes] = await conn.execute(
      `INSERT INTO orders
        (restaurant_id, user_id, customer_name, customer_phone, delivery_address, service_mode,
         payment_method, payment_status, payment_provider, payment_reference, subtotal, delivery_fee, taxes, total, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'placed')`,
      [
        Number(restaurantId),
        req.user?.id || null,
        customerName,
        customerPhone,
        deliveryAddress,
        serviceMode,
        paymentMethod,
        paymentStatus,
        paymentMethod === "stripe" ? "stripe" : paymentMethod,
        paymentReference || null,
        subtotal,
        deliveryFee,
        taxes,
        total,
      ]
    );
    const orderId = orderRes.insertId;

    for (const li of lineItems) {
      await conn.execute(
        `INSERT INTO order_items (order_id, menu_item_id, item_name, unit_price, quantity, line_total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, li.menuItemId, li.itemName, li.unitPrice, li.quantity, li.lineTotal]
      );
    }

    await conn.commit();

    res.status(201).json({
      id: orderId,
      restaurantId: Number(restaurantId),
      customerName,
      serviceMode,
      paymentMethod,
      paymentStatus,
      paymentReference: paymentReference || null,
      subtotal,
      deliveryFee,
      taxes,
      total,
      status: "placed",
      items: lineItems,
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

router.post("/payment-intent", async (req, res, next) => {
  try {
    const amount = Math.round(Number(req.body?.amount || 0) * 100);
    const currency = String(req.body?.currency || "inr").toLowerCase();
    if (!amount || amount < 100) {
      return res.status(400).json({ error: "A valid amount is required." });
    }

    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret) {
      return res.json({
        provider: "stripe",
        mock: true,
        clientSecret: `pi_mock_${Date.now()}_secret_local`,
        paymentReference: `mock_stripe_${Date.now()}`,
      });
    }

    const body = new URLSearchParams({
      amount: String(amount),
      currency,
      "automatic_payment_methods[enabled]": "true",
    });
    const response = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(502).json({ error: data?.error?.message || "Stripe payment failed." });
    }

    res.json({
      provider: "stripe",
      mock: false,
      clientSecret: data.client_secret,
      paymentReference: data.id,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/orders/:id  -> fetch a single order with its items.
 */
router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    
    // Check if orders table exists
    const ordersExist = await tableExists("orders");
    if (!ordersExist) {
      return res.status(503).json({ error: "Order system is not set up yet." });
    }

    const [order] = await query(
      `SELECT o.*, r.name AS restaurant_name
       FROM orders o JOIN restaurants r ON r.id = o.restaurant_id
       WHERE o.id = ?`,
      [id]
    );
    if (!order) return res.status(404).json({ error: "Order not found" });

    const items = await query(
      "SELECT item_name, unit_price, quantity, line_total FROM order_items WHERE order_id = ?",
      [id]
    );
    res.json({ ...order, items });
  } catch (err) {
    next(err);
  }
});

export default router;