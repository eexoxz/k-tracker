import {
  CalendarDays,
  Database,
  Disc3,
  ExternalLink,
  Globe2,
  Heart,
  Image,
  Instagram,
  Link,
  Loader2,
  Music,
  Music2,
  Newspaper,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Twitter,
  Users,
  Youtube
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { artists } from "./data/catalog";
import { discoverySources, fallbackCalendarEvents, getArtistNewsSources, sourceCredits } from "./data/publicSources";
import { fetchKpopCalendarEvents } from "./services/kpopCalendar";
import { fetchMusicBrainzReleaseGroups, musicBrainzPauseMs } from "./services/musicBrainz";
import { fetchRecentYoutubePosts, isYoutubeReady } from "./services/youtube";
import type { ApiRelease, Artist, ArtistPost, ArtistSource, KpopCalendarEvent, MusicScene, Platform, SourcePlatform } from "./types/music";
import { buildPlatformSearchUrl, platformLabels } from "./utils/links";
import { readStoredValue, readStringList, writeStoredValue, writeStringList } from "./utils/storage";

const scenes: Array<{ id: MusicScene; label: string; available: boolean }> = [
  { id: "kpop", label: "K-pop", available: true },
  { id: "mandopop", label: "Mandopop", available: false },
  { id: "jpop", label: "J-pop", available: false },
  { id: "english_pop", label: "English Pop", available: false }
];

const appViews = [
  { id: "discover", label: "Discover" },
  { id: "releases", label: "Releases" },
  { id: "news", label: "News" },
  { id: "sources", label: "Sources" }
] as const;

type AppView = (typeof appViews)[number]["id"];

type LocalPreferences = {
  scene: MusicScene;
  selectedArtist: string;
  activeView: AppView;
};

const defaultPreferences: LocalPreferences = {
  scene: "kpop",
  selectedArtist: "all",
  activeView: "discover"
};

const apiSources = [
  ...sourceCredits,
  { label: "MusicBrainz", url: "https://musicbrainz.org/doc/MusicBrainz_API", note: "release metadata" },
  { label: "Cover Art Archive", url: "https://coverartarchive.org/", note: "album artwork" },
  { label: "YouTube Data API", url: "https://developers.google.com/youtube/v3", note: "official posts when configured" }
];

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function createArtistId(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return `local-${slug || "artist"}-${Date.now()}`;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${date.slice(0, 10)}T00:00:00`));
}

function isUpcoming(date: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${date}T00:00:00`).getTime() >= today.getTime();
}

function getValidatedView(value: unknown): AppView {
  return appViews.some((view) => view.id === value) ? (value as AppView) : "discover";
}

function getInitialPreferences() {
  const stored = readStoredValue<Partial<LocalPreferences>>("preferences", defaultPreferences);
  return {
    ...defaultPreferences,
    ...stored,
    activeView: getValidatedView(stored.activeView)
  };
}

function getSourceIcon(source: SourcePlatform | Platform) {
  switch (source) {
    case "youtube":
      return <Youtube size={17} />;
    case "instagram":
      return <Instagram size={17} />;
    case "tiktok":
      return <Music size={17} />;
    case "x":
      return <Twitter size={17} />;
    case "spotify":
      return <Music2 size={17} />;
    case "appleMusic":
      return <Music size={17} />;
    case "melon":
      return <Radio size={17} />;
    case "musicBrainz":
      return <Database size={17} />;
    case "coverArtArchive":
      return <Image size={17} />;
    case "website":
      return <Globe2 size={17} />;
    case "news":
      return <Newspaper size={17} />;
    default:
      return <Link size={17} />;
  }
}

function getArtistFallbackSources(artist: Artist): ArtistSource[] {
  return [
    { id: "youtube", label: "YouTube", url: buildPlatformSearchUrl("youtube", artist.name, "official"), kind: "search" },
    { id: "spotify", label: "Spotify", url: buildPlatformSearchUrl("spotify", artist.name, ""), kind: "search" },
    { id: "appleMusic", label: "Apple Music", url: buildPlatformSearchUrl("appleMusic", artist.name, ""), kind: "search" }
  ];
}

export default function App() {
  const initialPreferences = useMemo(getInitialPreferences, []);
  const [scene, setScene] = useState<MusicScene>(initialPreferences.scene);
  const [selectedArtist, setSelectedArtist] = useState(initialPreferences.selectedArtist);
  const [activeView, setActiveView] = useState<AppView>(initialPreferences.activeView);
  const [artistQuery, setArtistQuery] = useState("");
  const [releaseQuery, setReleaseQuery] = useState("");
  const [newArtistName, setNewArtistName] = useState("");
  const [newArtistAliases, setNewArtistAliases] = useState("");
  const [watchlist, setWatchlist] = useState<string[]>(() => readStringList("watchlist", ["aespa", "ive", "iu"]));
  const [customArtists, setCustomArtists] = useState<Artist[]>(() => readStoredValue("customArtists", []));
  const [calendarEvents, setCalendarEvents] = useState<KpopCalendarEvent[]>(() =>
    readStoredValue("calendarEvents", fallbackCalendarEvents)
  );
  const [apiReleases, setApiReleases] = useState<ApiRelease[]>(() => readStoredValue("apiReleases", []));
  const [artistPosts, setArtistPosts] = useState<ArtistPost[]>(() => readStoredValue("artistPosts", []));
  const [lastRefreshed, setLastRefreshed] = useState(() => readStoredValue("lastRefreshed", ""));
  const [loading, setLoading] = useState(false);
  const [dataMessage, setDataMessage] = useState("");
  const didAutoRefresh = useRef(false);

  const allArtists = useMemo(() => [...artists, ...customArtists], [customArtists]);
  const sceneArtists = useMemo(() => allArtists.filter((artist) => artist.scene === scene), [allArtists, scene]);
  const customArtistIds = useMemo(() => new Set(customArtists.map((artist) => artist.id)), [customArtists]);
  const watchedArtists = useMemo(
    () => sceneArtists.filter((artist) => watchlist.includes(artist.id)),
    [sceneArtists, watchlist]
  );
  const activeArtist = useMemo(
    () => sceneArtists.find((artist) => artist.id === selectedArtist),
    [sceneArtists, selectedArtist]
  );

  useEffect(() => {
    writeStringList("watchlist", watchlist);
  }, [watchlist]);

  useEffect(() => {
    writeStoredValue("customArtists", customArtists);
  }, [customArtists]);

  useEffect(() => {
    writeStoredValue("calendarEvents", calendarEvents);
  }, [calendarEvents]);

  useEffect(() => {
    writeStoredValue("apiReleases", apiReleases);
  }, [apiReleases]);

  useEffect(() => {
    writeStoredValue("artistPosts", artistPosts);
  }, [artistPosts]);

  useEffect(() => {
    writeStoredValue("lastRefreshed", lastRefreshed);
  }, [lastRefreshed]);

  useEffect(() => {
    writeStoredValue("preferences", { scene, selectedArtist, activeView });
  }, [activeView, scene, selectedArtist]);

  useEffect(() => {
    if (selectedArtist !== "all" && !sceneArtists.some((artist) => artist.id === selectedArtist)) {
      setSelectedArtist("all");
    }
  }, [sceneArtists, selectedArtist]);

  useEffect(() => {
    if (didAutoRefresh.current || (apiReleases.length > 0 && calendarEvents.length > 1)) return;
    didAutoRefresh.current = true;
    void refreshArtistData();
  }, [apiReleases.length, calendarEvents.length]);

  const matchingArtists = useMemo(() => {
    const query = artistQuery.trim().toLowerCase();
    if (!query) return sceneArtists;

    return sceneArtists.filter((artist) =>
      [
        artist.name,
        ...(artist.aliases ?? []),
        ...(artist.members ?? []).flatMap((member) => [member.name, ...(member.aliases ?? [])])
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [artistQuery, sceneArtists]);

  const artistsInFocus = useMemo(() => {
    if (activeArtist) return [activeArtist];
    return watchedArtists;
  }, [activeArtist, watchedArtists]);

  const filteredReleases = useMemo(() => {
    const artistIds = new Set(artistsInFocus.map((artist) => artist.id));
    const query = releaseQuery.trim().toLowerCase();

    return apiReleases
      .filter((release) => artistIds.has(release.artistId))
      .filter((release) => {
        if (!query) return true;
        return `${release.artistName} ${release.title} ${release.type}`.toLowerCase().includes(query);
      });
  }, [apiReleases, artistsInFocus, releaseQuery]);

  const upcomingReleases = useMemo(
    () => filteredReleases.filter((release) => isUpcoming(release.releaseDate)).sort((a, b) => a.releaseDate.localeCompare(b.releaseDate)),
    [filteredReleases]
  );

  const discography = useMemo(
    () => [...filteredReleases].sort((a, b) => b.releaseDate.localeCompare(a.releaseDate)),
    [filteredReleases]
  );

  const focusedPosts = useMemo(() => {
    const artistIds = new Set(artistsInFocus.map((artist) => artist.id));
    return artistPosts.filter((post) => artistIds.has(post.artistId)).sort((a, b) => b.date.localeCompare(a.date));
  }, [artistPosts, artistsInFocus]);

  const visibleCalendarEvents = useMemo(() => {
    const query = releaseQuery.trim().toLowerCase();
    return calendarEvents.filter((event) => {
      if (!query) return true;
      return `${event.artistName} ${event.title} ${event.type} ${event.description ?? ""}`.toLowerCase().includes(query);
    });
  }, [calendarEvents, releaseQuery]);

  const activeArtistNewsSources = useMemo(
    () => (activeArtist ? getArtistNewsSources(activeArtist) : discoverySources),
    [activeArtist]
  );

  async function refreshArtistData() {
    const artistsToRefresh = artistsInFocus.length > 0 ? artistsInFocus : watchedArtists;

    setLoading(true);
    setDataMessage("Refreshing public metadata...");

    try {
      let calendarMessage = "";
      const releases: ApiRelease[] = [];
      const posts: ArtistPost[] = [];
      const failedArtists: string[] = [];

      try {
        const events = await fetchKpopCalendarEvents();
        setCalendarEvents(events.length > 0 ? events : fallbackCalendarEvents);
      } catch {
        calendarMessage = " K-Pop Calendar could not be reached, so source links are shown instead.";
      }

      for (const artist of artistsToRefresh) {
        try {
          releases.push(...(await fetchMusicBrainzReleaseGroups(artist)));
          if (isYoutubeReady(artist)) {
            posts.push(...(await fetchRecentYoutubePosts(artist)));
          }
        } catch {
          failedArtists.push(artist.name);
        }
        await sleep(musicBrainzPauseMs);
      }

      setApiReleases((current) => {
        const refreshedIds = new Set(artistsToRefresh.map((artist) => artist.id));
        const retained = current.filter((release) => !refreshedIds.has(release.artistId));
        const merged = [...retained, ...releases];
        const uniqueById = new Map(merged.map((release) => [`${release.artistId}-${release.id}`, release]));
        return [...uniqueById.values()];
      });

      setArtistPosts((current) => {
        const refreshedIds = new Set(posts.map((post) => post.artistId));
        const retained = current.filter((post) => !refreshedIds.has(post.artistId));
        const uniqueById = new Map([...retained, ...posts].map((post) => [`${post.artistId}-${post.id}`, post]));
        return [...uniqueById.values()];
      });

      setLastRefreshed(new Date().toISOString());
      setDataMessage(
        failedArtists.length > 0
          ? `Updated what I could. Could not refresh: ${failedArtists.join(", ")}.${calendarMessage}`
          : artistsToRefresh.length > 0
            ? `Updated from connected public sources.${calendarMessage}`
            : `Updated K-pop discovery sources.${calendarMessage}`
      );
    } catch (error) {
      setDataMessage(error instanceof Error ? error.message : "Could not refresh data right now.");
    } finally {
      setLoading(false);
    }
  }

  function toggleWatchlist(artistId: string) {
    setWatchlist((current) =>
      current.includes(artistId) ? current.filter((id) => id !== artistId) : [...current, artistId]
    );
  }

  function addCustomArtist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = newArtistName.trim();
    if (!name) return;

    const aliases = newArtistAliases
      .split(",")
      .map((alias) => alias.trim())
      .filter(Boolean);
    const artist = { id: createArtistId(name), name, scene, aliases };

    setCustomArtists((current) => [...current, artist]);
    setWatchlist((current) => [...new Set([...current, artist.id])]);
    setSelectedArtist(artist.id);
    setNewArtistName("");
    setNewArtistAliases("");
  }

  function removeCustomArtist(artistId: string) {
    setCustomArtists((current) => current.filter((artist) => artist.id !== artistId));
    setWatchlist((current) => current.filter((id) => id !== artistId));
    setApiReleases((current) => current.filter((release) => release.artistId !== artistId));
    setArtistPosts((current) => current.filter((post) => post.artistId !== artistId));
    if (selectedArtist === artistId) setSelectedArtist("all");
  }

  function renderSourceLink(source: ArtistSource) {
    return (
      <a className="icon-link" href={source.url} target="_blank" rel="noreferrer" title={source.label} key={`${source.id}-${source.url}`}>
        {getSourceIcon(source.id)}
        <span className="sr-only">{source.label}</span>
      </a>
    );
  }

  function renderPlatformLink(platform: Platform, url: string) {
    return (
      <a className="icon-link" href={url} target="_blank" rel="noreferrer" title={platformLabels[platform]} key={platform}>
        {getSourceIcon(platform)}
        <span className="sr-only">{platformLabels[platform]}</span>
      </a>
    );
  }

  function renderReleaseCard(release: ApiRelease) {
    return (
      <article className="release-card with-cover" key={`${release.artistId}-${release.id}`}>
        <div className="cover-frame">
          {release.cover ? (
            <img
              src={release.cover.imageUrl}
              alt={`${release.title} cover`}
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          ) : null}
          <div className="cover-placeholder">
            <Image size={24} />
            <span>{release.artistName.slice(0, 2).toUpperCase()}</span>
          </div>
        </div>
        <div className="release-card-body">
          <div className="release-header">
            <div>
              <p>{formatDate(release.releaseDate)}</p>
              <h3>{release.title}</h3>
            </div>
            <span>{release.type}</span>
          </div>
          <button className="artist-name as-button" type="button" onClick={() => setSelectedArtist(release.artistId)}>
            {release.artistName}
          </button>
          <div className="platform-links icon-only">
            {(Object.entries(release.platformSearches) as Array<[Platform, string]>).map(([platform, url]) =>
              renderPlatformLink(platform, url)
            )}
            <a className="icon-link source-link" href={release.source.url} target="_blank" rel="noreferrer" title={release.source.label}>
              {getSourceIcon("musicBrainz")}
              <span className="sr-only">{release.source.label}</span>
            </a>
          </div>
        </div>
      </article>
    );
  }

  function renderPostCard(post: ArtistPost) {
    return (
      <article className="post-card" key={`${post.artistId}-${post.id}`}>
        <a href={post.url} target="_blank" rel="noreferrer" title={post.title}>
          <div className="post-thumb">
            {post.thumbnailUrl ? <img src={post.thumbnailUrl} alt="" /> : <Youtube size={24} />}
          </div>
          <div>
            <p>{formatDate(post.date)}</p>
            <h3>{post.title}</h3>
            <small>{post.artistName} via {post.source.label}</small>
          </div>
          <ExternalLink size={16} />
        </a>
      </article>
    );
  }

  function renderCalendarEvent(event: KpopCalendarEvent) {
    const matchingArtist = sceneArtists.find(
      (artist) => artist.name.toLowerCase() === event.artistName.toLowerCase()
    );

    return (
      <article className="event-card" key={event.id}>
        <div>
          <p>{formatDate(event.date)}</p>
          <h3>{event.title}</h3>
          <button
            className="artist-name as-button"
            type="button"
            onClick={() => {
              if (matchingArtist) {
                setSelectedArtist(matchingArtist.id);
                setActiveView("releases");
              } else {
                setArtistQuery(event.artistName);
              }
            }}
          >
            {event.artistName}
          </button>
        </div>
        <div className="event-meta">
          <span>{event.type}</span>
          {event.confirmed === false ? <span>TBA</span> : null}
        </div>
        <div className="platform-links icon-only">
          {event.url ? (
            <a className="icon-link" href={event.url} target="_blank" rel="noreferrer" title="Open event source">
              <ExternalLink size={17} />
              <span className="sr-only">Open event source</span>
            </a>
          ) : null}
          <a className="icon-link source-link" href={event.source.url} target="_blank" rel="noreferrer" title={event.source.label}>
            {getSourceIcon("website")}
            <span className="sr-only">{event.source.label}</span>
          </a>
        </div>
      </article>
    );
  }

  function renderPublicSourceCard(source: ArtistSource) {
    return (
      <a className="public-source-card" href={source.url} target="_blank" rel="noreferrer" key={`${source.label}-${source.url}`}>
        {getSourceIcon(source.id)}
        <span>
          <strong>{source.label}</strong>
          <small>{source.kind}</small>
        </span>
        <ExternalLink size={15} />
      </a>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Artist watchlist">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <Music2 size={22} />
          </div>
          <div>
            <p className="eyebrow">K-pop release radar</p>
            <h1>K-tracker</h1>
          </div>
        </div>

        <div className="scene-tabs" aria-label="Music scene">
          {scenes.map((item) => (
            <button
              key={item.id}
              type="button"
              className={scene === item.id ? "active" : ""}
              disabled={!item.available}
              onClick={() => setScene(item.id)}
              title={item.available ? item.label : "Planned for later"}
            >
              {item.label}
            </button>
          ))}
        </div>

        <label className="search-box">
          <Search size={17} />
          <input value={artistQuery} onChange={(event) => setArtistQuery(event.target.value)} placeholder="Find artist" />
        </label>

        <form className="add-artist-form" onSubmit={addCustomArtist}>
          <input value={newArtistName} onChange={(event) => setNewArtistName(event.target.value)} placeholder="Add artist" />
          <input
            value={newArtistAliases}
            onChange={(event) => setNewArtistAliases(event.target.value)}
            placeholder="Aliases"
          />
          <button type="submit" title="Save artist">
            <Plus size={17} />
          </button>
        </form>

        <button className={`all-artists-button ${selectedArtist === "all" ? "active" : ""}`} type="button" onClick={() => setSelectedArtist("all")}>
          All saved artists
        </button>

        <section className="artist-list" aria-label="Artists">
          {matchingArtists.map((artist) => {
            const saved = watchlist.includes(artist.id);
            const isCustom = customArtistIds.has(artist.id);

            return (
              <div className={`artist-row ${selectedArtist === artist.id ? "selected" : ""}`} key={artist.id}>
                <button type="button" onClick={() => setSelectedArtist(artist.id)}>
                  <span>
                    <strong>{artist.name}</strong>
                    <small>{artist.aliases?.[0] ?? (isCustom ? "Saved locally" : "K-pop artist")}</small>
                  </span>
                </button>
                <button
                  type="button"
                  className="heart-button"
                  onClick={() => toggleWatchlist(artist.id)}
                  title={saved ? `Unsave ${artist.name}` : `Save ${artist.name}`}
                  aria-pressed={saved}
                >
                  <Heart size={18} className={saved ? "saved" : ""} fill={saved ? "currentColor" : "none"} />
                </button>
                {isCustom ? (
                  <button
                    type="button"
                    className="delete-artist"
                    onClick={() => removeCustomArtist(artist.id)}
                    title={`Remove ${artist.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                ) : null}
              </div>
            );
          })}
        </section>
      </aside>

      <section className="content">
        <header className="artist-hero">
          <div>
            <p className="eyebrow">{activeArtist ? "Artist page" : "K-pop discovery"}</p>
            <h2>{activeArtist?.name ?? "Recent K-pop comebacks"}</h2>
            <p className="topbar-note">
              {activeArtist
                ? `${activeArtist.aliases?.join(", ") || "Official sources, release metadata, and recent news shortcuts"}`
                : "Upcoming releases and comeback leads from public fan calendars, news feeds, and open metadata sources."}
            </p>
            <div className="source-strip">
              {(activeArtist?.sources ?? discoverySources).map(renderSourceLink)}
            </div>
          </div>
          <button className="sync-button" type="button" onClick={() => void refreshArtistData()} disabled={loading}>
            {loading ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
            Refresh
          </button>
        </header>

        <section className="toolbar-panel" aria-label="Release controls">
          <nav className="view-tabs" aria-label="App views">
            {appViews.map((view) => (
              <button
                key={view.id}
                type="button"
                className={activeView === view.id ? "active" : ""}
                onClick={() => setActiveView(view.id)}
              >
                {view.label}
              </button>
            ))}
          </nav>

          <div className="filter-panel simple">
            <label className="search-box release-search">
              <Search size={17} />
              <input
                value={releaseQuery}
                onChange={(event) => setReleaseQuery(event.target.value)}
                placeholder="Search artist, release, or news"
              />
            </label>
            <select value={selectedArtist} onChange={(event) => setSelectedArtist(event.target.value)}>
              <option value="all">All saved artists</option>
              {sceneArtists.map((artist) => (
                <option value={artist.id} key={artist.id}>
                  {artist.name}
                </option>
              ))}
            </select>
          </div>
          <p className="data-status">
            {dataMessage || (lastRefreshed ? `Last refreshed ${new Date(lastRefreshed).toLocaleString()}` : "Refresh to load public data.")}
          </p>
        </section>

        {activeView === "discover" ? (
          <section className="feed-section" aria-label="K-pop discovery">
            <div className="section-heading">
              <Sparkles size={18} />
              <h2>Upcoming from public calendars</h2>
            </div>
            <div className="event-list">
              {visibleCalendarEvents.length > 0 ? (
                visibleCalendarEvents.map(renderCalendarEvent)
              ) : (
                <article className="empty-card">
                  <h3>No matching calendar events</h3>
                  <p>Try a broader artist or release search, or use the source links below.</p>
                </article>
              )}
            </div>

            <div className="section-heading">
              <Globe2 size={18} />
              <h2>Public comeback/news sources</h2>
            </div>
            <div className="public-source-grid">
              {discoverySources.map(renderPublicSourceCard)}
            </div>
          </section>
        ) : null}

        {activeView === "releases" ? (
          <section className="feed-section" aria-label="Releases">
            <div className="section-heading">
              <CalendarDays size={18} />
              <h2>Upcoming</h2>
            </div>
            <div className="release-grid">
              {upcomingReleases.length > 0 ? (
                upcomingReleases.map(renderReleaseCard)
              ) : (
                <article className="empty-card">
                  <h3>No upcoming release dates found</h3>
                  <p>
                    Future K-pop announcements are often posted first on official socials, then databases catch up.
                    Sources are still linked below so you can jump straight to the official pages.
                  </p>
                </article>
              )}
            </div>

            <div className="section-heading">
              <Disc3 size={18} />
              <h2>Discography</h2>
            </div>
            <div className="release-grid">
              {discography.length > 0 ? (
                discography.map(renderReleaseCard)
              ) : (
                <article className="empty-card">
                  <h3>No release data loaded yet</h3>
                  <p>Refresh your saved artists to pull release groups from MusicBrainz.</p>
                </article>
              )}
            </div>
          </section>
        ) : null}

        {activeView === "news" ? (
          <section className="feed-section" aria-label="Recent news">
            <div className="section-heading">
              <Newspaper size={18} />
              <h2>{activeArtist ? `${activeArtist.name} news shortcuts` : "K-pop news sources"}</h2>
            </div>
            <div className="public-source-grid">
              {activeArtistNewsSources.map(renderPublicSourceCard)}
            </div>
            <div className="post-list">
              {focusedPosts.length > 0 ? (
                focusedPosts.map(renderPostCard)
              ) : (
                <article className="empty-card">
                  <h3>No live social feed connected yet</h3>
                  <p>
                    X and Instagram feeds need approved APIs. For now, this page keeps trustworthy news searches and
                    official source links one click away instead of pretending scraped posts are reliable.
                  </p>
                </article>
              )}
            </div>
          </section>
        ) : null}

        {activeView === "sources" ? (
          <section className="feed-section" aria-label="Sources">
            <div className="section-heading">
              <Globe2 size={18} />
              <h2>Artist sources</h2>
            </div>
            <div className="source-card-grid">
              {artistsInFocus.map((artist) => {
                const sourceLinks = artist.sources?.length ? artist.sources : getArtistFallbackSources(artist);
                return (
                  <article className="artist-summary-card" key={artist.id}>
                    <div>
                      <h3>{artist.name}</h3>
                      <p>{artist.aliases?.join(", ") || "No aliases saved"}</p>
                    </div>
                    <div className="source-list">
                      {sourceLinks.map((source) => (
                        <a href={source.url} target="_blank" rel="noreferrer" key={`${artist.id}-${source.id}-${source.url}`}>
                          {getSourceIcon(source.id)}
                          <span>
                            <strong>{source.label}</strong>
                            <small>{source.handle ?? source.kind}</small>
                          </span>
                          <ExternalLink size={15} />
                        </a>
                      ))}
                    </div>
                    {artist.members?.length ? (
                      <div className="member-list">
                        <div className="section-heading compact">
                          <Users size={16} />
                          <h2>Members</h2>
                        </div>
                        {artist.members.map((member) => (
                          <div className="member-row" key={member.name}>
                            <span>
                              <strong>{member.name}</strong>
                              <small>{member.aliases?.join(", ")}</small>
                            </span>
                            <div className="platform-links icon-only">
                              {member.sources.map((source) => renderSourceLink(source))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        <footer className="source-credit-bar" aria-label="Data source credits">
          <span>Powered by public sources</span>
          {apiSources.map((source) => (
            <a href={source.url} target="_blank" rel="noreferrer" key={source.label} title={source.note}>
              {source.label}
            </a>
          ))}
        </footer>
      </section>
    </main>
  );
}
