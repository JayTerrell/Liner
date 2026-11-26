import { resolveArtistPhoto } from "@/lib/art-resolver";

export const dynamic = "force-dynamic";

// ?name=Bill+Evans            -> 302 to the portrait image
// ?name=Bill+Evans&format=json -> { url, credit, creditUrl } for attribution
export async function GET(req: Request) {
  const u = new URL(req.url);
  const name = u.searchParams.get("name") ?? "";
  const mbid = u.searchParams.get("mbid") ?? undefined;
  if (!name) return new Response(null, { status: 400 });

  const hit = await resolveArtistPhoto({ name, mbid });
  if (!hit) return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=300" } });

  if (u.searchParams.get("format") === "json") {
    return Response.json(hit, { headers: { "Cache-Control": "public, max-age=86400" } });
  }
  return new Response(null, {
    status: 302,
    headers: { Location: hit.url, "Cache-Control": "public, max-age=86400" },
  });
}
