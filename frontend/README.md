# ShopWorld — Storefront

Customer-facing shop. React 18 + Vite 5, React Router 6, Zustand, Axios.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/
npm run preview
```

The API must be running first (see `../backend`).

## Configuration

`.env`:

```
VITE_API_URL=http://localhost:5000/api/v1
VITE_ASSET_URL=http://localhost:5000
```

Restart the dev server after changing these — Vite reads them at boot.

## Routes

| Path                        | Screen                                   | Auth |
| --------------------------- | ---------------------------------------- | ---- |
| `/`                         | Home                                     | —    |
| `/products`                 | Listing with filters and sorting         | —    |
| `/product/:slug`            | Product detail, reviews, related         | —    |
| `/cart`                     | Cart (guest cart lives in localStorage)  | —    |
| `/login`, `/register`       | Auth                                     | —    |
| `/checkout`                 | 3-step checkout                          | yes  |
| `/order-success/:orderNumber` | Confirmation                           | yes  |
| `/orders`, `/orders/:id`    | History, detail + tracking timeline      | yes  |
| `/account/*`                | Profile, addresses, security             | yes  |
| `/wishlist`                 | Saved products                           | yes  |

## Structure

```
src/
  api/        axios client (token refresh) + endpoint functions
  store/      zustand: auth, cart, toasts
  components/ Header, Footer, MobileNav, ProductCard, Icons, shared ui
  pages/      one file per route
  styles/     global.css - the whole design system
  utils/      formatting helpers and shared constants
```

## Notes

- **Guest cart.** Signed-out shoppers get a `localStorage` cart whose totals are computed with
  the same formula the server uses. On sign-in `POST /cart/merge` folds it into the account cart.
- **Token refresh.** A 401 triggers one shared refresh call; every request waiting on it replays
  afterwards. If the refresh fails, the app dispatches `auramart:signed-out` and clears state.
- **Styling** is plain CSS with custom properties — no Tailwind or CSS-in-JS build step.
