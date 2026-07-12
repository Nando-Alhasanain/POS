# PRD — Aplikasi POS Offline untuk Toko Bangunan & Retail

**Nama Produk Sementara:** POS TOKO
**Target Platform:** Desktop Windows  
**Target Pengguna:** Toko bangunan, toko retail kecil/menengah, toko grosir sederhana  
**Model Aplikasi:** Offline-first desktop app  
**Stack Rekomendasi:** React/Vite + Tauri + SQLite + Prisma/Drizzle  
**Versi Dokumen:** v1.0  
**Status:** Draft untuk MVP / Vibe Coding  

---

## 1. Ringkasan Produk

Aplikasi ini adalah **Point of Sales (POS) offline** untuk toko bangunan dan retail yang berjalan di komputer kasir. Aplikasi dirancang sederhana, ringan, dan tidak memiliki terlalu banyak fitur. Fokus utama aplikasi adalah membantu toko melakukan transaksi penjualan, mengelola produk, mengelola stok, mendukung satuan bertingkat, mencetak struk, serta membuat laporan dasar.

Aplikasi harus tetap dapat berjalan **tanpa koneksi internet**. Semua data utama disimpan secara lokal menggunakan SQLite di komputer kasir. Pengguna tidak perlu menginstal PostgreSQL, Node.js, atau dependency teknis lainnya saat implementasi. Hasil akhir aplikasi berupa installer Windows seperti `.exe` atau `.msi`.

---

## 2. Latar Belakang Masalah

Banyak toko bangunan dan retail kecil membutuhkan aplikasi kasir sederhana, tetapi aplikasi POS yang tersedia sering kali terlalu kompleks, berbasis cloud, atau memerlukan internet stabil. Di sisi lain, toko bangunan memiliki kebutuhan khusus seperti satuan bertingkat, misalnya:

- 1 dus = 12 pcs
- 1 roll = 100 meter
- 1 sak = 50 kg
- 1 ikat = 10 batang
- Barang bisa dijual satuan kecil maupun grosir

Aplikasi ini ditujukan untuk menjawab kebutuhan tersebut dengan pendekatan:

- Offline-first
- Mudah dipasang di PC kasir
- Fitur basic namun penting
- Mendukung satuan bertingkat
- Tidak terlalu kompleks untuk pengguna toko
- Mudah dikembangkan oleh developer yang terbiasa membuat web app

---

## 3. Tujuan Produk

### 3.1 Tujuan Utama

Membuat aplikasi POS desktop offline yang dapat digunakan oleh toko bangunan dan retail untuk:

1. Mengelola produk
2. Mengelola satuan produk
3. Menangani satuan bertingkat
4. Melakukan transaksi penjualan
5. Mengurangi stok otomatis
6. Mencetak struk
7. Melihat riwayat transaksi
8. Membuat laporan penjualan sederhana
9. Melakukan backup dan restore database

### 3.2 Tujuan Teknis

1. Aplikasi berjalan sebagai desktop app di Windows.
2. Aplikasi tetap berjalan tanpa internet.
3. Database tersimpan lokal menggunakan SQLite.
4. Installer mudah digunakan oleh pemilik toko/kasir.
5. Data tidak hilang saat aplikasi di-update.
6. Struktur database siap untuk pengembangan lanjutan.

---

## 4. Non-Goals / Bukan Prioritas MVP

Fitur berikut **tidak masuk MVP awal**:

1. Multi-cabang
2. Sinkronisasi cloud realtime
3. Aplikasi mobile
4. Dashboard owner online
5. Integrasi payment gateway langsung
6. Akuntansi lengkap
7. Manajemen hutang-piutang kompleks
8. Payroll karyawan
9. Loyalty point
10. Marketplace integration
11. Auto-update aplikasi
12. Multi-device dalam jaringan lokal
13. Sistem pajak kompleks
14. Integrasi e-faktur
15. CRM pelanggan tingkat lanjut

Fitur tersebut dapat dipertimbangkan setelah MVP stabil.

---

## 5. Target Pengguna

### 5.1 Admin / Pemilik Toko

Admin adalah pemilik toko atau orang yang dipercaya untuk mengelola data utama aplikasi.

Kebutuhan admin:

- Mengelola produk
- Mengatur harga
- Mengatur satuan produk
- Mengatur stok
- Melihat laporan penjualan
- Melakukan backup dan restore
- Mengelola akun kasir

### 5.2 Kasir

Kasir adalah pengguna harian yang melakukan transaksi penjualan.

Kebutuhan kasir:

- Mencari produk dengan cepat
- Scan barcode jika tersedia
- Menambahkan barang ke keranjang
- Memilih satuan jual
- Mengubah qty
- Menerima pembayaran
- Mencetak struk
- Melihat transaksi yang baru dilakukan

---

## 6. Platform dan Teknologi

### 6.1 Platform

- Windows 10
- Windows 11
- Target utama: PC kasir/laptop toko

### 6.2 Stack Teknis Rekomendasi

```txt
Frontend      : React + Vite
Desktop Shell : Tauri
Database      : SQLite
ORM           : Prisma atau Drizzle
Language      : TypeScript
Installer     : Tauri NSIS .exe
```

### 6.3 Catatan Pemilihan Stack

React + Vite lebih disarankan daripada Next.js untuk aplikasi desktop offline karena:

- Lebih sederhana
- Tidak membutuhkan SSR
- Tidak perlu API routes
- Cocok untuk single-page desktop app
- Integrasi dengan Tauri lebih ringan

Namun jika tetap ingin memakai Next.js, gunakan mode static export dan hindari fitur server-side.

---

## 7. Prinsip Produk

1. **Offline-first**  
   Semua fitur utama harus berjalan tanpa internet.

2. **Simple but reliable**  
   Lebih baik fitur sedikit tetapi stabil daripada banyak fitur tetapi rawan error.

3. **Kasir-friendly**  
   UI harus cepat, jelas, dan tidak membingungkan.

4. **Data safety first**  
   Backup, restore, dan penyimpanan database harus aman.

5. **Stock movement traceable**  
   Semua perubahan stok harus tercatat.

6. **Unit conversion safe**  
   Semua transaksi dengan satuan bertingkat harus dikonversi ke satuan dasar.

---

## 8. Scope MVP

### 8.1 Modul MVP

1. Authentication sederhana
2. Dashboard ringkas
3. Master produk
4. Master kategori
5. Master satuan
6. Satuan bertingkat per produk
7. Stok masuk dan penyesuaian stok
8. Transaksi penjualan
9. Cetak struk
10. Riwayat transaksi
11. Laporan penjualan sederhana
12. Backup dan restore database
13. Pengaturan toko
14. Pengaturan printer sederhana

---

## 9. Role dan Hak Akses

### 9.1 Role Admin

Admin dapat:

- Login
- Mengelola produk
- Mengelola kategori
- Mengelola satuan
- Mengelola harga
- Mengelola stok
- Melakukan transaksi
- Melihat laporan
- Melakukan backup dan restore
- Mengatur data toko
- Mengatur printer
- Mengelola user kasir

### 9.2 Role Kasir

Kasir dapat:

- Login
- Melakukan transaksi penjualan
- Mencetak struk
- Melihat riwayat transaksi miliknya
- Melihat stok produk secara terbatas

Kasir tidak dapat:

- Menghapus produk
- Mengubah harga master produk
- Melakukan restore database
- Mengakses laporan laba penuh
- Mengelola user

---

## 10. Fitur Detail

---

# 10.1 Authentication

## Deskripsi

Aplikasi memiliki sistem login sederhana untuk membedakan admin dan kasir.

## Kebutuhan

- User dapat login dengan username dan password.
- Password harus disimpan dalam bentuk hash.
- Saat pertama kali aplikasi dibuka, sistem membuat akun admin default atau menampilkan setup awal.
- User dapat logout.
- Role user menentukan akses menu.

## Field User

```txt
id
name
username
password_hash
role
is_active
created_at
updated_at
```

## Acceptance Criteria

- User dapat login dengan kredensial valid.
- User tidak dapat login dengan password salah.
- Role admin dan kasir memiliki menu berbeda.
- Password tidak disimpan dalam bentuk plain text.

---

# 10.2 Setup Awal Aplikasi

## Deskripsi

Ketika aplikasi pertama kali dijalankan dan database belum ada, sistem menjalankan setup awal.

## Flow

1. Aplikasi dibuka pertama kali.
2. Sistem mengecek apakah database sudah tersedia.
3. Jika belum, sistem membuat database SQLite.
4. Sistem menjalankan migration.
5. Sistem menampilkan halaman setup toko.
6. Admin mengisi nama toko dan akun admin.
7. Aplikasi masuk ke dashboard.

## Data Setup

- Nama toko
- Alamat toko
- Nomor telepon
- Nama admin
- Username admin
- Password admin

## Acceptance Criteria

- Database dibuat otomatis saat aplikasi pertama kali dijalankan.
- Admin pertama dapat dibuat tanpa perlu terminal.
- Setelah setup selesai, user diarahkan ke dashboard.

---

# 10.3 Dashboard

## Deskripsi

Dashboard menampilkan ringkasan singkat kondisi toko hari ini.

## Informasi yang Ditampilkan

- Total penjualan hari ini
- Jumlah transaksi hari ini
- Produk stok rendah
- Produk terlaris hari ini
- Shortcut ke transaksi baru
- Shortcut ke produk
- Shortcut ke laporan

## Acceptance Criteria

- Dashboard dapat dibuka oleh admin.
- Kasir dapat melihat dashboard versi sederhana.
- Data dashboard berubah sesuai transaksi hari ini.

---

# 10.4 Master Kategori

## Deskripsi

Kategori digunakan untuk mengelompokkan produk.

## Contoh Kategori

- Semen
- Cat
- Pipa
- Kabel
- Keramik
- Besi
- Alat listrik
- Sembako
- Minuman
- ATK

## Field

```txt
id
name
description
created_at
updated_at
```

## Fitur

- Tambah kategori
- Edit kategori
- Hapus kategori jika belum digunakan
- Pencarian kategori

## Acceptance Criteria

- Admin dapat membuat kategori baru.
- Kategori yang sudah dipakai produk tidak boleh dihapus sembarangan.
- Produk dapat dihubungkan ke kategori.

---

# 10.5 Master Satuan

## Deskripsi

Satuan digunakan sebagai unit barang, baik satuan dasar maupun satuan jual.

## Contoh Satuan

- pcs
- dus
- karton
- pack
- sak
- kg
- gram
- liter
- meter
- roll
- batang
- lembar
- ikat
- kaleng
- botol

## Field

```txt
id
name
symbol
description
created_at
updated_at
```

## Acceptance Criteria

- Admin dapat membuat satuan.
- Satuan memiliki symbol unik.
- Satuan yang sudah dipakai tidak boleh dihapus sembarangan.

---

# 10.6 Master Produk

## Deskripsi

Produk adalah data barang yang dijual di toko.

## Field Produk

```txt
id
name
sku
category_id
base_unit_id
stock_base
minimum_stock
purchase_price_base
default_selling_price_base
is_active
created_at
updated_at
```

## Catatan Penting

- `stock_base` selalu disimpan dalam satuan dasar.
- `base_unit_id` adalah satuan dasar produk.
- Harga grosir tidak disimpan di tabel produk utama, tetapi di tabel `product_units`.

## Contoh Produk

```txt
Nama produk      : Air Mineral Botol
Satuan dasar     : pcs
Stok dasar       : 240 pcs
Satuan jual      : pcs, pack, dus
```

```txt
Nama produk      : Kabel NYA 1.5mm
Satuan dasar     : meter
Stok dasar       : 500 meter
Satuan jual      : meter, roll
```

```txt
Nama produk      : Paku 5cm
Satuan dasar     : kg
Stok dasar       : 50 kg
Satuan jual      : kg, karung
```

## Fitur

- Tambah produk
- Edit produk
- Nonaktifkan produk
- Pencarian produk
- Filter kategori
- Kelola satuan jual produk
- Kelola barcode per satuan
- Kelola harga per satuan
- Lihat stok dalam satuan dasar

## Acceptance Criteria

- Admin dapat membuat produk dengan satuan dasar.
- Produk minimal harus memiliki satu product unit sebagai satuan dasar.
- Produk dapat memiliki lebih dari satu satuan jual.
- Produk nonaktif tidak muncul di kasir.

---

# 10.7 Satuan Bertingkat Produk

## Deskripsi

Satuan bertingkat memungkinkan satu produk dijual dalam beberapa satuan, misalnya pcs, pack, dus, roll, meter, kg, dan sebagainya.

## Prinsip Utama

1. Setiap produk punya satu satuan dasar.
2. Stok selalu disimpan dalam satuan dasar.
3. Satuan jual dikonversi ke satuan dasar.
4. Harga jual bisa berbeda untuk setiap satuan.
5. Barcode bisa berbeda untuk setiap satuan.
6. Transaksi harus menyimpan data konversi saat transaksi terjadi.

## Field Product Unit

```txt
id
product_id
unit_id
conversion_to_base
selling_price
barcode
is_base_unit
is_default
created_at
updated_at
```

## Contoh

Produk: Air Mineral Botol  
Satuan dasar: pcs

```txt
Satuan | Konversi ke pcs | Harga Jual | Barcode
pcs    | 1                | 4.000      | 899001
pack   | 12               | 45.000     | 899012
dus    | 24               | 85.000     | 899024
```

Produk: Kabel NYA  
Satuan dasar: meter

```txt
Satuan | Konversi ke meter | Harga Jual
meter  | 1                  | 8.000
roll   | 100                | 750.000
```

Produk: Paku  
Satuan dasar: kg

```txt
Satuan | Konversi ke kg | Harga Jual
kg     | 1              | 18.000
karung | 25             | 425.000
```

## Formula

```txt
qty_base = qty * conversion_to_base
subtotal = qty * selling_price
stock_after = stock_before - qty_base
```

## Acceptance Criteria

- Produk dapat dijual dalam satuan dasar.
- Produk dapat dijual dalam satuan grosir.
- Sistem mengurangi stok berdasarkan qty hasil konversi.
- Harga berubah otomatis saat satuan dipilih.
- Barcode pada product unit dapat langsung menentukan produk dan satuannya.
- Riwayat transaksi lama tidak berubah meskipun konversi atau harga master diubah.

---

# 10.8 Stok Masuk

## Deskripsi

Stok masuk digunakan untuk menambahkan stok produk ketika ada pembelian dari supplier atau penambahan manual.

## Flow

1. Admin membuka menu stok masuk.
2. Admin memilih produk.
3. Admin memilih satuan.
4. Admin mengisi qty.
5. Sistem mengonversi qty ke satuan dasar.
6. Sistem menambah `stock_base`.
7. Sistem mencatat ke `stock_movements`.

## Field Stock Movement

```txt
id
product_id
type
qty
unit_id
conversion_to_base
qty_base
note
reference_type
reference_id
created_by
created_at
```

## Type Stock Movement

```txt
IN
OUT
ADJUSTMENT
SALE
SALE_CANCEL
```

## Acceptance Criteria

- Admin dapat menambah stok.
- Stok bertambah dalam satuan dasar.
- Semua stok masuk tercatat dalam stock movement.
- Admin dapat melihat riwayat perubahan stok.

---

# 10.9 Penyesuaian Stok

## Deskripsi

Penyesuaian stok digunakan ketika stok fisik berbeda dari stok sistem.

## Flow

1. Admin memilih produk.
2. Admin melihat stok sistem.
3. Admin mengisi stok fisik aktual.
4. Sistem menghitung selisih.
5. Sistem menyimpan adjustment.
6. Sistem memperbarui `stock_base`.

## Acceptance Criteria

- Admin dapat menyesuaikan stok.
- Selisih stok tercatat.
- Penyesuaian membutuhkan catatan/alasan.
- Kasir tidak boleh melakukan penyesuaian stok.

---

# 10.10 Transaksi Penjualan

## Deskripsi

Modul utama untuk melakukan penjualan di kasir.

## Flow Utama

1. Kasir membuka menu transaksi baru.
2. Kasir mencari produk atau scan barcode.
3. Sistem menambahkan produk ke keranjang.
4. Kasir memilih satuan jual.
5. Kasir mengisi qty.
6. Sistem menghitung subtotal.
7. Sistem mengecek stok cukup atau tidak.
8. Kasir memilih metode pembayaran.
9. Kasir mengisi nominal bayar.
10. Sistem menghitung kembalian.
11. Transaksi disimpan.
12. Stok dikurangi otomatis.
13. Struk dapat dicetak.

## Field Sale

```txt
id
invoice_number
cashier_id
customer_name
total_gross
discount
total_net
payment_method
paid_amount
change_amount
status
created_at
updated_at
```

## Field Sale Item

```txt
id
sale_id
product_id
product_unit_id
product_name_snapshot
unit_name_snapshot
qty
conversion_to_base
qty_base
price
subtotal
created_at
```

## Status Sale

```txt
COMPLETED
CANCELLED
```

## Payment Method

```txt
CASH
TRANSFER
QRIS
DEBIT
CREDIT
OTHER
```

## Snapshot Data

Sale item harus menyimpan snapshot data berikut:

- Nama produk saat transaksi
- Nama satuan saat transaksi
- Harga saat transaksi
- Konversi saat transaksi

Tujuannya agar riwayat transaksi tetap akurat walaupun data produk berubah di masa depan.

## Acceptance Criteria

- Kasir dapat membuat transaksi baru.
- Kasir dapat menambah banyak item ke keranjang.
- Kasir dapat menjual produk dalam satuan berbeda.
- Sistem menolak transaksi jika stok tidak cukup.
- Sistem otomatis mengurangi stok setelah transaksi selesai.
- Invoice number unik.
- Transaksi tersimpan dengan status `COMPLETED`.
- Struk dapat dicetak setelah transaksi.

---

# 10.11 Pembatalan Transaksi

## Deskripsi

Admin dapat membatalkan transaksi jika terjadi kesalahan.

## Flow

1. Admin membuka riwayat transaksi.
2. Admin memilih transaksi.
3. Admin klik batalkan.
4. Admin wajib mengisi alasan.
5. Sistem mengubah status menjadi `CANCELLED`.
6. Sistem mengembalikan stok berdasarkan `qty_base`.
7. Sistem mencatat stock movement `SALE_CANCEL`.

## Acceptance Criteria

- Hanya admin yang dapat membatalkan transaksi.
- Transaksi yang sudah batal tidak bisa dibatalkan lagi.
- Stok kembali sesuai item transaksi.
- Alasan pembatalan tersimpan.

---

# 10.12 Cetak Struk

## Deskripsi

Aplikasi dapat mencetak struk transaksi.

## Tahap MVP

Untuk MVP, gunakan pendekatan print sederhana:

1. Preview struk di layar.
2. Print menggunakan dialog printer Windows.
3. Support printer thermal 58mm dan 80mm secara layout sederhana.

## Format Struk

Isi struk:

- Nama toko
- Alamat toko
- Nomor telepon
- Nomor invoice
- Tanggal dan waktu
- Nama kasir
- Daftar item
- Qty
- Satuan
- Harga
- Subtotal
- Diskon
- Total
- Bayar
- Kembali
- Catatan footer

## Contoh Struk

```txt
TOKO MAJU JAYA
Jl. Contoh No. 123
Telp: 08123456789

Invoice: INV-20260705-0001
Tanggal: 05/07/2026 14:30
Kasir: Budi

--------------------------------
Semen Tiga Roda
2 sak x 65.000        130.000

Paku 5cm
0.5 kg x 18.000         9.000

Kabel NYA
2.5 meter x 8.000      20.000
--------------------------------
Total                159.000
Bayar                200.000
Kembali               41.000
--------------------------------
Terima kasih
```

## Acceptance Criteria

- Struk dapat ditampilkan setelah transaksi.
- Struk dapat dicetak.
- Layout struk tetap terbaca pada ukuran thermal.
- Admin dapat mengatur nama toko dan footer struk.

---

# 10.13 Riwayat Transaksi

## Deskripsi

Menampilkan daftar transaksi yang pernah dilakukan.

## Filter

- Tanggal
- Nomor invoice
- Kasir
- Status
- Metode pembayaran

## Detail Transaksi

Detail transaksi menampilkan:

- Informasi invoice
- Daftar item
- Total
- Pembayaran
- Status
- Tombol cetak ulang
- Tombol batalkan khusus admin

## Acceptance Criteria

- User dapat melihat transaksi berdasarkan tanggal.
- Admin dapat melihat semua transaksi.
- Kasir hanya melihat transaksi miliknya jika dibatasi.
- Struk dapat dicetak ulang.

---

# 10.14 Laporan Penjualan

## Deskripsi

Laporan sederhana untuk melihat performa penjualan.

## Laporan MVP

1. Penjualan harian
2. Penjualan per periode
3. Produk terlaris
4. Stok rendah
5. Ringkasan metode pembayaran
6. Laba kotor sederhana

## Formula Laba Kotor Sederhana

```txt
gross_profit = total_sales - estimated_cost
estimated_cost = qty_base * purchase_price_base_snapshot
```

Untuk MVP, laba kotor boleh dibuat sederhana. Jika belum menyimpan snapshot harga modal, laporan laba dapat ditunda atau diberi label estimasi.

## Acceptance Criteria

- Admin dapat melihat total penjualan hari ini.
- Admin dapat filter laporan berdasarkan tanggal.
- Admin dapat melihat produk terlaris.
- Admin dapat melihat produk stok rendah.
- Laporan dapat diekspor ke CSV.

---

# 10.15 Import Produk

## Deskripsi

Import produk dari CSV/Excel dibutuhkan agar implementasi di toko tidak perlu input manual satu per satu.

## Format Minimal CSV

```csv
name,sku,category,base_unit,stock_base,purchase_price,selling_price,minimum_stock
Semen Tiga Roda,SMN001,Semen,sak,100,60000,65000,10
Kabel NYA 1.5mm,KBL001,Kabel,meter,500,6000,8000,50
Paku 5cm,PKU001,Paku,kg,50,14000,18000,5
```

## Import Product Unit Lanjutan

Untuk satuan bertingkat, bisa memakai format terpisah:

```csv
sku,unit,conversion_to_base,selling_price,barcode,is_base_unit
SMN001,sak,1,65000,,true
KBL001,meter,1,8000,,true
KBL001,roll,100,750000,,false
PKU001,kg,1,18000,,true
PKU001,karung,25,425000,,false
```

## Acceptance Criteria

- Admin dapat import produk dari CSV.
- Sistem memvalidasi data wajib.
- Sistem menampilkan error jika ada data tidak valid.
- Produk yang berhasil diimport masuk ke database.
- Satuan dan kategori bisa dibuat otomatis jika belum ada, atau user diminta memilih.

---

# 10.16 Export Data

## Deskripsi

Aplikasi dapat mengekspor data penting untuk arsip.

## Data yang Dapat Diekspor

- Produk
- Stok
- Transaksi
- Laporan penjualan
- Stock movement

## Format

- CSV untuk MVP
- Excel dapat ditambahkan kemudian

## Acceptance Criteria

- Admin dapat export produk ke CSV.
- Admin dapat export laporan penjualan ke CSV.
- File hasil export dapat dibuka di Excel.

---

# 10.17 Backup dan Restore Database

## Deskripsi

Karena aplikasi offline dan data tersimpan lokal, fitur backup dan restore wajib tersedia.

## Backup

Sistem membuat salinan file database SQLite ke lokasi yang dipilih user.

Format nama file:

```txt
backup-pos-YYYYMMDD-HHmmss.db
```

Contoh:

```txt
backup-pos-20260705-143000.db
```

## Restore

Sistem dapat mengganti database aktif dengan file backup yang dipilih user.

## Flow Backup

1. Admin membuka menu backup.
2. Admin klik backup.
3. Admin memilih folder tujuan.
4. Sistem menyalin file database.
5. Sistem menampilkan notifikasi berhasil.

## Flow Restore

1. Admin membuka menu restore.
2. Admin memilih file backup.
3. Sistem menampilkan konfirmasi risiko.
4. Sistem membuat backup otomatis dari database saat ini.
5. Sistem mengganti database dengan file backup.
6. Aplikasi restart.

## Acceptance Criteria

- Admin dapat backup database.
- File backup dapat disimpan ke flashdisk atau folder cloud drive.
- Admin dapat restore database.
- Restore membutuhkan konfirmasi.
- Sebelum restore, sistem membuat backup database saat ini.

---

# 10.18 Pengaturan Toko

## Deskripsi

Pengaturan toko digunakan untuk data yang muncul di struk dan identitas aplikasi.

## Field

```txt
store_name
store_address
store_phone
receipt_footer
currency
timezone
```

## Acceptance Criteria

- Admin dapat mengubah nama toko.
- Nama toko muncul di struk.
- Footer struk dapat diatur.

---

# 10.19 Pengaturan Printer

## Deskripsi

Pengaturan printer digunakan untuk memilih printer struk.

## MVP

- Pilih printer default dari sistem operasi
- Atur ukuran kertas: 58mm atau 80mm
- Preview struk
- Test print

## Acceptance Criteria

- Admin dapat melakukan test print.
- Admin dapat memilih ukuran struk.
- Struk tetap terbaca di printer thermal.

---

## 11. Data Model

## 11.1 Entity Relationship Overview

```txt
users
  └── sales

categories
  └── products

units
  ├── products.base_unit_id
  └── product_units

products
  ├── product_units
  ├── sale_items
  └── stock_movements

sales
  └── sale_items

product_units
  └── sale_items
```

---

## 11.2 Tabel Users

```txt
users
- id TEXT PRIMARY KEY
- name TEXT NOT NULL
- username TEXT UNIQUE NOT NULL
- password_hash TEXT NOT NULL
- role TEXT NOT NULL
- is_active BOOLEAN DEFAULT true
- created_at DATETIME
- updated_at DATETIME
```

---

## 11.3 Tabel Categories

```txt
categories
- id TEXT PRIMARY KEY
- name TEXT UNIQUE NOT NULL
- description TEXT
- created_at DATETIME
- updated_at DATETIME
```

---

## 11.4 Tabel Units

```txt
units
- id TEXT PRIMARY KEY
- name TEXT NOT NULL
- symbol TEXT UNIQUE NOT NULL
- description TEXT
- created_at DATETIME
- updated_at DATETIME
```

---

## 11.5 Tabel Products

```txt
products
- id TEXT PRIMARY KEY
- name TEXT NOT NULL
- sku TEXT UNIQUE
- category_id TEXT
- base_unit_id TEXT NOT NULL
- stock_base REAL DEFAULT 0
- minimum_stock REAL DEFAULT 0
- purchase_price_base REAL DEFAULT 0
- default_selling_price_base REAL DEFAULT 0
- is_active BOOLEAN DEFAULT true
- created_at DATETIME
- updated_at DATETIME
```

---

## 11.6 Tabel Product Units

```txt
product_units
- id TEXT PRIMARY KEY
- product_id TEXT NOT NULL
- unit_id TEXT NOT NULL
- conversion_to_base REAL NOT NULL
- selling_price REAL NOT NULL
- barcode TEXT
- is_base_unit BOOLEAN DEFAULT false
- is_default BOOLEAN DEFAULT false
- created_at DATETIME
- updated_at DATETIME
```

Rules:

- Satu produk wajib memiliki satu product unit dengan `is_base_unit = true`.
- Product unit base harus memiliki `conversion_to_base = 1`.
- Satu produk sebaiknya hanya memiliki satu `is_default = true`.
- Barcode boleh kosong.
- Barcode jika diisi sebaiknya unik.

---

## 11.7 Tabel Sales

```txt
sales
- id TEXT PRIMARY KEY
- invoice_number TEXT UNIQUE NOT NULL
- cashier_id TEXT NOT NULL
- customer_name TEXT
- total_gross REAL NOT NULL
- discount REAL DEFAULT 0
- total_net REAL NOT NULL
- payment_method TEXT NOT NULL
- paid_amount REAL NOT NULL
- change_amount REAL NOT NULL
- status TEXT DEFAULT 'COMPLETED'
- cancel_reason TEXT
- cancelled_at DATETIME
- cancelled_by TEXT
- created_at DATETIME
- updated_at DATETIME
```

---

## 11.8 Tabel Sale Items

```txt
sale_items
- id TEXT PRIMARY KEY
- sale_id TEXT NOT NULL
- product_id TEXT NOT NULL
- product_unit_id TEXT NOT NULL
- product_name_snapshot TEXT NOT NULL
- unit_name_snapshot TEXT NOT NULL
- qty REAL NOT NULL
- conversion_to_base REAL NOT NULL
- qty_base REAL NOT NULL
- price REAL NOT NULL
- purchase_price_base_snapshot REAL
- subtotal REAL NOT NULL
- created_at DATETIME
```

---

## 11.9 Tabel Stock Movements

```txt
stock_movements
- id TEXT PRIMARY KEY
- product_id TEXT NOT NULL
- type TEXT NOT NULL
- qty REAL NOT NULL
- unit_id TEXT
- conversion_to_base REAL
- qty_base REAL NOT NULL
- stock_before REAL NOT NULL
- stock_after REAL NOT NULL
- note TEXT
- reference_type TEXT
- reference_id TEXT
- created_by TEXT
- created_at DATETIME
```

Types:

```txt
IN
OUT
ADJUSTMENT
SALE
SALE_CANCEL
```

---

## 11.10 Tabel Settings

```txt
settings
- key TEXT PRIMARY KEY
- value TEXT
- updated_at DATETIME
```

Contoh key:

```txt
store_name
store_address
store_phone
receipt_footer
receipt_paper_size
default_printer_name
currency
```

---

## 12. Business Rules

## 12.1 Stock Rules

1. Semua stok disimpan dalam satuan dasar.
2. Transaksi penjualan mengurangi stok berdasarkan `qty_base`.
3. Stok masuk menambah stok berdasarkan `qty_base`.
4. Pembatalan transaksi mengembalikan stok berdasarkan `qty_base`.
5. Penyesuaian stok wajib mencatat alasan.
6. Produk tidak boleh dijual jika stok tidak cukup, kecuali fitur allow negative stock diaktifkan di masa depan.

## 12.2 Unit Rules

1. Setiap produk harus punya satuan dasar.
2. Satuan dasar harus memiliki konversi 1.
3. Satuan grosir harus memiliki konversi lebih dari 1.
4. Qty boleh desimal untuk produk seperti meter, kg, liter.
5. Harga jual disimpan per satuan jual.
6. Perubahan harga master tidak mengubah transaksi lama.

## 12.3 Transaction Rules

1. Invoice number harus unik.
2. Transaksi yang selesai tidak boleh diedit langsung.
3. Jika ada kesalahan, transaksi dibatalkan dan dibuat ulang.
4. Pembatalan transaksi hanya bisa dilakukan admin.
5. Semua item transaksi menyimpan snapshot data.

## 12.4 Backup Rules

1. Backup manual harus tersedia.
2. Restore hanya boleh dilakukan admin.
3. Sebelum restore, aplikasi membuat backup otomatis.
4. Database tidak boleh disimpan di folder instalasi aplikasi.

---

## 13. User Flow

## 13.1 Flow Login

```txt
Buka aplikasi
↓
Cek database
↓
Jika belum setup → halaman setup awal
↓
Jika sudah setup → halaman login
↓
Input username dan password
↓
Validasi
↓
Masuk dashboard
```

---

## 13.2 Flow Tambah Produk dengan Satuan Bertingkat

```txt
Admin buka menu Produk
↓
Klik Tambah Produk
↓
Isi nama produk
↓
Pilih kategori
↓
Pilih satuan dasar
↓
Isi stok awal dalam satuan dasar
↓
Isi harga modal dasar
↓
Tambahkan satuan jual:
  - satuan dasar, konversi 1, harga jual
  - satuan grosir, konversi ke dasar, harga jual
↓
Simpan
```

---

## 13.3 Flow Penjualan

```txt
Kasir buka Transaksi Baru
↓
Cari/scan produk
↓
Produk masuk ke cart
↓
Pilih satuan
↓
Isi qty
↓
Sistem validasi stok
↓
Sistem hitung subtotal
↓
Kasir klik Bayar
↓
Pilih metode pembayaran
↓
Input nominal bayar
↓
Sistem hitung kembalian
↓
Simpan transaksi
↓
Stok berkurang
↓
Cetak struk
```

---

## 13.4 Flow Stok Masuk

```txt
Admin buka menu Stok Masuk
↓
Pilih produk
↓
Pilih satuan
↓
Input qty
↓
Sistem konversi ke satuan dasar
↓
Simpan
↓
Stok bertambah
↓
Stock movement tercatat
```

---

## 13.5 Flow Backup

```txt
Admin buka Pengaturan
↓
Pilih Backup Data
↓
Pilih folder tujuan
↓
Sistem copy database
↓
Notifikasi berhasil
```

---

## 14. UI/UX Requirements

## 14.1 Prinsip UI

1. Sederhana
2. Cepat
3. Mudah dibaca
4. Cocok untuk layar kasir
5. Minim klik
6. Tombol utama jelas
7. Support keyboard shortcut

## 14.2 Layout Utama

Sidebar menu:

```txt
Dashboard
Transaksi
Riwayat Transaksi
Produk
Kategori
Satuan
Stok
Laporan
Pengaturan
```

## 14.3 Halaman Transaksi

Prioritas halaman transaksi:

- Search produk besar dan cepat
- Cart jelas
- Qty mudah diubah
- Satuan mudah dipilih
- Total pembayaran besar
- Tombol bayar menonjol
- Bisa digunakan dengan keyboard

## 14.4 Keyboard Shortcut

Rekomendasi shortcut:

```txt
F1  : Fokus search produk
F2  : Bayar
F3  : Cetak ulang struk terakhir
Esc : Batal / tutup modal
Enter : Konfirmasi
Ctrl+B : Backup data
```

## 14.5 Komponen Penting

- Searchable select untuk produk
- Dropdown satuan
- Numeric input untuk qty
- Modal pembayaran
- Toast notification
- Confirmation dialog
- Data table dengan search dan filter
- Empty state
- Loading state
- Error state

---

## 15. Error Handling

## 15.1 Error yang Harus Ditangani

1. Login gagal
2. Produk tidak ditemukan
3. Barcode tidak ditemukan
4. Stok tidak cukup
5. Qty tidak valid
6. Harga belum diatur
7. Printer tidak tersedia
8. Gagal cetak
9. Gagal backup
10. Gagal restore
11. Database error
12. File import tidak valid

## 15.2 Contoh Pesan Error

```txt
Stok tidak cukup. Stok tersedia: 10 pcs.
```

```txt
Produk dengan barcode ini tidak ditemukan.
```

```txt
File backup gagal dibuat. Pastikan folder tujuan dapat diakses.
```

```txt
Harga jual untuk satuan ini belum diatur.
```

---

## 16. Offline and Local Data Requirements

## 16.1 Database Location

Database tidak boleh disimpan di folder instalasi aplikasi.

Rekomendasi lokasi Windows:

```txt
C:\Users\{username}\AppData\Roaming\POS Lite Offline\pos.db
```

## 16.2 Data Persistence

Data harus tetap ada ketika:

- Aplikasi ditutup
- Komputer restart
- Aplikasi di-update
- Installer versi baru dijalankan

## 16.3 No Internet Dependency

Fitur berikut harus tetap jalan tanpa internet:

- Login
- Produk
- Stok
- Transaksi
- Cetak struk
- Laporan
- Backup
- Restore

---

## 17. Deployment Requirements

## 17.1 Output Build

Aplikasi harus dapat dibuild menjadi installer Windows:

```txt
POS-Lite-Offline-Setup.exe
```

## 17.2 Installation Flow

```txt
User menjalankan installer
↓
Aplikasi terpasang
↓
Shortcut muncul di Start Menu/Desktop
↓
User membuka aplikasi
↓
Setup awal jika database belum ada
```

## 17.3 Update Manual

Untuk MVP, update dilakukan manual:

```txt
Developer build versi baru
↓
Kirim installer baru
↓
User install versi baru
↓
Database lama tetap dipakai
```

## 17.4 Acceptance Criteria Deployment

- Installer dapat dijalankan di Windows 10/11.
- User tidak perlu install Node.js.
- User tidak perlu install database server.
- Database lama tidak tertimpa saat update.
- Aplikasi tetap berjalan offline.

---

## 18. Security Requirements

1. Password user harus di-hash.
2. Role harus dicek pada setiap aksi penting.
3. Restore database hanya admin.
4. Pembatalan transaksi hanya admin.
5. Data sensitif tidak perlu dikirim ke internet.
6. Jika nanti ada sync cloud, perlu enkripsi dan auth tambahan.

---

## 19. Performance Requirements

1. Aplikasi harus terbuka dalam waktu wajar di PC kasir standar.
2. Search produk harus cepat untuk minimal 5.000 produk.
3. Transaksi harus dapat disimpan kurang dari 2 detik.
4. Laporan harian harus dapat dibuka cepat.
5. Aplikasi tetap nyaman di RAM 4GB.

---

## 20. Testing Scenarios

## 20.1 Test Produk dan Satuan

- Tambah produk dengan satuan dasar pcs.
- Tambah satuan dus berisi 24 pcs.
- Tambah produk dengan satuan dasar meter.
- Tambah satuan roll berisi 100 meter.
- Ubah harga grosir.
- Nonaktifkan produk.

## 20.2 Test Transaksi

- Jual produk satuan pcs.
- Jual produk dus.
- Jual produk roll.
- Jual qty desimal seperti 2.5 meter.
- Campur beberapa satuan dalam satu transaksi.
- Pastikan stok berkurang benar.
- Pastikan subtotal benar.
- Pastikan struk menampilkan satuan yang dipilih.

## 20.3 Test Stok

- Tambah stok dalam satuan dasar.
- Tambah stok dalam satuan grosir.
- Lakukan adjustment.
- Batalkan transaksi.
- Pastikan stock movement lengkap.

## 20.4 Test Backup Restore

- Buat transaksi.
- Backup database.
- Tambah transaksi baru.
- Restore database lama.
- Pastikan data kembali sesuai backup.

## 20.5 Test Deployment

- Build installer.
- Install di PC lain.
- Jalankan aplikasi.
- Buat setup awal.
- Tutup dan buka ulang aplikasi.
- Pastikan data tetap ada.
- Install versi baru.
- Pastikan database tidak hilang.

---

## 21. MVP Milestone

## Milestone 1 — Foundation

Target:

- Setup Tauri + React/Vite
- Setup SQLite
- Setup ORM
- Migration awal
- Layout aplikasi
- Login
- Setup awal toko

Deliverable:

- Aplikasi desktop bisa dibuka
- Database lokal dibuat otomatis
- User admin bisa login

---

## Milestone 2 — Master Data

Target:

- CRUD kategori
- CRUD satuan
- CRUD produk
- CRUD product units
- Stok awal
- Search produk

Deliverable:

- Admin dapat membuat produk dengan satuan bertingkat

---

## Milestone 3 — Transaksi

Target:

- Halaman kasir
- Cart
- Pilih satuan
- Qty desimal
- Validasi stok
- Simpan transaksi
- Kurangi stok otomatis
- Stock movement

Deliverable:

- Kasir bisa melakukan transaksi penjualan lengkap

---

## Milestone 4 — Struk dan Riwayat

Target:

- Preview struk
- Print struk
- Riwayat transaksi
- Detail transaksi
- Cetak ulang
- Pembatalan transaksi oleh admin

Deliverable:

- Transaksi bisa dicetak dan dikelola

---

## Milestone 5 — Laporan dan Backup

Target:

- Dashboard ringkas
- Laporan harian
- Produk terlaris
- Stok rendah
- Export CSV
- Backup database
- Restore database

Deliverable:

- Aplikasi siap uji coba di toko nyata

---

## Milestone 6 — Packaging

Target:

- Build installer Windows
- Test install di PC lain
- Test update manual
- Fix bug production

Deliverable:

- Installer `.exe` siap implementasi

---

## 22. Future Enhancement

Fitur lanjutan setelah MVP:

1. Auto-update
2. Sync cloud
3. Multi-PC dalam jaringan lokal
4. Dashboard owner online
5. Manajemen pelanggan
6. Hutang/piutang
7. Supplier dan pembelian
8. Purchase order
9. Retur penjualan
10. Retur pembelian
11. Diskon bertingkat
12. Harga pelanggan khusus
13. Multi-cabang
14. Integrasi QRIS
15. Integrasi barcode scanner lebih advanced
16. ESC/POS native printing
17. Cash drawer integration
18. Audit log lengkap
19. License key
20. Subscription management

---

## 23. Prompt Vibe Coding untuk AI Agent

Gunakan prompt berikut untuk memulai development dengan AI coding agent.

```txt
Kamu adalah senior full-stack desktop app engineer. Saya ingin membangun aplikasi POS offline untuk toko bangunan dan retail menggunakan React + Vite + Tauri + SQLite + TypeScript.

Ikuti PRD berikut sebagai sumber utama. Fokus pada MVP sederhana, stabil, dan offline-first. Jangan menambahkan fitur di luar scope MVP kecuali diperlukan untuk fondasi teknis.

Requirement utama:
1. Aplikasi berjalan sebagai desktop app Windows menggunakan Tauri.
2. Frontend menggunakan React + Vite + TypeScript.
3. Database lokal menggunakan SQLite.
4. Gunakan ORM yang cocok, misalnya Prisma atau Drizzle.
5. Database harus tersimpan di folder app data, bukan folder instalasi.
6. Saat pertama kali app dibuka, buat database dan jalankan migration otomatis.
7. Buat setup awal toko dan admin.
8. Buat role admin dan kasir.
9. Buat modul produk, kategori, satuan, dan product_units.
10. Produk wajib mendukung satuan bertingkat.
11. Stok selalu disimpan dalam satuan dasar.
12. Transaksi harus mengurangi stok berdasarkan qty_base.
13. Sale item harus menyimpan snapshot nama produk, nama satuan, harga, dan konversi.
14. Buat fitur transaksi kasir dengan cart.
15. Buat fitur cetak struk sederhana dengan preview.
16. Buat riwayat transaksi dan cetak ulang.
17. Buat fitur pembatalan transaksi oleh admin.
18. Buat stock_movements untuk semua perubahan stok.
19. Buat laporan sederhana.
20. Buat backup dan restore database.

Mulai dari:
- setup project
- struktur folder
- schema database
- migration
- seed satuan awal
- layout utama
- authentication
- setup awal aplikasi

Kerjakan bertahap. Setelah setiap tahap, pastikan aplikasi bisa dijalankan dengan `npm run tauri dev`.
```

---

## 24. Prioritas Implementasi untuk AI Agent

Urutan implementasi yang disarankan:

```txt
1. Initialize React + Vite + Tauri project
2. Setup TypeScript path alias
3. Setup UI layout
4. Setup SQLite access
5. Setup schema/migration
6. Setup settings table
7. Setup first-run flow
8. Setup authentication
9. Seed default units
10. CRUD categories
11. CRUD units
12. CRUD products
13. CRUD product_units
14. Stock movement foundation
15. Sales cart UI
16. Sales transaction logic
17. Receipt preview
18. Transaction history
19. Cancel transaction
20. Reports
21. Backup/restore
22. Installer build
```

---

## 25. Definition of Done MVP

MVP dianggap selesai jika:

1. Aplikasi dapat di-install di Windows.
2. Aplikasi dapat berjalan offline.
3. Admin dapat setup toko pertama kali.
4. Admin dan kasir dapat login.
5. Admin dapat membuat produk.
6. Produk dapat memiliki satuan bertingkat.
7. Kasir dapat melakukan transaksi.
8. Penjualan dapat memakai satuan dasar maupun grosir.
9. Stok berkurang dengan benar.
10. Stock movement tercatat.
11. Struk dapat dicetak.
12. Riwayat transaksi dapat dilihat.
13. Admin dapat membatalkan transaksi.
14. Laporan harian dapat dilihat.
15. Data dapat dibackup.
16. Database tidak hilang setelah aplikasi ditutup atau di-update.

---

## 26. Catatan Kritis

Bagian yang harus sangat diperhatikan selama development:

1. **Jangan menyimpan database di folder instalasi.**
2. **Jangan menyimpan password plain text.**
3. **Jangan mengubah data transaksi lama ketika produk/harga berubah.**
4. **Jangan mengurangi stok berdasarkan qty tampilan, tetapi gunakan qty_base.**
5. **Jangan menghapus produk yang sudah pernah dipakai transaksi. Gunakan nonaktif.**
6. **Jangan membuat fitur terlalu banyak sebelum transaksi dan stok benar-benar stabil.**
7. **Pastikan backup dan restore tersedia sebelum dipakai toko nyata.**
8. **Pastikan transaksi tidak setengah tersimpan jika ada error. Gunakan database transaction.**
9. **Pastikan invoice number unik.**
10. **Pastikan qty mendukung decimal untuk barang meter/kg/liter.**

---

## 27. Contoh Kasus Validasi Satuan Bertingkat

### Case 1 — Retail

```txt
Produk: Air Mineral
Base unit: pcs
Stok: 240 pcs

Product units:
pcs  = 1 pcs, harga 4.000
pack = 12 pcs, harga 45.000
dus  = 24 pcs, harga 85.000

Transaksi:
2 dus
3 pack
5 pcs

Expected:
qty_base = 2*24 + 3*12 + 5*1 = 89 pcs
stock_after = 240 - 89 = 151 pcs
total = 2*85000 + 3*45000 + 5*4000 = 325000
```

### Case 2 — Toko Bangunan

```txt
Produk: Kabel NYA
Base unit: meter
Stok: 500 meter

Product units:
meter = 1 meter, harga 8.000
roll  = 100 meter, harga 750.000

Transaksi:
1 roll
2.5 meter

Expected:
qty_base = 1*100 + 2.5*1 = 102.5 meter
stock_after = 500 - 102.5 = 397.5 meter
total = 750000 + 20000 = 770000
```

### Case 3 — Barang Kiloan

```txt
Produk: Paku 5cm
Base unit: kg
Stok: 50 kg

Product units:
kg     = 1 kg, harga 18.000
karung = 25 kg, harga 425.000

Transaksi:
1 karung
0.5 kg

Expected:
qty_base = 1*25 + 0.5*1 = 25.5 kg
stock_after = 50 - 25.5 = 24.5 kg
total = 425000 + 9000 = 434000
```

---

## 28. Recommended Folder Structure

```txt
src/
  app/
    App.tsx
    routes.tsx
  components/
    ui/
    layout/
    forms/
    tables/
  features/
    auth/
    setup/
    dashboard/
    products/
    categories/
    units/
    product-units/
    sales/
    stock/
    reports/
    settings/
    backup/
  lib/
    db/
    utils/
    validators/
    printer/
    receipt/
    permissions/
  types/
  hooks/
  styles/

src-tauri/
  src/
    main.rs
  tauri.conf.json
  Cargo.toml
```

---

## 29. Recommended UI Pages

```txt
/login
/setup
/dashboard
/sales/new
/sales/history
/sales/:id
/products
/products/new
/products/:id/edit
/categories
/units
/stock/in
/stock/adjustment
/stock/movements
/reports/sales
/reports/stock-low
/settings/store
/settings/printer
/settings/backup-restore
/users
```

---

## 30. Closing

PRD ini dirancang untuk membantu development POS offline yang realistis, sederhana, dan cocok untuk toko bangunan maupun retail. Fokus MVP adalah memastikan transaksi, satuan bertingkat, stok, struk, dan backup berjalan dengan benar terlebih dahulu sebelum menambahkan fitur lanjutan.

