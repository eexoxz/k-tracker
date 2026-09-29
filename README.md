# K-tracker

A lightweight desktop-first K-pop release tracker built with React, TypeScript, and a Tauri-ready shell.

The first version focuses on the simple workflow:

- Save K-pop artists to a personal watchlist.
- Refresh saved artists from MusicBrainz to show upcoming release groups and current discography.
- Display release cards with album art when Cover Art Archive has an image.
- Open quick Spotify, YouTube, Apple Music, Melon, and MusicBrainz links.
- Search and filter the fetched release data by saved artist.
- Keep the internal model scene-based so Mandopop, J-pop, or English pop can be added later.

## Local-first plan

K-tracker currently remembers the watchlist, filter preferences, custom artists, fetched release cache, and last refresh time on this PC with browser/Tauri local storage. That keeps the personal version simple and fast. Firebase is intentionally left as a future sync layer, so login and cloud watchlists can be added later without changing the main app shape.

The current API source is MusicBrainz, which is useful for discography and release-group dates but may not have every future K-pop comeback announcement. Spotify/YouTube API integration can be added later for richer metadata and official MV checks.

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
