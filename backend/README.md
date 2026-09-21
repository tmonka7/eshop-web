# ShopWorld — Backend API

REST API for the ShopWorld storefront, admin panel and Android app.

- **Node** 18.19 (`engines` pins `>=18.19.0 <19`)
- **Express** 4 + **Mongoose** 8
- **MongoDB** 6.0

## Quick start

```bash
cp .env.example .env      # edit MONGO_URI / secrets if needed
npm install
npm run seed              # wipes and fills the database with demo data
npm run dev               # http://localhost:5000
```

Health check: <http://localhost:5000/api/v1/health>

### Seeded accounts

| Role     | Email                  | Password       |
| -------- | ---------------------- | -------------- |
| Admin    | `admin@auramart.com`   | `Admin@123`    |
| Manager  | `manager@auramart.com` | `Manager@123`  |
| Customer | `john@example.com`     | `Password@123` |

Five more customers exist (`sarah@`, `mike@`, `emily@`, `david@`, `anna@` `example.com`), all with
`Password@123`.

### Seeded coupons

`WELCOME10` (10% over $50) · `SAVE20` ($20 over $150) · `MEGA50` (50% over $200, capped at $150)

## Environment

| Variable                  | Default                                 | Notes                                    |
| ------------------------- | --------------------------------------- | ---------------------------------------- |
| `PORT`                    | `5000`                                  |                                          |
| `MONGO_URI`               | `mongodb://127.0.0.1:27017/auramart`    |                                          |
| `JWT_ACCESS_SECRET`       | —                                       | change before deploying                  |
| `JWT_REFRESH_SECRET`      | —                                       | change before deploying                  |
| `CORS_ORIGINS`            | localhost:5173, :5174                   | comma separated                          |
| `PUBLIC_URL`              | `http://localhost:5000`                 | prefix baked into stored image URLs      |
| `FREE_SHIPPING_THRESHOLD` | `50`                                    |                                          |
| `SHIPPING_FLAT_RATE`      | `9.99`                                  |                                          |
| `TAX_RATE`                | `0.1`                                   | 10%                                      |

## Transactions

Checkout decrements stock and writes the order atomically **when MongoDB runs as a replica set**.
A standalone `mongod` (the default local install) cannot do transactions, so the API detects that,
logs a warning once, and falls back to a sequential write with manual stock rollback on failure.
For production-grade atomicity, start mongod with `--replSet rs0` and run `rs.initiate()`.

## API map

Base path: `/api/v1`

### Auth — `/auth`
| Method | Path        | Auth | Purpose                     |
| ------ | ----------- | ---- | --------------------------- |
| POST   | `/register` | —    | Create account + tokens     |
| POST   | `/login`    | —    | Sign in                     |
| POST   | `/refresh`  | —    | Rotate the refresh token    |
| POST   | `/logout`   | user | Revoke refresh token(s)     |
| GET    | `/me`       | user | Current profile + wishlist  |
| PATCH  | `/password` | user | Change password             |

### Catalog (public)
`GET /categories` · `GET /categories/tree` · `GET /categories/:slug`
`GET /products` · `GET /products/filters` · `GET /products/featured` · `GET /products/best-sellers`
`GET /products/:slug` · `GET /products/:slug/related` · `GET /products/:slug/reviews`
`GET /products/:slug/reviews/summary` · `GET /banners` · `GET /promotions` · `GET /coupons/validate`

`GET /products` accepts: `page`, `limit`, `search`, `category` (id or slug), `brand`, `color`,
`tag`, `minPrice`, `maxPrice`, `minRating`, `featured`, `inStock`, and
`sort` = `best_selling | newest | oldest | price_asc | price_desc | rating | name_asc | popular`.

### Shopper (JWT required)
`GET|DELETE /cart` · `POST /cart/items` · `PATCH|DELETE /cart/items/:itemId`
`POST|DELETE /cart/coupon` · `POST /cart/merge`
`GET /checkout/preview` · `POST /orders` · `GET /orders` · `GET /orders/:id`
`GET /orders/:id/track` · `POST /orders/:id/cancel`
`POST /reviews` · `PATCH|DELETE /reviews/:id` · `POST /reviews/:id/helpful`
`PATCH /users/profile` · `POST /users/avatar` · `/users/addresses…` · `/users/wishlist…`

`:id` on an order accepts either the ObjectId or the human `ORD123456` number.

### Admin — `/admin` (role `admin` or `manager`)
`/dashboard/stats` · `/dashboard/sales-overview` · `/dashboard/sales-by-category`
`/dashboard/customer-growth` · `/dashboard/recent-orders` · `/dashboard/top-products`
`/products` (CRUD, `/status`, `/stock`) · `/categories` (CRUD)
`/orders` (list, detail, `/status`, `/tracking`)
`/customers` (list, detail, `/status`, `/export` → CSV)
`/inventory/alerts` · `/reviews` (+ `/moderate`) · `/coupons` (CRUD) · `/banners` (CRUD)
`/uploads/products` · `/uploads/banners` · `DELETE /uploads/:folder/:filename`

## Response shape

```jsonc
// success
{ "success": true, "message": "Products", "data": [ ... ],
  "pagination": { "page": 1, "limit": 12, "total": 16, "totalPages": 2, "hasNext": true, "hasPrev": false } }

// failure
{ "success": false, "message": "Validation failed",
  "errors": [ { "field": "email", "message": "A valid email is required" } ] }
```

## Payments

`src/services/payment.service.js` is a **mock gateway** so checkout is runnable without credentials.
It approves `card`, `paypal` and `applepay`, treats `cod` as unpaid-on-delivery, and **declines any
card number ending in `0000`** so you can exercise the failure path. Replace the body of `charge()`
with a real SDK call when going live.

## Layout

```
src/
  config/      env, db connection, enums
  models/      User Category Product Cart Order Review Coupon Banner
  middleware/  auth, validation, uploads, rate limits, error handler
  controllers/ request handling per resource
  routes/      auth, user, catalog (public), shop (customer), admin
  services/    pricing (single source of order maths), mock payments
  seed/        demo data + SVG image generator
```
