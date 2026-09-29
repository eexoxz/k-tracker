export type MusicScene = "kpop" | "mandopop" | "jpop" | "english_pop";

export type Platform = "spotify" | "youtube" | "appleMusic" | "melon";

export type ReleaseType = "single" | "album" | "ep" | "ost" | "preRelease";

export type Artist = {
  id: string;
  name: string;
  scene: MusicScene;
  aliases?: string[];
  group?: string;
};

export type Release = {
  id: string;
  artistId: string;
  artistName: string;
  title: string;
  scene: MusicScene;
  releaseDate: string;
  type: ReleaseType;
  platformHints: Platform[];
  summary: string;
};

export type NewsItem = {
  id: string;
  artistId?: string;
  artistName: string;
  scene: MusicScene;
  title: string;
  date: string;
  source: string;
  url: string;
};

export type DateFilter = "all" | "week" | "month";
