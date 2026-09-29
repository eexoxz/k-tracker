import type { Artist, NewsItem, Release } from "../types/music";

export const artists: Artist[] = [
  { id: "aespa", name: "aespa", scene: "kpop", aliases: ["에스파"] },
  { id: "ive", name: "IVE", scene: "kpop", aliases: ["아이브"] },
  { id: "newjeans", name: "NewJeans", scene: "kpop", aliases: ["뉴진스"] },
  { id: "le-sserafim", name: "LE SSERAFIM", scene: "kpop", aliases: ["르세라핌"] },
  { id: "seventeen", name: "SEVENTEEN", scene: "kpop", aliases: ["세븐틴"] },
  { id: "stray-kids", name: "Stray Kids", scene: "kpop", aliases: ["SKZ", "스트레이 키즈"] },
  { id: "iu", name: "IU", scene: "kpop", aliases: ["아이유"] },
  { id: "taeyeon", name: "TAEYEON", scene: "kpop", aliases: ["태연"] }
];

export const releases: Release[] = [
  {
    id: "aespa-supernova",
    artistId: "aespa",
    artistName: "aespa",
    title: "Supernova",
    scene: "kpop",
    releaseDate: "2026-09-21",
    type: "single",
    platformHints: ["spotify", "youtube", "appleMusic", "melon"],
    summary: "Bright electronic single with quick links for streaming searches."
  },
  {
    id: "ive-summer-festa",
    artistId: "ive",
    artistName: "IVE",
    title: "Summer Festa",
    scene: "kpop",
    releaseDate: "2026-09-18",
    type: "ep",
    platformHints: ["spotify", "youtube", "appleMusic"],
    summary: "EP placeholder entry for watchlist and date filtering."
  },
  {
    id: "iu-night-letter-live",
    artistId: "iu",
    artistName: "IU",
    title: "Night Letter Live",
    scene: "kpop",
    releaseDate: "2026-09-14",
    type: "single",
    platformHints: ["youtube", "melon"],
    summary: "Live performance-style release for testing platform-specific results."
  },
  {
    id: "skz-neon-run",
    artistId: "stray-kids",
    artistName: "Stray Kids",
    title: "Neon Run",
    scene: "kpop",
    releaseDate: "2026-09-09",
    type: "album",
    platformHints: ["spotify", "youtube", "appleMusic"],
    summary: "Album entry to make the newest-release feed feel populated."
  },
  {
    id: "taeyeon-dawnline",
    artistId: "taeyeon",
    artistName: "TAEYEON",
    title: "Dawnline",
    scene: "kpop",
    releaseDate: "2026-08-30",
    type: "ost",
    platformHints: ["spotify", "youtube", "appleMusic", "melon"],
    summary: "OST-style release for category variety."
  }
];

export const newsItems: NewsItem[] = [
  {
    id: "aespa-teaser",
    artistId: "aespa",
    artistName: "aespa",
    scene: "kpop",
    title: "Comeback teaser schedule added",
    date: "2026-09-23",
    source: "Official channels",
    url: "https://www.youtube.com/results?search_query=aespa+comeback+teaser"
  },
  {
    id: "ive-stage",
    artistId: "ive",
    artistName: "IVE",
    scene: "kpop",
    title: "Music show performance links are trending",
    date: "2026-09-20",
    source: "YouTube search",
    url: "https://www.youtube.com/results?search_query=IVE+music+show+performance"
  },
  {
    id: "seventeen-tour",
    artistId: "seventeen",
    artistName: "SEVENTEEN",
    scene: "kpop",
    title: "Tour-related update placeholder",
    date: "2026-09-15",
    source: "News search",
    url: "https://www.google.com/search?q=SEVENTEEN+tour+news"
  }
];
