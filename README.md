# K-tracker

A lightweight desktop-first K-pop release tracker built with React, TypeScript, and a Tauri-ready shell.

The first version focuses on the simple workflow:

- Open a general K-pop discovery feed for upcoming comeback/release events.
- Save K-pop artists to a personal watchlist.
- Open an artist page for releases, news shortcuts, official links, and member links when known.
- Refresh saved artists from MusicBrainz to show upcoming release groups and current discography.
- Display release cards with album art when Cover Art Archive has an image.
- Open quick icon links for Spotify, YouTube, Apple Music, Melon, MusicBrainz, and official artist sources.
- Search and filter the fetched release data by saved artist.
- Keep the internal model scene-based so Mandopop, J-pop, or English pop can be added later.

## Local-first plan

K-tracker currently remembers the watchlist, filter preferences, custom artists, fetched release cache, and last refresh time on this PC with browser/Tauri local storage. That keeps the personal version simple and fast. Firebase is intentionally left as a future sync layer, so login and cloud watchlists can be added later without changing the main app shape.

## Source plan

Current working sources:

- K-Pop Calendar open iCalendar feed for general upcoming K-pop events.
- KpopComebacks, KBS K-pop News RSS, and Soompi as public source shortcuts.
- MusicBrainz API for release-group metadata.
- Cover Art Archive for album/release artwork when available.
- Official/social/search links attached to each artist.

Prepared but optional:

- YouTube Data API for recent official uploads. Add `VITE_YOUTUBE_API_KEY` to `.env.local` and add `youtubeChannelId` to artists before enabling this fully.

Important limitation: MusicBrainz is useful for discography and release-group dates, but it may not have every future K-pop comeback announcement. X and Instagram links can be shown as official sources, but reading their feeds requires approved platform APIs/tokens. The app should use public calendars, RSS/news sources, and official links instead of scraping or inventing posts, because accuracy matters more than making the feed look full.

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
