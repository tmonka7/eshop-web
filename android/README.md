# AuraMart — Android App

Native customer app for the AuraMart store.

- **Language:** Java (no Kotlin anywhere in the project)
- **Gradle:** 8.13 · **Android Gradle Plugin:** 8.9.1 · **JDK:** 17
- **compileSdk/targetSdk:** 35 · **minSdk:** 24 (Android 7.0)
- Retrofit + OkHttp + Gson, Glide, Material 3, ViewBinding

## First run

### 1. Generate the Gradle wrapper

This repository does not ship `gradle-wrapper.jar` (a binary). Create it once:

**Android Studio** — open the `android/` folder; it creates the wrapper on first sync.

**Command line** — with Gradle 8.13 installed:

```bash
cd android
gradle wrapper --gradle-version 8.13
```

`gradle/wrapper/gradle-wrapper.properties` already pins 8.13, so the wrapper stays on that version.

### 2. Point the app at your API

`app/build.gradle` sets the base URL per build type:

| Build type | `API_BASE_URL`                      | Use for                                   |
| ---------- | ----------------------------------- | ----------------------------------------- |
| debug      | `http://10.0.2.2:5000/api/v1/`      | Android **emulator** (host loopback alias)|
| release    | `https://api.auramart.com/api/v1/`  | your deployed API                         |

On a **physical device**, replace `10.0.2.2` with your machine's LAN IP (for example
`http://192.168.1.20:5000/api/v1/`) and add that IP to `CORS_ORIGINS` in the backend `.env`.

### 3. Build and install

```bash
cd android
./gradlew assembleDebug          # APK at app/build/outputs/apk/debug/
./gradlew installDebug           # install onto the running emulator/device
```

Sign in with `john@example.com` / `Password@123`, or tap **Browse as guest**.

## Screens

| Screen                 | What it does                                                            |
| ---------------------- | ----------------------------------------------------------------------- |
| Splash                 | Validates a stored token, then routes to Login or Main                   |
| Login / Register       | JWT auth, one-tap demo credentials, guest browsing                       |
| Home                   | Hero banner carousel, category rail, featured row, best-seller grid      |
| Categories             | Full category list with product counts                                   |
| Product list           | Search, sort, endless scroll, pull to refresh                            |
| Product detail         | Image pager, variants, quantity, reviews, related products, write review |
| Cart                   | Quantity stepper, remove, promo code, live totals, free-shipping nudge   |
| Checkout               | Saved addresses, add address, payment method, mock card capture          |
| Order success          | Confirmation with items, total and tracking number                       |
| Orders                 | Status chips, endless scroll                                             |
| Order detail           | Tracking timeline, items, payment summary, cancel                        |
| Account                | Profile edit, addresses, wishlist, settings, sign out                    |
| Addresses / Wishlist   | Full CRUD / saved products grid                                          |

## Project layout

```
app/src/main/java/com/auramart/app/
  AuraMartApp.java            Application: session bootstrap + expiry handling
  data/
    model/Models.java         every API DTO in one file
    remote/ApiService.java    Retrofit interface (all endpoints)
    remote/ApiClient.java     OkHttp wiring, bearer token, 401 -> refresh -> replay
    local/SessionManager.java tokens, cached profile, wishlist ids, cart badge
    repository/Repo.java      unwraps the API envelope into one callback
  ui/
    SplashActivity            auth/routing decision
    auth/                     LoginActivity, RegisterActivity
    main/MainActivity         bottom nav host + cart badge
    home/ categories/ cart/ account/     the four tab fragments
    products/ product/ checkout/ orders/ other activities
    adapter/                  ProductAdapter + Adapters (the rest)
  util/                       Formats, Images, Ui, Validators
```

## Notes

- **Token refresh** happens inside an OkHttp interceptor: on a 401 it refreshes once
  (guarded by a lock so parallel calls do not stampede) and replays the original request.
  If the refresh fails the session is cleared and the app returns to Login.
- **Image hosts** are rewritten by `util/Images.normalize()`. The API stores absolute URLs
  built from its `PUBLIC_URL` (usually `localhost`), which an emulator cannot resolve, so
  any loopback host is swapped for the API host the app is configured with.
- **Cleartext HTTP** is permitted only for `10.0.2.2`, `localhost` and `127.0.0.1`
  (`res/xml/network_security_config.xml`). Production traffic must be HTTPS.
- The **payment step is a mock**, matching the backend: any card number ending in `0000`
  is declined so the failure path is testable.
