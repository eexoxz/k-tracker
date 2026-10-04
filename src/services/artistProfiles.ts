import type { Artist, ArtistMember, ArtistProfile, ArtistSource, SourcePlatform } from "../types/music";
import { buildPlatformSearchUrl } from "../utils/links";
import { searchMusicBrainzArtist, type MusicBrainzArtist } from "./musicBrainz";
import { musicBrainzRequest } from "./musicBrainzClient";

type Relation = {
  type: string;
  direction?: string;
  ended?: boolean;
  end?: string | null;
  "target-credit"?: string;
  artist?: MusicBrainzArtist & { "sort-name"?: string };
  url?: { resource: string };
};

type ArtistEntity = MusicBrainzArtist & { relations?: Relation[] };

const platformHosts: Array<[string, SourcePlatform, string]> = [
  ["instagram.com", "instagram", "Instagram"],
  ["twitter.com", "x", "X"],
  ["x.com", "x", "X"],
  ["tiktok.com", "tiktok", "TikTok"],
  ["youtube.com", "youtube", "YouTube"],
  ["open.spotify.com", "spotify", "Spotify"],
  ["music.apple.com", "appleMusic", "Apple Music"],
  ["itunes.apple.com", "appleMusic", "Apple Music"],
  ["melon.com", "melon", "Melon"]
];

export function getArtistSources(artist: Artist): ArtistSource[] {
  const sources = [...(artist.sources ?? [])];
  for (const id of ["youtube", "spotify", "appleMusic"] as const) {
    if (!sources.some((source) => source.id === id && source.kind !== "search")) {
      if (!sources.some((source) => source.id === id)) sources.push({
        id,
        label: `${id === "appleMusic" ? "Apple Music" : id === "spotify" ? "Spotify" : "YouTube"} search`,
        url: buildPlatformSearchUrl(id, artist.name, ""),
        kind: "search"
      });
    }
  }
  return sources;
}

export function sourcesFromRelations(entity: ArtistEntity): ArtistSource[] {
  const sources: ArtistSource[] = [];
  const attributionUrl = `https://musicbrainz.org/artist/${entity.id}`;
  for (const relation of entity.relations ?? []) {
    if (!relation.url || relation.ended || relation.end) continue;
    let url: URL;
    try { url = new URL(relation.url.resource); } catch { continue; }
    if (!["https:", "http:"].includes(url.protocol)) continue;
    const platform = platformHosts.find(([host]) => url.hostname === host || url.hostname.endsWith(`.${host}`));
    const allowed = ["social network", "youtube", "video channel", "official homepage", "streaming", "free streaming", "purchase for download"];
    if (!allowed.includes(relation.type)) continue;
    if (!platform && relation.type !== "official homepage") continue;
    const id = platform?.[1] ?? "website";
    if (sources.some((source) => source.id === id)) continue;
    // The API supplies these links; database attribution does not imply independent verification.
    sources.push({
      id,
      label: platform?.[2] ?? "Official website",
      url: url.href,
      kind: "database",
      attributionUrl
    });
  }
  sources.push({ id: "musicBrainz", label: "MusicBrainz artist record", url: attributionUrl, kind: "database" });
  return sources;
}

export function profileFromEntity(artist: Artist, entity: ArtistEntity): ArtistProfile {
  const sources = sourcesFromRelations(entity);
  const knownSources = artist.sources ?? [];
  const combined = [...sources, ...knownSources.filter((known) => !sources.some((source) => source.id === known.id))];
  const members: ArtistMember[] = [];
  for (const relation of entity.relations ?? []) {
    if (relation.type !== "member of band" || relation.direction !== "backward" || !relation.artist) continue;
    const member = relation.artist;
    if (members.some((item) => item.musicBrainzId === member.id)) continue;
    const name = relation["target-credit"] || member.name;
    const known = artist.members?.find((item) => item.musicBrainzId === member.id || item.name.toLowerCase() === name.toLowerCase());
    members.push({
      name,
      aliases: [...new Set([member.name, ...(known?.aliases ?? [])])].filter((alias) => alias !== name),
      musicBrainzId: member.id,
      sources: known?.sources ?? [],
      former: Boolean(relation.ended || relation.end)
    });
  }
  return {
    ...artist,
    musicBrainzId: entity.id,
    artistType: entity.type,
    aliases: [...new Set([...(artist.aliases ?? []), entity.name, ...(entity.aliases ?? []).map((alias) => alias.name)])]
      .filter((name) => name !== artist.name),
    sources: combined,
    members: entity.type === "Person" ? [] : members,
    youtubeChannelId: combined.find((source) => source.id === "youtube")?.url.match(/\/channel\/(UC[\w-]+)/)?.[1],
    fetchedAt: "",
    membersComplete: members.length === 0
  };
}

export async function fetchArtistProfile(
  artist: Artist,
  signal: AbortSignal,
  onUpdate: (profile: ArtistProfile) => void,
  onReady: (profile: ArtistProfile) => Promise<void>
) {
  const mbid = artist.musicBrainzId ?? (await searchMusicBrainzArtist(artist.name, signal))?.id;
  if (!mbid) throw new Error("No artist profile found.");
  const entity = await musicBrainzRequest<ArtistEntity>(`artist/${mbid}`, { inc: "url-rels+artist-rels+aliases" }, signal);
  let profile = profileFromEntity(artist, entity);
  onUpdate(profile);
  // Load releases as soon as the group identity is resolved, before individual member lookups.
  await onReady(profile);
  const failedMembers: string[] = [];
  for (let index = 0; index < (profile.members?.length ?? 0); index++) {
    signal.throwIfAborted();
    const member = profile.members![index];
    try {
      const memberEntity = await musicBrainzRequest<ArtistEntity>(`artist/${member.musicBrainzId}`, {
        inc: "url-rels+aliases"
      }, signal);
      const updated = {
        ...member,
        aliases: [...new Set([...(member.aliases ?? []), ...(memberEntity.aliases ?? []).map((alias) => alias.name)])],
        sources: sourcesFromRelations(memberEntity)
      };
      profile = { ...profile, members: profile.members!.map((item, memberIndex) => memberIndex === index ? updated : item) };
      onUpdate(profile);
    } catch {
      signal.throwIfAborted();
      failedMembers.push(member.name);
    }
  }
  profile = { ...profile, fetchedAt: new Date().toISOString(), membersComplete: failedMembers.length === 0 };
  onUpdate(profile);
  if (failedMembers.length) throw new Error(`Some member links could not load: ${failedMembers.join(", ")}. Refresh to retry.`);
  return profile;
}

export function normalizeArtistName(name: string) {
  return name.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

export function matchesArtistName(artist: Artist, name: string) {
  return [artist.name, ...(artist.aliases ?? [])].some((alias) => normalizeArtistName(alias) === normalizeArtistName(name));
}
