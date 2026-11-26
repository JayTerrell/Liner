// Data access layer. Reads the seed JSON today; swap these functions for
// Postgres queries later without touching any page.
import seed from "@/data/seed.json";
import type {
  Album, Artist, Channel, CreditRow, Lane, LinerPath, Story, Track,
} from "./types";

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

export function neighbors(album: Album) {
  const list = albumsByArtist(album.artistId);
  const i = list.findIndex((a) => a.id === album.id);
  return { prev: list[i - 1], next: list[i + 1] };
}

export const kindOfBlue = seed.kindOfBlue as {
  tracks: Track[];
  credits: CreditRow[];
  stories: Story[];
};

export function detailFor(albumId: string) {
  if (albumId === "kind-of-blue") return kindOfBlue;
  return { tracks: [] as Track[], credits: [] as CreditRow[], stories: [] as Story[] };
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
