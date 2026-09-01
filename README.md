# AR Corp — Operations Portal

Paket siap unggah. Isi folder ini diunggah **apa adanya** ke GitHub Pages
(atau Netlify Drop), tanpa perlu diubah.

    index.html                  aplikasi (karyawan + kantor pusat)
    support.js                  runtime tampilan
    arcorp-server.js            koneksi database Supabase
    manifest.webmanifest        identitas aplikasi (nama, ikon, warna)
    sw.js                       service worker — aplikasi tetap terbuka tanpa internet
    assets/                     logo dan ikon aplikasi

## Cara mengunggah ke GitHub Pages

1. Buat repository baru di github.com, nama bebas, pilih **Public**.
2. Klik **Add file → Upload files**, lalu tarik SELURUH isi folder ini
   (termasuk folder `assets`). Commit.
3. Buka **Settings → Pages**. Bagian *Source* pilih **Deploy from a branch**,
   branch `main`, folder `/ (root)`. Save.
4. Tunggu 1–2 menit. Alamat aplikasi muncul di halaman yang sama, berbentuk
   `https://<nama-akun>.github.io/<nama-repo>/`.

Alamat itulah yang dibagikan ke karyawan, dan yang dimasukkan ke PWABuilder
untuk membuat APK.

## Catatan

- Harus HTTPS. GitHub Pages sudah HTTPS otomatis — service worker dan GPS
  hanya aktif di HTTPS.
- Setelah mengunggah versi baru, karyawan mungkin masih melihat versi lama
  karena service worker menyimpan salinan. Naikkan `CACHE = 'arcorp-hr-v1'`
  di `sw.js` menjadi `v2`, `v3`, dan seterusnya setiap kali ada pembaruan.
- Koneksi database diatur dari dalam aplikasi: masuk sebagai Kantor Pusat →
  menu **Server**. Tidak ada yang perlu diubah di berkas mana pun.
