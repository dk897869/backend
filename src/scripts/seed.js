import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

/**
 * Seeds the database with cities, cuisines, restaurants, menu items and a few reviews.
 * Safe to run multiple times: it clears the relevant tables first.
 */

const cities = [
  { name: "Bengaluru", state: "Karnataka", latitude: 12.9716, longitude: 77.5946 },
  { name: "Mumbai", state: "Maharashtra", latitude: 19.076, longitude: 72.8777 },
  { name: "Delhi", state: "Delhi", latitude: 28.7041, longitude: 77.1025 },
  { name: "Hyderabad", state: "Telangana", latitude: 17.385, longitude: 78.4867 },
  { name: "Chennai", state: "Tamil Nadu", latitude: 13.0827, longitude: 80.2707 },
  { name: "Pune", state: "Maharashtra", latitude: 18.5204, longitude: 73.8567 },
  { name: "Ahmedabad", state: "Gujarat", latitude: 23.0225, longitude: 72.5714 },
  { name: "Jaipur", state: "Rajasthan", latitude: 26.9124, longitude: 75.7873 },
  { name: "Lucknow", state: "Uttar Pradesh", latitude: 26.8467, longitude: 80.9462 },
  { name: "Kolkata", state: "West Bengal", latitude: 22.5726, longitude: 88.3639 },
  { name: "Chandigarh", state: "Chandigarh", latitude: 30.7333, longitude: 76.7794 },
  { name: "Amritsar", state: "Punjab", latitude: 31.634, longitude: 74.8723 },
  { name: "Ludhiana", state: "Punjab", latitude: 30.901, longitude: 75.8573 },
  { name: "Gurugram", state: "Haryana", latitude: 28.4595, longitude: 77.0266 },
  { name: "Noida", state: "Uttar Pradesh", latitude: 28.5355, longitude: 77.391 },
  { name: "Indore", state: "Madhya Pradesh", latitude: 22.7196, longitude: 75.8577 },
  { name: "Bhopal", state: "Madhya Pradesh", latitude: 23.2599, longitude: 77.4126 },
  { name: "Patna", state: "Bihar", latitude: 25.5941, longitude: 85.1376 },
  { name: "Ranchi", state: "Jharkhand", latitude: 23.3441, longitude: 85.3096 },
  { name: "Bhubaneswar", state: "Odisha", latitude: 20.2961, longitude: 85.8245 },
  { name: "Guwahati", state: "Assam", latitude: 26.1445, longitude: 91.7362 },
  { name: "Kochi", state: "Kerala", latitude: 9.9312, longitude: 76.2673 },
  { name: "Thiruvananthapuram", state: "Kerala", latitude: 8.5241, longitude: 76.9366 },
  { name: "Coimbatore", state: "Tamil Nadu", latitude: 11.0168, longitude: 76.9558 },
  { name: "Mysuru", state: "Karnataka", latitude: 12.2958, longitude: 76.6394 },
  { name: "Visakhapatnam", state: "Andhra Pradesh", latitude: 17.6868, longitude: 83.2185 },
  { name: "Vijayawada", state: "Andhra Pradesh", latitude: 16.5062, longitude: 80.648 },
  { name: "Panaji", state: "Goa", latitude: 15.4909, longitude: 73.8278 },
  { name: "Raipur", state: "Chhattisgarh", latitude: 21.2514, longitude: 81.6296 },
  { name: "Dehradun", state: "Uttarakhand", latitude: 30.3165, longitude: 78.0322 },
  { name: "Shimla", state: "Himachal Pradesh", latitude: 31.1048, longitude: 77.1734 },
  { name: "Srinagar", state: "Jammu and Kashmir", latitude: 34.0837, longitude: 74.7973 },
  { name: "Gangtok", state: "Sikkim", latitude: 27.3314, longitude: 88.6138 },
  { name: "Shillong", state: "Meghalaya", latitude: 25.5788, longitude: 91.8933 },
  { name: "Aizawl", state: "Mizoram", latitude: 23.7271, longitude: 92.7176 },
  { name: "Imphal", state: "Manipur", latitude: 24.817, longitude: 93.9368 },
  { name: "Agartala", state: "Tripura", latitude: 23.8315, longitude: 91.2868 },
  { name: "Itanagar", state: "Arunachal Pradesh", latitude: 27.0844, longitude: 93.6053 },
  { name: "Kohima", state: "Nagaland", latitude: 25.6751, longitude: 94.1086 },
];

const cuisines = [
  "North Indian",
  "South Indian",
  "Chinese",
  "Italian",
  "Pizza",
  "Burger",
  "Biryani",
  "Desserts",
  "Beverages",
  "Mughlai",
  "Continental",
  "Street Food",
];

// Image URLs are deterministic and remote, so the seed can scale without bundling huge assets.
function img(seed, index = 0) {
  return `https://source.unsplash.com/600x420/?${encodeURIComponent(seed)},food,restaurant&sig=${index}`;
}

const restaurantTemplates = [
  {
    name: "Spice Junction",
    description: "Authentic North Indian curries, tandoori and biryani.",
    image: "indian restaurant",
    price_level: 2,
    cost_for_two: 600,
    rating: 4.3,
    delivery_time_min: 32,
    is_promoted: 1,
    cuisines: ["North Indian", "Mughlai", "Biryani"],
    menu: [
      { name: "Butter Chicken", price: 320, is_veg: 0, desc: "Creamy tomato gravy with tender chicken." },
      { name: "Paneer Tikka Masala", price: 280, is_veg: 1, desc: "Char-grilled paneer in rich masala." },
      { name: "Chicken Biryani", price: 260, is_veg: 0, desc: "Fragrant basmati rice with spices." },
      { name: "Garlic Naan", price: 60, is_veg: 1, desc: "Soft naan brushed with garlic butter." },
    ],
  },
  {
    name: "Dosa Corner",
    description: "Crispy dosas, fluffy idlis and filter coffee.",
    image: "dosa south indian food",
    price_level: 1,
    cost_for_two: 300,
    rating: 4.5,
    delivery_time_min: 25,
    is_promoted: 0,
    cuisines: ["South Indian", "Beverages"],
    menu: [
      { name: "Masala Dosa", price: 120, is_veg: 1, desc: "Crispy dosa with spiced potato filling." },
      { name: "Idli Vada Combo", price: 90, is_veg: 1, desc: "Steamed idli with crispy vada." },
      { name: "Filter Coffee", price: 40, is_veg: 1, desc: "Authentic South Indian filter coffee." },
    ],
  },
  {
    name: "Dragon Wok",
    description: "Indo-Chinese favourites, noodles and dim sum.",
    image: "chinese noodles restaurant",
    price_level: 2,
    cost_for_two: 550,
    rating: 4.1,
    delivery_time_min: 35,
    is_promoted: 0,
    cuisines: ["Chinese", "Street Food"],
    menu: [
      { name: "Hakka Noodles", price: 180, is_veg: 1, desc: "Wok-tossed noodles with veggies." },
      { name: "Chilli Chicken", price: 240, is_veg: 0, desc: "Spicy dry chilli chicken." },
      { name: "Veg Manchurian", price: 190, is_veg: 1, desc: "Fried veg balls in tangy sauce." },
    ],
  },
  {
    name: "Bella Napoli",
    description: "Wood-fired pizzas and hand-made pastas.",
    image: "pizza italian restaurant",
    price_level: 3,
    cost_for_two: 1200,
    rating: 4.6,
    delivery_time_min: 40,
    is_promoted: 1,
    cuisines: ["Italian", "Pizza", "Continental"],
    menu: [
      { name: "Margherita Pizza", price: 420, is_veg: 1, desc: "San Marzano tomato, mozzarella, basil." },
      { name: "Pepperoni Pizza", price: 520, is_veg: 0, desc: "Loaded with spicy pepperoni." },
      { name: "Penne Arrabbiata", price: 380, is_veg: 1, desc: "Penne in spicy tomato sauce." },
    ],
  },
  {
    name: "Burger Barn",
    description: "Juicy gourmet burgers and loaded fries.",
    image: "burger fries restaurant",
    price_level: 2,
    cost_for_two: 500,
    rating: 4.2,
    delivery_time_min: 28,
    is_promoted: 0,
    cuisines: ["Burger", "Street Food", "Beverages"],
    menu: [
      { name: "Classic Cheeseburger", price: 220, is_veg: 0, desc: "Beef patty, cheddar, house sauce." },
      { name: "Veggie Delight Burger", price: 190, is_veg: 1, desc: "Crispy veg patty with fresh veggies." },
      { name: "Loaded Fries", price: 150, is_veg: 1, desc: "Fries topped with cheese and jalapenos." },
    ],
  },
  {
    name: "Sweet Tooth",
    description: "Decadent desserts, cakes and shakes.",
    image: "dessert cake cafe",
    price_level: 1,
    cost_for_two: 350,
    rating: 4.7,
    delivery_time_min: 22,
    is_promoted: 0,
    cuisines: ["Desserts", "Beverages"],
    menu: [
      { name: "Chocolate Lava Cake", price: 160, is_veg: 1, desc: "Molten chocolate centre." },
      { name: "Oreo Shake", price: 140, is_veg: 1, desc: "Thick shake blended with Oreo." },
      { name: "Gulab Jamun (2 pcs)", price: 80, is_veg: 1, desc: "Warm syrup-soaked dumplings." },
    ],
  },
  {
    name: "Biryani House",
    description: "Dum-cooked biryanis from across India.",
    image: "biryani indian food",
    price_level: 2,
    cost_for_two: 650,
    rating: 4.4,
    delivery_time_min: 38,
    is_promoted: 1,
    cuisines: ["Biryani", "Mughlai", "North Indian"],
    menu: [
      { name: "Hyderabadi Chicken Biryani", price: 300, is_veg: 0, desc: "Spicy dum biryani with raita." },
      { name: "Veg Dum Biryani", price: 240, is_veg: 1, desc: "Aromatic veg biryani." },
      { name: "Mutton Biryani", price: 380, is_veg: 0, desc: "Slow-cooked mutton biryani." },
    ],
  },
  {
    name: "The Continental Table",
    description: "Premium continental plates and grills.",
    image: "continental fine dining",
    price_level: 3,
    cost_for_two: 1500,
    rating: 4.5,
    delivery_time_min: 45,
    is_promoted: 0,
    cuisines: ["Continental", "Italian"],
    menu: [
      { name: "Grilled Chicken Steak", price: 620, is_veg: 0, desc: "Herb-marinated grilled chicken." },
      { name: "Mushroom Risotto", price: 480, is_veg: 1, desc: "Creamy arborio rice with mushrooms." },
      { name: "Caesar Salad", price: 320, is_veg: 1, desc: "Classic Caesar with croutons." },
    ],
  },
];

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "zomato_clone",
    multipleStatements: true,
  });

  console.log("Clearing existing data ...");
  await connection.query(`
    SET FOREIGN_KEY_CHECKS = 0;
    TRUNCATE TABLE order_items;
    TRUNCATE TABLE orders;
    TRUNCATE TABLE reviews;
    TRUNCATE TABLE menu_items;
    TRUNCATE TABLE restaurant_cuisines;
    TRUNCATE TABLE restaurants;
    TRUNCATE TABLE cuisines;
    TRUNCATE TABLE cities;
    SET FOREIGN_KEY_CHECKS = 1;
  `);

  console.log("Inserting cities ...");
  const cityIds = {};
  for (const c of cities) {
    const [res] = await connection.execute(
      "INSERT INTO cities (name, state, latitude, longitude) VALUES (?, ?, ?, ?)",
      [c.name, c.state, c.latitude, c.longitude]
    );
    cityIds[c.name] = res.insertId;
  }

  console.log("Inserting cuisines ...");
  const cuisineIds = {};
  for (const name of cuisines) {
    const [res] = await connection.execute("INSERT INTO cuisines (name) VALUES (?)", [name]);
    cuisineIds[name] = res.insertId;
  }

  console.log("Inserting restaurants, cuisines links and menus ...");
  const cityNames = Object.keys(cityIds);
  for (let cityIdx = 0; cityIdx < cityNames.length; cityIdx++) {
    const cityName = cityNames[cityIdx];
    for (let templateIdx = 0; templateIdx < restaurantTemplates.length; templateIdx++) {
      const t = restaurantTemplates[templateIdx];
      const city = cities.find((c) => c.name === cityName);
      const jitterLat = city.latitude + (Math.random() - 0.5) * 0.08;
      const jitterLng = city.longitude + (Math.random() - 0.5) * 0.08;

      const [res] = await connection.execute(
      `INSERT INTO restaurants
          (name, description, image_url, city_id, address, latitude, longitude, price_level,
           cost_for_two, rating, delivery_time_min, supports_delivery, supports_pickup,
           supports_dine_in, is_promoted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `${t.name} ${cityName}`,
          t.description,
          img(t.image, restaurantIdSeed(cityIdx, templateIdx)),
          cityIds[cityName],
          `${Math.floor(Math.random() * 200) + 1}, Main Road, ${cityName}`,
          jitterLat,
          jitterLng,
          t.price_level,
          t.cost_for_two,
          t.rating,
          t.delivery_time_min,
          1,
          templateIdx % 3 !== 1 ? 1 : 0,
          templateIdx % 3 !== 2 ? 1 : 0,
          t.is_promoted,
        ]
      );
      const restaurantId = res.insertId;

      for (const cName of t.cuisines) {
        await connection.execute(
          "INSERT INTO restaurant_cuisines (restaurant_id, cuisine_id) VALUES (?, ?)",
          [restaurantId, cuisineIds[cName]]
        );
      }

      let menuIndex = 0;
      for (const m of t.menu) {
        menuIndex++;
        await connection.execute(
          `INSERT INTO menu_items
             (restaurant_id, name, description, price, image_url, rating, order_count, is_veg)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            restaurantId,
            m.name,
            m.desc,
            m.price,
            img(m.name, restaurantId * 10 + menuIndex),
            Math.round((3.8 + Math.random() * 1.1) * 10) / 10,
            Math.floor(Math.random() * 500),
            m.is_veg,
          ]
        );
      }

      // A couple of sample reviews
      await connection.execute(
        "INSERT INTO reviews (restaurant_id, customer_name, rating, comment) VALUES (?, ?, ?, ?)",
        [restaurantId, "Aarav", 5, "Delicious food and quick delivery!"]
      );
      await connection.execute(
        "INSERT INTO reviews (restaurant_id, customer_name, rating, comment) VALUES (?, ?, ?, ?)",
        [restaurantId, "Diya", 4, "Great taste, would order again."]
      );
    }
  }

  console.log("Seed complete.");
  await connection.end();
}

function restaurantIdSeed(cityIdx, copyIndex) {
  return cityIdx * 10 + copyIndex;
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
