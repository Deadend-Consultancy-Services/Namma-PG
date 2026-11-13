<<<<<<< HEAD
# PG Platform

Production-ready PG (paying guest) management platform. **No dummy or seed data anywhere.** Everything is stored in MongoDB Atlas, files live in Cloudinary, and screens update live through Socket.io.

```
pg-platform/
  backend/   Node.js + Express + Mongoose API, Socket.io, Razorpay, cron jobs
  web/       React + Vite + Tailwind  -> PG OWNER dashboard
  mobile/    React Native (Expo dev build) -> TENANT app
```

## 0. Quick start on Windows (PowerShell)
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned   # once, so npm works
cd backend ; npm install ; npm run dev        # terminal 1  -> API on http://localhost:5002
cd web     ; npm install ; npm run dev        # terminal 2  -> http://localhost:5173
```
`backend/.env` and `web/.env` are already filled in for local development (ports match: API 5002). Keep these files private: never upload them to GitHub or share them.

## 1. Prerequisites
- Node.js 18+ (20 recommended)
- A MongoDB Atlas cluster (Atlas replica set is required: transactions are used)
- A Cloudinary account
- A Razorpay account (Test Mode is fine to start)
- An SMS provider for OTP in production (MSG91 or Fast2SMS). For local development you can use `SMS_PROVIDER=console`, which prints the OTP in the backend terminal. This is refused when `NODE_ENV=production`.

## 2. Backend
```bash
cd backend
cp .env.example .env      # then fill in every value
npm install
npm run dev               # http://localhost:5000
```
Required `.env` values: `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET` (long random strings, 24+ chars), `CLIENT_URL` (owner web origin, comma separated for several), `CLOUDINARY_*`. Razorpay and SMS values are needed for payments / real OTP.
Never commit `.env`. The server refuses to start if configuration is missing.

Generate secrets: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

MongoDB Atlas: Network Access must allow your server IP; use a dedicated database user with read/write on your database only. Put the database name in the URI (`...mongodb.net/pgplatform?retryWrites=true&w=majority`).

## 3. Owner web dashboard
```bash
cd web
cp .env.example .env      # VITE_API_URL=http://localhost:5000
npm install
npm run dev               # http://localhost:5173
npm run build             # production build in dist/
```

## 4. Tenant mobile app
Razorpay's native SDK does not run in Expo Go, so use a development build.
```bash
cd mobile
cp .env.example .env      # EXPO_PUBLIC_API_URL=http://<your-computer-LAN-IP>:5000
npm install
npx expo prebuild
npx expo run:android      # or: npx expo run:ios (macOS)
```
Change `bundleIdentifier` / `package` in `app.json` to your own id before publishing.

## 5. First run (no seed data)
1. Open the web app, **Get Started -> I am a PG Owner -> Create account** and verify the OTP.
2. Add a Property, then Rooms (beds are created from the sharing type), Facilities, Food Menu, Visit slots.
3. Onboard a tenant (Tenants -> Onboard). The tenant then installs the app, chooses **Tenant -> Create account** with the SAME phone number, and is linked to the room automatically.
4. Tenants who are not onboarded can still sign up and use search, visit booking and reviews.

## 6. Razorpay setup
1. Dashboard -> API Keys -> generate Test keys; put `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` in `backend/.env`.
2. Dashboard -> Webhooks -> add `https://YOUR_API_DOMAIN/api/webhooks/razorpay`, set a secret (= `RAZORPAY_WEBHOOK_SECRET`), enable `payment.captured`, `order.paid`, `payment.failed`. For local testing expose the API with ngrok.
3. Payment flow: app creates an order -> Razorpay Checkout (UPI incl. PhonePe, cards, netbanking) -> backend verifies the signature -> webhook confirms (idempotent) -> owner dashboard and tenant app update live.
4. Going live: complete Razorpay KYC, swap in Live keys and the live webhook secret. Decide how rent settles to each owner (your account vs Razorpay Route linked accounts) with Razorpay support.

## 7. Production checklist
- `NODE_ENV=production`, HTTPS only, real `SMS_PROVIDER`, strong rotated secrets
- `CLIENT_URL` = your real web domain(s), never `*`
- Atlas IP allow-list + backups enabled
- Webhook URL is public HTTPS and shows successful deliveries in Razorpay
- Deploy backend (Render / Railway / AWS), web (Vercel / Netlify), mobile via EAS Build
- Run a real small payment end to end and confirm live dashboard updates

## Notes on behaviour
- Dashboard cards: *Allocated* = beds with an active tenant, *Occupied* = allocated and already moved in, *Reserved* = allocated with a future move-in date, *Vacant* = free beds.
- KYC files are stored as private Cloudinary assets and opened only through 5-minute signed links.
- Rent records are created automatically each month for every active tenant; unpaid ones become Overdue after the due date.
- Vacate notices complete automatically on the vacate date (daily job) and free the bed.


## 8. Going live (deployment) and the Razorpay "website link"
Razorpay's live activation asks for a website or app link. You can **skip that step** and keep using Test Mode while you build. When you are ready:
1. **Deploy the API** (Render / Railway / AWS). Set every variable from `backend/.env` in the host's settings, `NODE_ENV=production`, a real `SMS_PROVIDER` + `SMS_API_KEY`, and `CLIENT_URL` = your web domain (no `*`).
2. **Deploy the web app** (Vercel / Netlify, free). Build command `npm run build`, output `dist`, env `VITE_API_URL=https://your-api-domain`. `vercel.json` and `public/_redirects` are already included for page routing. Also set `VITE_BUSINESS_NAME`, `VITE_SUPPORT_EMAIL`, `VITE_SUPPORT_PHONE`, `VITE_BUSINESS_ADDRESS` so the policy pages show your real contact details.
3. Give Razorpay your deployed web link. Razorpay reviews that the site shows **Terms & Conditions, Privacy Policy, Refund/Cancellation Policy and Contact Us**. These are built in at `/terms`, `/privacy`, `/refund-policy`, `/contact` and linked from the home page. Read them and adjust the wording to your business (ideally with a lawyer) before submitting.
4. In Razorpay add the webhook `https://your-api-domain/api/webhooks/razorpay`, switch to Live keys, and put them in the API's environment variables.
=======
# Namma-PG
Namma PG 
>>>>>>> f1871873d0b0df39ad79179dd6e8e86d47ece6d2
