import Link from "next/link";
import { notFound } from "next/navigation";
import { AlbumShelf, type ShelfAlbum } from "@/components/AlbumShelf";
import { Cover, Portrait } from "@/components/Art";
import { badgeClass } from "@/components/PathCard";
import { Crumbs, JumpBar, LineageStrip, SectionHeader, WhereNext, type Neighbor, type NextTile } from "@/components/ui";
import { VideoCard, type CardVideo } from "@/components/VideoCard";
import { indexHref } from "@/components/index-ui";
import {
  FORMAT_LABEL, albumShelves, allArtistIds, albumsByArtist, artistOf, creditsFor, getAlbum, getArtist, getLane,
  pathsForArtist, startHere, videoSummary, voicesFor,
} from "@/lib/data";
import type { LineageRef, VideoMatch } from "@/lib/types";

// Curated artists by slug, and everyone who exists only through a credit by
// MusicBrainz ID.
export function generateStaticParams() {
  return allArtistIds().map((id) => ({ id }));
}

const card = (v: VideoMatch, why?: string): CardVideo => ({
  videoId: v.videoId, title: v.title, thumbnail: v.thumbnail, durationSeconds: v.durationSeconds,
  lean: v.lean, channelName: v.channelName, reason: why ?? v.reason,
});

// A lineage entry points at an artist page when that artist is in the archive
// and is plain text when not yet.
function neighbors(refs: LineageRef[] | undefined): Neighbor[] {
  return (refs ?? []).map((r) => {
    const a = r.id ? getArtist(r.id) : undefined;
    return { id: a?.id, name: a?.name ?? r.name ?? "", note: r.note };
  }).filter((n) => n.name);
}

export default async function ArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const artist = getArtist(id);
  if (!artist) notFound();

  const own = albumsByArtist(id);
  const summary = videoSummary(id);
  const shelves = albumShelves(id);
  const start = startHere(id, 4);
  const voices = voicesFor(id).slice(0, 12);
  const paths = pathsForArtist(id);
  // Records by other people that this artist is credited on. Their own albums
  // are already under By album, so they are not listed twice.
  const creditedRaw = creditsFor(id).filter((c) => getAlbum(c.albumId)?.artistId !== id);
  // One person can hold several roles on a record, and each shows as its own
  // credit. The page lists the record once, with every role underneath.
  const byAlbum = new Map<string, typeof creditedRaw>();
  for (const c of creditedRaw) byAlbum.set(c.albumId, [...(byAlbum.get(c.albumId) ?? []), c]);
  const credited = [...byAlbum.entries()].map(([albumId, rows]) => ({ albumId, rows }));
  const lane = artist.lanes?.[0] ? getLane(artist.lanes[0]) : undefined;
  const before = neighbors(artist.before);
  const after = neighbors(artist.after);
  const videosHref = `/artist/${id}/videos`;

  const counts = [
    { n: own.length, l: "Albums" },
    { n: credited.length, l: "Credits" },
    { n: summary.total, l: "Videos" },
    { n: summary.firsthand, l: "Firsthand" },
    { n: paths.length, l: "Journeys" },
  ].filter((c) => c.n > 0);

  const jump = [
    start.length > 0 && { id: "start", label: "Start here" },
    shelves.length > 0 && summary.total > 0 && { id: "albums", label: "By album" },
    voices.length > 0 && { id: "voices", label: "By voice" },
    summary.formats.length > 0 && { id: "formats", label: "By format" },
    paths.length > 0 && { id: "journeys", label: "Journeys" },
    credited.length > 0 && { id: "credited", label: "Credits" },
  ].filter(Boolean) as { id: string; label: string }[];

  const roleLine = [artist.years, artist.roles].filter(Boolean).join(" · ");
  const maxFormat = Math.max(1, ...summary.formats.map((f) => f.count));

  const shelfAlbums: ShelfAlbum[] = shelves.map(({ album, videos }) => ({
    id: album.id, title: album.title, year: album.year, count: videos.length,
    videos: videos.slice(0, 4).map((v) => card(v)),
    albumHref: `/album/${album.id}`,
    allHref: indexHref(videosHref, { album: album.id }),
  }));

  // Where to next: the neighbours in the lineage and the record that anchors
  // the page. A session player has no lineage, so theirs are three records.
  const tiles: NextTile[] = [];
  if (before[0]?.id) tiles.push({ kind: "Came before", name: before[0].name, why: before[0].note, href: `/artist/${before[0].id}` });
  const anchor = shelves[0]?.album;
  if (anchor) tiles.push({ kind: "Album", name: anchor.title, why: anchor.blurb, href: `/album/${anchor.id}` });
  if (after[0]?.id) tiles.push({ kind: "Came after", name: after[0].name, why: after[0].note, href: `/artist/${after[0].id}` });
  if (!tiles.length) {
    for (const c of credited.slice(0, 3)) {
      const al = getAlbum(c.albumId);
      if (al) tiles.push({ kind: "Credited on", name: al.title, why: `${artistOf(al).name}, ${al.year}`, href: `/album/${al.id}` });
    }
  }

  return (
    <div className="page">
      <div>
        <Crumbs trail={[
          { label: "Artists", href: "/search" },
          ...(lane ? [{ label: lane.label, href: `/search?lane=${lane.id}` }] : []),
          { label: artist.name },
        ]} />
        <section className="ahead" style={{ paddingTop: 22 }}>
          <div className="ahead-portrait">
            <Portrait name={artist.name} mbid={artist.mbid} qid={artist.wikidataQid} circle />
          </div>
          <div className="ahead-info">
            {roleLine && <span className="ahead-role">{roleLine}</span>}
            <h1 className="display">{artist.name}</h1>
            {counts.length > 0 && (
              <div className="counts">
                {counts.map((c) => (
                  <span key={c.l} className="count">
                    <span className="count-n">{c.n}</span>
                    <span className="count-l">{c.l}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="ahead-actions">
            <Link href="/journeys" className="btn">Start a journey</Link>
          </div>
        </section>
      </div>

      {(before.length > 0 || after.length > 0) && (
        <LineageStrip name={artist.name} before={before} after={after} />
      )}

      {(jump.length > 1 || summary.total > 0) && (
        <JumpBar
          items={jump}
          all={summary.total > 0 ? { href: videosHref, label: `All ${summary.total} videos` } : undefined}
        />
      )}

      {start.length > 0 && (
        <section id="start">
          <SectionHeader title="Start here" />
          <div className="start">
            <div className="start-feature">
              <VideoCard v={card(start[0].video, start[0].why)} variant="feature" />
            </div>
            {start.length > 1 && (
              <div className="start-side">
                {start.slice(1).map((s) => <VideoCard key={s.video.videoId} v={card(s.video, s.why)} variant="compact" />)}
              </div>
            )}
          </div>
        </section>
      )}

      {shelves.length > 0 && summary.total > 0 && (
        <section id="albums">
          <SectionHeader title="By album" />
          <AlbumShelf albums={shelfAlbums} />
        </section>
      )}

      {voices.length > 0 && (
        <section id="voices">
          <SectionHeader title="By voice" />
          <div className="voices">
            {voices.map((v) => {
              const curated = getArtist(v.id)?.fromCredits !== true;
              const initials = v.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
              return (
                <Link key={v.id} href={indexHref(videosHref, { voice: v.id })} className="voice-tile">
                  <span className="ring-s">
                    {curated ? (
                      <Portrait name={v.name} mbid={getArtist(v.id)?.mbid} qid={getArtist(v.id)?.wikidataQid} circle />
                    ) : (
                      <span className="art" style={{ borderRadius: "50%", display: "grid", placeItems: "center" }}>
                        <span className="mono">{initials}</span>
                      </span>
                    )}
                  </span>
                  <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                    <span className="voice-name">{v.name}</span>
                    <span className="mono muted" style={{ fontSize: 10 }}>{v.count} {v.count === 1 ? "video" : "videos"}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {summary.formats.length > 0 && (
        <section id="formats">
          <SectionHeader title="By format" />
          <div className="rule-list">
            {summary.formats.map((f) => (
              <Link key={f.format} href={indexHref(videosHref, { format: f.format })} className="rule-row">
                <span className="rule-name">{FORMAT_LABEL[f.format]}</span>
                <span className="rule-bar"><span style={{ width: `${Math.round((f.count / maxFormat) * 100)}%` }} /></span>
                <span className="rule-n">{f.count} {f.count === 1 ? "video" : "videos"}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {paths.length > 0 && (
        <section id="journeys">
          <SectionHeader title={`Journeys through ${artist.name}`} />
          <div className="rule-list">
            {paths.map((p) => (
              <Link key={p.id} href={`/journeys/${p.id}`} className="rule-row">
                <span className="rule-text">
                  <span className="rule-title">{p.title}</span>
                  <span className="muted small">{p.host} · {p.meta}</span>
                </span>
                <span className={badgeClass(p.kind)}>{p.badge}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {credited.length > 0 && (
        <section id="credited">
          <SectionHeader title="Credits" />
          <div className="credit-list">
            {credited.map((c) => {
              const al = getAlbum(c.albumId);
              if (!al) return null;
              return (
                <Link key={c.albumId} href={`/album/${al.id}`} className="res">
                  <Cover title={al.title} artist={artistOf(al).name} mbid={al.mbid} />
                  <div className="stack" style={{ gap: 3 }}>
                    <span className="row-title">{al.title}</span>
                    <span className="muted small">{artistOf(al).name} · {al.year}</span>
                    {c.rows.map((r, i) => <span key={i} className="muted small">{r.role} · {r.scope}</span>)}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <WhereNext tiles={tiles} />
    </div>
  );
}
