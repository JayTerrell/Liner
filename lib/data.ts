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

// --- Everyone credited on a record ---------------------------------------
// 804 people appear in the credits; 30 of them are curated artists with a
// biography and a thread. The rest exist only through their work, and they
// get the same page, keyed on their MusicBrainz ID. The index is derived
// from the album detail rather than stored twice.

export interface CreditOf { albumId: string; role: string; scope: string }

const creditsByPerson = new Map<string, { name: string; credits: CreditOf[] }>();
for (const [albumId, detail] of Object.entries(details.albums ?? {})) {
  for (const c of detail.credits) {
    if (!c.mbid) continue;
    const seen = creditsByPerson.get(c.mbid) ?? { name: c.name, credits: [] };
    seen.credits.push({ albumId, role: c.role, scope: c.scope });
    creditsByPerson.set(c.mbid, seen);
  }
}

const bySeedId = new Map(artists.map((a) => [a.id, a]));
// A curated artist reached through a credit keeps their own page, so nobody
// ends up with two.
const seedIdForMbid = new Map<string, string>();
for (const detail of Object.values(details.albums ?? {})) {
  for (const c of detail.credits) if (c.mbid && c.artistId) seedIdForMbid.set(c.mbid, c.artistId);
}

export const creditsFor = (artistId: string): CreditOf[] => {
  const direct = creditsByPerson.get(artistId)?.credits;
  if (direct) return direct;
  // A curated artist is keyed by slug, so find them through their mbid.
  for (const [mbid, seedId] of seedIdForMbid) {
    if (seedId === artistId) return creditsByPerson.get(mbid)?.credits ?? [];
  }
  return [];
};

export function getArtist(id: string): Artist | undefined {
  const seeded = bySeedId.get(id);
  if (seeded) return seeded;
  const person = creditsByPerson.get(id);
  if (!person) return undefined;
  // Someone who exists only through their credits. Their roles are whatever
  // they are credited as, most frequent first.
  const tally = new Map<string, number>();
  for (const c of person.credits) {
    for (const r of c.role.split(", ")) tally.set(r, (tally.get(r) ?? 0) + 1);
  }
  const roles = [...tally.entries()].sort((a, b) => b[1] - a[1]).map(([r]) => r);
  return { id, name: person.name, mbid: id, roles: roles.join(" · "), fromCredits: true };
}

// Every page to build: the curated artists, plus everyone who exists only
// through a credit.
export const allArtistIds = (): string[] => [
  ...artists.map((a) => a.id),
  ...[...creditsByPerson.keys()].filter((mbid) => !seedIdForMbid.has(mbid)),
];

export const personCount = creditsByPerson.size;
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
  const inLane = (ls: string[] = []) => !lane || ls.includes(lane);
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
      ar?.lanes?.forEach((l) => ls.add(l));
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
