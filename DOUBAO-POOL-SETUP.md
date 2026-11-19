# KAZAMA AI — Doubao Account Pool Setup

Pool ini menggunakan API Key Volcengine Ark yang memang dimiliki atau diizinkan untuk digunakan. Pool ini tidak memakai password Doubao konsumen, Cookie browser, atau token sesi privat.

## Environment variable Vercel

Buka Vercel Project Settings → Environment Variables, lalu tambahkan DOUBAO_ARK_API_KEYS sebagai JSON array:

    [
      { "label": "Ark account 1", "apiKey": "YOUR_ARK_API_KEY", "baseUrl": "https://ark.cn-beijing.volces.com/api/v3" },
      { "label": "Ark account 2", "apiKey": "ANOTHER_ARK_API_KEY", "baseUrl": "https://ark.cn-beijing.volces.com/api/v3" }
    ]

Tambahkan juga DOUBAO_POOL_ACCESS_CODE dengan kode rahasia pilihanmu. Kode ini melindungi endpoint generator dari penggunaan publik. Redeploy setelah menyimpan. Buka /doubao untuk melihat status pool dan masukkan kode akses tersebut sebelum generate.

## API routes

- GET /api/doubao/health — status pool tanpa membocorkan API Key.
- POST /api/doubao/generate — membuat tugas video dan mengembalikan task ID serta slot provider.
- GET /api/doubao/status?id=TASK_ID&slot=0 — memeriksa tugas memakai key slot yang sama.

## Scheduler

Request dibagi round-robin dalam satu instance server yang berjalan. Jika menerima HTTP 429 (rate limit), scheduler mencoba key berikutnya. Respons 5xx dan timeout tidak diulang otomatis karena request mungkin sudah diterima dan dapat menimbulkan tagihan ganda. Ini scheduler best-effort, bukan antrean terdistribusi yang persisten.

## Endpoint resmi

Base URL: https://ark.cn-beijing.volces.com/api/v3
Create task: POST /contents/generations/tasks
Poll task: GET /contents/generations/tasks/{task_id}

Model ID:
- Seedance 2.5: doubao-seedance-2-5-260628
- Seedance 2.5 Flash: doubao-seedance-2-5-flash-261115
