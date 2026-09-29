# Register POS on Vercel

## Deploy
1. Put this folder in a Git repo (or run `npx vercel` inside it).
2. Import it in Vercel. Framework preset: **Other**. No build command, no output directory.
3. **Storage tab → Marketplace → Upstash Redis → create/connect** (free plan is fine). This adds the
   `KV_REST_API_URL` / `KV_REST_API_TOKEN` variables automatically.
4. **Settings → Environment Variables**: add `POS_PIN` (your staff PIN, e.g. 6+ digits).
5. Redeploy. Open the site, go to Customers, and the status should read "Order server connected".

Customers order at `https://<your-app>.vercel.app/#menu` (the QR code on the Customers tab points there).
Staff enter the PIN once per browser session when the first order poll runs.

## Notes
- Without step 3–4 the register still works fully on-device; only cross-device QR ordering is off.
- Register data (sales, stock, customers) lives in that browser's localStorage, not on the server.
  Use one device as the register, and back up via the app's export features.
