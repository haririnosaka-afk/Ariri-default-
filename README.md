# KAZAMA AI

A clean Next.js AI video studio scaffold, built independently from scratch.

## Environment variables

Set `RELAYROUTER_API_KEY` in Vercel Project Settings → Environment Variables. Never expose this key in client-side code.

## Run locally

```bash
npm install
npm run dev
```

## Current integration notes

- Model discovery uses RelayRouter `GET /v1/models`.
- The current generic video adapter submits to `POST /v1/videos` and polls `GET /v1/videos/{id}`.
- RelayRouter documents provider-specific routes for several video models. Seedance 2.5 requires its own documented adapter before it should be presented as supported; do not assume every model accepts the generic route.
- Add persistent storage (Supabase/Postgres) before relying on history across devices.
