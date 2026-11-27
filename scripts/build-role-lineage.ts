// Turns the output of docs/sql/role_lineage.sql into data/lineage/roles.yaml.
//
//   1. Run docs/sql/role_lineage.sql in a Snowflake worksheet.
//   2. Save the single PAYLOAD cell to data/lineage/_payload.txt, replacing each
//      ~ with a newline.
//   3. npm run lineage:build
//
// For each person with a page, the file holds up to three bandleaders they
// worked with most, and for each one who held the same chair (bass, drums,
// tenor saxophone, engineer, producer) before and after them, oldest first.
// Liner cannot reach Snowflake at request time, so the site reads this file.
import { promises as fs } from "fs";
import path from "path";
import { dump as yamlDump } from "js-yaml";

const IN = process.argv[2] ?? path.join(process.cwd(), "data", "lineage", "_payload.txt");
const OUT = path.join(process.cwd(), "data", "lineage", "roles.yaml");

interface Neighbor { mbid: string; name: string; from: number; albums: number }
interface Stint {
  leader: string; chair: string; albums: number; from: number;
  before: Neighbor[]; after: Neighbor[];
}

async function main() {
  // A name can contain the ~ that separates records, so a piece that does not
  // start like a record belongs to the one before it.
  const lines: string[] = [];
  for (const raw of (await fs.readFile(IN, "utf8")).split("\n")) {
    if (!raw) continue;
    if (/^[SBA]\|/.test(raw) || !lines.length) lines.push(raw);
    else lines[lines.length - 1] += `~${raw}`;
  }

  const stints = new Map<string, Stint & { mbid: string }>();
  const key = (mbid: string, leader: string, chair: string) => `${mbid}|${leader}|${chair}`;
  const ranked = new Map<string, { rank: number; n: Neighbor }[]>();

  for (const line of lines) {
    const p = line.split("|");
    if (p[0] === "S") {
      const [, mbid, leader, chair, albums, from] = p;
      stints.set(key(mbid, leader, chair), { mbid, leader, chair, albums: Number(albums), from: Number(from), before: [], after: [] });
    } else {
      const [side, mbid, leader, chair, rank, nbMbid, nbName, nbFrom, , nbAlbums] = p;
      const k = `${side}${key(mbid, leader, chair)}`;
      const list = ranked.get(k) ?? [];
      list.push({ rank: Number(rank), n: { mbid: nbMbid, name: nbName, from: Number(nbFrom), albums: Number(nbAlbums) } });
      ranked.set(k, list);
    }
  }

  const people: Record<string, Omit<Stint, never>[]> = {};
  for (const [k, s] of stints) {
    // Rank 1 is the nearest to the person in time. Before reads oldest first,
    // so it is reversed; after already runs forward.
    s.before = (ranked.get(`B${k}`) ?? []).sort((a, b) => b.rank - a.rank).map((x) => x.n);
    s.after = (ranked.get(`A${k}`) ?? []).sort((a, b) => a.rank - b.rank).map((x) => x.n);
    // A chair nobody else ever held under this leader is no lineage.
    if (!s.before.length && !s.after.length) continue;
    const { mbid, ...rest } = s;
    (people[mbid] ??= []).push(rest);
  }
  for (const list of Object.values(people)) list.sort((a, b) => b.albums - a.albums || a.leader.localeCompare(b.leader));

  await fs.writeFile(OUT, yamlDump({
    _note:
      "Who held the same chair before and after each person, under the same bandleader, by the year " +
      "of their first studio album with that leader. Built by scripts/build-role-lineage.ts from " +
      "docs/sql/role_lineage.sql. Not edited by hand. Years are release years, so an archival " +
      "release of old sessions can place someone later than they played.",
    builtAt: new Date().toISOString(),
    people,
  }, { lineWidth: 120, noRefs: true }));

  const all = Object.values(people).flat();
  const chairs = new Map<string, number>();
  for (const s of all) chairs.set(s.chair, (chairs.get(s.chair) ?? 0) + 1);
  console.log(`${Object.keys(people).length} people, ${all.length} lineages`);
  console.log(`  both sides: ${all.filter((s) => s.before.length && s.after.length).length}, only before: ${all.filter((s) => s.before.length && !s.after.length).length}, only after: ${all.filter((s) => !s.before.length && s.after.length).length}`);
  console.log(`  chairs: ${[...chairs].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c, n]) => `${c} ${n}`).join(", ")}`);
}

main();
