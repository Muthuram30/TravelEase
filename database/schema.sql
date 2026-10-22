-- ============================================================
-- TravelEase Tourism Management System
-- Database Schema and Sample Data
-- ============================================================
--
-- DBMS Laboratory Project - 2026
--
-- This file contains:
--   1. Database creation
--   2. Table creation with primary/foreign keys
--   3. Sample/demo data
--   4. Meaningful SQL queries demonstrating DBMS functionality
--
-- Usage:
--   mysql -u root -p < schema.sql
-- ============================================================


-- ============================================================
-- 1. CREATE DATABASE
-- ============================================================

CREATE DATABASE IF NOT EXISTS tourism_db;

USE tourism_db;


-- ============================================================
-- 2. CREATE TABLES
-- ============================================================


-- ----------------------------------------------------------
-- Table 1: tourist
-- Stores tourist/customer information
-- ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS tourist (

    tourist_id   INT            AUTO_INCREMENT  PRIMARY KEY,
    name         VARCHAR(100)   NOT NULL,
    phone        VARCHAR(20)    NOT NULL,
    email        VARCHAR(100),
    address      VARCHAR(200),

    -- Ensure email is unique when provided
    UNIQUE KEY unique_email (email)

) ENGINE=InnoDB;

-- Authentication accounts. `role` is the source of truth for admin access.
CREATE TABLE IF NOT EXISTS user_account (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    theme_choice VARCHAR(40) NOT NULL DEFAULT 'kerala-green',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;


-- ----------------------------------------------------------
-- Table 2: tour_package
-- Stores available tour packages with pricing
-- ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS tour_package (

    package_id    INT             AUTO_INCREMENT  PRIMARY KEY,
    package_name  VARCHAR(100)    NOT NULL,
    destination   VARCHAR(100)    NOT NULL,
    duration      INT             NOT NULL,
    cost          DECIMAL(10,2)   NOT NULL,
    availability  INT             NOT NULL  DEFAULT 0

) ENGINE=InnoDB;


-- ----------------------------------------------------------
-- Table 3: booking
-- Stores bookings linking tourists to packages
-- Uses FOREIGN KEYS to maintain referential integrity
-- ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS booking (

    booking_id       INT             AUTO_INCREMENT  PRIMARY KEY,
    tourist_id       INT             NOT NULL,
    package_id       INT             NOT NULL,
    booking_date     DATE            NOT NULL,
    travel_date      DATE            NOT NULL,
    number_of_persons INT           NOT NULL  DEFAULT 1,
    total_cost       DECIMAL(10,2)   NOT NULL,
    booking_status   VARCHAR(20)     NOT NULL  DEFAULT 'Pending',
    created_at       TIMESTAMP       NOT NULL  DEFAULT CURRENT_TIMESTAMP,

    -- Foreign Key: links booking to a tourist
    CONSTRAINT fk_booking_tourist
        FOREIGN KEY (tourist_id)
        REFERENCES tourist (tourist_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    -- Foreign Key: links booking to a tour package
    CONSTRAINT fk_booking_package
        FOREIGN KEY (package_id)
        REFERENCES tour_package (package_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE

) ENGINE=InnoDB;


-- ----------------------------------------------------------
-- Table 4: admin
-- Stores admin user credentials for dashboard access
-- ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS admin (

    admin_id      INT            AUTO_INCREMENT  PRIMARY KEY,
    username      VARCHAR(50)    NOT NULL  UNIQUE,
    password_hash VARCHAR(255)   NOT NULL,
    full_name     VARCHAR(100)   NOT NULL,
    created_at    TIMESTAMP      NOT NULL  DEFAULT CURRENT_TIMESTAMP

) ENGINE=InnoDB;


-- ============================================================
-- 3. SAMPLE / DEMO DATA
-- ============================================================


-- ----------------------------------------------------------
-- Sample Tourists
-- ----------------------------------------------------------

INSERT INTO tourist (name, phone, email, address) VALUES
    ('Aarav Sharma',     '+91 98765 43210',  'aarav.sharma@email.com',     'Mumbai, India'),
    ('Priya Patel',      '+91 87654 32109',  'priya.patel@email.com',      'Ahmedabad, India'),
    ('Rahul Verma',      '+91 76543 21098',  'rahul.verma@email.com',      'Delhi, India'),
    ('Sneha Iyer',       '+91 65432 10987',  'sneha.iyer@email.com',       'Chennai, India'),
    ('Vikram Singh',     '+91 54321 09876',  'vikram.singh@email.com',     'Jaipur, India'),
    ('Ananya Reddy',     '+91 43210 98765',  'ananya.reddy@email.com',     'Hyderabad, India'),
    ('James Wilson',     '+1 555 123 4567',  'james.wilson@email.com',     'New York, USA'),
    ('Sophie Laurent',   '+33 6 12 34 56',   'sophie.laurent@email.com',   'Paris, France'),
    ('Kenji Tanaka',     '+81 90 1234 5678', 'kenji.tanaka@email.com',     'Tokyo, Japan'),
    ('Maria Garcia',     '+34 612 345 678',  'maria.garcia@email.com',     'Barcelona, Spain');


-- ----------------------------------------------------------
-- Sample Tour Packages
-- ----------------------------------------------------------

INSERT INTO tour_package (package_name, destination, duration, cost, availability) VALUES
    ('Golden Triangle Tour',     'Delhi-Agra-Jaipur',     7,  25000.00,  20),
    ('Kerala Backwaters',        'Kerala',                5,  18000.00,  15),
    ('Goa Beach Holiday',        'Goa',                   4,  12000.00,  25),
    ('Himalayan Adventure',      'Manali-Leh',            8,  35000.00,  10),
    ('Rajasthan Royal Tour',     'Rajasthan',             6,  28000.00,  12),
    ('Andaman Island Escape',    'Andaman Islands',       5,  32000.00,   8),
    ('Darjeeling Tea Trail',     'Darjeeling',            4,  15000.00,  18),
    ('Varanasi Spiritual Tour',  'Varanasi',              3,  10000.00,  30),
    ('Meghalaya Explorer',       'Shillong-Cherrapunji',  5,  22000.00,  14),
    ('Tamil Nadu Temple Tour',   'Tamil Nadu',            6,  20000.00,  16);


-- ----------------------------------------------------------
-- Sample Bookings
-- ----------------------------------------------------------

INSERT INTO booking (tourist_id, package_id, booking_date, travel_date, number_of_persons, total_cost, booking_status) VALUES
    (1, 1, '2026-09-10', '2026-10-15', 2,  50000.00, 'Confirmed'),
    (2, 2, '2026-09-12', '2026-10-20', 3,  54000.00, 'Confirmed'),
    (3, 3, '2026-09-15', '2026-11-05', 1,  12000.00, 'Confirmed'),
    (4, 4, '2026-09-18', '2026-11-10', 2,  70000.00, 'Pending'),
    (5, 5, '2026-09-20', '2026-10-25', 4, 112000.00, 'Confirmed'),
    (6, 6, '2026-09-22', '2026-12-01', 2,  64000.00, 'Cancelled'),
    (7, 1, '2026-09-25', '2026-12-10', 1,  25000.00, 'Pending'),
    (8, 7, '2026-09-26', '2026-11-15', 2,  30000.00, 'Confirmed'),
    (9, 3, '2026-09-27', '2026-11-20', 3,  36000.00, 'Confirmed'),
    (1, 8, '2026-09-28', '2026-12-05', 1,  10000.00, 'Rejected');


-- Update availability to reflect existing bookings
UPDATE tour_package SET availability = availability - 3  WHERE package_id = 1;  -- 2+1 persons booked
UPDATE tour_package SET availability = availability - 3  WHERE package_id = 2;  -- 3 persons booked
UPDATE tour_package SET availability = availability - 4  WHERE package_id = 3;  -- 1+3 persons booked
UPDATE tour_package SET availability = availability - 2  WHERE package_id = 4;  -- 2 persons booked (1 pending)
UPDATE tour_package SET availability = availability - 4  WHERE package_id = 5;  -- 4 persons booked
-- Package 6: booking was cancelled, so availability stays as-is
UPDATE tour_package SET availability = availability - 2  WHERE package_id = 7;  -- 2 persons booked
UPDATE tour_package SET availability = availability - 1  WHERE package_id = 8;  -- 1 person booked (but rejected)


-- Admin users are created by running: php backend/setup_admin.php
-- That script reads ADMIN_USERNAME and ADMIN_PASSWORD from backend/.env
-- and stores a proper bcrypt hash. Do NOT insert admin rows manually here.



-- ============================================================
-- 4. MEANINGFUL SQL QUERIES
--    (Demonstrating DBMS Functionality)
-- ============================================================


-- ----------------------------------------------------------
-- QUERY 1: JOIN — Tourist Booking Details
--
-- Shows complete booking information by joining
-- all three tables: tourist, tour_package, and booking.
-- Demonstrates INNER JOIN with multiple tables.
-- ----------------------------------------------------------

SELECT
    b.booking_id,
    t.name          AS tourist_name,
    t.phone         AS tourist_phone,
    p.package_name,
    p.destination,
    b.booking_date,
    b.number_of_persons,
    b.total_cost,
    b.booking_status

FROM booking b

JOIN tourist t
    ON b.tourist_id = t.tourist_id

JOIN tour_package p
    ON b.package_id = p.package_id

ORDER BY b.booking_id DESC;


-- ----------------------------------------------------------
-- QUERY 2: SEARCH — Find Tourists by Name or Email
--
-- Demonstrates pattern matching using LIKE
-- with parameterized wildcards for safe searching.
-- ----------------------------------------------------------

SELECT *
FROM tourist
WHERE name LIKE '%Sharma%'
   OR email LIKE '%sharma%'
ORDER BY tourist_id;


-- ----------------------------------------------------------
-- QUERY 3: AGGREGATE — Dashboard Statistics
--
-- Uses COUNT() and SUM() aggregate functions
-- to generate dashboard summary statistics.
-- ----------------------------------------------------------

-- Total number of tourists
SELECT COUNT(*) AS total_tourists FROM tourist;

-- Total number of bookings
SELECT COUNT(*) AS total_bookings FROM booking;

-- Pending bookings count
SELECT COUNT(*) AS pending_bookings 
FROM booking 
WHERE booking_status = 'Pending';

-- Confirmed bookings count
SELECT COUNT(*) AS confirmed_bookings 
FROM booking 
WHERE booking_status = 'Confirmed';

-- Total revenue from confirmed bookings
SELECT
    COALESCE(SUM(total_cost), 0) AS total_revenue
FROM booking
WHERE booking_status = 'Confirmed';

-- Bookings per destination (GROUP BY)
SELECT
    p.destination,
    COUNT(*)            AS total_bookings,
    SUM(b.total_cost)   AS total_revenue
FROM booking b
JOIN tour_package p
    ON b.package_id = p.package_id
WHERE b.booking_status = 'Confirmed'
GROUP BY p.destination
ORDER BY total_bookings DESC;


-- ----------------------------------------------------------
-- QUERY 4: SUBQUERY — Most Popular Package
--
-- Finds the package with the most confirmed bookings
-- using a subquery with GROUP BY and ORDER BY.
-- ----------------------------------------------------------

SELECT
    p.package_name,
    p.destination,
    p.cost,
    booking_counts.total_bookings

FROM tour_package p

JOIN (
    SELECT
        package_id,
        COUNT(*) AS total_bookings
    FROM booking
    WHERE booking_status = 'Confirmed'
    GROUP BY package_id
    ORDER BY total_bookings DESC
    LIMIT 5
) AS booking_counts
    ON p.package_id = booking_counts.package_id

ORDER BY booking_counts.total_bookings DESC;
