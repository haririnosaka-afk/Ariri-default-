# KAZAMA AI — Seedance Studio

Independent Next.js app focused on Seedance 2.5 via RelayRouter.

## Vercel environment variable
Set `RELAYROUTER_API_KEY` to the API token created in RelayRouter Console → API Tokens. Never expose the key in client-side code.

## Local development
`npm install && npm run dev`

## Integration
- Seedance 2.5 create task: `POST https://api.relayrouter.ai/api/v3/contents/generations/tasks`
- Query task: `GET https://api.relayrouter.ai/api/v3/contents/generations/tasks/{id}`
- Image hosting: RelayRouter imageproxy upload endpoint.
- Supported duration 4–30 sec, resolutions 480p/720p/1080p, ratios 16:9, 4:3, 1:1, 3:4, 9:16, 21:9, adaptive.

## Important
Generation and polling require an active RelayRouter API key and model access/credits. Image uploads are sent to RelayRouter's image-hosting service and return public URLs for the provider to fetch. Do not upload sensitive images.
