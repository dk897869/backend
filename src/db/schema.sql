-- Zomato clone MySQL schema
-- Run with: mysql -u root -p < src/db/schema.sql
-- (or use `npm run db:init` which executes this file)

CREATE DATABASE IF NOT EXISTS zomato_clone
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE zomato_clone;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(40) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  is_verified TINYINT(1) NOT NULL DEFAULT 0,
  is_phone_verified TINYINT(1) NOT NULL DEFAULT 0,
  verification_token VARCHAR(255),
  token_expires_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS login_otps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(40) NOT NULL,
  otp_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  consumed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_login_otps_phone (phone)
) ENGINE=InnoDB;

-- Cities available for location filtering
CREATE TABLE IF NOT EXISTS cities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  state VARCHAR(120) NOT NULL,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_city_name (name)
) ENGINE=InnoDB;

-- Master list of cuisines
CREATE TABLE IF NOT EXISTS cuisines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  UNIQUE KEY uq_cuisine_name (name)
) ENGINE=InnoDB;

-- Restaurants
CREATE TABLE IF NOT EXISTS restaurants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  image_url VARCHAR(500),
  city_id INT NOT NULL,
  address VARCHAR(300),
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  -- price_level: 1 = low/budget, 2 = medium, 3 = high/premium
  price_level TINYINT NOT NULL DEFAULT 2,
  cost_for_two INT NOT NULL DEFAULT 500,
  rating DECIMAL(2, 1) NOT NULL DEFAULT 4.0,
  delivery_time_min INT NOT NULL DEFAULT 30,
  supports_delivery TINYINT(1) NOT NULL DEFAULT 1,
  supports_pickup TINYINT(1) NOT NULL DEFAULT 1,
  supports_dine_in TINYINT(1) NOT NULL DEFAULT 1,
  is_promoted TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_restaurant_city FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE,
  INDEX idx_restaurant_city (city_id),
  INDEX idx_restaurant_price (price_level),
  INDEX idx_restaurant_cost (cost_for_two)
) ENGINE=InnoDB;

-- Many-to-many join between restaurants and cuisines
CREATE TABLE IF NOT EXISTS restaurant_cuisines (
  restaurant_id INT NOT NULL,
  cuisine_id INT NOT NULL,
  PRIMARY KEY (restaurant_id, cuisine_id),
  CONSTRAINT fk_rc_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  CONSTRAINT fk_rc_cuisine FOREIGN KEY (cuisine_id) REFERENCES cuisines(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Menu items belonging to a restaurant
CREATE TABLE IF NOT EXISTS menu_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  restaurant_id INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  image_url VARCHAR(500),
  rating DECIMAL(2, 1) NOT NULL DEFAULT 4.2,
  order_count INT NOT NULL DEFAULT 0,
  is_veg TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_item_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  INDEX idx_item_restaurant (restaurant_id)
) ENGINE=InnoDB;

-- Orders placed by users
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  restaurant_id INT NOT NULL,
  user_id INT NULL,
  customer_name VARCHAR(200) NOT NULL,
  customer_email VARCHAR(255),
  customer_phone VARCHAR(40) NOT NULL,
  delivery_address VARCHAR(400) NOT NULL,
  service_mode ENUM('delivery', 'pickup', 'dine_in') NOT NULL DEFAULT 'delivery',
  payment_method ENUM('card', 'upi', 'netbanking', 'cod', 'cash', 'stripe') NOT NULL,
  payment_status ENUM('pending', 'paid') NOT NULL DEFAULT 'pending',
  payment_provider VARCHAR(40),
  payment_reference VARCHAR(255),
  subtotal DECIMAL(10, 2) NOT NULL,
  delivery_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
  taxes DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  status ENUM('placed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled') NOT NULL DEFAULT 'placed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id),
  CONSTRAINT fk_order_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_order_restaurant (restaurant_id)
) ENGINE=InnoDB;

-- Individual line items for an order
CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  menu_item_id INT NOT NULL,
  item_name VARCHAR(200) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  quantity INT NOT NULL,
  line_total DECIMAL(10, 2) NOT NULL,
  CONSTRAINT fk_oi_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_oi_item FOREIGN KEY (menu_item_id) REFERENCES menu_items(id),
  INDEX idx_oi_order (order_id)
) ENGINE=InnoDB;

-- Reviews / feedback for restaurants
CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  restaurant_id INT NOT NULL,
  customer_name VARCHAR(200) NOT NULL,
  rating TINYINT NOT NULL,
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_review_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  INDEX idx_review_restaurant (restaurant_id)
) ENGINE=InnoDB;
