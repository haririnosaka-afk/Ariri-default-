# KAZAMA AI — Dola Pool setup

KAZAMA is the web interface. Dola Pool is the provider-side service that owns the provider sessions, account scheduler, task queue, and account administration UI.

## 1. Required Vercel environment variables

Set these in the Vercel project **kazama-ai** → Settings → Environment Variables:

- `DOLA_POOL_BASE_URL`: the HTTPS base URL of your own Dola Pool deployment (no trailing slash required).
- `DOLA_POOL_API_KEY`: a customer API key created in the Dola Pool admin panel.

Do not put the API key in browser code, GitHub, chat messages, or a public environment variable. Keep it server-side only. Redeploy after changing environment variables.

## 2. Add/manage provider accounts

Open the Dola Pool dashboard using its own admin URL (the same base URL configured above). Sign in to its admin panel and add/manage only accounts you are authorized to use. KAZAMA intentionally displays aggregate health information only; provider cookies, passwords, proxy credentials, and account names are not exposed in the browser.

The Dola Pool service is responsible for its own account validation, scheduling, cooldowns, and provider quota enforcement. Accounts that have exhausted provider limits should remain unavailable until the provider resets or reauthorizes them. KAZAMA does not bypass provider quotas or switch accounts to evade an exhausted free allowance.

## 3. Verify the connection

After deployment, open:

- `/api/pool` — aggregate pool health and the dashboard link.
- `/api/models` — model availability configured in the KAZAMA UI.

The KAZAMA home page shows total, healthy, cooldown, running, and queued counts. A pool can be connected but report no capacity; add/repair authorized accounts in the Dola Pool admin panel in that case.

## 4. Model input limits currently configured in KAZAMA

| Provider model ID | Duration choices |
| --- | --- |
| `seedance-2.0-fast` (Dola) | 5, 10 seconds |
| `seedance-2.5` (Dola) | 5, 10, 30 seconds |
| `doubao-seedance-2.0-mini` | 4–15 seconds |
| `doubao-seedance-2.0-fast` | 4–15 seconds |
| `doubao-seedance-2.0` | 4–15 seconds |
| `doubao-seedance-2.5` | 4–30 seconds |

Actual availability remains subject to the selected provider account, service configuration, upstream model access, and quota. The 1080p option is an upscale request and depends on the Dola Pool upscale service being enabled; it is not a promise that the upstream generates native 1080p.

## 5. Generation safety

A generation request is submitted once and then polled by task ID. Do not automatically resubmit a prompt when a request times out; first check the existing task to avoid duplicate jobs or charges. No paid fallback should be enabled without an explicit decision by the owner.
