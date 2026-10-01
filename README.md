# Register POS (GitHub → Vercel)

## Repo layout (must be at the repo root)
```
index.html        the register + customer ordering page
api/              serverless functions (orders, menu, ping)
package.json
vercel.json       preconfigured: no framework, no build step
.gitignore
```

## Deploy from GitHub
1. Create a GitHub repo (private is fine) and upload all of these files to its root
   (GitHub → Add file → Upload files → Commit).
2. Vercel → **Add New → Project → Import** that repo → **Deploy**.
   Nothing needs configuring: `vercel.json` already sets framework = Other, no build.
3. Project → **Storage → Upstash → Redis** → create → **Connect to Project** (Production ticked).
4. Project → **Settings → Environment Variables** → add `POS_PIN` = your staff PIN (6+ digits), Production ticked.
5. **Deployments → latest → ⋯ → Redeploy** (variables only apply to new deployments).
6. Check `https://<your-app>.vercel.app/api/ping` → `{"ok":true,"missing":[]}`.

Every later change: commit to GitHub and Vercel redeploys automatically.
Never commit secrets: `POS_PIN` and the Redis keys live only in Vercel's Environment Variables.

## Using it
- Till device: open the site, enter the PIN when asked. Customers tab should say "Order server connected".
- Customers order at `https://<your-app>.vercel.app/#menu` (the QR code on the Customers tab).
- New orders pop up on the register within ~8 seconds, with a beep and Accept / Decline.

## Notes
- Without steps 3–4 the register still works on-device; only cross-device QR ordering is off.
- Sales, stock and customers are stored in the till browser's localStorage, not on the server.
