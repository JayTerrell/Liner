// Run once with network access:  npm run art:warm
// Looks up every album cover and artist portrait in the seed and saves the
// results to data/art-cache.json, so pages load instantly afterwards.
import seed from "../data/seed.json";
import { resolveAlbumArt, resolveArtistPhoto } from "../lib/art-resolver";

async function main() {
  const artistName = new Map(seed.artists.map((a) => [a.id, a.name]));
  const seen = new Set<string>();
  let ok = 0;
  let miss = 0;

  const albums: { artist: string; title: string }[] = [];
  seed.albums.forEach((a) => albums.push({ artist: artistName.get(a.artistId)!, title: a.title }));
  seed.paths.forEach((p) => p.items.forEach((i) => albums.push({ artist: i.artist, title: i.title })));

  for (const a of albums) {
    const k = `${a.artist}|${a.title}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const hit = await resolveAlbumArt(a);
    hit ? ok++ : miss++;
    console.log(hit ? "cover  ok  " : "cover  MISS", a.artist, "-", a.title);
  }
  for (const a of seed.artists) {
    const hit = await resolveArtistPhoto({ name: a.name });
    hit ? ok++ : miss++;
    console.log(hit ? "photo  ok  " : "photo  MISS", a.name);
  }
  console.log(`\nDone. ${ok} found, ${miss} without art (they fall back to generated covers).`);
}

main();
