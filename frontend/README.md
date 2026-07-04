# DealBase Radar — panel (frontend)

React + Vite + TypeScript + Tailwind. Łączy się z backendem w folderze `../backend`.

## Uruchomienie lokalne

```
npm install
cp .env.example .env   # ustaw VITE_API_URL na adres backendu
npm run dev
```

## Status

Szkielet: logowanie, rejestracja, wyszukiwarka z Deal Score, obserwowane wyszukiwania.
Wymaga działającego backendu (patrz ../backend/README.md) - bez niego formularze logowania/wyszukiwania nie będą miały się z czym połączyć.

Jeszcze nie wdrożony publicznie - czeka na decyzję o hostingu (Vercel, tak jak frontend CRM).
