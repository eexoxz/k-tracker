import type { ApiRelease, Artist, Platform } from "../types/music";
import { buildPlatformSearchUrl } from "../utils/links";

const musicBrainzBaseUrl = "https://musicbrainz.org/ws/2";
export const musicBrainzPauseMs = 1100;

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

export async function searchMusicBrainzArtist(artistName: string) {
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

export async function fetchMusicBrainzReleaseGroups(artist: Artist) {
  const mbid = artist.musicBrainzId ?? (await searchMusicBrainzArtist(artist.name))?.id;
  if (!mbid) return [];

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
