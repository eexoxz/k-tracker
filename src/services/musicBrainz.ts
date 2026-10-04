import type { ApiRelease, Artist, Platform } from "../types/music";
import { buildPlatformSearchUrl } from "../utils/links";
import { musicBrainzRequest } from "./musicBrainzClient";
export { musicBrainzPauseMs } from "./musicBrainzClient";

export type MusicBrainzArtist = {
  id: string;
  name: string;
  disambiguation?: string;
  type?: string;
  country?: string;
  aliases?: Array<{ name: string }>;
  score?: number;
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

function normalizeDate(date?: string) {
  if (!date) return "";
  if (/^\d{4}$/.test(date)) return `${date}-01-01`;
  if (/^\d{4}-\d{2}$/.test(date)) return `${date}-01`;
  return date;
}

function getPlatformSearches(artistName: string, title: string): Record<Platform, string> {
  return {
    spotify: buildPlatformSearchUrl("spotify", artistName, title),
    youtube: buildPlatformSearchUrl("youtube", artistName, title),
    appleMusic: buildPlatformSearchUrl("appleMusic", artistName, title),
    melon: buildPlatformSearchUrl("melon", artistName, title)
  };
}

export async function searchMusicBrainzArtists(artistName: string, signal?: AbortSignal) {
  const escaped = artistName.replace(/[\\"]/g, "\\$&");
  const data = await musicBrainzRequest<MusicBrainzArtistResponse>("artist", {
    query: `artist:"${escaped}"`,
    limit: "15"
  }, signal);
  return (data.artists ?? []).sort((a, b) => {
    const rank = (artist: MusicBrainzArtist) => (artist.country === "KR" ? 100 : 0) + (artist.score ?? 0);
    return rank(b) - rank(a);
  });
}

export async function searchMusicBrainzArtist(artistName: string, signal?: AbortSignal) {
  const matches = await searchMusicBrainzArtists(artistName, signal);
  const normalize = (name: string) => name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const exact = matches.filter((artist) => [artist.name, ...(artist.aliases ?? []).map((alias) => alias.name)]
    .some((name) => normalize(name) === normalize(artistName)));
  const korean = exact.filter((artist) => artist.country === "KR");
  if (korean.length === 1) return korean[0];
  if (exact.length === 1) return exact[0];
  throw new Error(`Choose ${artistName} from the online search results to confirm the artist.`);
}

export async function fetchMusicBrainzReleaseGroups(artist: Artist, signal?: AbortSignal) {
  const mbid = artist.musicBrainzId ?? (await searchMusicBrainzArtist(artist.name, signal))?.id;
  if (!mbid) return [];

  const data = await musicBrainzRequest<MusicBrainzReleaseGroupResponse>("release-group", {
    artist: mbid, limit: "100"
  }, signal);
  return (data["release-groups"] ?? [])
    .map((group): ApiRelease | null => {
      const releaseDate = normalizeDate(group["first-release-date"]);
      if (!releaseDate) return null;

      const type = [group["primary-type"], ...(group["secondary-types"] ?? [])].filter(Boolean).join(" / ") || "Release";
      const sourceUrl = `https://musicbrainz.org/release-group/${group.id}`;
      const coverUrl = `https://coverartarchive.org/release-group/${group.id}/front-250`;

      return {
        id: group.id,
        artistId: artist.id,
        artistName: artist.name,
        title: group.title,
        releaseDate,
        type,
        source: {
          label: "MusicBrainz",
          url: sourceUrl,
          kind: "metadata"
        },
        cover: {
          label: "Cover Art Archive",
          url: `https://coverartarchive.org/release-group/${group.id}`,
          imageUrl: coverUrl,
          kind: "cover"
        },
        platformSearches: getPlatformSearches(artist.name, group.title)
      };
    })
    .filter((release): release is ApiRelease => Boolean(release));
}
