# test-assistant-mobile — Geliştirme günlüğü

Kullanım: [ortak changelog rehberi](../CHANGELOG.md). Sürümler geliştirme ledger'ına aittir; deploy/paket yayını değildir.
Kayıtlar eklenme sırasıyla tutulur. Minor = yeni yetenek; patch = düzeltme/iyileştirme/bakım.
Başlangıç: `1.0.0` (manifest: `1.0.0`). Önceki sürümler tahmin edilmemiştir.
Geçmiş: [Git arşivi](docs/changelog/history.md). Release notlarına kendiliğinden dahil edilmez.

<!-- CHANGELOG:BASELINE {"date": "2026-10-22T13:47:26+03:00", "git_head": "ec932916a5fafbe3e1f45ffd818ae0ea711600e3", "manifest_version": "1.0.0", "note": "Ledger starting point only; not a historical release claim", "version": "1.0.0"} -->

<!-- CHANGELOG:ENTRY {"bump": "minor", "date": "2026-10-30T16:48:56+03:00", "evidence": "npm run test:unit — testData.getCell 3/3 PASS; gerçek Appium smoke UNVERIFIED.", "id": "2026-10-30-data-center-phase-4-android", "summary": "Android runner COTESTER_DATASET_ROW_INDEX ile dataset hücrelerini çözer; eksik kolon/satır fail-closed.", "title": "Mobile getCell + DATA-3 row env", "version": "1.1.0"} -->
## 1.1.0 — Mobile getCell + DATA-3 row env

Android runner COTESTER_DATASET_ROW_INDEX ile dataset hücrelerini çözer; eksik kolon/satır fail-closed.

Kanıt / doğrulama: npm run test:unit — testData.getCell 3/3 PASS; gerçek Appium smoke UNVERIFIED.

<!-- CHANGELOG:ENTRY {"bump": "patch", "date": "2026-10-30T17:12:35+03:00", "evidence": "npm run test:unit — DATA-3 three-row smoke 2/2 PASS; gerçek Appium execution UNVERIFIED.", "id": "2026-10-30-data-center-phase-4-android-validation-smoke", "summary": "Android runner, Appium olmadan 3 satırlık DATA-3 hücre çözümlemesini birim testiyle doğrular.", "title": "DATA-3 three-row getCell smoke test", "version": "1.1.1"} -->
## 1.1.1 — DATA-3 three-row getCell smoke test

Android runner, Appium olmadan 3 satırlık DATA-3 hücre çözümlemesini birim testiyle doğrular.

Kanıt / doğrulama: npm run test:unit — DATA-3 three-row smoke 2/2 PASS; gerçek Appium execution UNVERIFIED.

<!-- CHANGELOG:ENTRY {"bump": "minor", "date": "2026-10-30T18:20:16+03:00", "evidence": "tests/step-event.test.ts PASS inside npm run test:unit; Appium E2E UNVERIFIED.", "id": "2026-10-30-pkg8-phase2-step-state-hybrid-preview", "summary": "Android runner WEB/API ile aynı structured step identity marker’larını üretir; DATA-3 row ayrımı korunur.", "title": "MOBILE structured step event parity", "version": "1.2.0"} -->
## 1.2.0 — MOBILE structured step event parity

Android runner WEB/API ile aynı structured step identity marker’larını üretir; DATA-3 row ayrımı korunur.

Kanıt / doğrulama: tests/step-event.test.ts PASS inside npm run test:unit; Appium E2E UNVERIFIED.
