import type { Artist, ArtistPost } from "../types/music";

const youtubeBaseUrl = "https://www.googleapis.com/youtube/v3";

type YoutubeSearchItem = {
  id?: {
    videoId?: string;
  };
  snippet?: {
    title?: string;
    publishedAt?: string;
    thumbnails?: {
      medium?: {
        url?: string;
      };
      high?: {
        url?: string;
      };
    };
  };
};

type YoutubeSearchResponse = {
  items?: YoutubeSearchItem[];
};

function getYoutubeKey() {
  return import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined;
}

export function isYoutubeReady(artist: Artist) {
  return Boolean(getYoutubeKey() && artist.youtubeChannelId);
}

export async function fetchRecentYoutubePosts(artist: Artist): Promise<ArtistPost[]> {
  const apiKey = getYoutubeKey();
  if (!apiKey || !artist.youtubeChannelId) return [];

  const params = new URLSearchParams({
    key: apiKey,
    channelId: artist.youtubeChannelId,
    part: "snippet",
    order: "date",
    maxResults: "8",
    type: "video"
  });

  const response = await fetch(`${youtubeBaseUrl}/search?${params}`);
  if (!response.ok) throw new Error(`Could not load YouTube posts for ${artist.name}`);

  const data = (await response.json()) as YoutubeSearchResponse;

  return (data.items ?? [])
    .map((item): ArtistPost | null => {
      const videoId = item.id?.videoId;
      const title = item.snippet?.title;
      const publishedAt = item.snippet?.publishedAt;
      if (!videoId || !title || !publishedAt) return null;

      return {
        id: videoId,
        artistId: artist.id,
        artistName: artist.name,
        title,
        date: publishedAt.slice(0, 10),
        platform: "youtube",
        url: `https://www.youtube.com/watch?v=${videoId}`,
        thumbnailUrl: item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.medium?.url,
        source: {
          label: "YouTube Data API",
          url: "https://developers.google.com/youtube/v3",
          kind: "official"
        }
      };
    })
    .filter((post): post is ArtistPost => Boolean(post));
}
