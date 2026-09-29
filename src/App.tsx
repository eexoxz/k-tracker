import {
  Bell,
  CalendarDays,
  ExternalLink,
  Filter,
  Heart,
  Image,
  Link2,
  Music2,
  Newspaper,
  Plus,
  Search,
  Star,
  Trash2
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

const today = new Date();

type LocalPreferences = {
  scene: MusicScene;
  selectedArtist: string;
  dateFilter: DateFilter;
  platformFilter: "all" | Platform;
  watchlistOnly: boolean;
};

const defaultPreferences: LocalPreferences = {
  scene: "kpop",
  selectedArtist: "all",
  dateFilter: "month",
  platformFilter: "all",
  watchlistOnly: false
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
    readStoredValue("preferences", defaultPreferences)
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
  const [watchlist, setWatchlist] = useState<string[]>(() => readStringList("watchlist", ["aespa", "ive", "iu"]));
  const [customArtists, setCustomArtists] = useState(() => readStoredValue<typeof artists>("customArtists", []));
  const [localComebacks, setLocalComebacks] = useState<Comeback[]>(() =>
    readStoredValue("comebacks", comebackTemplates)
  );

  useEffect(() => {
    writeStringList("watchlist", watchlist);
  }, [watchlist]);

  useEffect(() => {
    writeStoredValue("customArtists", customArtists);
  }, [customArtists]);

  useEffect(() => {
    writeStoredValue("comebacks", localComebacks);
  }, [localComebacks]);

  useEffect(() => {
    const nextPreferences = { scene, selectedArtist, dateFilter, platformFilter, watchlistOnly };
    setPreferences(nextPreferences);
    writeStoredValue("preferences", nextPreferences);
  }, [dateFilter, platformFilter, scene, selectedArtist, watchlistOnly]);

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
        if (!query) return true;
        return `${comeback.artistName} ${comeback.title} ${comeback.type} ${comeback.status}`
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => a.comebackDate.localeCompare(b.comebackDate));
  }, [dateFilter, localComebacks, platformFilter, releaseQuery, scene, selectedArtist, watchlist, watchlistOnly]);

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
            <h2>Newest releases and artist updates</h2>
            <p className="topbar-note">Personal watchlist is saved locally on this PC. Release/news data is still manual sample data.</p>
          </div>
          <button className="sync-button" type="button">
            <Bell size={18} />
            Check releases
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
            <span>{filteredReleases.length}</span>
            <small>matching releases</small>
          </article>
          <article>
            <CalendarDays size={18} />
            <span>{filteredComebacks.length}</span>
            <small>tracked comebacks</small>
          </article>
          <article>
            <Newspaper size={18} />
            <span>{filteredNews.length}</span>
            <small>updates</small>
          </article>
        </section>

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

          <label className="toggle">
            <input
              type="checkbox"
              checked={watchlistOnly}
              onChange={(event) => setWatchlistOnly(event.target.checked)}
            />
            Watchlist only
          </label>
        </section>

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
            <input value={newMelonUrl} onChange={(event) => setNewMelonUrl(event.target.value)} placeholder="Melon link" aria-label="Melon link" />
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

        <section className="comeback-section" aria-label="Comeback calendar">
          <div className="section-heading">
            <CalendarDays size={18} />
            <h2>Comeback calendar</h2>
          </div>
          <div className="comeback-grid">
            {filteredComebacks.map((comeback) => {
              const links = getComebackLinks(comeback);
              const isSample = comeback.id.startsWith("sample-");

              return (
                <article className="comeback-card" key={comeback.id}>
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
                      <span>{comebackStatuses.find((status) => status.id === comeback.status)?.label ?? comeback.status}</span>
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
      </section>
    </main>
  );
}
