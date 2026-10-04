# Development Archive

Development was put aside on 2026-10-04. The source, lockfiles, automated tests, font preview, browser verification scripts, screenshots, and release notes are kept in this repository so the local working folder can be removed.

Generated dependencies, Rust build caches, generated schemas, and preview logs are not archived. Recreate dependencies and builds with the commands in the main README. Browser verification scripts in this folder reference the original machine's bundled Playwright runtime and port 5174; adapt those paths when running elsewhere.

The Windows 0.1.1 installer is also retained in the repository's draft GitHub release.

## Remaining Work

The intended app is a lightweight personal K-pop tracker: open it to see recent and upcoming comebacks, then search any artist for discography, group/member socials, and recent news. Sora is the chosen font. Artist pages must share the same behavior, and supplied data must remain attributable and accurate. Login is optional; preferences should stay on the user's PC. Other music scenes can be added later.

Priorities for resuming development:

1. Make discovery reliable across multiple public sources, with recent and upcoming releases and handling for unavailable feeds.
2. Fetch credited article headlines, dates, thumbnails, and source links inside the app. News currently opens external searches.
3. Refresh stale data automatically on launch while keeping cached content available offline.
4. Improve discography pagination, album cover coverage, and direct release links. Preserve uncertain dates rather than assigning an exact day.
5. Supplement missing artist/member records and correctly associate member solo activities with their groups.
6. Add date and platform filters, then measure startup speed and memory use on a modest Windows PC.

Current working foundation: online artist search; shared group/member pages; MusicBrainz discography and source links; Cover Art Archive artwork; one public calendar connector; local watchlists and profile caching; source credits; desktop browser-opening support; a Windows installer; and six regression tests.

The automated and browser checks passed for the current snapshot. Complete source coverage, a fetched news feed, and performance verification on older hardware are still unfinished.
