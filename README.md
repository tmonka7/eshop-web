# AuraMart — Full E-Commerce Platform

Four projects on one API: a REST backend, a customer storefront, an admin panel and a
native Android app.

| Project          | Stack                                        | Dev URL / output                     |
| ---------------- | -------------------------------------------- | ------------------------------------ |
| [`backend/`](backend/)         | Node 18.19 · Express 4 · MongoDB 6.0 · JWT     | <http://localhost:5000>              |
| [`frontend/`](frontend/)       | React 18 · Vite 5 · React Router · Zustand     | <http://localhost:5173>              |
| [`admin-panel/`](admin-panel/) | React 18 · Vite 5 · Recharts                   | <http://localhost:5174>              |
| [`android/`](android/)         | Java · Gradle 8.13 · Retrofit · Glide          | `app/build/outputs/apk/debug/`       |

---

## Quick start

### Prerequisites

- **Node 18.19** (the backend pins `>=18.19.0 <19`)
- **MongoDB 6.0** running locally on `27017`
- **JDK 17** + **Gradle 8.13** (or Android Studio) for the Android app

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run seed        # 16 products, 9 categories, 8 users, 90 orders, reviews, coupons
npm run dev         # http://localhost:5000
```

Check it is alive: <http://localhost:5000/api/v1/health>

### 2. Storefront

```bash
cd frontend
npm install
npm run dev         # http://localhost:5173
```

### 3. Admin panel

```bash
cd admin-panel
npm install
npm run dev         # http://localhost:5174
```

### 4. Android

```bash
cd android
gradle wrapper --gradle-version 8.13   # once; Android Studio does this for you
./gradlew installDebug                 # onto a running emulator
```

See [android/README.md](android/README.md) for device vs. emulator networking.

---

## Demo accounts

| Role     | Email                  | Password       | Where            |
| -------- | ---------------------- | -------------- | ---------------- |
| Admin    | `admin@auramart.com`   | `Admin@123`    | Admin panel      |
| Manager  | `manager@auramart.com` | `Manager@123`  | Admin panel      |
| Customer | `john@example.com`     | `Password@123` | Storefront / app |

Five more customers exist with the same password: `sarah@`, `mike@`, `emily@`, `david@`,
`anna@` `example.com`.

**Promo codes:** `WELCOME10` (10% over $50) · `SAVE20` ($20 over $150) · `MEGA50`
(50% over $200, capped at $150)

---

## What is built

### Storefront (`frontend/`)
Home with hero banners, category rail, featured and best-seller grids · product listing with
faceted filters (category, price, brand, colour, rating, availability) and six sort orders ·
product detail with gallery, variants, reviews and related items · cart with promo codes and
a live free-shipping meter · three-step checkout · order history, detail and tracking ·
account profile, addresses, wishlist and password change · responsive down to phone width
with a bottom nav bar.

### Admin panel (`admin-panel/`)
Dashboard with revenue/orders/customers/conversion KPIs, a sales-over-time area chart, a
sales-by-category donut, customer growth and recent orders · product CRUD with image upload
and inline status toggles · categories · inventory restocking · orders with status tabs and a
guarded status workflow · customers with detail, activation and CSV export · review
moderation · coupon CRUD · banner CRUD · reports · settings.

### Android app (`android/`)
Every customer flow above as native Java screens — see [android/README.md](android/README.md).

### Backend (`backend/`)
JWT auth with refresh-token rotation · catalogue with faceted filtering · server-side cart
that re-validates stock and price on every read · checkout that decrements stock atomically ·
mock payment gateway · order lifecycle with a guarded status machine and stock restoration on
cancel · reviews with verified-purchase detection · coupons · banners · image uploads ·
dashboard aggregations. Full API map in [backend/README.md](backend/README.md).

---

## How the pieces fit

```
                         ┌───────────────────┐
  React storefront  ───► │                   │
  (localhost:5173)       │                   │
                         │   Express API     │ ───►  MongoDB 6.0
  React admin panel ───► │   /api/v1         │       (auramart)
  (localhost:5174)       │   :5000           │
                         │                   │ ───►  /uploads  (product images)
  Android app       ───► │                   │
  (10.0.2.2:5000)        └───────────────────┘
```

All three clients speak the same REST API and the same JSON envelope:

```jsonc
{ "success": true, "message": "Products", "data": [ ... ],
  "pagination": { "page": 1, "limit": 12, "total": 16, "totalPages": 2 } }
```

Order maths lives in exactly one place — `backend/src/services/pricing.service.js` — so the
cart, the checkout preview and the saved order can never disagree.

---

## Things worth knowing

**Product images are generated, not downloaded.** `npm run seed` writes gradient PNGs into
`backend/uploads/` with a small built-in PNG encoder, so the store looks complete with no
internet access and no image licensing. Replace them through the admin panel's upload field.

**Payments are mocked.** `backend/src/services/payment.service.js` mimics a Stripe-shaped
charge so checkout is runnable without credentials. Any card number ending in `0000` is
declined, which exercises the failure path. Swap the body of `charge()` for a real SDK call
before going live.

**Transactions need a replica set.** Checkout writes the order and decrements stock inside a
MongoDB transaction when one is available. A standalone `mongod` — the default local install
— cannot do transactions, so the API detects that, warns once, and falls back to a sequential
write that rolls stock back by hand if anything fails. For real atomicity run
`mongod --replSet rs0` and `rs.initiate()`.

**Secrets.** `backend/.env` ships with development defaults. Change `JWT_ACCESS_SECRET` and
`JWT_REFRESH_SECRET` before deploying anywhere real.

---

## Repository layout

```
backend/       Express API, Mongoose models, seed data + image generator
frontend/      Customer storefront (Vite + React)
admin-panel/   Admin dashboard (Vite + React + Recharts)
android/       Native Java app (Gradle 8.13)
```
