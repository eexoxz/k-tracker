import type { Artist } from "../types/music";

export const artists: Artist[] = [
  {
    id: "blackpink",
    name: "BLACKPINK",
    scene: "kpop",
    aliases: ["블랙핑크", "BP"],
    sources: [
      { id: "website", label: "Linktree", url: "https://linktr.ee/blackpink", kind: "official" },
      { id: "instagram", label: "Instagram", handle: "@blackpinkofficial", url: "https://www.instagram.com/blackpinkofficial/", kind: "official" },
      { id: "x", label: "X", handle: "@BLACKPINK", url: "https://x.com/BLACKPINK", kind: "official" },
      { id: "tiktok", label: "TikTok", handle: "@bp_tiktok", url: "https://www.tiktok.com/@bp_tiktok", kind: "official" },
      { id: "youtube", label: "YouTube", handle: "@BLACKPINK", url: "https://www.youtube.com/@BLACKPINK", kind: "official" },
      { id: "spotify", label: "Spotify", url: "https://open.spotify.com/search/BLACKPINK", kind: "search" }
    ],
    members: [
      {
        name: "JISOO",
        aliases: ["Kim Jisoo", "지수"],
        sources: [
          { id: "instagram", label: "Instagram", handle: "@sooyaaa__", url: "https://www.instagram.com/sooyaaa__/", kind: "official" }
        ]
      },
      {
        name: "JENNIE",
        aliases: ["Jennie Kim", "제니"],
        sources: [
          { id: "instagram", label: "Instagram", handle: "@jennierubyjane", url: "https://www.instagram.com/jennierubyjane/", kind: "official" }
        ]
      },
      {
        name: "ROSE",
        aliases: ["Rosé", "Park Chaeyoung", "로제"],
        sources: [
          { id: "instagram", label: "Instagram", handle: "@roses_are_rosie", url: "https://www.instagram.com/roses_are_rosie/", kind: "official" }
        ]
      },
      {
        name: "LISA",
        aliases: ["Lalisa Manobal", "리사"],
        sources: [
          { id: "instagram", label: "Instagram", handle: "@lalalalisa_m", url: "https://www.instagram.com/lalalalisa_m/", kind: "official" }
        ]
      }
    ]
  },
  {
    id: "aespa",
    name: "aespa",
    scene: "kpop",
    aliases: ["에스파"],
    musicBrainzId: "2e33d91b-2421-470a-9b47-e475ed5e45c8",
    sources: [
      { id: "instagram", label: "Instagram", handle: "@aespa_official", url: "https://www.instagram.com/aespa_official/", kind: "official" },
      { id: "x", label: "X", handle: "@aespa_Official", url: "https://x.com/aespa_Official", kind: "official" },
      { id: "youtube", label: "YouTube", handle: "@aespa", url: "https://www.youtube.com/@aespa", kind: "official" },
      { id: "spotify", label: "Spotify", url: "https://open.spotify.com/search/aespa", kind: "search" }
    ]
  },
  {
    id: "ive",
    name: "IVE",
    scene: "kpop",
    aliases: ["아이브"],
    sources: [
      { id: "instagram", label: "Instagram", handle: "@ivestarship", url: "https://www.instagram.com/ivestarship/", kind: "official" },
      { id: "x", label: "X", handle: "@IVEstarship", url: "https://x.com/IVEstarship", kind: "official" },
      { id: "youtube", label: "YouTube", handle: "@IVEstarship", url: "https://www.youtube.com/@IVEstarship", kind: "official" },
      { id: "spotify", label: "Spotify", url: "https://open.spotify.com/search/IVE", kind: "search" }
    ]
  },
  {
    id: "newjeans",
    name: "NewJeans",
    scene: "kpop",
    aliases: ["뉴진스"],
    sources: [
      { id: "youtube", label: "YouTube", url: "https://www.youtube.com/results?search_query=NewJeans+official", kind: "search" },
      { id: "spotify", label: "Spotify", url: "https://open.spotify.com/search/NewJeans", kind: "search" }
    ]
  },
  {
    id: "le-sserafim",
    name: "LE SSERAFIM",
    scene: "kpop",
    aliases: ["르세라핌"],
    sources: [
      { id: "instagram", label: "Instagram", handle: "@le_sserafim", url: "https://www.instagram.com/le_sserafim/", kind: "official" },
      { id: "youtube", label: "YouTube", handle: "@LESSERAFIM_official", url: "https://www.youtube.com/@LESSERAFIM_official", kind: "official" },
      { id: "spotify", label: "Spotify", url: "https://open.spotify.com/search/LE%20SSERAFIM", kind: "search" }
    ]
  },
  {
    id: "seventeen",
    name: "SEVENTEEN",
    scene: "kpop",
    aliases: ["세븐틴"],
    sources: [
      { id: "instagram", label: "Instagram", handle: "@saythename_17", url: "https://www.instagram.com/saythename_17/", kind: "official" },
      { id: "x", label: "X", handle: "@pledis_17", url: "https://x.com/pledis_17", kind: "official" },
      { id: "youtube", label: "YouTube", handle: "@pledis17", url: "https://www.youtube.com/@pledis17", kind: "official" },
      { id: "spotify", label: "Spotify", url: "https://open.spotify.com/search/SEVENTEEN", kind: "search" }
    ]
  },
  {
    id: "stray-kids",
    name: "Stray Kids",
    scene: "kpop",
    aliases: ["SKZ", "스트레이 키즈"],
    sources: [
      { id: "instagram", label: "Instagram", handle: "@realstraykids", url: "https://www.instagram.com/realstraykids/", kind: "official" },
      { id: "x", label: "X", handle: "@Stray_Kids", url: "https://x.com/Stray_Kids", kind: "official" },
      { id: "youtube", label: "YouTube", handle: "@StrayKids", url: "https://www.youtube.com/@StrayKids", kind: "official" },
      { id: "spotify", label: "Spotify", url: "https://open.spotify.com/search/Stray%20Kids", kind: "search" }
    ]
  },
  {
    id: "iu",
    name: "IU",
    scene: "kpop",
    aliases: ["아이유", "이지은"],
    sources: [
      { id: "instagram", label: "Instagram", handle: "@dlwlrma", url: "https://www.instagram.com/dlwlrma/", kind: "official" },
      { id: "youtube", label: "YouTube", handle: "@dlwlrma", url: "https://www.youtube.com/@dlwlrma", kind: "official" },
      { id: "spotify", label: "Spotify", url: "https://open.spotify.com/search/IU", kind: "search" }
    ]
  },
  {
    id: "taeyeon",
    name: "TAEYEON",
    scene: "kpop",
    aliases: ["태연"],
    sources: [
      { id: "instagram", label: "Instagram", handle: "@taeyeon_ss", url: "https://www.instagram.com/taeyeon_ss/", kind: "official" },
      { id: "spotify", label: "Spotify", url: "https://open.spotify.com/search/TAEYEON", kind: "search" },
      { id: "youtube", label: "YouTube", url: "https://www.youtube.com/results?search_query=TAEYEON+official", kind: "search" }
    ]
  }
];
