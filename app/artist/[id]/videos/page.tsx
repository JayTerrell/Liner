import { notFound } from "next/navigation";
import { FilterRail, Pager, SortSelect, Summary, VideoRow } from "@/components/index-ui";
import { Crumbs } from "@/components/ui";
import {
  FORMATS, PAGE_SIZE, artistIdsWithVideos, getAlbum, getArtist, videoIndex, videosOf, voicesFor,
  type IndexQuery, type LengthKey, type SortKey, type SourceKey,
} from "@/lib/data";
import type { VideoFormat } from "@/lib/types";

export function generateStaticParams() {
  return artistIdsWithVideos().map((id) => ({ id }));
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Everything the page shows comes from the address, so any view can be shared
// and survives a refresh. Anything in the address that is not a real choice is
// ignored rather than trusted.
function parse(sp: Record<string, string | string[] | undefined>, artistId: string): IndexQuery {
  const source = one(sp.source) as SourceKey | undefined;
  const format = one(sp.format) as VideoFormat | undefined;
  const length = one(sp.length) as LengthKey | undefined;
  const sort = one(sp.sort) as SortKey | undefined;
  const album = one(sp.album);
  const voice = one(sp.voice);
  const page = Number(one(sp.page));
  return {
    source: source && ["first", "second", "mixed"].includes(source) ? source : undefined,
    format: format && FORMATS.includes(format) ? format : undefined,
    length: length && ["short", "mid", "long"].includes(length) ? length : undefined,
    sort: sort && ["first", "new", "short", "long"].includes(sort) ? sort : undefined,
    album: album && getAlbum(album) ? album : undefined,
    voice: voice && voicesFor(artistId).some((v) => v.id === voice) ? voice : undefined,
    page: Number.isInteger(page) && page > 1 ? page : undefined,
  };
}

export default async function VideosPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const artist = getArtist(id);
  if (!artist || videosOf(id).length === 0) notFound();

  const q = parse(await searchParams, id);
  const r = videoIndex(id, q);
  const base = `/artist/${id}/videos`;

  return (
    <div className="page">
      <div>
        <Crumbs trail={[
          { label: "Artists", href: "/search" },
          { label: artist.name, href: `/artist/${id}` },
          { label: "All videos" },
        ]} />
        <section className="index-head">
          <h1 className="display">Everything on {artist.name}</h1>
          <SortSelect base={base} q={q} />
        </section>
        <Summary
          base={base} q={q} total={r.total}
          voiceName={r.voiceName} albumTitle={q.album ? getAlbum(q.album)?.title : undefined}
        />
        <div className="index-layout">
          <FilterRail base={base} q={q} facets={r.facets} />
          <main className="index-main">
            {r.rows.length > 0 ? (
              <div className="vrows">
                {r.rows.map((row) => <VideoRow key={row.video.videoId} row={row} />)}
              </div>
            ) : (
              <p className="empty-index">Nothing matches these filters.</p>
            )}
            <Pager base={base} q={q} page={r.page} pages={r.pages} total={r.total} pageSize={PAGE_SIZE} />
          </main>
        </div>
      </div>
    </div>
  );
}
