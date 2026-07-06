import { Router } from "express";
import { query } from "../db/pool.js";

const router = Router();

const collectionDefs = [
  {
    slug: "luxury-dining",
    title: "Best luxury dining places",
    subtitle: "Restaurants with elegant interiors, premium menus, and memorable dining.",
    sort: "rating",
    image: "https://source.unsplash.com/1400x520/?luxury,dining,restaurant",
  },
  {
    slug: "insta-worthy",
    title: "Insta-worthy spots",
    subtitle: "Beautiful cafes and restaurants made for good food and good photos.",
    sort: "promoted",
    image: "https://source.unsplash.com/1400x520/?cafe,interior,restaurant",
  },
  {
    slug: "party-places",
    title: "Lit party places",
    subtitle: "Lively restaurants, pubs, and night-out favorites near you.",
    sort: "rating",
    image: "https://source.unsplash.com/1400x520/?bar,party,restaurant",
  },
  {
    slug: "local-legends",
    title: "Local legends",
    subtitle: "Popular neighborhood restaurants customers keep coming back to.",
    sort: "delivery",
    image: "https://source.unsplash.com/1400x520/?indian,food,restaurant",
  },
];

function restaurantSelect() {
  return `
    SELECT
      r.id, r.name, r.description, r.image_url, r.address,
      r.latitude, r.longitude, r.price_level, r.cost_for_two,
      r.rating, r.delivery_time_min, r.supports_delivery,
      r.supports_pickup, r.supports_dine_in, r.is_promoted,
      c.state AS state_name, c.name AS city_name,
      GROUP_CONCAT(DISTINCT cu.name ORDER BY cu.name SEPARATOR ', ') AS cuisines
    FROM restaurants r
    JOIN cities c ON c.id = r.city_id
    LEFT JOIN restaurant_cuisines rc ON rc.restaurant_id = r.id
    LEFT JOIN cuisines cu ON cu.id = rc.cuisine_id
  `;
}

function buildWhere(req) {
  const where = [];
  const params = [];
  if (req.query.cityId) {
    where.push("r.city_id = ?");
    params.push(Number(req.query.cityId));
  }
  if (req.query.state) {
    where.push("c.state = ?");
    params.push(String(req.query.state));
  }
  if (req.query.serviceMode === "delivery") where.push("r.supports_delivery = 1");
  if (req.query.serviceMode === "pickup") where.push("r.supports_pickup = 1");
  if (req.query.serviceMode === "dine_in") where.push("r.supports_dine_in = 1");
  return { where, params };
}

router.get("/", async (req, res, next) => {
  try {
    const { where, params } = buildWhere(req);
    const rows = await query(
      `${restaurantSelect()}
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       GROUP BY r.id
       ORDER BY r.rating DESC, r.is_promoted DESC
       LIMIT 12`,
      params
    );

    res.json(
      collectionDefs.map((collection, index) => ({
        ...collection,
        count: Math.max(rows.length, 0),
        image: rows[index]?.image_url || collection.image,
        restaurantId: rows[index]?.id || null,
      }))
    );
  } catch (err) {
    next(err);
  }
});

router.get("/:slug", async (req, res, next) => {
  try {
    const collection = collectionDefs.find((item) => item.slug === req.params.slug);
    if (!collection) return res.status(404).json({ error: "Collection not found." });

    const { where, params } = buildWhere(req);
    const orderBy =
      collection.sort === "delivery"
        ? "r.delivery_time_min ASC, r.rating DESC"
        : collection.sort === "promoted"
          ? "r.is_promoted DESC, r.rating DESC"
          : "r.rating DESC, r.cost_for_two DESC";

    const restaurants = await query(
      `${restaurantSelect()}
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       GROUP BY r.id
       ORDER BY ${orderBy}
       LIMIT 48`,
      params
    );

    res.json({
      ...collection,
      count: restaurants.length,
      image: restaurants[0]?.image_url || collection.image,
      restaurants,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
