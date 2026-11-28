# KAZAMA AI — Jimeng Seedance 2.5 Flash (file baru, additive)

Ini jalur Jimeng yang ditambahkan 2026-11-28, **tanpa mengubah NexaBot,
PosBot, Studio, atau model lain** di KAZAMA AI.

## File baru

- `lib/jimeng.ts` — client Jimeng web (diadaptasi dari dsh-jimeng v1.1.0, MIT).
- `app/api/jimeng/route.ts` — API server-side: catalog / credit / status / generate.
- `app/jimeng/page.tsx` — halaman generate di `/jimeng`.

Tidak ada file lama yang diubah.

## Model yang ditambahkan

- **Seedance 2.5 Flash (Jimeng)** — `dreamina_seedance_45_flash`, durasi 4–30 detik,
  rasio 16:9 / 9:16 / 1:1, resolusi 480p / 720p.
- **Seedance 2.5 (Jimeng)** — `dreamina_seedance_45_pro`, durasi 4–30 detik.

Katalog live dari Jimeng (dicek 2026-11-28, pakai sessionid dummy):
Flash 4–30 detik, dari `frames` 96–720 pada 24 fps. API baru Jimeng tidak
lagi mengirim `duration_option`, jadi durasi diturunkan dari `frames`.

## Biaya

Generate Jimeng **TIDAK memotong Credit KAZAMA**. Jimeng memakai kredit
gratis akun Jimeng sendiri (pool `JIMENG_SESSIONIDS`). Itu sengaja, sesuai
tujuan pool: pakai kuota gratis harian akun Jimeng.

## Env yang harus diisi di Vercel

Di project `kazama-ai` → Settings → Environment Variables, tambahkan:

```
JIMENG_SESSIONIDS=sessionid_jimeng1,sessionid_jimeng2
```

Satu sessionid per akun Jimeng, dipisah koma. Boleh juga 1 header Cookie
lengkap lewat `JIMENG_COOKIE`. **Jangan paste sessionid di chat dan jangan
commit ke GitHub.** Setelah isi env, redeploy.

## Cara tes (urut, gratis dulu)

1. Login KAZAMA, buka `/jimeng`.
2. `GET /api/jimeng?resource=catalog` — harus ada Flash dengan durasi 4–30.
3. `GET /api/jimeng?resource=credit` — lihat sisa kredit akun Jimeng.
4. Generate 10 detik dulu di `/jimeng`, kalau berhasil baru coba 30 detik.

## Status verifikasi

- Katalog + dryRun 30 detik sudah terverifikasi di doubao-pool (2026-11-28):
  `duration_ms=30000`, `model_req_key=dreamina_seedance_45_flash`.
- **Generate live 30 detik BELUM terverifikasi.** Butuh 1 akun Jimeng asli.
  Kalau submit ditolak `shark not pass` / butuh `a_bogus`, berarti jalur
  HTTP murni gagal di akun itu, dan opsinya tinggal worker Playwright
  di luar Vercel, atau jalur berbayar (Ark / RelayRouter).

## Risiko

- Reverse-engineered, bukan API resmi Jimeng. Endpoint bisa berubah sewaktu-waktu.
- Akun Jimeng bisa kena limit / blokir kalau terlalu agresif.
- Sessionid bisa expired, harus ambil ulang.
- Jangan pakai untuk jualan ke orang lain tanpa memahami ToS Jimeng.
