# C.A.D.I.R.O. — Capture All Data, Identify Real Opportunities

> Path of Exile 1 strategy builder, trade search, and ROI tracking platform.

## Project Overview

| Key         | Value                                      |
|-------------|--------------------------------------------|
| Codename    | C.A.D.I.R.O.                               |
| Full Name   | Capture All Data, Identify Real Opportunities |
| Target Game | Path of Exile 1                            |
| Backend     | NestJS + TypeORM + PostgreSQL              |
| Frontend    | Next.js 15 App Router + TanStack Query + Tailwind |
| Auth        | Placeholder (DB-based, no library)         |
| AI Codename | Navali (Claude's project persona)          |

---

## Phase 1 — MVP: Foundation + Regex + Trade

### 1.1 Project Scaffolding

- [ ] **T-001** Backend: NestJS projesi oluştur (`backend/`)
  - TypeScript strict mode
  - ESLint + Prettier config
  - TypeORM + PostgreSQL bağlantısı
  - Environment config (@nestjs/config + validation)
  - CORS ayarları (frontend origin)

- [ ] **T-002** Frontend: Next.js 15 App Router projesi oluştur (`frontend/`)
  - TypeScript strict mode
  - Tailwind CSS setup
  - TanStack Query provider
  - API client utility (`lib/api.ts`)
  - ESLint + Prettier config

- [ ] **T-003** Database: PostgreSQL schema + migration altyapısı
  - TypeORM migration config
  - Initial migration boilerplate
  - Docker Compose ile local PostgreSQL (opsiyonel)

- [ ] **T-004** Monorepo konfigürasyonu
  - Root `package.json` (workspaces veya scripts)
  - Shared types paketi (`shared/types/`)
  - Concurrent dev script (backend + frontend)

### 1.2 Placeholder Auth

- [ ] **T-005** Backend: Auth modülü
  - `POST /auth/login` — username + password, JWT token döndür
  - `GET /auth/me` — mevcut kullanıcı bilgisi
  - Basit JWT sign/verify (jose veya manual, kütüphane yok)
  - AuthGuard (custom, @nestjs/passport kullanma)
  - @CurrentUser() decorator

- [ ] **T-006** Database: Users tablosu + seed data
  - `users` tablosu: id, username, password_hash, display_name, created_at
  - Seed: test1/123456, test2/123456 (bcrypt hash)
  - Migration dosyası

- [ ] **T-007** Frontend: Login sayfası + auth state
  - Login form (username + password)
  - Token'ı localStorage'da tut
  - Auth context (React context, kütüphane yok)
  - Protected route wrapper
  - Logout fonksiyonu

### 1.3 Regex Filter Builder

- [ ] **T-008** Domain modeli tasarla
  - RegexFilter entity: id, user_id, name, description, category, pattern, is_active, created_at, updated_at
  - Category enum: "stat", "modifier", "attribute", "custom"
  - DTO'lar: CreateRegexFilterDto, UpdateRegexFilterDto

- [ ] **T-009** Backend: RegexFilter CRUD
  - `GET /regex-filters` — kullanıcının filtreleri (pagination)
  - `GET /regex-filters/:id` — tek filtre
  - `POST /regex-filters` — yeni filtre oluştur
  - `PATCH /regex-filters/:id` — filtre güncelle
  - `DELETE /regex-filters/:id` — filtre sil
  - Ownership guard (user sadece kendi filtrelerini görsün)

- [ ] **T-010** Backend: Regex validation servisi
  - Regex syntax doğrulama
  - PoE mod listesine karşı test (bilinen modifier'lar)
  - Regex preview: "bu regex şu mod'lara eşleşir" sonucu

- [ ] **T-011** Frontend: Regex Builder sayfası
  - Filtre listesi (tablo/kart görünümü)
  - Yeni filtre oluştur modal/form
  - Regex input + live preview
  - Kategori seçimi
  - Düzenle / Sil aksiyonları

- [ ] **T-012** Frontend: Regex Test Aracı
  - Textarea'ya item text yapıştır
  - Aktif regex'leri item'a karşı çalıştır
  - Eşleşen satırları highlight et
  - Hızlı regex oluştur (seçili text'ten)

### 1.4 Trade Search Integration

- [ ] **T-013** PoE Trade API araştırması + adapter
  - pathofexile.com/trade API endpoint'leri haritalandır
  - Rate limit kurallarını belgele
  - Request/Response type'ları oluştur
  - API adapter servisi (backend proxy)

- [ ] **T-014** Backend: Trade Search modülü
  - `POST /trade/search` — regex filter'ı trade query'ye çevir, sonuçları döndür
  - `GET /trade/fetch/:id` — trade sonuç detayları
  - Regex → Trade stat mapping servisi
  - Rate limiter (PoE API kurallarına uygun)
  - Response caching (kısa süreli, aynı arama tekrar etmesin)

- [ ] **T-015** Backend: PoE Static Data servisi
  - Mod listesi (stats.json'dan parse)
  - Item base type'ları
  - Currency değerleri (ninja API veya manual)
  - Periyodik güncelleme mekanizması

- [ ] **T-016** Frontend: Trade Search sayfası
  - Kayıtlı regex filtrelerinden seç
  - "Ara" butonu → backend'e gönder
  - Sonuçları tablo olarak göster (item, price, seller, whisper)
  - Whisper mesajını kopyala butonu
  - Sonuç filtreleme (min/max price)

### 1.5 Temel UI/UX

- [ ] **T-017** Layout + Navigation
  - App shell: sidebar + main content
  - Navigation: Dashboard, Regex Filters, Trade Search
  - User menu (profil, logout)
  - Responsive design (mobile-friendly)
  - Dark theme (PoE temasına uygun)

- [ ] **T-018** Dashboard sayfası
  - Son kullanılan filtreler
  - Hızlı arama shortcut'ı
  - Basit istatistikler (kaç filtre, kaç arama)

---

## Phase 2 — Cost Analysis & Strategy (Post-MVP)

### 2.1 Cost per Map Calculator

- [ ] **T-019** Map strategy entity + CRUD
  - Strategy: name, description, map_name, atlas_passives, required_items, expected_drops
  - Her strateji birden fazla regex filter'a bağlanabilir

- [ ] **T-020** Cost hesaplama engine
  - Input cost: map cost + scarab cost + fragment cost + currency cost
  - Output value: beklenen drop'ların trade value'su
  - Net profit per map
  - Chaos/Divine per hour projeksiyonu

- [ ] **T-021** Frontend: Strategy Builder sayfası
  - Strateji oluştur/düzenle
  - Item cost girişi (trade'den otomatik çek veya manual)
  - Profit/loss dashboard

### 2.2 Atlas Passive Tree

- [ ] **T-022** Atlas passive tree data modeli
  - Atlas tree node'ları (JSON data)
  - Strateji başına seçili node'lar

- [ ] **T-023** Atlas tree görselleştirme
  - Interactive tree viewer (Canvas veya SVG)
  - Strateji bazında node highlight
  - Paylaşılabilir tree link

---

## Phase 3 — Stash & ROI (GGG OAuth Bağımlı)

- [ ] **T-024** GGG OAuth integration
  - OAuth2 flow implementasyonu
  - Token storage + refresh
  - Scope: stash read

- [ ] **T-025** Stash snapshot servisi
  - Stash tab'larını çek
  - Snapshot'ı DB'ye kaydet (tarih bazlı)
  - Diff: önceki snapshot ile karşılaştır

- [ ] **T-026** ROI Tracker
  - Strateji başına: before/after stash snapshot
  - Gerçek kazanç hesaplama
  - Zaman bazlı ROI grafikleri

---

## Phase 4 — Social & Sharing

- [ ] **T-027** Strategy paylaşım sistemi
  - Public/private toggle
  - Shareable link oluştur
  - Strategy import/export (JSON)

- [ ] **T-028** Community feed
  - Public stratejileri listele
  - Upvote/bookmark sistemi
  - Filtreleme: map type, budget, profit margin

- [ ] **T-029** Atlas tree sharing
  - Tree config'i URL'e encode et
  - Paylaşılan tree'yi görüntüle
  - "Bu stratejiyi kullan" butonu (kendi hesabına kopyala)

---

## Teknik Borç & Altyapı (Sürekli)

- [ ] **T-030** Test altyapısı
  - Backend: Jest + supertest (e2e)
  - Frontend: Vitest + React Testing Library
  - CI pipeline (GitHub Actions)

- [ ] **T-031** Error handling standardı
  - Backend: Global exception filter
  - Frontend: Error boundaries + toast notifications
  - API error response formatı

- [ ] **T-032** Deployment hazırlığı
  - Dockerfiles (backend + frontend)
  - Docker Compose (full stack + DB)
  - Environment variable documentation

---

## Task Dependency Grafiği

```
T-001 ─┬─► T-005 ─► T-006 ─► T-007
T-002 ─┤
T-003 ─┤   T-008 ─► T-009 ─► T-010 ─► T-011 ─► T-012
T-004 ─┘
            T-013 ─► T-014 ─► T-015 ─► T-016

            T-017 (paralel, T-002'den sonra)
            T-018 (T-017'den sonra)

Phase 2: T-019 → T-020 → T-021 (Phase 1 tamamlandıktan sonra)
          T-022 → T-023

Phase 3: T-024 → T-025 → T-026 (GGG OAuth onayına bağlı)

Phase 4: T-027 → T-028 → T-029 (Phase 2 tamamlandıktan sonra)
```

## Execution Order (Önerilen)

**Sprint 1:** T-001, T-002, T-003, T-004 (Scaffolding — paralel)
**Sprint 2:** T-005, T-006, T-007, T-017 (Auth + Layout — paralel)
**Sprint 3:** T-008, T-009, T-010 (Regex backend)
**Sprint 4:** T-011, T-012, T-018 (Regex frontend + dashboard)
**Sprint 5:** T-013, T-014, T-015 (Trade backend)
**Sprint 6:** T-016, T-030, T-031 (Trade frontend + test + error handling)
