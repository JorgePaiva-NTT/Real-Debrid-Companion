# RD Companion — Web Version

A React (Next.js) web app for Real-Debrid. Deploy to Vercel and share the URL with anyone.

## Features

- 📊 Traffic usage chart (last 30 days)
- 📋 Torrents list with search, pagination, and delete
- 📥 Downloads list with direct download links
- 🔓 Link unrestricting and magnet adding
- 🔒 Token stays server-side (your friend never sees it)

## Deploy to Vercel (Free)

### 1. Push to GitHub

Make sure the `web/` folder is committed to your repo.

### 2. Import to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repo
3. Set **Root Directory** to `web`
4. Add Environment Variable:
   - Name: `RD_TOKEN`
   - Value: your Real-Debrid API token (get it from https://real-debrid.com/apitoken)
5. Click **Deploy**

### 3. Share the URL

Once deployed, Vercel gives you a URL like `https://rd-companion-xxx.vercel.app`. Share it with your friend — no login needed.

## Local Development

```bash
cd web
cp .env.local.example .env.local  # add your token
npm install
npm run dev
```

Open http://localhost:3000

## Architecture

```
web/
├── app/
│   ├── api/rd/[...path]/route.js  ← Proxy to RD API (hides token, solves CORS)
│   ├── layout.js
│   ├── page.js                     ← Main page with tab navigation
│   └── globals.css
├── components/
│   ├── Dashboard.js
│   ├── TrafficChart.js
│   ├── Unrestrict.js
│   ├── Torrents.js
│   └── Downloads.js
├── lib/
│   ├── rd.js                       ← Client-side API calls (→ /api/rd/...)
│   └── utils.js
└── package.json
```

## Security Note

Your RD token is stored as a Vercel environment variable and **never** sent to the browser. The API routes run server-side and proxy requests on behalf of all users.
