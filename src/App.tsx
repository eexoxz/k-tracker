import {
  Bell,
  CalendarDays,
  Check,
  Download,
  ExternalLink,
  Filter,
  Heart,
  Image,
  Link2,
  Music2,
  Newspaper,
  Plus,
  Search,
  Settings,
  Star,
  Trash2,
  Upload
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { artists, comebackTemplates, newsItems, releases } from "./data/catalog";
import type { Comeback, ComebackStatus, ComebackType, DateFilter, MusicScene, Platform, PlatformLinks } from "./types/music";
import { buildPlatformSearchUrl, platformLabels } from "./utils/links";
import { readStoredValue, readStringList, writeStoredValue, writeStringList } from "./utils/storage";

const scenes: Array<{ id: MusicScene; label: string; available: boolean }> = [
  { id: "kpop", label: "K-pop", available: true },
  { id: "mandopop", label: "Mandopop", available: false },
  { id: "jpop", label: "J-pop", available: false },
  { id: "english_pop", label: "English Pop", available: false }
];

const dateFilters: Array<{ id: DateFilter; label: string }> = [
  { id: "all", label: "All dates" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" }
];

const platforms: Array<{ id: "all" | Platform; label: string }> = [
  { id: "all", label: "All platforms" },
  { id: "spotify", label: "Spotify" },
  { id: "youtube", label: "YouTube" },
  { id: "appleMusic", label: "Apple Music" },
  { id: "melon", label: "Melon" }
];

const comebackTypes: Array<{ id: ComebackType; label: string }> = [
  { id: "single", label: "Single" },
  { id: "singleAlbum", label: "Single album" },
  { id: "miniAlbum", label: "Mini album" },
  { id: "fullAlbum", label: "Full album" },
  { id: "album", label: "Album" },
  { id: "preRelease", label: "Pre-release" },
  { id: "debut", label: "Debut" },
  { id: "ost", label: "OST" },
  { id: "japaneseRelease", label: "Japanese release" }
];

const comebackStatuses: Array<{ id: ComebackStatus; label: string }> = [
  { id: "rumored", label: "Rumored" },
  { id: "announced", label: "Announced" },
  { id: "confirmed", label: "Confirmed" },
  { id: "released", label: "Released" }
];

type ActiveView = "today" | "calendar" | "add" | "releases" | "news" | "settings";
type StatusFilter = "all" | ComebackStatus | "missingSource" | "unseen";

const appViews: Array<{ id: ActiveView; label: string }> = [
  { id: "today", label: "Today" },
  { id: "calendar", label: "Calendar" },
  { id: "add", label: "Add" },
  { id: "releases", label: "Releases" },
  { id: "news", label: "News" },
  { id: "settings", label: "Data" }
];

const statusFilters: Array<{ id: StatusFilter; label: string }> = [
  { id: "all", label: "All statuses" },
  { id: "confirmed", label: "Confirmed" },
  { id: "announced", label: "Announced" },
  { id: "rumored", label: "Rumored" },
  { id: "released", label: "Released" },
  { id: "missingSource", label: "Needs source" },
  { id: "unseen", label: "Unseen" }
];

const today = new Date();

type LocalPreferences = {
  scene: MusicScene;
  selectedArtist: string;
  dateFilter: DateFilter;
  platformFilter: "all" | Platform;
  watchlistOnly: boolean;
  activeView: ActiveView;
  statusFilter: StatusFilter;
};

const defaultPreferences: LocalPreferences = {
  scene: "kpop",
  selectedArtist: "all",
  dateFilter: "month",
  platformFilter: "all",
  watchlistOnly: false,
  activeView: "today",
  statusFilter: "all"
};

function isWithinFilter(date: string, filter: DateFilter) {
  if (filter === "all") return true;

  const releaseDate = new Date(`${date}T00:00:00`);
  const ageInDays = Math.floor((today.getTime() - releaseDate.getTime()) / 86_400_000);

  if (filter === "week") return ageInDays >= 0 && ageInDays <= 7;
  return ageInDays >= 0 && ageInDays <= 30;
}

function isComebackWithinFilter(date: string, filter: DateFilter) {
  if (filter === "all") return true;

  const comebackDate = new Date(`${date}T00:00:00`);
  const dayDistance = Math.floor((comebackDate.getTime() - today.getTime()) / 86_400_000);

  if (filter === "week") return dayDistance >= -7 && dayDistance <= 7;
  return dayDistance >= -30 && dayDistance <= 30;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${date}T00:00:00`));
}

function daysUntil(date: string) {
  const targetDate = new Date(`${date}T00:00:00`);
  return Math.ceil((targetDate.getTime() - today.getTime()) / 86_400_000);
}

function formatCountdown(date: string) {
  const days = daysUntil(date);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1) return `${days} days away`;
  return `${Math.abs(days)} days ago`;
}

function createArtistId(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return `local-${slug || "artist"}-${Date.now()}`;
}

function createComebackId(artistId: string, title: string) {
  const slug = `${artistId}-${title}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return `comeback-${slug || "entry"}-${Date.now()}`;
}

function normalizeUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export default function App() {
  const [preferences, setPreferences] = useState<LocalPreferences>(() =>
    ({ ...defaultPreferences, ...readStoredValue<Partial<LocalPreferences>>("preferences", defaultPreferences) })
  );
  const [scene, setScene] = useState<MusicScene>(preferences.scene);
  const [artistQuery, setArtistQuery] = useState("");
  const [newArtistName, setNewArtistName] = useState("");
  const [newArtistAliases, setNewArtistAliases] = useState("");
  const [newComebackArtistId, setNewComebackArtistId] = useState("");
  const [newComebackTitle, setNewComebackTitle] = useState("");
  const [newComebackDate, setNewComebackDate] = useState("");
  const [newComebackTime, setNewComebackTime] = useState("");
  const [newComebackType, setNewComebackType] = useState<ComebackType>("single");
  const [newComebackStatus, setNewComebackStatus] = useState<ComebackStatus>("announced");
  const [newCoverUrl, setNewCoverUrl] = useState("");
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [newSpotifyUrl, setNewSpotifyUrl] = useState("");
  const [newAppleMusicUrl, setNewAppleMusicUrl] = useState("");
  const [newYoutubeUrl, setNewYoutubeUrl] = useState("");
  const [newMelonUrl, setNewMelonUrl] = useState("");
  const [newComebackNotes, setNewComebackNotes] = useState("");
  const [releaseQuery, setReleaseQuery] = useState("");
  const [selectedArtist, setSelectedArtist] = useState(preferences.selectedArtist);
  const [dateFilter, setDateFilter] = useState<DateFilter>(preferences.dateFilter);
  const [platformFilter, setPlatformFilter] = useState<"all" | Platform>(preferences.platformFilter);
  const [watchlistOnly, setWatchlistOnly] = useState(preferences.watchlistOnly);
  const [activeView, setActiveView] = useState<ActiveView>(preferences.activeView);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(preferences.statusFilter);
  const [watchlist, setWatchlist] = useState<string[]>(() => readStringList("watchlist", ["aespa", "ive", "iu"]));
  const [seenComebacks, setSeenComebacks] = useState<string[]>(() => readStringList("seenComebacks"));
  const [customArtists, setCustomArtists] = useState(() => readStoredValue<typeof artists>("customArtists", []));
  const [localComebacks, setLocalComebacks] = useState<Comeback[]>(() =>
    readStoredValue("comebacks", comebackTemplates)
  );
  const [backupText, setBackupText] = useState("");
  const [backupMessage, setBackupMessage] = useState("");

  useEffect(() => {
    writeStringList("watchlist", watchlist);
  }, [watchlist]);

  useEffect(() => {
    writeStringList("seenComebacks", seenComebacks);
  }, [seenComebacks]);

  useEffect(() => {
    writeStoredValue("customArtists", customArtists);
  }, [customArtists]);

  useEffect(() => {
    writeStoredValue("comebacks", localComebacks);
  }, [localComebacks]);

  useEffect(() => {
    const nextPreferences = { scene, selectedArtist, dateFilter, platformFilter, watchlistOnly, activeView, statusFilter };
    setPreferences(nextPreferences);
    writeStoredValue("preferences", nextPreferences);
  }, [activeView, dateFilter, platformFilter, scene, selectedArtist, statusFilter, watchlistOnly]);

  const allArtists = useMemo(() => [...artists, ...customArtists], [customArtists]);
  const customArtistIds = useMemo(() => new Set(customArtists.map((artist) => artist.id)), [customArtists]);
  const sceneArtists = useMemo(() => allArtists.filter((artist) => artist.scene === scene), [allArtists, scene]);

  useEffect(() => {
    if (selectedArtist !== "all" && !allArtists.some((artist) => artist.id === selectedArtist)) {
      setSelectedArtist("all");
    }
  }, [allArtists, selectedArtist]);

  useEffect(() => {
    if (!newComebackArtistId || !sceneArtists.some((artist) => artist.id === newComebackArtistId)) {
      setNewComebackArtistId(sceneArtists[0]?.id ?? "");
    }
  }, [newComebackArtistId, sceneArtists]);

  const matchingArtists = useMemo(() => {
    const query = artistQuery.trim().toLowerCase();
    if (!query) return sceneArtists;

    return sceneArtists.filter((artist) => {
      const names = [artist.name, ...(artist.aliases ?? [])].join(" ").toLowerCase();
      return names.includes(query);
    });
  }, [artistQuery, sceneArtists]);

  const filteredReleases = useMemo(() => {
    const query = releaseQuery.trim().toLowerCase();

    return releases
      .filter((release) => release.scene === scene)
      .filter((release) => (selectedArtist === "all" ? true : release.artistId === selectedArtist))
      .filter((release) => (watchlistOnly ? watchlist.includes(release.artistId) : true))
      .filter((release) => isWithinFilter(release.releaseDate, dateFilter))
      .filter((release) => (platformFilter === "all" ? true : release.platformHints.includes(platformFilter)))
      .filter((release) => {
        if (!query) return true;
        return `${release.artistName} ${release.title} ${release.type}`.toLowerCase().includes(query);
      })
      .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));
  }, [dateFilter, platformFilter, releaseQuery, scene, selectedArtist, watchlist, watchlistOnly]);

  const filteredComebacks = useMemo(() => {
    const query = releaseQuery.trim().toLowerCase();

    return localComebacks
      .filter((comeback) => comeback.scene === scene)
      .filter((comeback) => (selectedArtist === "all" ? true : comeback.artistId === selectedArtist))
      .filter((comeback) => (watchlistOnly ? watchlist.includes(comeback.artistId) : true))
      .filter((comeback) => isComebackWithinFilter(comeback.comebackDate, dateFilter))
      .filter((comeback) => (platformFilter === "all" ? true : Boolean(comeback.platformLinks[platformFilter])))
      .filter((comeback) => {
        if (statusFilter === "all") return true;
        if (statusFilter === "missingSource") return !comeback.sourceUrl;
        if (statusFilter === "unseen") return !seenComebacks.includes(comeback.id);
        return comeback.status === statusFilter;
      })
      .filter((comeback) => {
        if (!query) return true;
        return `${comeback.artistName} ${comeback.title} ${comeback.type} ${comeback.status}`
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => a.comebackDate.localeCompare(b.comebackDate));
  }, [
    dateFilter,
    localComebacks,
    platformFilter,
    releaseQuery,
    scene,
    seenComebacks,
    selectedArtist,
    statusFilter,
    watchlist,
    watchlistOnly
  ]);

  const sceneComebacks = useMemo(
    () =>
      localComebacks
        .filter((comeback) => comeback.scene === scene)
        .filter((comeback) => (watchlistOnly ? watchlist.includes(comeback.artistId) : true)),
    [localComebacks, scene, watchlist, watchlistOnly]
  );

  const upcomingComebacks = useMemo(
    () =>
      sceneComebacks
        .filter((comeback) => daysUntil(comeback.comebackDate) >= 0)
        .sort((a, b) => a.comebackDate.localeCompare(b.comebackDate)),
    [sceneComebacks]
  );

  const nextComeback = upcomingComebacks[0];
  const dueSoonComebacks = upcomingComebacks.filter((comeback) => daysUntil(comeback.comebackDate) <= 7);
  const missingSourceComebacks = sceneComebacks.filter((comeback) => !comeback.sourceUrl);
  const unseenReleasedComebacks = sceneComebacks.filter(
    (comeback) => comeback.status === "released" && !seenComebacks.includes(comeback.id)
  );

  const filteredNews = useMemo(
    () =>
      newsItems
        .filter((item) => item.scene === scene)
        .filter((item) => (watchlistOnly && item.artistId ? watchlist.includes(item.artistId) : true))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [scene, watchlist, watchlistOnly]
  );

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
    setLocalComebacks((current) => current.filter((comeback) => comeback.artistId !== artistId));
    setSeenComebacks((current) =>
      current.filter((id) => localComebacks.some((comeback) => comeback.id === id && comeback.artistId !== artistId))
    );
  }

  function addComeback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const artist = allArtists.find((item) => item.id === newComebackArtistId);
    const title = newComebackTitle.trim();
    const comebackDate = newComebackDate.trim();

    if (!artist || !title || !comebackDate) return;

    const platformLinks: PlatformLinks = {
      spotify: normalizeUrl(newSpotifyUrl) || undefined,
      appleMusic: normalizeUrl(newAppleMusicUrl) || undefined,
      youtube: normalizeUrl(newYoutubeUrl) || undefined,
      melon: normalizeUrl(newMelonUrl) || undefined
    };

    const comeback: Comeback = {
      id: createComebackId(artist.id, title),
      artistId: artist.id,
      artistName: artist.name,
      scene,
      title,
      comebackDate,
      comebackTime: newComebackTime.trim() || undefined,
      type: newComebackType,
      status: newComebackStatus,
      coverUrl: normalizeUrl(newCoverUrl) || undefined,
      sourceUrl: normalizeUrl(newSourceUrl) || undefined,
      platformLinks,
      notes: newComebackNotes.trim() || undefined
    };

    setLocalComebacks((current) => [...current, comeback]);
    setWatchlist((current) => [...new Set([...current, artist.id])]);
    setNewComebackTitle("");
    setNewComebackDate("");
    setNewComebackTime("");
    setNewCoverUrl("");
    setNewSourceUrl("");
    setNewSpotifyUrl("");
    setNewAppleMusicUrl("");
    setNewYoutubeUrl("");
    setNewMelonUrl("");
    setNewComebackNotes("");
  }

  function removeComeback(comebackId: string) {
    setLocalComebacks((current) => current.filter((comeback) => comeback.id !== comebackId));
    setSeenComebacks((current) => current.filter((id) => id !== comebackId));
  }

  function updateComebackStatus(comebackId: string, status: ComebackStatus) {
    setLocalComebacks((current) =>
      current.map((comeback) => (comeback.id === comebackId ? { ...comeback, status } : comeback))
    );
  }

  function toggleSeenComeback(comebackId: string) {
    setSeenComebacks((current) =>
      current.includes(comebackId) ? current.filter((id) => id !== comebackId) : [...current, comebackId]
    );
  }

  function getComebackLinks(comeback: Comeback) {
    const explicitLinks = Object.entries(comeback.platformLinks).filter((entry): entry is [Platform, string] =>
      Boolean(entry[1])
    );

    if (explicitLinks.length > 0) return explicitLinks;

    const fallbackPlatforms: Platform[] = platformFilter === "all" ? ["spotify", "youtube", "appleMusic"] : [platformFilter];
    return fallbackPlatforms.map((platform) => [
      platform,
      buildPlatformSearchUrl(platform, comeback.artistName, comeback.title)
    ] as [Platform, string]);
  }

  function exportLocalData() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      customArtists,
      watchlist,
      comebacks: localComebacks,
      seenComebacks,
      preferences
    };

    setBackupText(JSON.stringify(payload, null, 2));
    setBackupMessage("Backup generated. Keep this text somewhere safe if you want a manual copy.");
  }

  function importLocalData() {
    try {
      const payload = JSON.parse(backupText) as {
        customArtists?: typeof artists;
        watchlist?: string[];
        comebacks?: Comeback[];
        seenComebacks?: string[];
        preferences?: Partial<LocalPreferences>;
      };

      if (Array.isArray(payload.customArtists)) setCustomArtists(payload.customArtists);
      if (Array.isArray(payload.watchlist)) setWatchlist(payload.watchlist);
      if (Array.isArray(payload.comebacks)) setLocalComebacks(payload.comebacks);
      if (Array.isArray(payload.seenComebacks)) setSeenComebacks(payload.seenComebacks);
      if (payload.preferences) {
        setScene(payload.preferences.scene ?? scene);
        setSelectedArtist(payload.preferences.selectedArtist ?? selectedArtist);
        setDateFilter(payload.preferences.dateFilter ?? dateFilter);
        setPlatformFilter(payload.preferences.platformFilter ?? platformFilter);
        setWatchlistOnly(payload.preferences.watchlistOnly ?? watchlistOnly);
        setActiveView(payload.preferences.activeView ?? activeView);
        setStatusFilter(payload.preferences.statusFilter ?? statusFilter);
      }

      setBackupMessage("Backup imported into local storage.");
    } catch {
      setBackupMessage("Could not import that backup. Check that it is valid JSON.");
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Artist watchlist">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <Music2 size={22} />
          </div>
          <div>
            <p className="eyebrow">Desktop release radar</p>
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
              title={item.available ? item.label : "Planned for a later version"}
            >
              {item.label}
            </button>
          ))}
        </div>

        <label className="search-box">
          <Search size={17} />
          <input
            value={artistQuery}
            onChange={(event) => setArtistQuery(event.target.value)}
            placeholder="Find an artist"
          />
        </label>

        <form className="add-artist-form" onSubmit={addCustomArtist}>
          <input
            value={newArtistName}
            onChange={(event) => setNewArtistName(event.target.value)}
            placeholder="Add artist"
            aria-label="Artist name"
          />
          <input
            value={newArtistAliases}
            onChange={(event) => setNewArtistAliases(event.target.value)}
            placeholder="Aliases, optional"
            aria-label="Artist aliases"
          />
          <button type="submit" title="Add artist to watchlist">
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
          {matchingArtists.length === 0 ? (
            <p className="empty-note">No artists found. Add one above and it will be saved on this PC.</p>
          ) : null}
        </section>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">K-pop first, expandable later</p>
            <h2>Comeback tracker for the stuff you actually care about</h2>
            <p className="topbar-note">
              Local-first for now: watchlist, comebacks, seen items, and backups stay on this PC.
            </p>
          </div>
          <button className="sync-button" type="button" onClick={() => setActiveView("calendar")}>
            <Bell size={18} />
            Review calendar
          </button>
        </header>

        <section className="stats-strip" aria-label="Tracker summary">
          <article>
            <Star size={18} />
            <span>{watchlist.length}</span>
            <small>saved artists</small>
          </article>
          <article>
            <CalendarDays size={18} />
            <span>{dueSoonComebacks.length}</span>
            <small>due soon</small>
          </article>
          <article>
            <CalendarDays size={18} />
            <span>{unseenReleasedComebacks.length}</span>
            <small>unseen releases</small>
          </article>
          <article>
            <Link2 size={18} />
            <span>{missingSourceComebacks.length}</span>
            <small>need sources</small>
          </article>
        </section>

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

        <section className="filter-panel" aria-label="Release filters">
          <label className="search-box release-search">
            <Search size={17} />
            <input
              value={releaseQuery}
              onChange={(event) => setReleaseQuery(event.target.value)}
              placeholder="Search releases"
            />
          </label>

          <label>
            <Filter size={16} />
            <select value={selectedArtist} onChange={(event) => setSelectedArtist(event.target.value)}>
              <option value="all">All artists</option>
              {sceneArtists.map((artist) => (
                <option value={artist.id} key={artist.id}>
                  {artist.name}
                </option>
              ))}
            </select>
          </label>

          <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value as DateFilter)}>
            {dateFilters.map((filter) => (
              <option value={filter.id} key={filter.id}>
                {filter.label}
              </option>
            ))}
          </select>

          <select value={platformFilter} onChange={(event) => setPlatformFilter(event.target.value as "all" | Platform)}>
            {platforms.map((platform) => (
              <option value={platform.id} key={platform.id}>
                {platform.label}
              </option>
            ))}
          </select>

          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
            {statusFilters.map((filter) => (
              <option value={filter.id} key={filter.id}>
                {filter.label}
              </option>
            ))}
          </select>

          <label className="toggle">
            <input
              type="checkbox"
              checked={watchlistOnly}
              onChange={(event) => setWatchlistOnly(event.target.checked)}
            />
            Watchlist only
          </label>
        </section>

        {activeView === "today" ? (
          <section className="today-grid" aria-label="Today overview">
            <article className="today-spotlight">
              <p className="eyebrow">Next comeback</p>
              {nextComeback ? (
                <>
                  <h2>{nextComeback.title}</h2>
                  <p className="artist-name">{nextComeback.artistName}</p>
                  <p className="summary">
                    {formatDate(nextComeback.comebackDate)}
                    {nextComeback.comebackTime ? ` · ${nextComeback.comebackTime}` : ""} ·{" "}
                    {formatCountdown(nextComeback.comebackDate)}
                  </p>
                  <div className="meta-row">
                    <span>{comebackTypes.find((type) => type.id === nextComeback.type)?.label ?? nextComeback.type}</span>
                    <span>
                      {comebackStatuses.find((status) => status.id === nextComeback.status)?.label ?? nextComeback.status}
                    </span>
                  </div>
                  <div className="platform-links">
                    {getComebackLinks(nextComeback).map(([platform, url]) => (
                      <a href={url} target="_blank" rel="noreferrer" key={`spotlight-${platform}`}>
                        {platformLabels[platform]}
                      </a>
                    ))}
                    {nextComeback.sourceUrl ? (
                      <a href={nextComeback.sourceUrl} target="_blank" rel="noreferrer">
                        <ExternalLink size={14} />
                        Source
                      </a>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="summary">No upcoming comeback yet. Add one from the Add view.</p>
              )}
            </article>
            <article className="today-list">
              <p className="eyebrow">Needs attention</p>
              <button type="button" onClick={() => setStatusFilter("missingSource")}>
                {missingSourceComebacks.length} missing source links
              </button>
              <button type="button" onClick={() => setStatusFilter("unseen")}>
                {unseenReleasedComebacks.length} released but unseen
              </button>
              <button type="button" onClick={() => setDateFilter("week")}>
                {dueSoonComebacks.length} within a week
              </button>
            </article>
          </section>
        ) : null}

        {activeView === "add" ? (
          <section className="comeback-builder" aria-label="Add comeback">
          <div className="section-heading">
            <CalendarDays size={18} />
            <h2>Add comeback</h2>
          </div>
          <form className="comeback-form" onSubmit={addComeback}>
            <select
              value={newComebackArtistId}
              onChange={(event) => setNewComebackArtistId(event.target.value)}
              aria-label="Comeback artist"
            >
              {sceneArtists.map((artist) => (
                <option value={artist.id} key={artist.id}>
                  {artist.name}
                </option>
              ))}
            </select>
            <input
              value={newComebackTitle}
              onChange={(event) => setNewComebackTitle(event.target.value)}
              placeholder="Release title"
              aria-label="Release title"
            />
            <input
              type="date"
              value={newComebackDate}
              onChange={(event) => setNewComebackDate(event.target.value)}
              aria-label="Comeback date"
            />
            <input
              value={newComebackTime}
              onChange={(event) => setNewComebackTime(event.target.value)}
              placeholder="Time, e.g. 6PM KST"
              aria-label="Comeback time"
            />
            <select
              value={newComebackType}
              onChange={(event) => setNewComebackType(event.target.value as ComebackType)}
              aria-label="Comeback type"
            >
              {comebackTypes.map((type) => (
                <option value={type.id} key={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
            <select
              value={newComebackStatus}
              onChange={(event) => setNewComebackStatus(event.target.value as ComebackStatus)}
              aria-label="Comeback status"
            >
              {comebackStatuses.map((status) => (
                <option value={status.id} key={status.id}>
                  {status.label}
                </option>
              ))}
            </select>
            <input
              value={newCoverUrl}
              onChange={(event) => setNewCoverUrl(event.target.value)}
              placeholder="Album cover image URL"
              aria-label="Album cover URL"
            />
            <input
              value={newSourceUrl}
              onChange={(event) => setNewSourceUrl(event.target.value)}
              placeholder="Announcement/source URL"
              aria-label="Source URL"
            />
            <input
              value={newSpotifyUrl}
              onChange={(event) => setNewSpotifyUrl(event.target.value)}
              placeholder="Spotify link"
              aria-label="Spotify link"
            />
            <input
              value={newAppleMusicUrl}
              onChange={(event) => setNewAppleMusicUrl(event.target.value)}
              placeholder="Apple Music link"
              aria-label="Apple Music link"
            />
            <input
              value={newYoutubeUrl}
              onChange={(event) => setNewYoutubeUrl(event.target.value)}
              placeholder="YouTube link"
              aria-label="YouTube link"
            />
            <input
              value={newMelonUrl}
              onChange={(event) => setNewMelonUrl(event.target.value)}
              placeholder="Melon link"
              aria-label="Melon link"
            />
            <textarea
              value={newComebackNotes}
              onChange={(event) => setNewComebackNotes(event.target.value)}
              placeholder="Notes, version info, title track, reminder..."
              aria-label="Comeback notes"
            />
            <button type="submit">
              <Plus size={17} />
              Add comeback
            </button>
          </form>
          </section>
        ) : null}

        {activeView === "today" || activeView === "calendar" ? (
          <section className="comeback-section" aria-label="Comeback calendar">
          <div className="section-heading">
            <CalendarDays size={18} />
            <h2>Comeback calendar</h2>
          </div>
          <div className="comeback-grid">
            {filteredComebacks.map((comeback) => {
              const links = getComebackLinks(comeback);
              const isSample = comeback.id.startsWith("sample-");
              const isSeen = seenComebacks.includes(comeback.id);

              return (
                <article className={`comeback-card ${isSeen ? "is-seen" : ""}`} key={comeback.id}>
                  <div className="cover-frame">
                    {comeback.coverUrl ? (
                      <img src={comeback.coverUrl} alt={`${comeback.title} cover`} />
                    ) : (
                      <div className="cover-placeholder">
                        <Image size={24} />
                        <span>{comeback.artistName.slice(0, 2).toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                  <div className="comeback-body">
                    <div className="comeback-heading">
                      <div>
                        <p className="eyebrow">
                          {formatDate(comeback.comebackDate)}
                          {comeback.comebackTime ? ` · ${comeback.comebackTime}` : ""}
                        </p>
                        <h3>{comeback.title}</h3>
                      </div>
                      <button type="button" className="delete-comeback" onClick={() => removeComeback(comeback.id)} title="Remove comeback">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <p className="artist-name">{comeback.artistName}</p>
                    <div className="meta-row">
                      <span>{comebackTypes.find((type) => type.id === comeback.type)?.label ?? comeback.type}</span>
                      <span>{formatCountdown(comeback.comebackDate)}</span>
                    </div>
                    <div className="comeback-actions">
                      <select
                        value={comeback.status}
                        onChange={(event) => updateComebackStatus(comeback.id, event.target.value as ComebackStatus)}
                        aria-label={`Status for ${comeback.title}`}
                      >
                        {comebackStatuses.map((status) => (
                          <option value={status.id} key={status.id}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                      <button type="button" className={isSeen ? "seen" : ""} onClick={() => toggleSeenComeback(comeback.id)}>
                        <Check size={14} />
                        {isSeen ? "Seen" : "Mark seen"}
                      </button>
                    </div>
                    {comeback.notes ? <p className="summary">{comeback.notes}</p> : null}
                    {isSample ? <p className="sample-label">Example entry only. Replace with a real comeback.</p> : null}
                    <div className="platform-links">
                      {links.map(([platform, url]) => (
                        <a href={url} target="_blank" rel="noreferrer" key={`${comeback.id}-${platform}`}>
                          {platformLabels[platform]}
                        </a>
                      ))}
                      {comeback.sourceUrl ? (
                        <a href={comeback.sourceUrl} target="_blank" rel="noreferrer">
                          <ExternalLink size={14} />
                          Source
                        </a>
                      ) : (
                        <span className="source-missing">
                          <Link2 size={14} />
                          source needed
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
            {filteredComebacks.length === 0 ? (
              <article className="empty-card">
                <h3>No tracked comebacks</h3>
                <p>Add one above with a source link, cover URL, and platform links when you have them.</p>
              </article>
            ) : null}
          </div>
          </section>
        ) : null}

        {activeView === "releases" ? (
          <section className="release-grid" aria-label="Newest releases">
          {filteredReleases.map((release) => (
            <article className="release-card" key={release.id}>
              <div className="release-header">
                <div>
                  <p>{formatDate(release.releaseDate)}</p>
                  <h3>{release.title}</h3>
                </div>
                <span>{release.type}</span>
              </div>
              <p className="artist-name">{release.artistName}</p>
              <p className="summary">{release.summary}</p>
              <p className="sample-label">Sample entry until a real source is connected</p>
              <div className="platform-links">
                {release.platformHints.map((platform) => (
                  <a
                    href={buildPlatformSearchUrl(platform, release.artistName, release.title)}
                    target="_blank"
                    rel="noreferrer"
                    key={platform}
                  >
                    {platformLabels[platform]}
                  </a>
                ))}
              </div>
            </article>
          ))}
          {filteredReleases.length === 0 ? (
            <article className="empty-card">
              <h3>No matching releases</h3>
              <p>Try changing filters, or add artists to your watchlist and use the quick platform searches for now.</p>
            </article>
          ) : null}
          </section>
        ) : null}

        {activeView === "news" ? (
          <section className="news-section" aria-label="Artist updates">
          <div className="section-heading">
            <Newspaper size={18} />
            <h2>News radar</h2>
          </div>
          <div className="news-list">
            {filteredNews.map((item) => (
              <a className="news-row" href={item.url} target="_blank" rel="noreferrer" key={item.id}>
                <span>
                  <strong>{item.title}</strong>
                  <small>
                    {item.artistName} · {item.source}
                  </small>
                </span>
                <time>{formatDate(item.date)}</time>
              </a>
            ))}
          </div>
          </section>
        ) : null}

        {activeView === "settings" ? (
          <section className="data-panel" aria-label="Local data backup">
            <div className="section-heading">
              <Settings size={18} />
              <h2>Local data</h2>
            </div>
            <p className="summary">
              This creates a manual JSON backup of your local artists, watchlist, comeback calendar, seen state, and
              preferences.
            </p>
            <div className="data-actions">
              <button type="button" onClick={exportLocalData}>
                <Download size={16} />
                Export backup
              </button>
              <button type="button" onClick={importLocalData}>
                <Upload size={16} />
                Import backup
              </button>
            </div>
            <textarea
              value={backupText}
              onChange={(event) => setBackupText(event.target.value)}
              placeholder="Exported backup JSON appears here. Paste a backup here to import."
            />
            {backupMessage ? <p className="sample-label">{backupMessage}</p> : null}
          </section>
        ) : null}
      </section>
    </main>
  );
}
