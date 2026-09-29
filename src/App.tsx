import { Bell, CalendarDays, Filter, Heart, Music2, Newspaper, Plus, Search, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { artists, newsItems, releases } from "./data/catalog";
import type { DateFilter, MusicScene, Platform } from "./types/music";
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

const today = new Date("2026-09-29T00:00:00");

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

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${date}T00:00:00`));
}

export default function App() {
  const [preferences, setPreferences] = useState<LocalPreferences>(() =>
    readStoredValue("preferences", defaultPreferences)
  );
  const [scene, setScene] = useState<MusicScene>(preferences.scene);
  const [artistQuery, setArtistQuery] = useState("");
  const [releaseQuery, setReleaseQuery] = useState("");
  const [selectedArtist, setSelectedArtist] = useState(preferences.selectedArtist);
  const [dateFilter, setDateFilter] = useState<DateFilter>(preferences.dateFilter);
  const [platformFilter, setPlatformFilter] = useState<"all" | Platform>(preferences.platformFilter);
  const [watchlistOnly, setWatchlistOnly] = useState(preferences.watchlistOnly);
  const [watchlist, setWatchlist] = useState<string[]>(() => readStringList("watchlist", ["aespa", "ive", "iu"]));

  useEffect(() => {
    writeStringList("watchlist", watchlist);
  }, [watchlist]);

  useEffect(() => {
    const nextPreferences = { scene, selectedArtist, dateFilter, platformFilter, watchlistOnly };
    setPreferences(nextPreferences);
    writeStoredValue("preferences", nextPreferences);
  }, [dateFilter, platformFilter, scene, selectedArtist, watchlistOnly]);

  const sceneArtists = useMemo(() => artists.filter((artist) => artist.scene === scene), [scene]);

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

        <section className="artist-list" aria-label="Artists">
          {matchingArtists.map((artist) => {
            const saved = watchlist.includes(artist.id);

            return (
              <button
                type="button"
                key={artist.id}
                className="artist-row"
                onClick={() => toggleWatchlist(artist.id)}
                aria-pressed={saved}
              >
                <span>
                  <strong>{artist.name}</strong>
                  <small>{artist.aliases?.[0] ?? "K-pop artist"}</small>
                </span>
                <Heart size={18} className={saved ? "saved" : ""} fill={saved ? "currentColor" : "none"} />
              </button>
            );
          })}
        </section>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">K-pop first, expandable later</p>
            <h2>Newest releases and artist updates</h2>
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
