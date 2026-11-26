// Pulls video metadata for the channels in data/youtube/channels.json and
// writes data/youtube/videos.json.
//
//   npm run yt:ingest              pull the channels that have no videos yet
//   npm run yt:ingest -- --all     re-pull every channel
//
// The key is read from YOUTUBE_API_KEY, or sent by the agent proxy as an
// x-goog-api-key header, in which case set YOUTUBE_API_KEY=proxy.
// In a Claude Code cloud session prefix the command with NODE_USE_ENV_PROXY=1,
// as scripts/warm-art.ts explains.
//
// Quota: the free tier allows 10,000 units a day. Resolving a channel by name
// costs 100 (search.list); everything after that costs 1 per 50 videos. So the
// first run of 19 channels costs about 2,000 units and later runs about 60,
// because resolved channel IDs are written back to channels.json and reused.
import { promises as fs } from "fs";
import path from "path";

const API = "https://www.googleapis.com/youtube/v3";
const KEY = process.env.YOUTUBE_API_KEY ?? "";
const PER_CHANNEL = Number(process.env.YT_PER_CHANNEL ?? 50);
const CHANNELS_FILE = path.join(process.cwd(), "data", "youtube", "channels.json");
const VIDEOS_FILE = path.join(process.cwd(), "data", "youtube", "videos.json");

export interface SeedChannel {
  id: string; name: string; query: string; lanes: string[];
  type: string; lean: "firsthand" | "secondhand" | "mixed"; notes?: string;
  channelId?: string;        // filled on first run and committed
  resolvedTitle?: string;    // the real YouTube title, to check the match by eye
  uploadsPlaylist?: string;
}

export interface RawVideo {
  videoId: string; channelId: string; channelKey: string;
  title: string; description: string; publishedAt: string;
  durationSeconds: number; viewCount: number; thumbnail: string;
}

let units = 0;

async function api(resource: string, params: Record<string, string>, cost: number) {
  units += cost;
  const qs = new URLSearchParams(params);
  // Send the key as a query parameter when we hold one. When the proxy injects
  // an x-goog-api-key header instead, we must not also send a bogus key param.
  const headers: Record<string, string> = { Accept: "application/json" };
  if (KEY && KEY !== "proxy") qs.set("key", KEY);
  const res = await fetch(`${API}/${resource}?${qs}`, { headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = body?.error?.errors?.[0]?.reason ?? body?.error?.message ?? res.status;
    throw new Error(`${resource} failed: ${reason}`);
  }
  return body;
}

// 100 units. Only ever run once per channel; the result is committed.
async function resolveChannel(c: SeedChannel) {
  const j = await api("search", { part: "snippet", q: c.query, type: "channel", maxResults: "1" }, 100);
  const hit = j.items?.[0];
  if (!hit) return null;
  return { channelId: hit.snippet.channelId as string, title: hit.snippet.channelTitle as string };
}

async function uploadsPlaylist(channelId: string) {
  const j = await api("channels", { part: "contentDetails", id: channelId }, 1);
  return j.items?.[0]?.contentDetails?.relatedPlaylists?.uploads as string | undefined;
}

async function recentVideoIds(playlistId: string, want: number) {
  const ids: string[] = [];
  let pageToken = "";
  while (ids.length < want) {
    const p: Record<string, string> = {
      part: "contentDetails", playlistId,
      maxResults: String(Math.min(50, want - ids.length)),
    };
    if (pageToken) p.pageToken = pageToken;
    const j = await api("playlistItems", p, 1);
    for (const it of j.items ?? []) ids.push(it.contentDetails.videoId);
    pageToken = j.nextPageToken ?? "";
    if (!pageToken) break;
  }
  return ids;
}

// ISO 8601 "PT1H2M10S" -> seconds.
function seconds(iso: string) {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso ?? "");
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

async function videoDetails(ids: string[], c: SeedChannel): Promise<RawVideo[]> {
  const out: RawVideo[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const j = await api("videos", { part: "snippet,contentDetails,statistics", id: ids.slice(i, i + 50).join(",") }, 1);
    for (const v of j.items ?? []) {
      const t = v.snippet.thumbnails ?? {};
      out.push({
        videoId: v.id,
        channelId: v.snippet.channelId,
        channelKey: c.id,
        title: v.snippet.title,
        description: (v.snippet.description ?? "").slice(0, 1500),
        publishedAt: v.snippet.publishedAt,
        durationSeconds: seconds(v.contentDetails?.duration),
        viewCount: Number(v.statistics?.viewCount ?? 0),
        thumbnail: (t.medium ?? t.high ?? t.default)?.url ?? "",
      });
    }
  }
  return out;
}

async function main() {
  if (!KEY) {
    console.error("No YOUTUBE_API_KEY set. Export the key, or set YOUTUBE_API_KEY=proxy when the proxy injects it.");
    process.exit(1);
  }
  const all = process.argv.includes("--all");
  const seed = JSON.parse(await fs.readFile(CHANNELS_FILE, "utf8")) as { _note: string; channels: SeedChannel[] };
  let existing: RawVideo[] = [];
  try { existing = JSON.parse(await fs.readFile(VIDEOS_FILE, "utf8")).videos ?? []; } catch { /* first run */ }
  const done = new Set(existing.map((v) => v.channelKey));

  const kept: RawVideo[] = all ? [] : existing;
  for (const c of seed.channels) {
    if (!all && done.has(c.id)) { console.log(`skip   ${c.name} (already pulled)`); continue; }
    try {
      if (!c.channelId) {
        const r = await resolveChannel(c);
        if (!r) { console.log(`MISS   ${c.name} — no channel matched "${c.query}"`); continue; }
        c.channelId = r.channelId;
        c.resolvedTitle = r.title;
        console.log(`found  ${c.name} -> "${r.title}" (${r.channelId})`);
      }
      if (!c.uploadsPlaylist) c.uploadsPlaylist = await uploadsPlaylist(c.channelId);
      if (!c.uploadsPlaylist) { console.log(`MISS   ${c.name} — no uploads playlist`); continue; }
      const ids = await recentVideoIds(c.uploadsPlaylist, PER_CHANNEL);
      const vids = await videoDetails(ids, c);
      kept.push(...vids);
      console.log(`ok     ${c.name} — ${vids.length} videos`);
    } catch (e) {
      console.log(`ERROR  ${c.name} — ${(e as Error).message}`);
    }
  }

  // Write resolved IDs back so the 100-unit search never runs twice.
  await fs.writeFile(CHANNELS_FILE, JSON.stringify(seed, null, 2) + "\n");
  await fs.writeFile(VIDEOS_FILE, JSON.stringify({
    _note: "Raw YouTube metadata pulled by scripts/youtube-ingest.ts. Not edited by hand.",
    pulledAt: new Date().toISOString(),
    videos: kept,
  }, null, 2) + "\n");
  console.log(`\n${kept.length} videos from ${new Set(kept.map((v) => v.channelKey)).size} channels. ~${units} quota units used.`);
}

main();
