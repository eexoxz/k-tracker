# K-tracker

A lightweight desktop-first K-pop release tracker built with React, TypeScript, and a Tauri-ready shell.

The first version focuses on the simple workflow:

- Save K-pop artists to a personal watchlist.
- Track comeback entries with status, release type, source links, cover image URLs, and platform links.
- Use Today, Calendar, Add, Releases, News, and Data views for daily tracking.
- Mark comeback entries as seen and filter entries that need source links or follow-up.
- Export/import a local JSON backup so personal tracking data is not trapped in one app session.
- Scan newest releases by artist, date, and platform.
- Open quick Spotify, YouTube, Apple Music, or Melon searches.
- Keep the internal model scene-based so Mandopop, J-pop, or English pop can be added later.

## Local-first plan

K-tracker currently remembers the watchlist, filter preferences, custom artists, comeback calendar, and seen state on this PC with browser/Tauri local storage. That keeps the personal version simple and fast. Firebase is intentionally left as a future sync layer, so login and cloud watchlists can be added later without changing the main app shape.

The comeback calendar is manual-first by design. Real APIs can later enrich it with Spotify/YouTube metadata, but manually saved source links remain useful for checking whether a comeback date is confirmed.

## Run the web app

```bash
pnpm install
pnpm dev
```

## Run as a desktop app

Tauri also needs the Rust toolchain installed.

```bash
pnpm install
pnpm desktop
```

## Firebase

The app currently saves preferences locally so it works without setup. Firebase is included as a planned dependency for optional login and synced watchlists. Copy `.env.example` to `.env.local` when you are ready to connect a Firebase project.
