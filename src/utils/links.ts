import type { Platform } from "../types/music";

const platformSearchUrls: Record<Platform, (query: string) => string> = {
  spotify: (query) => `https://open.spotify.com/search/${encodeURIComponent(query)}`,
  youtube: (query) => `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
  appleMusic: (query) => `https://music.apple.com/us/search?term=${encodeURIComponent(query)}`,
  melon: (query) => `https://www.melon.com/search/total/index.htm?q=${encodeURIComponent(query)}`
};

export const platformLabels: Record<Platform, string> = {
  spotify: "Spotify",
  youtube: "YouTube",
  appleMusic: "Apple Music",
  melon: "Melon"
};

export function buildPlatformSearchUrl(platform: Platform, artist: string, title: string) {
  return platformSearchUrls[platform](`${artist} ${title}`);
}
