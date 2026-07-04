# DealBase Radar

Aplikacja (nie strona marketingowa — ta jest osobno: [dealbase-radar-website](https://github.com/investrentkg/dealbase-radar-website)).

Struktura lustrzana do `investrent-crm`:

- `backend/` — Express + TypeScript. API: auth, wyszukiwanie (Apify), Deal Score, RCN/Cenogram, watchlisty, alerty.
- `frontend/` — React + Vite + TypeScript + Tailwind. Panel użytkownika.

Każda część ma własny `package.json` i `README.md` z instrukcją uruchomienia.

## Status (04.07.2026)

Backend: działa end-to-end, testowany przez GitHub Actions (`.github/workflows/test-auth-flow.yml`, `workflow_dispatch`).
Frontend: szkielet gotowy (logowanie, wyszukiwarka, watchlisty), build przechodzi, jeszcze nie wdrożony publicznie.

Baza danych: Supabase, projekt `dealbase-radar-accounts` (schematy `radar` i `market_intel`).
