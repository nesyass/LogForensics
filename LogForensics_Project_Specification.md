# LOGFORENSICS

## Project Specification & Development Blueprint

**Nama proyek:** LogForensics\
**Kategori:** Blue Team · Security Operations · Incident Response · Log
Analysis\
**Tipe:** Local-first security investigation tool\
**Status dokumen:** Project blueprint / MVP specification\
**Target implementasi awal:** 1 hari untuk MVP fungsional, dilanjutkan
iterasi kualitas portfolio\
**Lisensi kode yang disarankan:** MIT (sesuaikan jika menggunakan
dependensi atau dataset dengan ketentuan berbeda)

> **Catatan implementasi (2026).** Dokumen ini adalah blueprint awal dan
> dipertahankan sebagai catatan keputusan produk. Stack yang diimplementasikan
> sekarang adalah **React 19 + TypeScript + Vite**, **FastAPI**, dan **SQLite**
> (WAL). Referensi Streamlit, `st.session_state`, dan penyimpanan in-memory di
> bawah ini adalah rancangan awal dan tidak lagi menggambarkan aplikasi.
> Dokumentasi terkini ada di [`README.md`](README.md) dan [`docs/`](docs/).


------------------------------------------------------------------------

# 1. Ringkasan Proyek

LogForensics adalah aplikasi analisis log keamanan yang membantu analyst
mengimpor, menormalisasi, menelusuri, dan menghubungkan event dari
beberapa sumber log untuk mendukung investigasi insiden.

Aplikasi berfokus pada **log-based security investigation**, bukan
pengganti SIEM atau digital forensic suite. Tujuan utamanya adalah
mengubah kumpulan log mentah menjadi informasi investigasi yang lebih
mudah diperiksa: aktivitas login gagal, autentikasi berhasil, aktivitas
administratif yang tidak biasa, pola akses web, perubahan file (jika
sumber log menyediakannya), dan rangkaian event yang berdekatan secara
waktu.

LogForensics harus dapat berjalan sepenuhnya secara lokal. MVP tidak
memerlukan API key, cloud service, domain, atau layanan berbayar.

## 1.1 Masalah yang ingin diselesaikan

Dalam investigasi keamanan, informasi sering tersebar dalam beberapa
file log dengan format dan struktur berbeda. Analyst perlu: - Membaca
format log yang berbeda. - Menyamakan timestamp, alamat IP, username,
hostname, dan jenis event. - Menemukan pola aktivitas yang
mencurigakan. - Menyusun urutan kejadian. - Menelusuri bukti ke baris
log asli. - Menghasilkan ringkasan yang dapat dibagikan kepada tim.

Pekerjaan manual ini memakan waktu dan berisiko melewatkan hubungan
antar-event.

## 1.2 Solusi

LogForensics menyediakan alur kerja lokal:

1.  Pengguna mengimpor file log.
2.  Aplikasi mengidentifikasi format yang didukung.
3.  Parser mengubah baris log menjadi event terstruktur.
4.  Normalizer menyamakan field ke skema internal.
5.  Detection rules mengidentifikasi pola yang perlu ditinjau.
6.  Correlation engine menghubungkan event berdasarkan waktu dan
    atribut.
7.  Timeline menyusun kejadian secara kronologis.
8.  Analyst memeriksa bukti asli dan menambahkan catatan.
9.  Aplikasi mengekspor hasil investigasi.

## 1.3 Tujuan utama

-   Mempercepat triage awal log keamanan.
-   Menyediakan timeline aktivitas yang dapat ditelusuri ke sumber
    aslinya.
-   Menampilkan alasan suatu event ditandai.
-   Mengurangi pekerjaan parsing dan pengelompokan manual.
-   Menghasilkan artefak laporan yang reproducible.
-   Menjadi demonstrasi kemampuan Python, log engineering, detection
    logic, dan incident investigation.

## 1.4 Bukan tujuan MVP

MVP tidak ditujukan untuk: - Menggantikan SIEM seperti Wazuh, Splunk,
atau Elastic Security. - Melakukan live endpoint monitoring. - Mengambil
alih atau mengarantina perangkat. - Melakukan atribusi threat actor. -
Menyatakan bahwa suatu event pasti merupakan serangan. - Melakukan disk
imaging atau full disk forensics. - Menjamin chain of custody untuk
kebutuhan hukum. - Menggunakan machine learning sebagai pengganti aturan
deteksi yang dapat dijelaskan.

------------------------------------------------------------------------

# 2. Target Pengguna dan Use Case

## 2.1 Target pengguna

-   Junior SOC Analyst.
-   Blue Team Analyst.
-   Incident Response trainee.
-   Security Operations student.
-   Security researcher yang menganalisis dataset log.
-   System administrator yang melakukan pemeriksaan awal aktivitas
    server.

## 2.2 Use case utama

### UC-01 --- Analisis authentication log

Analyst mengunggah Linux authentication log untuk menemukan: - Login
gagal berulang. - Login berhasil. - Banyak username yang ditargetkan
dari satu IP. - Satu username yang ditargetkan dari beberapa IP. - Login
berhasil setelah serangkaian kegagalan.

### UC-02 --- Analisis web access log

Analyst mengunggah access log web server untuk menemukan: - Lonjakan
request dari satu alamat IP. - Banyak HTTP 4xx atau 5xx. - Request ke
path sensitif atau tidak lazim. - User-agent yang tidak biasa. - Pola
request yang dapat mengindikasikan scanning.

Temuan ini merupakan indikator untuk ditinjau, bukan bukti otomatis
bahwa scanning atau eksploitasi berhasil.

### UC-03 --- Rekonstruksi timeline

Analyst memilih rentang waktu, IP, atau username untuk menampilkan
urutan event terkait.

### UC-04 --- Pemeriksaan bukti

Analyst membuka sebuah alert dan melihat: - Baris log asli. - Nama file
sumber. - Nomor baris sumber jika tersedia. - Timestamp hasil parsing. -
Field hasil normalisasi. - Detection rule yang cocok. - Alasan alert
dibuat.

### UC-05 --- Ekspor hasil investigasi

Analyst mengekspor ringkasan, alert, dan timeline ke JSON atau CSV. PDF
dapat ditambahkan setelah MVP stabil.

------------------------------------------------------------------------

# 3. Ruang Lingkup Fitur

## 3.1 MVP --- wajib selesai terlebih dahulu

  -----------------------------------------------------------------------
  ID                Fitur             Deskripsi         Prioritas
  ----------------- ----------------- ----------------- -----------------
  F-01              Log upload        Upload file .log, Must
                                      .txt, atau .csv   

  F-02              Format detection  Mendeteksi format Must
                                      yang didukung     
                                      atau meminta      
                                      pilihan manual    

  F-03              Log parser        Parsing Linux     Must
                                      auth log dan      
                                      Apache/Nginx      
                                      access log        

  F-04              Normalization     Mengubah event ke Must
                                      skema standar     

  F-05              Detection rules   Deteksi failed    Must
                                      login burst,      
                                      successful login, 
                                      HTTP error spike, 
                                      dan suspicious    
                                      path              

  F-06              Timeline          Menampilkan event Must
                                      berdasarkan waktu 

  F-07              IP analysis       Menghitung event  Must
                                      per IP dan status 
                                      terkait           

  F-08              Evidence view     Menampilkan raw   Must
                                      log dan sumber    
                                      event             

  F-09              Export            Ekspor event dan  Must
                                      alert ke JSON/CSV 

  F-10              Sample dataset    Menyediakan       Must
                                      dataset sintetis  
                                      untuk demo        

  F-11              Tests             Unit test parser, Must
                                      normalizer, dan   
                                      detection rules   

  F-12              Documentation     README,           Must
                                      instalasi, contoh 
                                      penggunaan, dan   
                                      batasan           
  -----------------------------------------------------------------------

## 3.2 Fitur setelah MVP

-   Windows Security Event Log parser.
-   JSON structured log parser.
-   Multi-file correlation.
-   User activity profile.
-   Configurable detection thresholds.
-   Investigation case management.
-   Analyst notes dan tagging.
-   PDF report generator.
-   Sigma rule import terbatas.
-   Hashing file input dan output untuk pemeriksaan integritas.
-   Local database untuk menyimpan case.
-   Streamlit dashboard yang lebih lengkap.
-   Docker packaging.

## 3.3 Fitur yang tidak disarankan untuk versi pertama

-   Machine learning anomaly detection sebelum baseline rule-based
    tervalidasi.
-   Automatic blocking IP.
-   Live agent pada endpoint.
-   Threat actor attribution.
-   Klaim forensic chain-of-custody yang tidak didukung prosedur dan
    kontrol teknis.
-   Integrasi banyak layanan eksternal yang membutuhkan API key.

------------------------------------------------------------------------

# 4. Sumber Log dan Format yang Didukung

MVP sebaiknya mendukung dua sumber yang umum dan relatif mudah diuji.

## 4.1 Linux authentication log

Contoh lokasi: - Debian/Ubuntu: `/var/log/auth.log` - RHEL-family:
`/var/log/secure`

Contoh baris sintetis:

``` text
Nov  5 09:00:12 lab-server sshd[1201]: Failed password for invalid user admin from 192.0.2.15 port 51234 ssh2
Nov  5 09:00:19 lab-server sshd[1202]: Failed password for root from 192.0.2.15 port 51235 ssh2
Nov  5 09:02:41 lab-server sshd[1203]: Accepted password for analyst from 192.0.2.15 port 51236 ssh2
```

Parser perlu mengenali setidaknya: - Timestamp. - Hostname. -
Process/service. - PID jika tersedia. - Event type. - Username jika
tersedia. - Source IP jika tersedia. - Port jika tersedia. - Raw
message.

Catatan: format syslog klasik sering tidak menyertakan tahun atau
timezone. Aplikasi harus meminta tahun/timezone analisis atau menerapkan
asumsi yang dinyatakan secara eksplisit. Jangan diam-diam menganggap
timestamp sebagai UTC.

## 4.2 Apache/Nginx access log

Contoh format Combined Log Format:

``` text
192.0.2.25 - - [05/Nov/2026:09:10:12 +0700] "GET /login HTTP/1.1" 200 1234 "https://example.test/" "Mozilla/5.0"
192.0.2.25 - - [05/Nov/2026:09:10:13 +0700] "GET /admin HTTP/1.1" 403 321 "-" "curl/8.0"
192.0.2.25 - - [05/Nov/2026:09:10:14 +0700] "GET /.env HTTP/1.1" 404 210 "-" "curl/8.0"
```

Parser perlu mengenali: - Timestamp dan timezone. - Client IP. - HTTP
method. - Request path. - HTTP protocol. - Status code. - Response
size. - Referer. - User-agent. - Raw message.

Jangan mengasumsikan semua web server memakai format yang sama. Parser
harus memberikan error yang jelas jika format tidak cocok.

## 4.3 Dataset

Gunakan dataset sintetis yang dibuat sendiri untuk demo dan automated
tests. Dataset sintetis: - Tidak mengandung data pribadi. - Memiliki
skenario normal dan suspicious. - Memiliki expected result untuk
pengujian. - Diberi label bahwa data tersebut simulasi.

Jika memakai dataset publik, periksa lisensi, ketentuan atribusi, dan
izin redistribusinya sebelum memasukkannya ke repository.

------------------------------------------------------------------------

# 5. Arsitektur Teknis

## 5.1 Rekomendasi stack MVP

  Komponen          Teknologi                        Alasan
  ----------------- -------------------------------- -------------------------------------
  Bahasa            Python 3.11+                     Ekosistem parsing dan analisis data
  UI                Streamlit                        Cepat untuk membuat antarmuka lokal
  Parsing           Python `re`, `datetime`, `csv`   Dependensi minimal
  Data processing   Pandas (opsional)                Agregasi dan analisis tabel
  Validation        Pydantic (opsional)              Validasi struktur event
  Testing           Pytest                           Automated tests
  Export            JSON dan CSV bawaan Python       Tidak perlu layanan tambahan
  Version control   Git dan GitHub                   Dokumentasi dan source control

Untuk MVP satu hari, gunakan Streamlit dan Python. FastAPI, React,
PostgreSQL, Redis, dan Celery belum diperlukan. Tambahkan teknologi
tersebut hanya ketika ada kebutuhan arsitektur yang jelas.

## 5.2 Diagram alur data

``` text
                 +--------------------+
                 |  Analyst / User     |
                 +----------+---------+
                            |
                            v
                 +--------------------+
                 | Upload Log Files   |
                 +----------+---------+
                            |
                            v
                 +--------------------+
                 | Format Detection   |
                 +----------+---------+
                            |
                            v
                 +--------------------+
                 | Parser Layer       |
                 | Linux Auth / Web   |
                 +----------+---------+
                            |
                            v
                 +--------------------+
                 | Normalization      |
                 +----------+---------+
                            |
                 +----------+----------+
                 |                     |
                 v                     v
       +------------------+   +--------------------+
       | Detection Engine |   | Event Aggregation  |
       +---------+--------+   +----------+---------+
                 |                       |
                 +-----------+-----------+
                             |
                             v
                  +---------------------+
                  | Correlation Engine  |
                  +----------+----------+
                             |
                             v
                  +---------------------+
                  | Timeline & Findings |
                  +----------+----------+
                             |
                 +-----------+-----------+
                 |                       |
                 v                       v
        +----------------+      +----------------+
        | Streamlit UI   |      | JSON / CSV     |
        +----------------+      +----------------+
```

## 5.3 Prinsip desain

-   Parser dipisahkan dari UI.
-   Detection rules dipisahkan dari parser.
-   Raw log tidak boleh hilang setelah normalisasi.
-   Setiap event memiliki referensi ke sumber.
-   Timestamp menyimpan timezone atau status timezone yang diketahui.
-   Detection output harus menjelaskan rule dan alasan kecocokan.
-   Error parsing harus terlihat oleh pengguna.
-   Input tidak dipercaya dan tidak boleh dieksekusi sebagai perintah.

------------------------------------------------------------------------

# 6. Desain Data dan Skema Event

Setiap baris log yang berhasil diproses diubah menjadi event dengan
skema konsisten.

## 6.1 Normalized event

Contoh struktur:

``` json
{
  "event_id": "evt-000001",
  "timestamp": "2026-11-05T09:00:12+07:00",
  "timestamp_precision": "second",
  "timestamp_timezone_known": true,
  "source_file": "auth_sample.log",
  "source_line": 1,
  "source_type": "linux_auth",
  "host": "lab-server",
  "event_category": "authentication",
  "event_type": "authentication_failure",
  "username": "admin",
  "source_ip": "192.0.2.15",
  "source_port": 51234,
  "destination_ip": null,
  "http_method": null,
  "http_path": null,
  "http_status": null,
  "process": "sshd",
  "raw_message": "Failed password for invalid user admin from 192.0.2.15 port 51234 ssh2",
  "parse_status": "success"
}
```

Nilai di atas adalah contoh sintetis. `192.0.2.0/24` merupakan rentang
alamat yang dicadangkan untuk dokumentasi.

## 6.2 Field penting

  -----------------------------------------------------------------------
  Field                   Tipe                    Keterangan
  ----------------------- ----------------------- -----------------------
  event_id                string                  ID unik event

  timestamp               datetime/string         Waktu event dengan
                                                  offset bila diketahui

  source_file             string                  Nama file asal

  source_line             integer                 Nomor baris asal

  source_type             string                  Jenis parser

  host                    string/null             Hostname

  event_category          string                  authentication, web,
                                                  system, dll.

  event_type              string                  Jenis event yang
                                                  dinormalisasi

  username                string/null             Akun terkait

  source_ip               string/null             IP sumber

  source_port             integer/null            Port sumber

  http_method             string/null             HTTP method

  http_path               string/null             Request path

  http_status             integer/null            HTTP status

  raw_message             string                  Baris asli

  parse_status            string                  success atau failed
  -----------------------------------------------------------------------

## 6.3 Parse failure

Baris yang tidak berhasil diparse tidak boleh dibuang. Simpan sebagai
parse error dengan: - Nama file. - Nomor baris. - Raw line. - Alasan
kegagalan. - Parser yang digunakan.

Sediakan ringkasan jumlah baris berhasil dan gagal diparse.

------------------------------------------------------------------------

# 7. Detection Engineering

Detection engine adalah komponen inti. Setiap detection harus memiliki
ID, nama, deskripsi, severity, kondisi, window, threshold, dan alasan
alert.

Severity adalah tingkat prioritas untuk triage, bukan kepastian bahwa
serangan terjadi.

## 7.1 Rule LF-001 --- Failed Login Burst

**Tujuan:** Menandai banyak kegagalan autentikasi dari satu IP dalam
jangka waktu pendek.

-   Input: Linux authentication events.
-   Grouping key: source IP.
-   Window awal: 2 menit.
-   Threshold awal: 10 kegagalan.
-   Severity awal: Medium.
-   Output: alert berisi IP, jumlah kegagalan, rentang waktu, dan event
    pendukung.

Threshold harus dapat dikonfigurasi. Angka tersebut merupakan nilai awal
untuk lab, bukan baseline universal.

## 7.2 Rule LF-002 --- Successful Login After Repeated Failures

**Tujuan:** Menandai keberhasilan autentikasi setelah beberapa kegagalan
dari sumber yang sama.

Kondisi awal: - Terdapat minimal 5 kegagalan dari IP yang sama. -
Terdapat login berhasil dari IP yang sama. - Login berhasil terjadi
dalam rentang waktu yang ditentukan setelah kegagalan.

Severity awal: High, untuk investigasi lebih lanjut.

Catatan: pola ini bisa terjadi karena pengguna salah mengetik password.
Jangan menyimpulkan account compromise tanpa bukti tambahan.

## 7.3 Rule LF-003 --- Multi-User Login Attempts

**Tujuan:** Menandai satu IP yang mencoba mengakses banyak username.

Kondisi awal: - Minimal 5 username berbeda. - Sumber IP sama. - Rentang
waktu 5 menit.

Kemungkinan interpretasi: password spraying atau account enumeration.
Alert harus menyatakan bahwa pola tersebut perlu diverifikasi.

## 7.4 Rule LF-004 --- HTTP Error Spike

**Tujuan:** Menandai peningkatan response 4xx atau 5xx dari satu IP.

Kondisi awal: - Hitung status code 4xx/5xx per IP dalam window. -
Bandingkan dengan threshold yang dapat dikonfigurasi. - Pisahkan 4xx dan
5xx pada hasil analisis.

Kemungkinan penyebab mencakup kesalahan pengguna, konfigurasi aplikasi,
scanning, atau gangguan layanan.

## 7.5 Rule LF-005 --- Sensitive Path Request

**Tujuan:** Menandai request ke path yang perlu diperiksa, misalnya: -
`/.env` - `/admin` - `/wp-admin` - `/phpmyadmin` - `/backup` - `/config`

Rule harus: - Menggunakan daftar path yang dapat dikonfigurasi. -
Memperhitungkan URL encoding dan normalisasi path secara aman. - Tidak
menganggap request ke path tersebut sebagai bukti eksploitasi. -
Menyimpan status code dan raw request line sebagai evidence.

## 7.6 Struktur detection rule

Contoh konfigurasi:

``` yaml
id: LF-001
name: Failed Login Burst
description: Multiple failed authentication events from one source IP.
source_type: linux_auth
event_type: authentication_failure
group_by:
  - source_ip
window_seconds: 120
threshold: 10
severity: medium
enabled: true
```

Untuk MVP, rules boleh didefinisikan dalam Python terlebih dahulu. YAML
dapat ditambahkan setelah engine stabil.

## 7.7 Format alert

``` json
{
  "alert_id": "alert-0001",
  "rule_id": "LF-001",
  "title": "Failed Login Burst",
  "severity": "medium",
  "status": "needs_review",
  "source_ip": "192.0.2.15",
  "event_count": 12,
  "first_seen": "2026-11-05T09:00:12+07:00",
  "last_seen": "2026-11-05T09:01:45+07:00",
  "reason": "12 failed authentication events from the same IP within 120 seconds.",
  "evidence_event_ids": [
    "evt-000001",
    "evt-000002"
  ]
}
```

------------------------------------------------------------------------

# 8. Correlation dan Timeline

## 8.1 Tujuan correlation

Correlation menghubungkan event yang memiliki atribut atau rentang waktu
yang relevan. MVP dapat menggunakan: - Source IP yang sama. - Username
yang sama. - Host yang sama. - Kedekatan timestamp. - Urutan event yang
telah ditentukan.

## 8.2 Contoh rangkaian event

``` text
09:00:12  Authentication failure
09:00:19  Authentication failure
09:00:31  Authentication failure
09:02:41  Authentication success
09:04:10  Privileged command event (jika tersedia di sumber log)
```

Timeline dapat menampilkan rangkaian tersebut sebagai satu kelompok
investigasi potensial.

Jangan menghubungkan event hanya karena timestamp-nya berdekatan.
Tampilkan alasan hubungan, misalnya IP sama, username sama, host sama,
atau rule correlation yang cocok.

## 8.3 Timeline requirements

-   Urutkan event berdasarkan timestamp.
-   Tampilkan timezone.
-   Tampilkan source file dan source line.
-   Filter berdasarkan IP, username, host, kategori, dan rentang waktu.
-   Klik event untuk melihat raw log.
-   Tampilkan parse status.
-   Bedakan event biasa dan event yang menjadi evidence alert.

------------------------------------------------------------------------

# 9. Antarmuka Pengguna

MVP menggunakan Streamlit dengan halaman atau tab berikut.

## 9.1 Overview

Menampilkan: - Total file yang diimpor. - Total baris log. - Parsed
events. - Parse errors. - Total alerts. - Distribusi severity. - Rentang
waktu data.

## 9.2 Upload & Parsing

Komponen: - File uploader. - Pilihan parser otomatis atau manual. -
Input tahun/timezone bila dibutuhkan. - Tombol Analyze. - Progress atau
status proses. - Ringkasan parsing.

## 9.3 Event Explorer

Tabel event dengan filter: - Timestamp. - Event category/type. - Source
IP. - Username. - Host. - Source file.

Pengguna dapat membuka detail event untuk melihat raw message.

## 9.4 Alerts

Menampilkan: - Alert ID. - Rule ID. - Title. - Severity. - Source IP. -
Event count. - First seen dan last seen. - Reason. - Status review.

Status review awal: - Needs Review. - Benign / Expected. - Confirmed
Suspicious. - False Positive.

Status tersebut adalah keputusan analyst, bukan hasil otomatis.

## 9.5 Timeline

Menampilkan urutan kejadian dan filter berdasarkan atribut. Pastikan
timezone ditampilkan dengan jelas.

## 9.6 IP Analysis

Menampilkan: - Jumlah event per IP. - Failed authentication count. -
Successful authentication count. - HTTP request count. - HTTP error
count. - Alert terkait.

Jangan melakukan geolocation IP secara otomatis pada MVP. IP internal,
private, reserved, dan data sintetis dapat membuat interpretasi
geolokasi menyesatkan.

## 9.7 Export

Format awal: - `events.json` - `events.csv` - `alerts.json` -
`timeline.csv` - `investigation-summary.md`

------------------------------------------------------------------------

# 10. Struktur Repository

Struktur yang disarankan:

``` text
logforensics/
│
├── app.py
├── README.md
├── LICENSE
├── requirements.txt
├── .gitignore
│
├── src/
│   └── logforensics/
│       ├── __init__.py
│       ├── config.py
│       ├── models.py
│       ├── ingestion/
│       │   ├── __init__.py
│       │   └── file_loader.py
│       ├── parsers/
│       │   ├── __init__.py
│       │   ├── linux_auth.py
│       │   └── web_access.py
│       ├── normalization/
│       │   ├── __init__.py
│       │   └── normalizer.py
│       ├── detection/
│       │   ├── __init__.py
│       │   ├── engine.py
│       │   └── rules.py
│       ├── correlation/
│       │   ├── __init__.py
│       │   └── correlator.py
│       ├── analysis/
│       │   ├── __init__.py
│       │   ├── ip_analysis.py
│       │   └── timeline.py
│       └── reporting/
│           ├── __init__.py
│           └── exporter.py
│
├── tests/
│   ├── test_linux_auth_parser.py
│   ├── test_web_access_parser.py
│   ├── test_normalization.py
│   ├── test_detection.py
│   └── test_timeline.py
│
├── sample_data/
│   ├── auth_normal.log
│   ├── auth_suspicious.log
│   ├── web_access.log
│   └── expected_results.json
│
├── rules/
│   └── detection_rules.yaml
│
├── docs/
│   ├── architecture.md
│   ├── detection-rules.md
│   ├── data-schema.md
│   ├── test-plan.md
│   └── limitations.md
│
└── screenshots/
    ├── overview.png
    ├── event-explorer.png
    ├── alerts.png
    └── timeline.png
```

Untuk prototipe yang sangat cepat, beberapa modul dapat dimulai sebagai
satu file. Namun, pisahkan modul ketika implementasi mulai berkembang.
Struktur di atas adalah target repository yang rapi, bukan syarat untuk
menulis semua file sekaligus.

------------------------------------------------------------------------

# 11. Rencana Pengerjaan MVP Hari Pertama

Target realistis: satu MVP yang dapat mengimpor dataset, mem-parsing dua
format log, mendeteksi beberapa pola, menampilkan hasil, dan mengekspor
laporan.

## Tahap 1 --- Project setup (30 menit)

-   Buat repository GitHub `logforensics`.
-   Siapkan virtual environment.
-   Instal Python dependencies.
-   Buat struktur direktori minimum.
-   Tambahkan `.gitignore`.

## Tahap 2 --- Sample dataset (30 menit)

-   Buat authentication log normal.
-   Buat authentication log dengan failed login burst.
-   Buat web access log normal.
-   Buat web access log dengan HTTP error spike dan sensitive path
    request.
-   Tandai semua data sebagai sintetis.

## Tahap 3 --- Parser & normalization (60--90 menit)

-   Implementasikan Linux auth parser.
-   Implementasikan web access parser.
-   Simpan raw message.
-   Simpan source file dan source line.
-   Implementasikan parse error handling.
-   Uji timestamp dan timezone.

## Tahap 4 --- Detection engine (60 menit)

Implementasikan: - LF-001 Failed Login Burst. - LF-002 Successful Login
After Repeated Failures. - LF-004 HTTP Error Spike. - LF-005 Sensitive
Path Request.

## Tahap 5 --- Dashboard (60 menit)

Buat Streamlit UI: - Upload file. - Pilih parser. - Tampilkan ringkasan
parsing. - Tampilkan event table. - Tampilkan alerts. - Tampilkan
timeline sederhana.

## Tahap 6 --- Export & testing (45--60 menit)

-   Export JSON dan CSV.
-   Uji skenario normal.
-   Uji skenario suspicious.
-   Uji baris yang gagal diparse.
-   Pastikan evidence mengarah ke raw log yang benar.

## Tahap 7 --- Documentation & GitHub polish (45 menit)

-   Tulis README.
-   Tambahkan architecture diagram.
-   Tambahkan detection rule documentation.
-   Tambahkan screenshot.
-   Tambahkan hasil test.
-   Buat release awal `v0.1.0`.

Estimasi ini adalah timebox untuk MVP. Jika parser atau UI membutuhkan
waktu lebih lama, kurangi jumlah rule dahulu; jangan mengorbankan
kebenaran parsing dan evidence traceability.

------------------------------------------------------------------------

# 12. Testing dan Acceptance Criteria

Project belum dianggap selesai hanya karena dashboard berhasil dibuka.

## 12.1 Parser tests

-   Valid Linux auth line berhasil diparse.
-   Valid web access line berhasil diparse.
-   Baris tidak valid tidak menyebabkan aplikasi crash.
-   Source line dan raw message tetap tersedia.
-   Timestamp dengan timezone diproses dengan benar.
-   Timestamp tanpa tahun/timezone ditangani dengan asumsi yang
    terlihat.

## 12.2 Detection tests

-   10 atau lebih failed login dalam window menghasilkan alert sesuai
    konfigurasi.
-   Login normal tidak menghasilkan failed-login alert.
-   Successful login setelah kegagalan menghasilkan alert sesuai
    kondisi.
-   HTTP error spike terdeteksi pada dataset yang memenuhi threshold.
-   Request ke sensitive path ditandai sebagai event untuk ditinjau.
-   Event di luar time window tidak ikut dihitung.
-   Event tanpa source IP tidak membuat engine crash.

## 12.3 Data integrity tests

-   Raw message tidak berubah selama parsing.
-   Source file dan line number tercatat.
-   Event ID unik dalam satu hasil analisis.
-   Export memuat data yang sama dengan hasil analisis.
-   Parse errors tetap dapat diperiksa.

## 12.4 Acceptance criteria MVP

MVP dapat dinyatakan selesai apabila: 1. Pengguna dapat mengunggah file
log yang didukung. 2. Parser menghasilkan normalized events. 3. Baris
gagal parsing dilaporkan. 4. Minimal empat detection rules bekerja. 5.
Timeline dapat ditampilkan. 6. Alert memiliki alasan dan evidence
reference. 7. Hasil dapat diekspor ke JSON dan CSV. 8. Automated tests
berjalan. 9. README memungkinkan orang lain menjalankan aplikasi secara
lokal. 10. Dataset demo tidak mengandung data pribadi atau log
organisasi.

------------------------------------------------------------------------

# 13. Keamanan Aplikasi

Karena aplikasi ini memproses log yang tidak tepercaya, aplikasi itu
sendiri juga harus dirancang dengan aman.

## 13.1 Input handling

-   Batasi ukuran file.
-   Batasi ekstensi file yang diterima.
-   Validasi konten, bukan hanya nama ekstensi.
-   Jangan menjalankan isi file sebagai kode.
-   Jangan menggunakan `eval()` atau `exec()` pada input.
-   Tangani encoding error.
-   Batasi jumlah baris atau penggunaan memori untuk file besar.

## 13.2 Sensitive data

Log dapat mengandung: - Username. - IP internal. - Session identifier. -
Token. - Email. - Informasi personal. - URL dengan parameter sensitif.

Karena itu: - Gunakan dataset sintetis pada repository publik. - Jangan
commit log organisasi atau data pengguna. - Sediakan opsi redaction
untuk field sensitif. - Hindari menampilkan secret lengkap pada
dashboard. - Jangan mengirim log ke layanan eksternal tanpa persetujuan.

## 13.3 Web UI

Jika menggunakan Streamlit: - Jalankan secara lokal secara default. -
Jangan membuka port ke jaringan publik tanpa kebutuhan. - Jika digunakan
bersama, tambahkan autentikasi dan kontrol akses melalui mekanisme yang
sesuai. - Jangan menganggap aplikasi lokal otomatis aman.

## 13.4 Evidence integrity

Untuk meningkatkan transparansi, versi lanjutan dapat menghitung SHA-256
untuk file input dan file hasil ekspor.

Hash hanya membantu mendeteksi perubahan terhadap salinan yang
dibandingkan. Hash saja tidak membuktikan siapa yang memperoleh bukti,
kapan bukti dikumpulkan, atau bahwa bukti tidak berubah sebelum hashing.

------------------------------------------------------------------------

# 14. Metrik Evaluasi

Agar project terlihat matang secara teknis, evaluasi detection engine
menggunakan dataset dengan label ground truth.

Metrik: - True Positive (TP). - False Positive (FP). - True Negative
(TN). - False Negative (FN). - Precision. - Recall. - F1-score. - Parse
success rate. - Processing time.

Rumus:

Precision = TP / (TP + FP)

Recall = TP / (TP + FN)

F1-score = 2 × (Precision × Recall) / (Precision + Recall)

Untuk detection rules, tentukan terlebih dahulu definisi satu unit
evaluasi: event, alert, atau skenario. Jangan mencampur ketiganya dalam
satu confusion matrix.

Laporkan hasil pada dataset sintetis sebagai hasil pengujian lab, bukan
klaim performa pada lingkungan produksi.

------------------------------------------------------------------------

# 15. Dokumentasi GitHub

README utama sebaiknya memiliki urutan:

1.  Project title dan short description.
2.  Screenshot atau demo GIF.
3.  Problem statement.
4.  Features.
5.  Supported log formats.
6.  Architecture.
7.  Detection rules.
8.  Installation.
9.  Usage.
10. Sample analysis.
11. Testing and evaluation.
12. Security and privacy considerations.
13. Limitations.
14. Roadmap.
15. License and acknowledgements.

## 15.1 Contoh deskripsi repository

> A local-first security log investigation tool for parsing,
> normalizing, detecting, and correlating suspicious activity across
> Linux authentication and web server logs. Includes evidence
> traceability, incident timelines, and exportable investigation
> results.

## 15.2 Contoh GitHub topics

``` text
cybersecurity
blue-team
log-analysis
incident-response
security-automation
python
streamlit
threat-detection
digital-forensics
soc
```

Gunakan istilah digital forensics secara proporsional. Deskripsi utama
project tetap menekankan log analysis dan incident investigation.

## 15.3 Contoh commit plan

``` text
chore: initialize project structure
feat: add synthetic authentication log dataset
feat: implement Linux authentication parser
feat: implement web access log parser
feat: normalize parsed security events
feat: add failed login detection rule
feat: add suspicious web activity rules
feat: implement event timeline
feat: add evidence traceability
feat: add JSON and CSV export
test: add parser and detection test suite
docs: add architecture and usage documentation
docs: prepare project demo screenshots
release: publish v0.1.0
```

Buat commit berdasarkan perubahan yang benar-benar sudah dikerjakan.
Jangan membuat commit palsu hanya untuk memperbanyak aktivitas GitHub.

------------------------------------------------------------------------

# 16. Roadmap Pengembangan

## v0.1.0 --- MVP

-   Linux authentication log parser.
-   Apache/Nginx access log parser.
-   Basic detection rules.
-   Timeline.
-   IP analysis.
-   JSON/CSV export.
-   Synthetic dataset.
-   Basic tests.

## v0.2.0 --- Investigation Enhancement

-   Multi-file correlation.
-   Investigation notes.
-   Configurable thresholds.
-   Better filtering.
-   PDF/Markdown report.
-   Redaction.

## v0.3.0 --- Extended Log Sources

-   Windows Security Event Log.
-   JSON logs.
-   Additional Linux system logs.
-   More detection rules.
-   Improved parser diagnostics.

## v0.4.0 --- Detection Engineering

-   YAML rule configuration.
-   Rule testing framework.
-   Detection performance evaluation.
-   Sigma-inspired rule metadata.
-   ATT&CK technique references where justified.

## v1.0.0 --- Stable Portfolio Release

-   Stable schema.
-   Full automated test suite.
-   Reproducible sample investigations.
-   Complete documentation.
-   Security review.
-   Demo video.
-   Versioned release.

------------------------------------------------------------------------

# 17. Risiko dan Mitigasi

  -----------------------------------------------------------------------
  Risiko                  Dampak                  Mitigasi
  ----------------------- ----------------------- -----------------------
  Log formats vary        Parsing gagal           Dokumentasikan format
                                                  yang didukung dan
                                                  tampilkan parse errors

  Missing timezone        Timeline keliru         Minta asumsi eksplisit
                                                  dan tampilkan timezone

  False positives         Analyst salah mengambil Tampilkan evidence dan
                          keputusan               alasan rule

  Large files             Aplikasi lambat atau    Batasi ukuran dan
                          kehabisan memori        gunakan
                                                  streaming/chunking

  Sensitive log data      Kebocoran informasi     Dataset sintetis,
                                                  redaction, dan
                                                  local-first processing

  Overly complex MVP      Project tidak selesai   Prioritaskan parser,
                                                  empat rules, timeline,
                                                  dan export

  Misleading forensic     Klaim kemampuan         Jelaskan ruang lingkup
  claims                  berlebihan              sebagai log-based
                                                  investigation
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 18. Definisi Sukses Portfolio

LogForensics layak dipajang sebagai portfolio ketika pengunjung GitHub
dapat: - Memahami masalah yang diselesaikan. - Melihat arsitektur dan
alur data. - Menjalankan aplikasi tanpa layanan berbayar. - Menguji
dataset contoh. - Melihat detection rules dan evidence. - Memverifikasi
hasil melalui automated tests. - Memahami keterbatasan sistem.

Bukti demonstrasi yang disarankan: 1. Screenshot overview dashboard. 2.
Screenshot event explorer. 3. Screenshot alert detail dengan raw
evidence. 4. Screenshot incident timeline. 5. Contoh file JSON/CSV hasil
ekspor. 6. Video demo 2--4 menit. 7. Test report dari automated test
suite.

**Jangan mengklaim bahwa LogForensics telah digunakan di lingkungan
enterprise atau mampu mendeteksi seluruh serangan jika belum ada bukti
pengujian yang mendukung klaim tersebut.**

------------------------------------------------------------------------

# 19. Referensi Teknis

Gunakan dokumentasi resmi berikut selama implementasi:

-   Python Documentation: https://docs.python.org/3/
-   Streamlit Documentation: https://docs.streamlit.io/
-   Pytest Documentation: https://docs.pytest.org/
-   OWASP Logging Cheat Sheet:
    https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
-   MITRE ATT&CK: https://attack.mitre.org/
-   Sigma Rules: https://sigmahq.io/
-   NIST Computer Security Incident Handling Guide (SP 800-61 Rev. 2):
    https://csrc.nist.gov/pubs/sp/800/61/r2/final
-   NIST Guide to Integrating Forensic Techniques into Incident Response
    (SP 800-86): https://csrc.nist.gov/pubs/sp/800/86/final

Periksa versi dan status publikasi referensi sebelum menjadikannya dasar
klaim standar dalam dokumentasi.

------------------------------------------------------------------------

# 20. Keputusan Implementasi Awal

Agar pengerjaan tidak melebar, gunakan keputusan awal berikut:

-   Nama repository: `logforensics`
-   Bahasa: Python
-   UI: Streamlit
-   Storage MVP: in-memory selama sesi analisis
-   Input: Linux auth log dan Apache/Nginx access log
-   Detection: empat sampai lima rule yang explainable
-   Timeline: kronologis dengan timezone yang terlihat
-   Evidence: raw message, source file, dan source line
-   Export: JSON dan CSV
-   Testing: Pytest
-   Deployment: local-only
-   Dataset: sintetis
-   Biaya software dan layanan tambahan: Rp0

## Definition of Done

Project versi pertama selesai jika pengguna dapat mengunggah dua jenis
log, menjalankan analisis, melihat event dan alert yang dapat ditelusuri
ke baris sumber, memeriksa timeline, mengekspor hasil, dan menjalankan
automated tests.

**Prinsip akhir:** prioritaskan hasil yang benar, dapat dijelaskan,
dapat diuji, dan dapat direproduksi. Dashboard yang menarik adalah nilai
tambah; kualitas analisis dan evidence adalah inti LogForensics.
