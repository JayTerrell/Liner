// Run once with network access:  npm run art:warm
//
// In a Claude Code cloud session, outbound HTTPS goes through a local proxy
// that Node's fetch() does not read from the environment on its own, so every
// lookup fails with ENOTFOUND. There, run it as:
//   NODE_USE_ENV_PROXY=1 npm run art:warm
// On a normal machine the plain command is enough.
// Looks up every album cover and artist portrait in the seed and saves the
// results to data/art-cache.json, so pages load instantly afterwards and
// production never has to call MusicBrainz live.
import seed from "../data/seed.json";
import { resolveAlbumArt, resolveArtistPhoto } from "../lib/art-resolver";

async function main() {
  const artistName = new Map(seed.artists.map((a) => [a.id, a.name]));
  const albumMbid = new Map(seed.albums.map((a) => [a.id, (a as { mbid?: string }).mbid]));
  const seen = new Set<string>();
  let ok = 0;
  const misses: string[] = [];

  const albums: { artist: string; title: string; mbid?: string }[] = [];
  seed.albums.forEach((a) =>
    albums.push({ artist: artistName.get(a.artistId)!, title: a.title, mbid: (a as { mbid?: string }).mbid }),
  );
  // Journey items may carry their own mbid when the record is not in the
  // album list yet, and fall back to the album's when it is.
  seed.paths.forEach((p) =>
    p.items.forEach((i) => {
      const it = i as { title: string; artist: string; mbid?: string; albumId?: string };
      albums.push({ artist: it.artist, title: it.title, mbid: it.mbid ?? (it.albumId ? albumMbid.get(it.albumId) : undefined) });
    }),
  );

  for (const a of albums) {
    const k = `${a.artist}|${a.title}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const hit = await resolveAlbumArt(a);
    if (hit) ok++;
    else misses.push(`cover  ${a.artist} - ${a.title}`);
    console.log(hit ? "cover  ok  " : "cover  MISS", a.artist, "-", a.title);
  }
  for (const a of seed.artists) {
    const art = a as { name: string; mbid?: string; wikidataQid?: string };
    const hit = await resolveArtistPhoto({ name: art.name, mbid: art.mbid, qid: art.wikidataQid });
    if (hit) ok++;
    else misses.push(`photo  ${art.name}`);
    console.log(hit ? "photo  ok  " : "photo  MISS", art.name);
  }
  console.log(`\nDone. ${ok} found, ${misses.length} without art (they fall back to generated covers).`);
  if (misses.length) console.log(misses.map((m) => `  ${m}`).join("\n"));
}

main();
