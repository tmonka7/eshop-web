# ShopWorld — Full E-Commerce Platform

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

### Install everything at once

The repo root is an npm workspace, so one install covers all three Node
projects and hoists shared packages into a single `node_modules/`:

```bash
npm install         # from the repo root
```

You can still install a project on its own (`cd backend && npm install`) if you
prefer; the per-project instructions below assume you have not run the root
install.

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

## Design system

A light theme built on a green primary, shared by all four projects so the
storefront, the panel and the app read as one brand.

Everything is driven by tokens — `:root` in
[frontend/src/styles/global.css](frontend/src/styles/global.css) and
[admin-panel/src/styles/admin.css](admin-panel/src/styles/admin.css), mirrored
as `@color` resources in
[android/app/src/main/res/values/colors.xml](android/app/src/main/res/values/colors.xml).
Restyling means editing those three blocks, not hunting hex values.

| Role | Value | Why |
|---|---|---|
| `--primary` | `#15803d` (green-700) | 5.0:1 against white **both ways**, so it works as a button fill *and* as price/link text. The brighter `#16a34a` is only 3.3:1 — fine for a chart mark, too weak for 12–15px text. |
| `--bg-soft` | `#f2faf5` | The tinted page canvas white cards sit on. |
| red scale | `#ef4444`–`#b91c1c` | **Not** a brand colour. Reserved for sale flags, destructive buttons and errors, so it still reads as an accent against all the green. |
| `--success` | `#0d9488` teal | Deliberately not green, so an "ok" badge never looks like a primary button. |

**Contrast is checked, not eyeballed.** Every text-on-colour pairing clears
WCAG AA (4.5:1 for body and badge text, 3:1 for marks). That pass also caught
three badge styles — warn, purple and danger — that had been sitting at
3.0–4.0:1 since before the restyle; they now use `-700` text steps.

**Chart colour** follows the data-viz rules: a fixed categorical order that
leads with brand green and excludes red (a reserved status colour must never
double as a series). The order in
[admin-panel/src/utils/constants.js](admin-panel/src/utils/constants.js) was run
through the palette validator — worst adjacent CVD ΔE 10.3, normal-vision 31.1.
The donut folds everything past five categories into one "Other" slice rather
than cycling hues, and the revenue-by-category bars use a single colour because
they are revenue-sorted, where colouring by index would encode rank instead of
identity.

### Motion

Each web project ends its stylesheet with a self-contained **motion layer** that
restyles the rules above it — gradients, glows, hover lifts, sheen sweeps,
scroll-triggered entrances, a drifting hero and an animated sign-in backdrop.
It changes no layout, so it can be read, tuned or deleted in one block.

| Piece | Where |
|---|---|
| Storefront motion CSS | end of [frontend/src/styles/global.css](frontend/src/styles/global.css) |
| Storefront runtime | [frontend/src/utils/motion.js](frontend/src/utils/motion.js) |
| Panel motion CSS | end of [admin-panel/src/styles/admin.css](admin-panel/src/styles/admin.css) |
| Panel runtime + KPI count-up | [admin-panel/src/utils/motion.js](admin-panel/src/utils/motion.js) |
| App transitions & list entrances | [android/app/src/main/res/anim/](android/app/src/main/res/anim/), [animator/](android/app/src/main/res/animator/) |

Three constraints hold across all of it:

- **Nothing is communicated by motion alone.** An entrance only ever changes
  opacity and position; every animated confirmation (a cart bump, a wishlist
  heart) also updates a label or shows a message.
- **The hidden starting state is applied by JavaScript, never by CSS.** If the
  script fails to load or `IntersectionObserver` is missing, the page renders
  in full with no animation — it never renders blank.
- **`prefers-reduced-motion: reduce` stands the whole layer down**, and
  `forced-colors: active` restores the hero headline to a flat system colour,
  since high-contrast mode drops the background image it is clipped from.

Gradients under white text are constrained the same way flat fills are: both
stops have to clear 4.5:1 on their own. That is why the primary button runs
green-700→green-800 rather than into the brighter green-600, and why the hero
headline's sweep shifts green→teal instead of green→light-green — green-600 is
only 2.7:1 against the hero's own pale green backdrop.

---

## Languages

All four projects ship in **English, Simplified Chinese and Japanese**.

Each client has a language picker — the storefront header, the admin topbar and
the Android account screen — and remembers the choice locally. For a signed-in
user it is also saved on the account (`PATCH /users/language`), so the same
person sees the same language on the next device.

**How a request picks its language.** The API resolves, most explicit first:
`?lang=ja` → the `X-Language` header the clients send → the signed-in user's
saved preference → `Accept-Language` → English. The resolved tag comes back in
`Content-Language`, and `GET /api/v1/languages` lists what is on offer.

**Two layers are translated.**

- *Interface copy* lives in catalogues: `backend/src/i18n/locales/*.json`,
  `frontend/src/i18n/locales/*.js`, `admin-panel/src/i18n/locales/*.js` and
  `android/app/src/main/res/values{,-zh,-ja}/strings.xml`. Components reference
  keys, never English prose.
- *Catalogue content* — product, category and banner copy — lives in a
  `translations.{en,zh,ja}` sub-document on the document itself. The canonical
  top-level fields stay the English original and the fallback, so an
  untranslated product still renders its English name rather than a blank.
  The admin forms have a per-language tab for editing them, and `npm run seed`
  loads trilingual copy from `backend/src/seed/translations.js`.

Storefront responses fold the right language into the flat fields, so clients
still receive `{ name, description }` and never see the storage shape. Admin
responses keep the whole sub-document so the panel can edit every language.

**Prices stay in USD** in every language; only number and date formatting
follows the locale. Adding a currency layer would mean exchange rates and a
`currency` field on stored orders — deliberately out of scope.

**Adding a language** means adding a locale file to each of the four catalogues
(keep the key sets identical), extending `LOCALES` in `backend/src/i18n/index.js`
and `frontend/src/i18n/constants.js`, adding a `values-xx/` folder plus an entry
in `android/app/src/main/res/xml/locales_config.xml`, and adding the copy to
`backend/src/seed/translations.js`.

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
