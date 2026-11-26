// Resolves real artwork from open sources:
//   albums   -> MusicBrainz release-group search -> Cover Art Archive
//   artists  -> MusicBrainz artist -> Wikidata image (P18) -> Wikimedia Commons
// Results are cached in memory and in data/art-cache.json, so each lookup is
// paid for once. MusicBrainz asks for at most 1 request/second and a real
// User-Agent, so lookups run through a single slow queue.
import { promises as fs } from "fs";
import path from "path";
import { load as yamlLoad, dump as yamlDump } from "js-yaml";

const UA = "Liner/0.1 (https://github.com/JayTerrell/Liner)";
const CACHE_FILE = path.join(process.cwd(), "data", "art-cache.yaml");
const GAP_MS = 1100;

export interface ArtHit { url: string; mbid?: string; credit?: string; creditUrl?: string }
type Cache = Record<string, ArtHit | null>;

let cache: Cache | null = null;
let chain: Promise<unknown> = Promise.resolve();

async function load(): Promise<Cache> {
  if (cache) return cache;
  try {
    cache = (yamlLoad(await fs.readFile(CACHE_FILE, "utf8")) ?? {}) as Cache;
  } catch {
    cache = {};
  }
  return cache;
}

async function persist() {
  try {
    await fs.writeFile(CACHE_FILE, yamlDump(cache, { lineWidth: 160, noRefs: true }));
  } catch {
    // read-only filesystems (serverless) just keep the in-memory cache
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function queued<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(() => sleep(GAP_MS), () => sleep(GAP_MS));
  return run;
}

// MusicBrainz answers "503 the web server is currently busy" fairly often, and
// it also returns that message inside a 200 body. Either way it means "ask
// again shortly", not "no such record", so retry before giving up: an
// unretried blip used to show a permanent placeholder.
async function getJson(url: string, tries = 3) {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    if (i > 0) await sleep(GAP_MS * (i + 1));
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (res.status === 503 || res.status === 429) {
        lastErr = new Error(`${res.status} busy ${url}`);
        continue;
      }
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      const body = await res.json();
      if (body?.error && /busy|try again/i.test(String(body.error))) {
        lastErr = new Error(`busy ${url}`);
        continue;
      }
      return body;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error(`failed ${url}`);
}

const q = (s: string) => s.replace(/"/g, '\\"');

// MusicBrainz writes curly apostrophes ("Bags’ Groove") where the seed uses
// straight ones, so compare titles with both flattened.
const norm = (s: string) =>
  s.toLowerCase().replace(/[‘’ʼ`]/g, "'").replace(/\s+/g, " ").trim();

// Does Cover Art Archive actually hold a front cover for this release group?
// Without this check a release group with no art still produced an image URL,
// so the page requested a 404 on every render instead of drawing the
// generated cover straight away.
async function hasCoverArt(mbid: string): Promise<boolean> {
  try {
    const res = await fetch(`https://coverartarchive.org/release-group/${mbid}/front-500`, {
      method: "HEAD",
      redirect: "manual",
      headers: { "User-Agent": UA },
    });
    // 307 is the usual answer: a redirect to the image on archive.org.
    return res.status === 200 || res.status === 307 || res.status === 302;
  } catch {
    return false;
  }
}

// The first search hit is often a compilation or a single reissue rather than
// the record people mean (searching "Walkin'" by Miles Davis used to land on a
// 2002 compilation with no cover). Prefer an exact title match, a plain studio
// album over a compilation/single/live edition, and then the version with the
// most editions, which is reliably the canonical release group.
interface RgCandidate {
  id: string;
  title: string;
  score?: number;
  "primary-type"?: string;
  "secondary-types"?: string[];
}

function pickReleaseGroup(groups: RgCandidate[], title: string): string | undefined {
  if (!groups.length) return undefined;
  const want = norm(title);
  const rank = (g: RgCandidate) => {
    let r = 0;
    if (norm(g.title ?? "") === want) r += 8;
    if ((g["primary-type"] ?? "") === "Album") r += 4;
    if (!(g["secondary-types"] ?? []).length) r += 2;
    return r;
  };
  return [...groups].sort((a, b) => rank(b) - rank(a) || (b.score ?? 0) - (a.score ?? 0))[0]?.id;
}

export async function resolveAlbumArt(opts: { artist: string; title: string; mbid?: string }): Promise<ArtHit | null> {
  const key = `album|${opts.artist}|${opts.title}`.toLowerCase();
  const c = await load();
  if (key in c) return c[key];

  const hit = await queued(async () => {
    try {
      let mbid = opts.mbid;
      if (!mbid) {
        const j = await getJson(
          `https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(
            `releasegroup:"${q(opts.title)}" AND artist:"${q(opts.artist)}"`,
          )}&fmt=json&limit=10`,
        );
        mbid = pickReleaseGroup(j["release-groups"] ?? [], opts.title);
      }
      if (!mbid) return null;
      if (!(await hasCoverArt(mbid))) return null;
      return { mbid, url: `https://coverartarchive.org/release-group/${mbid}/front-500`, credit: "Cover Art Archive" } as ArtHit;
    } catch {
      return undefined; // transient: do not cache failures
    }
  });
  if (hit === undefined) return null;
  c[key] = hit;
  await persist();
  return hit;
}

export async function resolveArtistPhoto(
  opts: { name: string; mbid?: string; qid?: string },
): Promise<ArtHit | null> {
  const key = `artist|${opts.name}`.toLowerCase();
  const c = await load();
  if (key in c) return c[key];

  const hit = await queued(async () => {
    try {
      // A pinned Wikidata QID skips both MusicBrainz calls, which is the
      // difference between three chances to hit a rate limit and one.
      let qid = opts.qid;
      if (!qid) {
        let mbid = opts.mbid;
        if (!mbid) {
          const j = await getJson(
            `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(`artist:"${q(opts.name)}"`)}&fmt=json&limit=1`,
          );
          mbid = j.artists?.[0]?.id;
        }
        if (!mbid) return null;
        await sleep(GAP_MS);
        const rels = await getJson(`https://musicbrainz.org/ws/2/artist/${mbid}?inc=url-rels&fmt=json`);
        const wd = (rels.relations ?? []).find((r: { type: string }) => r.type === "wikidata");
        qid = wd?.url?.resource?.split("/").pop();
      }
      if (!qid) return null;
      const ent = await getJson(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`);
      const file = ent.entities?.[qid]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value as string | undefined;
      // No P18 means Wikimedia Commons holds no freely licensed portrait of
      // this person. That is a real gap, not an error: the initials card
      // stands in rather than reaching for a copyrighted press photo.
      if (!file) return null;
      return {
        mbid: opts.mbid,
        url: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=700`,
        credit: "Wikimedia Commons",
        creditUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, "_"))}`,
      } as ArtHit;
    } catch {
      return undefined;
    }
  });
  if (hit === undefined) return null;
  c[key] = hit;
  await persist();
  return hit;
}
