// Data access layer. Reads the seed JSON today; swap these functions for
// Postgres queries later without touching any page.
import { loadYaml } from "./files";
import type {
  Album, Artist, Channel, CreditRow, Lane, LinerPath, RoleLineage, Story, Track, VideoFormat, VideoMatch,
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

// --- Role lineage -----------------------------------------------------------
// For a person: under each bandleader they worked with most, who held the same
// chair before and after them. A neighbour links to a page only when one exists,
// which today means someone credited on an album in the archive.

interface RawLineage {
  leader: string; chair: string; albums: number; from: number;
  before: { mbid: string; name: string; from: number }[];
  after: { mbid: string; name: string; from: number }[];
}
const lineageFile = loadYaml<{ people?: Record<string, RawLineage[]> }>("lineage", "roles.yaml").people ?? {};

// A curated artist is keyed by slug on the page and by MusicBrainz id in the
// lineage, so find the id behind the slug.
const mbidForPageId = (id: string): string | undefined => {
  if (creditsByPerson.has(id)) return id;
  for (const [mbid, seedId] of seedIdForMbid) if (seedId === id) return mbid;
  return undefined;
};
const hasPage = (mbid: string) => creditsByPerson.has(mbid) || seedIdForMbid.has(mbid);
const neighbour = (n: { mbid: string; name: string; from: number }) => ({
  id: hasPage(n.mbid) ? (seedIdForMbid.get(n.mbid) ?? n.mbid) : undefined,
  name: n.name,
  from: n.from,
});

export function roleLineageFor(artistId: string): RoleLineage[] {
  const mbid = mbidForPageId(artistId);
  return (mbid ? lineageFile[mbid] ?? [] : []).map((l) => ({
    leader: l.leader, chair: l.chair, albums: l.albums, from: l.from,
    before: l.before.map(neighbour), after: l.after.map(neighbour),
  }));
}
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

// --- The artist page and the full video index -------------------------------
// Every list on an artist page follows three layers: a few picks to start with,
// shelves for the rest, and an index that holds everything. This section is the
// data for all three, and it is the only place that knows how videos are ranked,
// grouped, filtered or counted. Counts are always computed here, never in a page.

export const FORMAT_LABEL: Record<VideoFormat, string> = {
  interview: "Interviews",
  breakdown: "Breakdowns",
  podcast: "Podcasts",
  live: "Live",
  documentary: "Documentaries",
  other: "Other",
};
export const FORMATS = Object.keys(FORMAT_LABEL) as VideoFormat[];
export const SOURCE_LABEL = { first: "Firsthand", second: "Secondhand", mixed: "Mixed" } as const;
export type SourceKey = keyof typeof SOURCE_LABEL;
const sourceOf = (v: VideoMatch): SourceKey => (v.lean === "firsthand" ? "first" : v.lean === "secondhand" ? "second" : "mixed");

export type LengthKey = "short" | "mid" | "long";
export const LENGTH_LABEL: Record<LengthKey, string> = { short: "Under 15 min", mid: "15 to 45 min", long: "Over 45 min" };
const lengthOf = (v: VideoMatch): LengthKey => {
  const m = v.durationSeconds / 60;
  return m < 15 ? "short" : m <= 45 ? "mid" : "long";
};

export const videosOf = (artistId: string): VideoMatch[] => videos.filter((v) => v.artistIds.includes(artistId));

// Editor picks. A pin wins over the rule, and brings its own reason.
const pins = loadYaml<{ artists?: Record<string, { videoId: string; reason?: string }[]> }>("youtube", "pins.yaml").artists ?? {};

// How worth opening a video is, by rule. Firsthand sits far above everything
// else because the archive exists to put people who were there first; after that
// a video that names an album beats one that does not, a length worth sitting
// down for beats a clip, and views break ties on a log scale so one viral upload
// cannot bury the rest.
const score = (v: VideoMatch) => {
  const min = v.durationSeconds / 60;
  const lean = v.lean === "firsthand" ? 3000 : v.lean === "mixed" ? 1500 : 0;
  const length = min < 4 ? 0 : min <= 60 ? 150 : 80;
  return lean + (v.albumIds.length ? 200 : 0) + length + Math.log10(v.viewCount + 1) * 20;
};
const byScore = (a: VideoMatch, b: VideoMatch) => score(b) - score(a);

export interface StartItem { video: VideoMatch; why?: string }

// Up to n picks: pinned first, then by rule with at most two from one channel,
// so a page opens on several voices rather than one archive.
export function startHere(artistId: string, n = 4): StartItem[] {
  const pool = videosOf(artistId);
  const byId = new Map(pool.map((v) => [v.videoId, v]));
  const picked: StartItem[] = [];
  for (const pin of pins[artistId] ?? []) {
    const v = byId.get(pin.videoId);
    if (v && picked.length < n) picked.push({ video: v, why: pin.reason ?? v.reason });
  }
  const taken = new Set(picked.map((p) => p.video.videoId));
  const perChannel = new Map<string, number>();
  for (const p of picked) perChannel.set(p.video.channelKey, (perChannel.get(p.video.channelKey) ?? 0) + 1);
  for (const v of [...pool].sort(byScore)) {
    if (picked.length >= n) break;
    if (taken.has(v.videoId) || (perChannel.get(v.channelKey) ?? 0) >= 2) continue;
    picked.push({ video: v, why: v.reason });
    perChannel.set(v.channelKey, (perChannel.get(v.channelKey) ?? 0) + 1);
  }
  return picked;
}

export interface VideoSummary {
  total: number;
  firsthand: number;
  formats: { format: VideoFormat; count: number }[];
  albums: { albumId: string; count: number }[];
}

export function videoSummary(artistId: string): VideoSummary {
  const pool = videosOf(artistId);
  const formats = new Map<VideoFormat, number>();
  const albumsHit = new Map<string, number>();
  for (const v of pool) {
    formats.set(v.format, (formats.get(v.format) ?? 0) + 1);
    for (const a of v.albumIds) albumsHit.set(a, (albumsHit.get(a) ?? 0) + 1);
  }
  return {
    total: pool.length,
    firsthand: pool.filter((v) => v.lean === "firsthand").length,
    formats: [...formats].map(([format, count]) => ({ format, count })).sort((a, b) => b.count - a.count),
    albums: [...albumsHit].map(([albumId, count]) => ({ albumId, count })).sort((a, b) => b.count - a.count),
  };
}

// An artist's own albums, each with the videos that name it. Albums with no
// videos stay in the list so the work is always reachable from the page.
export function albumShelves(artistId: string) {
  const pool = videosOf(artistId);
  return albumsByArtist(artistId)
    .map((album) => ({ album, videos: pool.filter((v) => v.albumIds.includes(album.id)).sort(byScore) }))
    .sort((a, b) => b.videos.length - a.videos.length || a.album.year - b.album.year);
}

// --- Voices -----------------------------------------------------------------
// People who are credited on an album in the archive and are named in a video's
// title. This is deliberately modest: a name in a title means the person is
// part of what the video is about, not that they are the one speaking, so the
// section says how many videos name them and nothing more. Full names only: a
// bare first name matches far too much.

const voiceNames: { mbid: string; name: string; key: string }[] = [];
{
  const seen = new Set<string>();
  for (const [mbid, p] of creditsByPerson) {
    const key = p.name.toLowerCase();
    if (p.name.trim().split(/\s+/).length < 2 || seen.has(key)) continue;
    seen.add(key);
    voiceNames.push({ mbid, name: p.name, key });
  }
}
const normTitle = (t: string) => ` ${t.toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[^a-z0-9'. ]/g, " ").replace(/\s+/g, " ")} `;
const voiceCache = new Map<string, string[]>();
const voicesIn = (v: VideoMatch): string[] => {
  let hit = voiceCache.get(v.videoId);
  if (!hit) {
    const t = normTitle(v.title);
    hit = voiceNames.filter((n) => t.includes(` ${n.key} `)).map((n) => n.mbid);
    voiceCache.set(v.videoId, hit);
  }
  return hit;
};
// A credited person's page id: the slug when they are a curated artist.
const pageIdForMbid = (mbid: string) => seedIdForMbid.get(mbid) ?? mbid;

export interface Voice { id: string; name: string; role: string; count: number }

export function voicesFor(artistId: string): Voice[] {
  const tally = new Map<string, number>();
  for (const v of videosOf(artistId)) {
    for (const mbid of voicesIn(v)) {
      if (pageIdForMbid(mbid) === artistId) continue; // the subject is not a voice on their own page
      tally.set(mbid, (tally.get(mbid) ?? 0) + 1);
    }
  }
  return [...tally]
    .map(([mbid, count]) => {
      const credits = creditsByPerson.get(mbid)!;
      const roles = new Map<string, number>();
      for (const c of credits.credits) roles.set(c.role.split(", ")[0], (roles.get(c.role.split(", ")[0]) ?? 0) + 1);
      const role = [...roles].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
      return { id: pageIdForMbid(mbid), name: credits.name, role, count };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

// --- The full index ---------------------------------------------------------
export const PAGE_SIZE = 24;
export type SortKey = "first" | "new" | "short" | "long";
export const SORT_LABEL: Record<SortKey, string> = {
  first: "Firsthand first", new: "Newest", short: "Shortest", long: "Longest",
};

export interface IndexQuery {
  source?: SourceKey; format?: VideoFormat; length?: LengthKey;
  album?: string; voice?: string; sort?: SortKey; page?: number;
}

type Dim = "source" | "format" | "length" | "album" | "voice";
function passes(v: VideoMatch, q: IndexQuery, skip?: Dim) {
  if (skip !== "source" && q.source && sourceOf(v) !== q.source) return false;
  if (skip !== "format" && q.format && v.format !== q.format) return false;
  if (skip !== "length" && q.length && lengthOf(v) !== q.length) return false;
  if (skip !== "album" && q.album && !v.albumIds.includes(q.album)) return false;
  if (skip !== "voice" && q.voice && !voicesIn(v).some((m) => pageIdForMbid(m) === q.voice)) return false;
  return true;
}

export interface IndexRow { video: VideoMatch; albums: { id: string; title: string }[]; why?: string }

export function videoIndex(artistId: string, q: IndexQuery) {
  const pool = videosOf(artistId);
  const sort = q.sort ?? "first";
  const order: Record<SortKey, (a: VideoMatch, b: VideoMatch) => number> = {
    first: byScore,
    new: (a, b) => b.publishedAt.localeCompare(a.publishedAt),
    short: (a, b) => a.durationSeconds - b.durationSeconds,
    long: (a, b) => b.durationSeconds - a.durationSeconds,
  };
  const all = pool.filter((v) => passes(v, q)).sort(order[sort]);
  const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, q.page ?? 1), pages);

  // Each filter's counts are taken with every OTHER filter applied, so a count
  // always says how many you would get by choosing that option next.
  const countBy = <K extends string>(dim: Dim, key: (v: VideoMatch) => K[]) => {
    const m = new Map<K, number>();
    for (const v of pool) if (passes(v, q, dim)) for (const k of key(v)) m.set(k, (m.get(k) ?? 0) + 1);
    return m;
  };
  const src = countBy("source", (v) => [sourceOf(v)]);
  const fmt = countBy("format", (v) => [v.format]);
  const len = countBy("length", (v) => [lengthOf(v)]);
  const alb = countBy("album", (v) => v.albumIds);
  const allSources = pool.filter((v) => passes(v, q, "source")).length;
  const allAlbums = pool.filter((v) => passes(v, q, "album")).length;

  return {
    total: all.length,
    pages, page, sort,
    rows: all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((video): IndexRow => ({
      video,
      albums: video.albumIds.map((id) => ({ id, title: getAlbum(id)?.title ?? id })),
      why: video.reason,
    })),
    facets: {
      allSources, allAlbums,
      sources: (Object.keys(SOURCE_LABEL) as SourceKey[]).map((k) => ({ key: k, count: src.get(k) ?? 0 })).filter((x) => x.count || q.source === x.key),
      formats: FORMATS.map((k) => ({ key: k, count: fmt.get(k) ?? 0 })).filter((x) => x.count || q.format === x.key),
      lengths: (Object.keys(LENGTH_LABEL) as LengthKey[]).map((k) => ({ key: k, count: len.get(k) ?? 0 })).filter((x) => x.count || q.length === x.key),
      albums: [...alb].map(([id, count]) => ({ id, title: getAlbum(id)?.title ?? id, count })).sort((a, b) => b.count - a.count || a.title.localeCompare(b.title)),
    },
    voiceName: q.voice ? voicesFor(artistId).find((v) => v.id === q.voice)?.name : undefined,
  };
}

// Artists that have at least one video, for the index route.
export const artistIdsWithVideos = (): string[] => [...new Set(videos.flatMap((v) => v.artistIds))];

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
