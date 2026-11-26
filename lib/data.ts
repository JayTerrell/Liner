// Data access layer. Reads the seed JSON today; swap these functions for
// Postgres queries later without touching any page.
import { loadYaml } from "./files";
import type {
  Album, Artist, Channel, CreditRow, Lane, LinerPath, Story, Track, VideoMatch,
} from "./types";

interface Seed {
  _note: string; lanes: Lane[]; artists: Artist[]; albums: Album[];
  channels: Channel[]; paths: LinerPath[];
}
interface AlbumDetail { tracks: Track[]; credits: CreditRow[]; stories: Story[] }

const seed = loadYaml<Seed>("seed.yaml");
const details = loadYaml<{ albums: Record<string, AlbumDetail> }>("albums", "details.yaml");
const matchData = loadYaml<{ matches: VideoMatch[] }>("youtube", "matches.yaml");

const artists = seed.artists as Artist[];
const albums = seed.albums as Album[];
const paths = seed.paths as LinerPath[];
const channels = seed.channels as Channel[];
export const lanes = seed.lanes as Lane[];

export const sampleNote = seed._note;

export const getArtists = () => artists;
export const getArtist = (id: string) => artists.find((a) => a.id === id);
export const getAlbums = () => albums;
export const getAlbum = (id: string) => albums.find((a) => a.id === id);
export const getPaths = () => paths;
export const getPath = (id: string) => paths.find((p) => p.id === id);
export const getLane = (id: string) => lanes.find((l) => l.id === id);

export const albumsByArtist = (artistId: string) =>
  albums.filter((a) => a.artistId === artistId).sort((a, b) => a.year - b.year);

export const artistOf = (album: Album) => getArtist(album.artistId)!;

export const pathsForAlbum = (albumId: string) =>
  paths.filter((p) => p.items.some((i) => i.albumId === albumId));

export const pathsForArtist = (artistId: string) => {
  const ids = new Set(albumsByArtist(artistId).map((a) => a.id));
  return paths.filter((p) => p.items.some((i) => i.albumId && ids.has(i.albumId)));
};

export const channelsForLanes = (laneIds: string[], limit = 4): Channel[] =>
  channels.filter((c) => c.lanes.some((l) => laneIds.includes(l))).slice(0, limit);

// --- Ingested YouTube content -------------------------------------------
// Matched by rules in scripts/youtube-match.ts, never at request time.

const videos = matchData.matches as VideoMatch[];

// Firsthand first, since the archive is meant to showcase people who were
// there; then longer pieces over clips, which favours a real conversation
// over a promo.
const rank = (v: VideoMatch) =>
  (v.lean === "firsthand" ? 2 : v.lean === "mixed" ? 1 : 0) * 1e6 +
  Math.min(v.durationSeconds, 7200);

const byRank = (a: VideoMatch, b: VideoMatch) => rank(b) - rank(a);

// One channel can own a subject: ranked purely by lean and length, every slot
// on J Dilla's page went to Red Bull Music Academy's lectures. Take the best
// two from each channel first, then fill from what is left, so a page shows
// several people talking rather than one archive.
function spread(pool: VideoMatch[], limit: number, perChannel = 2): VideoMatch[] {
  const sorted = [...pool].sort(byRank);
  const seen = new Map<string, number>();
  const first: VideoMatch[] = [];
  const rest: VideoMatch[] = [];
  for (const v of sorted) {
    const n = seen.get(v.channelKey) ?? 0;
    if (n < perChannel) { first.push(v); seen.set(v.channelKey, n + 1); } else rest.push(v);
  }
  return [...first, ...rest].slice(0, limit);
}

export const videosForArtist = (artistId: string, limit = 6): VideoMatch[] =>
  spread(videos.filter((v) => v.artistIds.includes(artistId)), limit);

// An album's videos are the ones that name it, then the rest about its artist.
export const videosForAlbum = (album: Album, limit = 6): VideoMatch[] => {
  const named = videos.filter((v) => v.albumIds.includes(album.id));
  const rest = videos.filter(
    (v) => !v.albumIds.includes(album.id) && v.artistIds.includes(album.artistId),
  );
  return [...spread(named, limit), ...spread(rest, limit)].slice(0, limit);
};

export const videoCount = videos.length;

export function neighbors(album: Album) {
  const list = albumsByArtist(album.artistId);
  const i = list.findIndex((a) => a.id === album.id);
  return { prev: list[i - 1], next: list[i + 1] };
}

const EMPTY: AlbumDetail = { tracks: [], credits: [], stories: [] };

// Track lists and credits come from LINER_DB via scripts/build-album-details.ts.
// Stories stay empty until creators and historians write them: MusicBrainz and
// Discogs carry no such thing.
export function detailFor(albumId: string): AlbumDetail {
  return details.albums?.[albumId] ?? EMPTY;
}

export function search(q: string, lane?: string) {
  const needle = q.trim().toLowerCase();
  const inLane = (ls: string[]) => !lane || ls.includes(lane);
  const hit = (...s: (string | undefined)[]) =>
    !needle || s.some((x) => x && x.toLowerCase().includes(needle));

  const a = artists.filter((x) => inLane(x.lanes) && hit(x.name, x.roles, x.bio));
  const al = albums.filter((x) => {
    const ar = getArtist(x.artistId)!;
    return inLane(ar.lanes) && hit(x.title, ar.name, String(x.year));
  });
  const p = paths.filter((x) => {
    const ls = new Set<string>();
    x.items.forEach((i) => {
      const alb = i.albumId ? getAlbum(i.albumId) : undefined;
      const ar = alb ? getArtist(alb.artistId) : artists.find((z) => z.name === i.artist);
      ar?.lanes.forEach((l) => ls.add(l));
    });
    return inLane([...ls]) && hit(x.title, x.host, x.blurb);
  });
  return { artists: a, albums: al, paths: p };
}

export function pathCovers(p: LinerPath, n = 4) {
  return p.items.slice(0, n).map((i) => ({
    title: i.title,
    artist: i.artist,
    mbid: i.mbid ?? (i.albumId ? getAlbum(i.albumId)?.mbid : undefined),
  }));
}
