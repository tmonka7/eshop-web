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
| `VISUAL_SEARCH_ENABLED`   | `true`                                  | DINOv3 image search                      |
| `VISUAL_SEARCH_MODEL_DIR` | `ml/dinov3-vits16`                      | relative to `backend/`                   |
| `VISUAL_SEARCH_MODEL_FILE`| `model.onnx`                            | `model_quantized.onnx` for int8          |
| `VISUAL_SEARCH_MIN_SCORE` | `0.25`                                  | cosine cut-off for results               |
| `VISUAL_SEARCH_THREADS`   | `0`                                     | onnxruntime threads, 0 = auto            |
| `VISUAL_SEARCH_INDEX_ON_BOOT` | `true`                              | index pending products after start-up    |
| `VISUAL_SEARCH_FETCH_REMOTE`  | `false`                             | also embed images hosted on other sites  |
| `VISUAL_SEARCH_DETECT`    | `true`                                  | find the product area (green box) first  |
| `VISUAL_SEARCH_DETECT_SIDE` | `448`                                 | longest side used for area detection     |
| `VISUAL_SEARCH_SAM2`      | `true`                                  | fit the box to the product with SAM2     |
| `VISUAL_SEARCH_SAM2_DIR`  | `ml/sam2.1-hiera-tiny`                  | SAM2 model folder                        |

## Image search (DINOv3)

Registering or editing a product extracts DINOv3 features from each image and stores them in
MongoDB (`productembeddings`). Shoppers can then search by photo. The model runs in-process on
the CPU from `ml/`, with no network access, so it works on an air-gapped host. See
[ml/README.md](ml/README.md) for how to get the model there.

### Product area (green box)

Before embedding, the API finds the product inside the photo and embeds only that area, for
shoppers' photos and catalogue images alike. It works in two steps:

1. **Which object** - `src/services/regionDetect.js` scores DINOv3's own patch tokens by how
   unlike the image border they are, sharpened by colour distance from the border, and picks the
   strongest connected blob: a rough box (16 px patches) and its strongest point.
2. **Its outline** - `src/services/sam2.service.js` prompts SAM2.1 (Hiera-tiny) with that box
   and point. SAM2 segments the object, and the box around its mask becomes the product area.
   On 60 test composites this raised the mean overlap with the true product box from 0.68 to 0.81
   (plain backgrounds 0.82 -> 0.94), at about 2 s extra per photo on a CPU. Without the SAM2 files,
   or with `VISUAL_SEARCH_SAM2=false`, the rough box is used; nothing else changes.

The search response's `region.method` says which one produced the box (`sam2`, `dinov3` or
`manual`). Switching SAM2 on or off changes the detector id, so the catalogue is re-detected once
at the next start. The clients
draw it as a glowing green box that the user can move or resize; the search then runs on that box
(`box` field). Admins can adjust the box per catalogue image (`imageRegions`, saved as manual and
kept on re-indexing). The Android app runs step 1 on the phone (`util/RegionDetector.java`);
when the API reports a `segmenter` in `GET /products/visual-search/status`, the app lets the
API find the area instead, so its boxes match the storefront's.

```bash
npm run model:fetch       # once, on a connected machine: downloads + verifies the model
npm run model:sam2        # also SAM2.1 for the product outline (74 MB)
npm run visual:reindex    # (re)extract missing vectors; add -- --force to redo all
npm run model:android     # (repo root) bundle the same model into the Android app
```

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
`GET /products/visual-search/status` · `POST /products/visual-search` (multipart `image`;
`limit`, `minScore`, optional `box` = JSON `{x,y,w,h}` fractions, `detect=false` for the whole
photo) returns products with a `similarity` score, best match first, plus `region`: the area searched.
`POST /products/visual-search/vector` (`{ model, vector, limit?, minScore? }`) does the same for a
vector the client computed itself; it returns 409 when `model` is not the server's model

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
`GET /visual-search/status` · `POST /visual-search/reindex` (`{ force }`) ·
`POST /visual-search/detect` (`{ image }` → product area of a stored image) ·
`POST /products/:id/visual-index`

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
