// Matches the videos in data/youtube/videos.json to the artists and albums in
// data/seed.json, and writes data/youtube/matches.json.
//
//   npm run yt:match
//
// This is the free rules pass that the project brief puts first, before any
// model is asked to judge anything. It is deliberately strict: a video with no
// confident match is dropped rather than guessed at, because a video filed
// under the wrong artist is worse for Liner than no video at all.
import { promises as fs } from "fs";
import path from "path";
import seed from "../data/seed.json";

const VIDEOS = path.join(process.cwd(), "data", "youtube", "videos.json");
const CHANNELS = path.join(process.cwd(), "data", "youtube", "channels.json");
const OUT = path.join(process.cwd(), "data", "youtube", "matches.json");

// Anything shorter than this is a Short or a teaser, not a piece of content.
const MIN_SECONDS = 90;

// Extra ways people write an artist's name. Only forms specific enough to
// stand alone. Bare first names are deliberately absent: "Aretha" matched a
// Soul Train dancer called Aretha Jackson, and "Stevie" matched a Tejano
// presenter called Stevie D.
const ALIASES: Record<string, string[]> = {
  "miles-davis": ["Miles Davis"],
  "john-coltrane": ["Coltrane"],
  "thelonious-monk": ["Thelonious Monk"],
  "charles-mingus": ["Mingus"],
  "herbie-hancock": ["Herbie Hancock"],
  "ornette-coleman": ["Ornette"],
  "art-blakey": ["Art Blakey"],
  "sly-stone": ["Sly and the Family Stone", "Sly & the Family Stone", "Sly Stone"],
  "parliament": ["Parliament-Funkadelic", "Parliament Funkadelic", "P-Funk"],
  "stevie-wonder": ["Stevie Wonder"],
  "marvin-gaye": ["Marvin Gaye"],
  "curtis-mayfield": ["Curtis Mayfield"],
  "michael-jackson": ["Michael Jackson"],
  "d-angelo": ["D'Angelo", "D’Angelo", "DAngelo"],
  "erykah-badu": ["Erykah Badu"],
  "robert-glasper": ["Robert Glasper", "Glasper"],
  "snoh-aalegra": ["Snoh Aalegra"],
  "a-tribe-called-quest": ["A Tribe Called Quest", "Tribe Called Quest", "ATCQ"],
  "j-dilla": ["J Dilla", "J-Dilla", "Jay Dee", "Dilla"],
  "9th-wonder": ["9th Wonder"],
  "public-enemy": ["Public Enemy"],
  "fela-kuti": ["Fela Kuti", "Fela"],
  "tito-puente": ["Tito Puente"],
  "buena-vista-social-club": ["Buena Vista Social Club"],
  "aretha-franklin": ["Aretha Franklin"],
};

// Phrases that look like an artist but are not. Checked before matching, and
// the matched span is blanked out so it cannot trigger.
const DECOYS = [
  "Selena Gomez", "Fresh Prince", "Prince Harry", "Prince William", "Princess",
  "Prince George", "Prince Edward", "The Artist Formerly", "Prince Charles",
  "Houston Rockets", "Monk Mode", "Mingus Big Band Tribute",
];

// Phrases that disqualify one particular artist. A one-word stage name is a
// magnet for other people's names: "Prince" alone matched Prince Paul, Arabian
// Prince, a gospel choir called G.B. Prince and a track titled "Prince of the
// Scene". Add to this list whenever a review turns up a wrong match.
const REJECT: Record<string, string[]> = {
  prince: ["prince paul", "arabian prince", "prince choir", "prince of the", "prince of darkness"],
  parliament: ["houses of parliament", "member of parliament", "parliament square"],
  selena: ["selena gomez"],
  "fela-kuti": ["wena fela"],
};

// Album titles too generic to stand on their own: they only count when the
// album's artist is matched in the same video.
const WEAK_TITLES = new Set([
  "live!", "dig", "milestones", "feels", "voodoo", "zombie", "donuts", "1999",
  "thriller", "control", "touch", "gold", "home", "trane", "soul", "funk",
]);

const norm = (s: string) =>
  s.toLowerCase()
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ");

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A whole-word match that tolerates punctuation around the phrase.
function mentions(haystack: string, needle: string) {
  return new RegExp(`(^|[^a-z0-9'])${escape(norm(needle))}([^a-z0-9']|$)`, "i").test(haystack);
}

interface Match {
  videoId: string; channelKey: string; channelName: string; title: string; publishedAt: string;
  durationSeconds: number; viewCount: number; thumbnail: string;
  artistIds: string[]; albumIds: string[]; lean: string; lanes: string[];
  matchedOn: "title" | "description"; confidence: "strong" | "weak";
}

async function main() {
  const videos = JSON.parse(await fs.readFile(VIDEOS, "utf8")).videos as Array<{
    videoId: string; channelKey: string; title: string; description: string;
    publishedAt: string; durationSeconds: number; viewCount: number; thumbnail: string;
  }>;
  const channels = JSON.parse(await fs.readFile(CHANNELS, "utf8")).channels as Array<{
    id: string; name: string; lanes: string[]; lean: string;
  }>;
  const chan = new Map(channels.map((c) => [c.id, c]));

  const artists = seed.artists.map((a) => ({
    id: a.id, names: ALIASES[a.id] ?? [a.name], lanes: a.lanes as string[],
  }));
  const albums = seed.albums.map((a) => ({ id: a.id, title: a.title, artistId: a.artistId }));

  const matches: Match[] = [];
  let tooShort = 0, noMatch = 0;
  const perArtist = new Map<string, number>();

  for (const v of videos) {
    if (v.durationSeconds < MIN_SECONDS) { tooShort++; continue; }

    let title = norm(v.title);
    let desc = norm(v.description);
    for (const d of DECOYS) {
      const re = new RegExp(escape(norm(d)), "gi");
      title = title.replace(re, " ");
      desc = desc.replace(re, " ");
    }

    // Title only. Matching on the description was tried and abandoned: channel
    // boilerplate and passing name-drops filed "How to listen to Jamiroquai"
    // under Stevie Wonder and an RZA interview under Prince. A description
    // mention says the artist was named, not that the video is about them.
    const hit = artists.filter(
      (a) =>
        a.names.some((n) => mentions(title, n)) &&
        !(REJECT[a.id] ?? []).some((bad) => title.includes(norm(bad))),
    );
    if (!hit.length) { noMatch++; continue; }
    const inTitle = hit;

    const hitIds = new Set(hit.map((a) => a.id));
    const hay = inTitle.length ? title : `${title} ${desc}`;
    const albumIds = albums
      .filter((al) => mentions(hay, al.title))
      .filter((al) => !WEAK_TITLES.has(al.title.toLowerCase()) || hitIds.has(al.artistId))
      .map((al) => al.id);

    const c = chan.get(v.channelKey);
    const lanes = [...new Set([...(c?.lanes ?? []), ...hit.flatMap((a) => a.lanes)])];
    matches.push({
      videoId: v.videoId, channelKey: v.channelKey, channelName: c?.name ?? v.channelKey, title: v.title,
      publishedAt: v.publishedAt, durationSeconds: v.durationSeconds,
      viewCount: v.viewCount, thumbnail: v.thumbnail,
      artistIds: [...hitIds], albumIds, lean: c?.lean ?? "mixed", lanes,
      matchedOn: inTitle.length ? "title" : "description",
      confidence: inTitle.length ? "strong" : "weak",
    });
    for (const id of hitIds) perArtist.set(id, (perArtist.get(id) ?? 0) + 1);
  }

  await fs.writeFile(OUT, JSON.stringify({
    _note: "Videos matched to Liner artists and albums by scripts/youtube-match.ts. Rules only, no model judgement.",
    builtAt: new Date().toISOString(),
    matches,
  }, null, 2) + "\n");

  const strong = matches.filter((m) => m.confidence === "strong").length;
  console.log(`${videos.length} videos in`);
  console.log(`  ${tooShort} dropped: under ${MIN_SECONDS}s (Shorts and teasers)`);
  console.log(`  ${noMatch} dropped: no Liner artist named in the title`);
  console.log(`  ${matches.length} matched  (${strong} by title, ${matches.length - strong} by description only)`);
  console.log(`  ${matches.filter((m) => m.albumIds.length).length} also name a Liner album`);
  console.log(`\nartists covered: ${perArtist.size} of ${seed.artists.length}`);
  for (const [id, n] of [...perArtist].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${id}`);
  }
  const bare = seed.artists.filter((a) => !perArtist.has(a.id)).map((a) => a.name);
  if (bare.length) console.log(`\nno videos at all: ${bare.join(", ")}`);
}

main();
