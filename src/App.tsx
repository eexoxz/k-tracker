import {
  CalendarDays,
  ChevronDown,
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
  Radio,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Twitter,
  Users,
  Youtube
} from "lucide-react";
import { isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { artists } from "./data/catalog";
import { discoverySources, fallbackCalendarEvents, getArtistNewsSources, sourceCredits } from "./data/publicSources";
import { fetchKpopCalendarEvents } from "./services/kpopCalendar";
import { fetchArtistProfile, getArtistSources, matchesArtistName } from "./services/artistProfiles";
import { fetchMusicBrainzReleaseGroups, searchMusicBrainzArtists } from "./services/musicBrainz";
import { fetchRecentYoutubePosts, isYoutubeReady } from "./services/youtube";
import type { ApiRelease, Artist, ArtistMember, ArtistPost, ArtistProfile, ArtistSource, KpopCalendarEvent, MusicScene, Platform, SourcePlatform } from "./types/music";
import { platformLabels } from "./utils/links";
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

export default function App() {
  const initialPreferences = useMemo(getInitialPreferences, []);
  const [scene, setScene] = useState<MusicScene>(initialPreferences.scene);
  const [selectedArtist, setSelectedArtist] = useState(initialPreferences.selectedArtist);
  const [activeView, setActiveView] = useState<AppView>(initialPreferences.activeView);
  const [artistQuery, setArtistQuery] = useState("");
  const [releaseQuery, setReleaseQuery] = useState("");
  const [releaseLimit, setReleaseLimit] = useState(12);
  const [onlineArtists, setOnlineArtists] = useState<Artist[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [artistProfiles, setArtistProfiles] = useState<Record<string, ArtistProfile>>(() => readStoredValue("artistProfiles", {}));
  const [profileLoadingId, setProfileLoadingId] = useState("");
  const [profileMessages, setProfileMessages] = useState<Record<string, string>>({});
  const [profileRefresh, setProfileRefresh] = useState(0);
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
  const profilesRef = useRef(artistProfiles);
  const handledProfileRefresh = useRef(0);
  profilesRef.current = artistProfiles;

  const allArtists = useMemo(() => [...artists, ...customArtists].map((artist) => artistProfiles[artist.id] ?? artist), [customArtists, artistProfiles]);
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

  useEffect(() => { setReleaseLimit(12); }, [selectedArtist, releaseQuery]);

  useEffect(() => {
    writeStoredValue("customArtists", customArtists);
  }, [customArtists]);

  useEffect(() => {
    writeStoredValue("artistProfiles", artistProfiles);
  }, [artistProfiles]);

  useEffect(() => {
    const query = artistQuery.trim();
    setOnlineArtists([]);
    setSearchMessage("");
    if (query.length < 2) { setSearchLoading(false); return; }
    const controller = new AbortController();
    setSearchLoading(true);
    const timer = window.setTimeout(() => {
      void searchMusicBrainzArtists(query, controller.signal).then((results) => {
        if (controller.signal.aborted) return;
        setOnlineArtists(results.map((result) => ({
          id: `mb-${result.id}`,
          name: result.name,
          scene,
          musicBrainzId: result.id,
          aliases: result.aliases?.map((alias) => alias.name),
          artistType: result.type,
          disambiguation: [result.disambiguation, result.country].filter(Boolean).join(" / ")
        })));
        if (!results.length) setSearchMessage("No artists found online.");
      }).catch(() => {
        if (!controller.signal.aborted) setSearchMessage("Artist search is unavailable. Try again shortly.");
      }).finally(() => {
        if (!controller.signal.aborted) setSearchLoading(false);
      });
    }, 450);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [artistQuery, scene]);

  useEffect(() => {
    setProfileLoadingId("");
    if (selectedArtist === "all") { setProfileLoadingId(""); return; }
    const artist = [...artists, ...customArtists].find((item) => item.id === selectedArtist);
    if (!artist) return;
    const cached = profilesRef.current[selectedArtist];
    const force = profileRefresh !== handledProfileRefresh.current;
    handledProfileRefresh.current = profileRefresh;
    if (!force && cached?.membersComplete && Date.now() - Date.parse(cached.fetchedAt) < 86400000) return;
    const controller = new AbortController();
    setProfileLoadingId(selectedArtist);
    setProfileMessages((current) => ({ ...current, [selectedArtist]: "Loading artist details..." }));
    let releaseFailed = false;
    void fetchArtistProfile(cached ?? artist, controller.signal, (profile) => {
      if (!controller.signal.aborted) setArtistProfiles((current) => ({ ...current, [artist.id]: profile }));
    }, async (profile) => {
      try {
        const releases = await fetchMusicBrainzReleaseGroups(profile, controller.signal);
        if (!controller.signal.aborted) setApiReleases((current) => [
          ...current.filter((release) => release.artistId !== artist.id), ...releases
        ]);
      } catch {
        controller.signal.throwIfAborted();
        releaseFailed = true;
      }
      setProfileMessages((current) => ({ ...current, [artist.id]: "Loading member links..." }));
    }).then(() => {
      if (releaseFailed && !controller.signal.aborted) setArtistProfiles((current) => ({
        ...current, [artist.id]: { ...current[artist.id], fetchedAt: "" }
      }));
      if (!controller.signal.aborted) setProfileMessages((current) => ({
        ...current, [artist.id]: releaseFailed ? "Artist links loaded. Releases could not refresh; try again shortly." : ""
      }));
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setProfileMessages((current) => ({
        ...current, [artist.id]: error instanceof Error ? error.message : "Artist details could not load. Refresh to retry."
      }));
    }).finally(() => {
      if (!controller.signal.aborted) setProfileLoadingId("");
    });
    return () => controller.abort();
  }, [selectedArtist, customArtists, profileRefresh]);

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
    if (selectedArtist === "all") void refreshArtistData();
    else void fetchKpopCalendarEvents().then(setCalendarEvents).catch(() => undefined);
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
      if (activeArtist && !matchesArtistName(activeArtist, event.artistName)) return false;
      if (!query) return true;
      return `${event.artistName} ${event.title} ${event.type} ${event.description ?? ""}`.toLowerCase().includes(query);
    });
  }, [calendarEvents, releaseQuery, activeArtist]);

  const activeArtistNewsSources = useMemo(
    () => (activeArtist ? getArtistNewsSources(activeArtist) : discoverySources),
    [activeArtist]
  );

  const upcomingCalendarEvents = visibleCalendarEvents.filter((event) =>
    isUpcoming(event.date) && event.type !== "calendar" && artistsInFocus.some((artist) => matchesArtistName(artist, event.artistName))
  );

  async function refreshArtistData() {
    if (loading) return;
    if (activeArtist) setProfileRefresh((current) => current + 1);
    const artistsToRefresh = activeArtist ? [] : watchedArtists;

    setLoading(true);
    setDataMessage("Refreshing public metadata...");

    try {
      let calendarMessage = "";
      const releases: ApiRelease[] = [];
      const posts: ArtistPost[] = [];
      const failedArtists: string[] = [];
      const refreshedIds = new Set<string>();

      try {
        const events = await fetchKpopCalendarEvents();
        setCalendarEvents(events.length > 0 ? events : fallbackCalendarEvents);
      } catch {
        calendarMessage = " K-Pop Calendar could not be reached, so source links are shown instead.";
      }

      for (const artist of artistsToRefresh) {
        try {
          releases.push(...(await fetchMusicBrainzReleaseGroups(artist)));
          refreshedIds.add(artist.id);
          if (isYoutubeReady(artist)) {
            posts.push(...(await fetchRecentYoutubePosts(artist)));
          }
        } catch {
          failedArtists.push(artist.name);
        }
      }

      setApiReleases((current) => {
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

  function openArtist(artist: Artist) {
    const existing = sceneArtists.find((item) =>
      artist.musicBrainzId && item.musicBrainzId ? item.musicBrainzId === artist.musicBrainzId : matchesArtistName(item, artist.name)
    );
    const target = existing ?? artist;
    if (existing && !existing.musicBrainzId && artist.musicBrainzId) {
      setArtistProfiles((current) => ({
        ...current, [existing.id]: { ...existing, ...artist, id: existing.id, fetchedAt: "", membersComplete: false }
      }));
    }
    if (!existing) setCustomArtists((current) => [...current, artist]);
    setSelectedArtist(target.id);
    setActiveView("releases");
    setReleaseQuery("");
    setArtistQuery("");
  }

  function openMember(artist: Artist, member: ArtistMember) {
    if (!member.musicBrainzId) return;
    openArtist({
      id: `mb-${member.musicBrainzId}`, name: member.name, aliases: member.aliases,
      scene: artist.scene, musicBrainzId: member.musicBrainzId, sources: member.sources, group: artist.name
    });
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
      <a className="icon-link" href={source.url} target="_blank" rel="noreferrer" title={`${source.label}${source.attributionUrl ? " (via MusicBrainz)" : source.kind === "search" ? " (search)" : ""}`} key={`${source.id}-${source.url}`}>
        {getSourceIcon(source.id)}
        <span className="sr-only">{source.label}</span>
      </a>
    );
  }

  function handleExternalLink(event: ReactMouseEvent<HTMLElement>) {
    if (!isTauri() || !(event.target instanceof Element)) return;
    const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
    if (!anchor || !/^https?:\/\//i.test(anchor.href)) return;
    event.preventDefault();
    void openUrl(anchor.href).catch(() => {
      const message = "The browser could not open this link. Please try again.";
      if (activeArtist) setProfileMessages((current) => ({ ...current, [activeArtist.id]: message }));
      else setDataMessage(message);
    });
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
              loading="lazy"
              decoding="async"
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
    const matchingArtist = sceneArtists.find((artist) => matchesArtistName(artist, event.artistName));

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
                openArtist(matchingArtist);
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
    <main className="app-shell" onClick={handleExternalLink}>
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
          <input value={artistQuery} onChange={(event) => setArtistQuery(event.target.value)} placeholder="Find any artist" aria-label="Find any artist" />
        </label>

        <button className={`all-artists-button ${selectedArtist === "all" ? "active" : ""}`} type="button" onClick={() => setSelectedArtist("all")}>
          All saved artists
        </button>

        <section className="artist-list" aria-label="Artists">
          {matchingArtists.map((artist) => {
            const saved = watchlist.includes(artist.id);
            const isCustom = customArtistIds.has(artist.id);

            return (
              <div className={`artist-row ${selectedArtist === artist.id ? "selected" : ""}`} key={artist.id}>
                <button type="button" onClick={() => openArtist(artist)}>
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
        {artistQuery.trim().length >= 2 ? (
          <section className="artist-search-results" aria-label="Online artist results">
            <h2>More artists</h2>
            <p className="search-status" role="status">
              {searchLoading ? "Searching MusicBrainz..." : searchMessage}
            </p>
            {onlineArtists.filter((artist) => !sceneArtists.some((local) => local.musicBrainzId === artist.musicBrainzId))
              .map((artist) => (
                <div className="artist-row" key={artist.id}>
                  <button type="button" onClick={() => openArtist(artist)}>
                    <span>
                      <strong>{artist.name}</strong>
                      <small>{[artist.artistType, artist.disambiguation].filter(Boolean).join(" / ")}</small>
                    </span>
                  </button>
                </div>
              ))}
          </section>
        ) : null}
      </aside>

      <section className="content">
        <header className="artist-hero">
          <div>
            <p className="eyebrow">{activeArtist ? "Artist page" : "K-pop discovery"}</p>
            <h2>{activeArtist?.name ?? "Recent K-pop comebacks"}</h2>
            <p className="topbar-note">
              {activeArtist
                ? `${activeArtist.aliases?.slice(0, 4).join(", ") || activeArtist.group || ""}`
                : "Upcoming releases and comeback leads from public fan calendars, news feeds, and open metadata sources."}
            </p>
            <div className="source-strip">
              {(activeArtist ? getArtistSources(activeArtist) : discoverySources).map(renderSourceLink)}
            </div>
          </div>
          <button className="sync-button" type="button" onClick={() => void refreshArtistData()} disabled={loading || profileLoadingId === selectedArtist}>
            {loading || profileLoadingId === selectedArtist ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
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
          <p className="data-status" role="status">
            {activeArtist
              ? profileMessages[activeArtist.id] || (artistProfiles[activeArtist.id]?.fetchedAt ? `Artist details updated ${new Date(artistProfiles[activeArtist.id].fetchedAt).toLocaleString()}` : "")
              : dataMessage || (lastRefreshed ? `Last refreshed ${new Date(lastRefreshed).toLocaleString()}` : "Refresh to load public data.")}
          </p>
        </section>

        {activeArtist && activeArtist.artistType !== "Person" ? (
          <section className="artist-members-section" aria-label={`${activeArtist.name} members`}>
            <div className="section-heading"><Users size={18} /><h2>Members</h2></div>
            {activeArtist.members?.length ? (
              <div className="artist-members-grid">
                {activeArtist.members.map((member) => (
                  <div className="member-row" key={member.musicBrainzId ?? member.name}>
                    <span>
                      {member.musicBrainzId ? (
                        <button className="as-button artist-name" type="button" onClick={() => openMember(activeArtist, member)}>{member.name}</button>
                      ) : <strong>{member.name}</strong>}
                      {member.former ? <small>Former member</small> : null}
                    </span>
                    <div className="platform-links icon-only">
                      {member.sources.map(renderSourceLink)}
                      {!member.sources.some((source) => source.id === "instagram") && member.sources.length > 0 ? <small>No Instagram listed</small> : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="data-status">{profileLoadingId === activeArtist.id ? "Loading members..." : "Member details are not available from the source yet."}</p>}
          </section>
        ) : null}

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
              {upcomingCalendarEvents.map(renderCalendarEvent)}
              {upcomingReleases.length > 0 ? (
                upcomingReleases.map(renderReleaseCard)
              ) : upcomingCalendarEvents.length === 0 ? (
                <article className="empty-card">
                  <h3>No upcoming release dates found</h3>
                  <p>
                    Future K-pop announcements are often posted first on official socials, then databases catch up.
                    Check the artist's source links for announcements that have not reached the calendar yet.
                  </p>
                </article>
              ) : null}
            </div>

            <div className="section-heading">
              <Disc3 size={18} />
              <h2>Discography</h2>
            </div>
            <div className="release-grid">
              {discography.length > 0 ? (
                discography.slice(0, releaseLimit).map(renderReleaseCard)
              ) : (
                <article className="empty-card">
                  <h3>No release data loaded yet</h3>
                  <p>{profileLoadingId === selectedArtist ? "Loading releases..." : "No releases are available from the source yet."}</p>
                </article>
              )}
            </div>
            {discography.length > releaseLimit ? (
              <button className="more-releases" type="button" onClick={() => setReleaseLimit((current) => current + 12)}>
                <ChevronDown size={18} /> More releases
              </button>
            ) : null}
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
                  <h3>No recent posts loaded</h3>
                  <p>Recent news is available through the sources above.</p>
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
                const sourceLinks = getArtistSources(artist);
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
                            <small>{source.handle ?? (source.attributionUrl ? "Via MusicBrainz" : source.kind)}</small>
                          </span>
                          <ExternalLink size={15} />
                        </a>
                      ))}
                    </div>
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
