# Register POS (GitHub → Vercel + Firebase)

## Repo layout (must be at the repo root)
```
index.html        the register + customer ordering page
api/              serverless functions (orders, menu, ping) - uses Firebase Firestore
package.json      lists the firebase-admin dependency (Vercel installs it automatically)
vercel.json       preconfigured: no framework, no build step
.gitignore
```

## 1. Firebase (once)
1. console.firebase.google.com → **Add project** (Analytics not needed).
2. **Build → Firestore Database → Create database**. Choose **Production mode** and the location nearest you.
   (Production mode blocks all direct client access; only your Vercel server can read/write.)
3. **Project settings (gear) → Service accounts → Generate new private key** → a `.json` file downloads.
   Keep it secret. Never upload it to GitHub.

## 2. Vercel
1. Import the GitHub repo → Deploy (nothing to configure).
2. **Settings → Environment Variables** (tick Production), add:
   - `FIREBASE_SERVICE_ACCOUNT` = open the downloaded .json in a text editor, copy **everything**, paste.
   - `POS_PIN` = your staff PIN (6+ digits).
3. **Deployments → latest → ⋯ → Redeploy**.
4. Optional: **Settings → Functions → Function Region** → pick the region closest to your Firebase location (faster orders).

## 3. Check
Sign in to the register and tap **QR orders** in the top bar. Every line should show ✓.
Customers order at `https://<your-app>.vercel.app/#menu`.
New orders pop up on the register within ~8 seconds with Accept / Decline.

## Notes
- Orders are stored in Firestore collection `pos_orders` and auto-deleted after 3 days.
- Rate-limit and PIN-lockout counters live in `pos_rl` / `pos_fail`. Optional: add a Firestore TTL policy on the
  `exp` field of those collections to clean them automatically.
- Firestore free plan: 50k reads / 20k writes per day, plenty for a shop.
- Sales, stock and customers stay in the till browser's localStorage, not on the server.
