# AuraMart — Admin Panel

Staff dashboard. React 18 + Vite 5, Recharts, Zustand, Axios.

## Run

```bash
npm install
npm run dev        # http://localhost:5174
npm run build      # dist/
```

Sign in with `admin@auramart.com` / `Admin@123` (or the `manager@` account).
Customer accounts are rejected at the login screen and by the API.

## Configuration

`.env`:

```
VITE_API_URL=http://localhost:5000/api/v1
VITE_ASSET_URL=http://localhost:5000
```

## Pages

| Path           | What it does                                                             |
| -------------- | ------------------------------------------------------------------------ |
| `/`            | KPIs, sales-over-time, sales by category, customer growth, recent orders  |
| `/products`    | CRUD, image upload, active toggle, stock and status filters              |
| `/categories`  | CRUD with parent nesting and product counts                              |
| `/inventory`   | Low/out-of-stock list with inline restocking                             |
| `/orders`      | Status tabs, search, detail drawer, guarded status transitions           |
| `/customers`   | Search, detail with lifetime stats, activate/deactivate, CSV export      |
| `/promotions`  | Coupon CRUD (percent/fixed, caps, usage limits, expiry)                  |
| `/reviews`     | Publish/hide/delete; product ratings recompute automatically             |
| `/content`     | Banner CRUD for the storefront hero, promo strip and mobile app          |
| `/reports`     | Orders per day, revenue by category, new customers, best sellers         |
| `/settings`    | Account, environment, password change                                    |

## Notes

- **Order status is a state machine**, mirrored from the API: pending → processing → shipped →
  delivered, with cancel allowed only before shipping. The UI offers only legal transitions,
  and the server rejects anything else.
- **Cancelling an order** restores stock and marks the payment refunded.
- **Charts** use one shared categorical palette (`src/utils/constants.js`) so every screen
  colours the same category identically.
- **CSV export** is fetched with the bearer token and handed to the browser as a blob.
