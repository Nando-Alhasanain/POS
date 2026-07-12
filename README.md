<p align="center">
  <img src="./logo%20kasir.png" alt="POS TOKO" width="120" />
</p>

<h1 align="center">POS TOKO</h1>

<p align="center">
  Aplikasi kasir desktop offline-first untuk toko, dibangun dengan React, TypeScript, Tauri, dan SQLite.
</p>

## Fitur Utama

- Transaksi kasir dengan metode bayar tunai, transfer, QRIS, debit, kredit, dan lainnya.
- Manajemen produk, kategori, satuan jual, barcode, SKU, dan foto produk.
- Stok masuk, penyesuaian stok, dan riwayat pergerakan stok.
- Riwayat transaksi, pembatalan transaksi, dan cetak ulang struk.
- Laporan penjualan, produk terlaris, laba kotor, dan ringkasan pembayaran.
- Cetak struk thermal ESC/POS lewat Windows printer.
- Akun admin dan kasir dengan pembatasan akses berdasarkan role.
- Backup dan restore data toko, database, foto produk, dan logo struk.
- Auto-update melalui GitHub Releases.

## Instalasi Komputer Kasir

Download installer terbaru dari halaman release:

https://github.com/Nando-Alhasanain/POS/releases/latest

Untuk instalasi awal, cukup jalankan file installer:

```text
POS.TOKO_x.x.x_x64-setup.exe
```

File `.sig` dan `update.json` tidak perlu dicopy manual ke komputer kasir. Keduanya dipakai aplikasi untuk proses auto-update.

## Auto-Update

Aplikasi mengecek update dari endpoint berikut:

```text
https://github.com/Nando-Alhasanain/POS/releases/latest/download/update.json
```

Update akan dicek setelah user login ke aplikasi. Jika versi baru tersedia, aplikasi akan menawarkan download dan install update.

## Development

Install dependency:

```powershell
npm install
```

Jalankan mode development Tauri:

```powershell
npm run tauri:dev
```

Build frontend:

```powershell
npm run build
```

Build production installer:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = (Get-Content -Raw "src-tauri\update-key.key").Trim()
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "<password-signing-key>"
npm run tauri:build:prod
```

## Struktur Data

- Database SQLite disimpan di folder app data milik aplikasi.
- Foto produk disimpan di folder `product-images` pada app data.
- Logo struk disimpan di folder `store-assets` pada app data.
- Backup lengkap memakai format `.postoko-backup`.

## Catatan Keamanan

- Jangan commit atau upload `src-tauri/update-key.key`.
- Simpan private signing key dan password updater di tempat aman.
- File `.sig` boleh dipublish di GitHub Release karena hanya berisi signature artifact.
