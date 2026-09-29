import {
  CalendarDays,
  Disc3,
  ExternalLink,
  Heart,
  Image,
  Loader2,
  Music2,
  Plus,
  RefreshCw,
  Search,
  Trash2
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { artists } from "./data/catalog";
import type { Artist, MusicScene, Platform } from "./types/music";
import { buildPlatformSearchUrl, platformLabels } from "./utils/links";
import { readStoredValue, readStringList, writeStoredValue, writeStringList } from "./utils/storage";

const scenes: Array<{ id: MusicScene; label: string; available: boolean }> = [
  { id: "kpop", label: "K-pop", available: true },
  { id: "mandopop", label: "Mandopop", available: false },
  { id: "jpop", label: "J-pop", available: false },
  { id: "english_pop", label: "English Pop", available: false }
];

const appViews = [
  { id: "upcoming", label: "Upcoming" },
  { id: "discography", label: "Discography" },
  { id: "artists", label: "Artists" }
] as const;

type AppView = (typeof appViews)[number]["id"];

type LocalPreferences = {
  scene: MusicScene;
  selectedArtist: string;
  activeView: AppView;
};

type MusicBrainzArtist = {
  id: string;
  name: string;
  disambiguation?: string;
};

type MusicBrainzReleaseGroup = {
  id: string;
  title: string;
  "first-release-date"?: string;
  "primary-type"?: string;
  "secondary-types"?: string[];
};

type MusicBrainzArtistResponse = {
  artists?: MusicBrainzArtist[];
};

type MusicBrainzReleaseGroupResponse = {
  "release-groups"?: MusicBrainzReleaseGroup[];
};

type ApiRelease = {
  id: string;
  artistId: string;
  artistName: string;
  title: string;
  releaseDate: string;
  type: string;
  sourceUrl: string;
  coverUrl: string;
  platformSearches: Record<Platform, string>;
};

const defaultPreferences: LocalPreferences = {
  scene: "kpop",
  selectedArtist: "all",
  activeView: "upcoming"
};

const musicBrainzBaseUrl = "https://musicbrainz.org/ws/2";
const apiPauseMs = 1100;

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
  }).format(new Date(`${date}T00:00:00`));
}

function normalizeDate(date?: string) {
  if (!date) return "";
  if (/^\d{4}$/.test(date)) return `${date}-01-01`;
  if (/^\d{4}-\d{2}$/.test(date)) return `${date}-01`;
  return date;
}

function isUpcoming(date: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${date}T00:00:00`).getTime() >= today.getTime();
}

function getPlatformSearches(artistName: string, title: string): Record<Platform, string> {
  return {
    spotify: buildPlatformSearchUrl("spotify", artistName, title),
    youtube: buildPlatformSearchUrl("youtube", artistName, title),
    appleMusic: buildPlatformSearchUrl("appleMusic", artistName, title),
    melon: buildPlatformSearchUrl("melon", artistName, title)
  };
}

function getValidatedView(value: unknown): AppView {
  return appViews.some((view) => view.id === value) ? (value as AppView) : "upcoming";
}

function getInitialPreferences() {
  const stored = readStoredValue<Partial<LocalPreferences>>("preferences", defaultPreferences);
  return {
    ...defaultPreferences,
    ...stored,
    activeView: getValidatedView(stored.activeView)
  };
}

async function searchMusicBrainzArtist(artistName: string) {
  const params = new URLSearchParams({
    query: `artist:"${artistName}"`,
    fmt: "json",
    limit: "1"
  });

  const response = await fetch(`${musicBrainzBaseUrl}/artist?${params}`);
  if (!response.ok) throw new Error(`Could not search ${artistName}`);

  const data = (await response.json()) as MusicBrainzArtistResponse;
  return data.artists?.[0];
}

async function fetchReleaseGroups(artist: Artist, mbid: string) {
  const params = new URLSearchParams({
    artist: mbid,
    fmt: "json",
    limit: "100"
  });

  const response = await fetch(`${musicBrainzBaseUrl}/release-group?${params}`);
  if (!response.ok) throw new Error(`Could not load releases for ${artist.name}`);

  const data = (await response.json()) as MusicBrainzReleaseGroupResponse;
  return (data["release-groups"] ?? [])
    .map((group): ApiRelease | null => {
      const releaseDate = normalizeDate(group["first-release-date"]);
      if (!releaseDate) return null;

      const type = [group["primary-type"], ...(group["secondary-types"] ?? [])].filter(Boolean).join(" / ") || "Release";

      return {
        id: group.id,
        artistId: artist.id,
        artistName: artist.name,
        title: group.title,
        releaseDate,
        type,
        sourceUrl: `https://musicbrainz.org/release-group/${group.id}`,
        coverUrl: `https://coverartarchive.org/release-group/${group.id}/front-250`,
        platformSearches: getPlatformSearches(artist.name, group.title)
      };
    })
    .filter((release): release is ApiRelease => Boolean(release));
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
  const [apiReleases, setApiReleases] = useState<ApiRelease[]>(() => readStoredValue("apiReleases", []));
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

  useEffect(() => {
    writeStringList("watchlist", watchlist);
  }, [watchlist]);

  useEffect(() => {
    writeStoredValue("customArtists", customArtists);
  }, [customArtists]);

  useEffect(() => {
    writeStoredValue("apiReleases", apiReleases);
  }, [apiReleases]);

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
    if (didAutoRefresh.current || apiReleases.length > 0 || watchedArtists.length === 0) return;
    didAutoRefresh.current = true;
    void refreshArtistData();
  }, [apiReleases.length, watchedArtists.length]);

  const matchingArtists = useMemo(() => {
    const query = artistQuery.trim().toLowerCase();
    if (!query) return sceneArtists;

    return sceneArtists.filter((artist) =>
      [artist.name, ...(artist.aliases ?? [])].join(" ").toLowerCase().includes(query)
    );
  }, [artistQuery, sceneArtists]);

  const filteredReleases = useMemo(() => {
    const query = releaseQuery.trim().toLowerCase();

    return apiReleases
      .filter((release) => release.artistId === selectedArtist || selectedArtist === "all")
      .filter((release) => (watchlist.includes(release.artistId) ? true : selectedArtist !== "all"))
      .filter((release) => {
        if (!query) return true;
        return `${release.artistName} ${release.title} ${release.type}`.toLowerCase().includes(query);
      });
  }, [apiReleases, releaseQuery, selectedArtist, watchlist]);

  const upcomingReleases = useMemo(
    () => filteredReleases.filter((release) => isUpcoming(release.releaseDate)).sort((a, b) => a.releaseDate.localeCompare(b.releaseDate)),
    [filteredReleases]
  );

  const discography = useMemo(
    () => [...filteredReleases].sort((a, b) => b.releaseDate.localeCompare(a.releaseDate)),
    [filteredReleases]
  );

  async function refreshArtistData() {
    const artistsToRefresh = selectedArtist === "all" ? watchedArtists : sceneArtists.filter((artist) => artist.id === selectedArtist);

    if (artistsToRefresh.length === 0) {
      setDataMessage("Save at least one artist first.");
      return;
    }

    setLoading(true);
    setDataMessage("Refreshing from MusicBrainz...");

    try {
      const releases: ApiRelease[] = [];
      const failedArtists: string[] = [];

      for (const artist of artistsToRefresh) {
        const match = await searchMusicBrainzArtist(artist.name);
        if (!match) {
          failedArtists.push(artist.name);
          await sleep(apiPauseMs);
          continue;
        }

        const artistReleases = await fetchReleaseGroups(artist, match.id);
        releases.push(...artistReleases);
        await sleep(apiPauseMs);
      }

      setApiReleases((current) => {
        const retained = current.filter((release) => !artistsToRefresh.some((artist) => artist.id === release.artistId));
        const merged = [...retained, ...releases];
        const uniqueById = new Map(merged.map((release) => [`${release.artistId}-${release.id}`, release]));
        return [...uniqueById.values()];
      });
      setLastRefreshed(new Date().toISOString());
      setDataMessage(
        failedArtists.length > 0
          ? `Updated, but could not match: ${failedArtists.join(", ")}.`
          : "Updated from MusicBrainz."
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
    setNewArtistName("");
    setNewArtistAliases("");
  }

  function removeCustomArtist(artistId: string) {
    setCustomArtists((current) => current.filter((artist) => artist.id !== artistId));
    setWatchlist((current) => current.filter((id) => id !== artistId));
    setApiReleases((current) => current.filter((release) => release.artistId !== artistId));
  }

  function renderReleaseCard(release: ApiRelease) {
    return (
      <article className="release-card with-cover" key={`${release.artistId}-${release.id}`}>
        <div className="cover-frame">
          <img
            src={release.coverUrl}
            alt={`${release.title} cover`}
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
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
          <p className="artist-name">{release.artistName}</p>
          <div className="platform-links">
            {(Object.entries(release.platformSearches) as Array<[Platform, string]>).map(([platform, url]) => (
              <a href={url} target="_blank" rel="noreferrer" key={platform}>
                {platformLabels[platform]}
              </a>
            ))}
            <a href={release.sourceUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={14} />
              MusicBrainz
            </a>
          </div>
        </div>
      </article>
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

        <section className="artist-list" aria-label="Artists">
          {matchingArtists.map((artist) => {
            const saved = watchlist.includes(artist.id);
            const isCustom = customArtistIds.has(artist.id);

            return (
              <div className="artist-row" key={artist.id}>
                <button type="button" onClick={() => toggleWatchlist(artist.id)} aria-pressed={saved}>
                  <span>
                    <strong>{artist.name}</strong>
                    <small>{artist.aliases?.[0] ?? (isCustom ? "Saved locally" : "K-pop artist")}</small>
                  </span>
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
        <header className="topbar">
          <div>
            <p className="eyebrow">API-backed, local watchlist</p>
            <h2>Upcoming comebacks and discography from saved artists</h2>
            <p className="topbar-note">
              Save artists, refresh, and K-tracker pulls release-group data from MusicBrainz. Spotify, Apple Music,
              YouTube, and Melon buttons open searchable links for each release.
            </p>
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
                placeholder="Search artist or release"
              />
            </label>
            <select value={selectedArtist} onChange={(event) => setSelectedArtist(event.target.value)}>
              <option value="all">Saved artists</option>
              {sceneArtists.map((artist) => (
                <option value={artist.id} key={artist.id}>
                  {artist.name}
                </option>
              ))}
            </select>
          </div>
          <p className="data-status">
            {dataMessage || (lastRefreshed ? `Last refreshed ${new Date(lastRefreshed).toLocaleString()}` : "Refresh to load API data.")}
          </p>
        </section>

        {activeView === "upcoming" ? (
          <section className="feed-section" aria-label="Upcoming comebacks">
            <div className="section-heading">
              <CalendarDays size={18} />
              <h2>Upcoming</h2>
            </div>
            <div className="release-grid">
              {upcomingReleases.length > 0 ? (
                upcomingReleases.map(renderReleaseCard)
              ) : (
                <article className="empty-card">
                  <h3>No upcoming releases found</h3>
                  <p>
                    MusicBrainz may not have future comeback dates for your saved artists yet. Refresh later, or use
                    Discography to see current releases.
                  </p>
                </article>
              )}
            </div>
          </section>
        ) : null}

        {activeView === "discography" ? (
          <section className="feed-section" aria-label="Discography">
            <div className="section-heading">
              <Disc3 size={18} />
              <h2>Discography</h2>
            </div>
            <div className="release-grid">
              {discography.length > 0 ? (
                discography.map(renderReleaseCard)
              ) : (
                <article className="empty-card">
                  <h3>No discography loaded yet</h3>
                  <p>Refresh your saved artists to pull release groups from MusicBrainz.</p>
                </article>
              )}
            </div>
          </section>
        ) : null}

        {activeView === "artists" ? (
          <section className="feed-section" aria-label="Saved artists">
            <div className="section-heading">
              <Heart size={18} />
              <h2>Saved artists</h2>
            </div>
            <div className="artist-summary-grid">
              {watchedArtists.map((artist) => (
                <article className="artist-summary-card" key={artist.id}>
                  <h3>{artist.name}</h3>
                  <p>{artist.aliases?.join(", ") || "No aliases saved"}</p>
                  <div className="platform-links">
                    <a href={buildPlatformSearchUrl("spotify", artist.name, "")} target="_blank" rel="noreferrer">
                      Spotify
                    </a>
                    <a href={buildPlatformSearchUrl("youtube", artist.name, "")} target="_blank" rel="noreferrer">
                      YouTube
                    </a>
                    <a href={buildPlatformSearchUrl("appleMusic", artist.name, "")} target="_blank" rel="noreferrer">
                      Apple Music
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
