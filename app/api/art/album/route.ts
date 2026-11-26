import { resolveAlbumArt } from "@/lib/art-resolver";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const title = u.searchParams.get("title") ?? "";
  const artist = u.searchParams.get("artist") ?? "";
  const mbid = u.searchParams.get("mbid") ?? undefined;
  if (!title || !artist) return new Response(null, { status: 400 });

  const hit = await resolveAlbumArt({ title, artist, mbid });
  if (!hit) return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=300" } });
  return new Response(null, {
    status: 302,
    headers: { Location: hit.url, "Cache-Control": "public, max-age=86400" },
  });
}
