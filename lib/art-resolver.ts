// Resolves real artwork from open sources:
//   albums   -> MusicBrainz release-group search -> Cover Art Archive
//   artists  -> MusicBrainz artist -> Wikidata image (P18) -> Wikimedia Commons
// Results are cached in memory and in data/art-cache.json, so each lookup is
// paid for once. MusicBrainz asks for at most 1 request/second and a real
// User-Agent, so lookups run through a single slow queue.
import { promises as fs } from "fs";
import path from "path";

const UA = "Liner/0.1 (https://github.com/JayTerrell/Liner)";
const CACHE_FILE = path.join(process.cwd(), "data", "art-cache.json");
const GAP_MS = 1100;

export interface ArtHit { url: string; mbid?: string; credit?: string; creditUrl?: string }
type Cache = Record<string, ArtHit | null>;

let cache: Cache | null = null;
let chain: Promise<unknown> = Promise.resolve();

async function load(): Promise<Cache> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(CACHE_FILE, "utf8")) as Cache;
  } catch {
    cache = {};
  }
  return cache;
}

async function persist() {
  try {
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
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

async function getJson(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

const q = (s: string) => s.replace(/"/g, '\\"');

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
          )}&fmt=json&limit=1`,
        );
        mbid = j["release-groups"]?.[0]?.id;
      }
      if (!mbid) return null;
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

export async function resolveArtistPhoto(opts: { name: string; mbid?: string }): Promise<ArtHit | null> {
  const key = `artist|${opts.name}`.toLowerCase();
  const c = await load();
  if (key in c) return c[key];

  const hit = await queued(async () => {
    try {
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
      const qid = wd?.url?.resource?.split("/").pop();
      if (!qid) return null;
      const ent = await getJson(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`);
      const file = ent.entities?.[qid]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value as string | undefined;
      if (!file) return null;
      return {
        mbid,
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
