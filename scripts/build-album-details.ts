// Turns the output of docs/sql/album_details.sql into data/albums/details.yaml.
//
//   1. Run docs/sql/album_details.sql in a Snowflake worksheet.
//   2. Save the single PAYLOAD cell to data/albums/_payload.txt, replacing
//      each ~ with a newline.
//   3. npm run albums:build
//
// Liner cannot reach Snowflake at request time, so the site reads the built
// file. When the move to Postgres happens, this becomes a scheduled job and
// the YAML goes away.
import { promises as fs } from "fs";
import path from "path";
import { load as yamlLoad, dump as yamlDump } from "js-yaml";

const IN = process.argv[2] ?? path.join(process.cwd(), "data", "albums", "_payload.txt");
const OUT = path.join(process.cwd(), "data", "albums", "details.yaml");
const SEED = path.join(process.cwd(), "data", "seed.yaml");
const EDITORIAL = path.join(process.cwd(), "data", "albums", "editorial.yaml");

interface Track { n: number; title: string; len: string; note: string }
interface CreditRow { name: string; role: string; scope: string; mbid?: string; artistId?: string }
interface Story { tag: string; title: string; body: string }

const clock = (s: number) => (s > 0 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "—");

// MusicBrainz relationship names are lowercase and terse. Title-case them.
// "instrument" is only a fallback: a player almost always carries the actual
// instrument in ATTRIBUTES, so "Trumpet" shows rather than "Musician".
const ROLE: Record<string, string> = {
  instrument: "Musician",
  vocal: "Vocals",
  producer: "Producer",
  engineer: "Engineer",
  recording: "Recording",
  mix: "Mix",
  "liner notes": "Liner notes",
  "artists and repertoire": "A&R",
  design: "Design",
  photography: "Photography",
  arranger: "Arranger",
  composer: "Composer",
  conductor: "Conductor",
  performer: "Performer",
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const role = (r: string, instruments: string) =>
  instruments ? instruments.split(", ").map(cap).join(", ") : ROLE[r] ?? cap(r);

async function main() {
  const seed = yamlLoad(await fs.readFile(SEED, "utf8")) as {
    albums: { id: string }[]; artists: { id: string; name: string; mbid?: string }[];
  };
  // Hand-written notes and stories. Nothing here is overwritten by a rebuild.
  const editorial = (yamlLoad(await fs.readFile(EDITORIAL, "utf8")) as {
    albums: Record<string, { trackNotes?: Record<string, string>; stories?: Story[] }>;
  }).albums ?? {};
  const artistByName = new Map(seed.artists.map((a) => [a.name.toLowerCase(), a.id]));
  const artistByMbid = new Map(
    seed.artists.filter((a) => a.mbid).map((a) => [a.mbid as string, a.id]),
  );

  const tracks = new Map<string, Track[]>();
  const credits = new Map<string, CreditRow[]>();

  for (const line of (await fs.readFile(IN, "utf8")).split("\n")) {
    if (!line.trim()) continue;
    const p = line.split("|");
    if (p[0] === "T") {
      const [, album, , no, title, secs] = p;
      if (!tracks.has(album)) tracks.set(album, []);
      tracks.get(album)!.push({ n: Number(no), title, len: clock(Number(secs)), note: "" });
    } else if (p[0] === "C") {
      const [, album, mbid, name, rel, n, instruments = ""] = p;
      if (!credits.has(album)) credits.set(album, []);
      // A credit points at a curated artist page when we have one for this
      // person, by MusicBrainz ID first and by name only as a fallback.
      const seedId = artistByMbid.get(mbid) ?? artistByName.get(name.toLowerCase());
      credits.get(album)!.push({
        name, role: role(rel, instruments), scope: "", // scope filled below, once the track total is known
        ...(mbid ? { mbid } : {}),
        ...(seedId ? { artistId: seedId } : {}),
        _n: Number(n),
      } as CreditRow & { _n: number });
    }
  }

  const albums: Record<string, { tracks: Track[]; credits: CreditRow[]; stories: Story[] }> = {};
  for (const a of seed.albums) {
    const ed = editorial[a.id] ?? {};
    const t = (tracks.get(a.id) ?? [])
      .sort((x, y) => x.n - y.n)
      // A hand-written note rides along with the sourced title and timing.
      .map((tr) => ({ ...tr, note: ed.trackNotes?.[String(tr.n)] ?? "" }));
    // One person can hold several relationships on a record: MusicBrainz lists
    // Fred Plaut on Kind of Blue as both "recording" and "engineer". Merge them
    // into one line per person, and put whoever played on most of the album
    // first, so the band reads before the crew.
    const merged = new Map<string, CreditRow & { _n: number }>();
    for (const row of (credits.get(a.id) ?? []) as (CreditRow & { _n: number })[]) {
      const key = `${row.mbid ?? row.name}|${row._n}`;
      const seen = merged.get(key);
      if (seen) {
        if (!seen.role.split(", ").includes(row.role)) seen.role += `, ${row.role}`;
      } else merged.set(key, { ...row });
    }
    const c = [...merged.values()].sort((x, y) => y._n - x._n || x.name.localeCompare(y.name)).map((row) => {
      const { _n, ...rest } = row as CreditRow & { _n: number };
      // A zero count is a credit on the release as a whole, not on tracks.
      rest.scope = _n === 0 ? "Whole album" : _n >= t.length && t.length > 0 ? "All tracks" : `${_n} of ${t.length} tracks`;
      return rest;
    });
    // Stories are editorial, written by creators and historians. MusicBrainz
    // has none and never will, so they come from the overlay or not at all.
    albums[a.id] = { tracks: t, credits: c, stories: (ed.stories ?? []) as Story[] };
  }

  const doc = {
    _note:
      "Track lists and credits from LINER_DB.ANALYTICS, built by scripts/build-album-details.ts " +
      "from docs/sql/album_details.sql, with hand-written notes and stories laid over it from " +
      "data/albums/editorial.yaml. Do not edit this file: a rebuild overwrites it. Write in " +
      "editorial.yaml instead.",
    builtAt: new Date().toISOString(),
    albums,
  };
  await fs.writeFile(OUT, yamlDump(doc, { lineWidth: 100, noRefs: true }));

  const withT = Object.values(albums).filter((a) => a.tracks.length).length;
  const withC = Object.values(albums).filter((a) => a.credits.length).length;
  const allCredits = Object.values(albums).flatMap((a) => a.credits);
  const linked = allCredits.filter((c) => c.artistId).length;
  const people = new Set(allCredits.filter((c) => c.mbid).map((c) => c.mbid));
  console.log(`${Object.keys(albums).length} albums written`);
  console.log(`  ${withT} with a track list, ${Object.values(albums).reduce((n, a) => n + a.tracks.length, 0)} tracks`);
  console.log(`  ${withC} with credits, ${Object.values(albums).reduce((n, a) => n + a.credits.length, 0)} credit rows`);
  console.log(`  ${linked} credits link to a curated artist page`);
  console.log(`  ${people.size} distinct people, each with a page of their own`);
  const stories = Object.values(albums).reduce((n, a) => n + a.stories.length, 0);
  const notes = Object.values(albums).flatMap((a) => a.tracks).filter((t) => t.note).length;
  console.log(`  ${stories} stories and ${notes} track notes from the editorial overlay`);
  const bare = seed.albums.filter((a) => !albums[a.id].credits.length).map((a) => a.id);
  if (bare.length) console.log(`  no credits in MusicBrainz: ${bare.join(", ")}`);
}

main();
