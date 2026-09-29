export type MusicScene = "kpop" | "mandopop" | "jpop" | "english_pop";

export type Platform = "spotify" | "youtube" | "appleMusic" | "melon";

export type SourcePlatform =
  | Platform
  | "musicBrainz"
  | "coverArtArchive"
  | "instagram"
  | "x"
  | "website"
  | "news";

export type ArtistSource = {
  id: SourcePlatform;
  label: string;
  url: string;
  handle?: string;
  kind: "official" | "database" | "search" | "news";
};

export type Artist = {
  id: string;
  name: string;
  scene: MusicScene;
  aliases?: string[];
  group?: string;
  musicBrainzId?: string;
  youtubeChannelId?: string;
  sources?: ArtistSource[];
};

export type SourceCredit = {
  label: string;
  url: string;
  kind: "metadata" | "cover" | "official" | "search" | "news";
};

export type ApiRelease = {
  id: string;
  artistId: string;
  artistName: string;
  title: string;
  releaseDate: string;
  type: string;
  source: SourceCredit;
  cover?: SourceCredit & { imageUrl: string };
  platformSearches: Record<Platform, string>;
};

export type ArtistPost = {
  id: string;
  artistId: string;
  artistName: string;
  title: string;
  date: string;
  platform: "youtube";
  url: string;
  thumbnailUrl?: string;
  source: SourceCredit;
};
