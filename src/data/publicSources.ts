import type { Artist, ArtistSource, KpopCalendarEvent } from "../types/music";

export const discoverySources: ArtistSource[] = [
  {
    id: "website",
    label: "K-Pop Calendar",
    url: "https://kpopcal.com/",
    kind: "database"
  },
  {
    id: "website",
    label: "KpopComebacks",
    url: "https://www.kpopcomebacks.com/",
    kind: "database"
  },
  {
    id: "news",
    label: "KBS K-pop News RSS",
    url: "https://world.kbs.co.kr/rss/rss_enternews.htm?lang=e",
    kind: "news"
  },
  {
    id: "news",
    label: "Soompi K-pop",
    url: "https://www.soompi.com/tag/kpop",
    kind: "news"
  }
];

export const sourceCredits = [
  { label: "K-Pop Calendar", url: "https://www.kpopcal.com/data", note: "open calendar feed, CC BY 4.0 attribution" },
  { label: "KpopComebacks", url: "https://www.kpopcomebacks.com/", note: "public comeback schedule reference" },
  { label: "KBS K-pop News RSS", url: "https://world.kbs.co.kr/rss/rss_enternews.htm?lang=e", note: "public RSS news feed" },
  { label: "Soompi", url: "https://www.soompi.com/tag/kpop", note: "K-pop news reference" }
];

export const fallbackCalendarEvents: KpopCalendarEvent[] = [
  {
    id: "kpopcal-open-feed",
    artistName: "K-pop",
    title: "Open K-pop calendar feed",
    date: new Date().toISOString().slice(0, 10),
    type: "calendar",
    source: {
      label: "K-Pop Calendar",
      url: "https://kpopcal.com/",
      kind: "metadata"
    },
    url: "https://kpopcal.com/",
    description: "Refresh to load upcoming comeback and release events from the public calendar feed."
  }
];

function newsQueryUrl(query: string) {
  return `https://news.google.com/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
}

export function getArtistNewsSources(artist: Artist): ArtistSource[] {
  const queryName = artist.name;
  return [
    {
      id: "news",
      label: "Google News",
      url: newsQueryUrl(`${queryName} K-pop comeback OR release`),
      kind: "news"
    },
    {
      id: "news",
      label: "Soompi Search",
      url: `https://www.soompi.com/search?query=${encodeURIComponent(queryName)}`,
      kind: "news"
    },
    {
      id: "news",
      label: "KBS News Search",
      url: `https://world.kbs.co.kr/search.htm?lang=e&keyword=${encodeURIComponent(queryName)}`,
      kind: "news"
    }
  ];
}
