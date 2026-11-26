import Link from "next/link";
import { notFound } from "next/navigation";
import { Cover, Portrait } from "@/components/Art";
import { PathCard } from "@/components/PathCard";
import { Voices } from "@/components/Voices";
import {
  albumsByArtist, channelsForLanes, getArtist, getArtists, getLane, pathsForArtist,
} from "@/lib/data";
import type { LineageRef } from "@/lib/types";

export function generateStaticParams() {
  return getArtists().map((a) => ({ id: a.id }));
}

function Ref({ r }: { r: LineageRef }) {
  const a = r.id ? getArtist(r.id) : undefined;
  const name = a?.name ?? r.name ?? "";
  const body = (
    <>
      <span className="thread-name">{name}</span>
      {r.note && <span className="muted small">{r.note}</span>}
    </>
  );
  return a ? (
    <Link href={`/artist/${a.id}`} className="thread-item">{body}</Link>
  ) : (
    <div className="thread-item">{body}</div>
  );
}

export default async function ArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const artist = getArtist(id);
  if (!artist) notFound();

  const albums = albumsByArtist(id);
  const paths = pathsForArtist(id);
  const voices = channelsForLanes(artist.lanes, 4);

  return (
    <div className="page">
      <div>
        <Link href="/search" className="back">‹ BACK TO SEARCH</Link>
        <div className="head">
          <Portrait name={artist.name} mbid={artist.mbid} className="ratio-45" />
          <div className="head-info">
            <div className="row-gap">
              {artist.lanes.map((l) => (
                <Link key={l} href={`/search?lane=${l}`} className="badge badge-peer">{getLane(l)?.label ?? l}</Link>
              ))}
            </div>
            <h1 className="display">{artist.name}</h1>
            <div className="mono muted">{artist.roles} · {artist.years}</div>
            <p className="body-copy">{artist.bio}</p>
          </div>
        </div>
      </div>

      <section>
        <div className="section-label"><span>The thread · before → work → after</span></div>
        <div className="thread">
          <div className="thread-col">
            <div className="thread-head"><span>BEFORE</span><span>←</span></div>
            {artist.before.length ? artist.before.map((r, i) => <Ref key={i} r={r} />) : <p className="thread-empty">Roots and influences arrive as the archive grows.</p>}
          </div>
          <div className="thread-col thread-work">
            <div className="thread-head"><span>THE WORK</span><span>{albums.length} IN ARCHIVE</span></div>
            {albums.length ? (
              <div className="work-grid">
                {albums.map((al) => (
                  <Link key={al.id} href={`/album/${al.id}`} className="cover-tile">
                    <Cover title={al.title} artist={artist.name} mbid={al.mbid} />
                    <span className="tile-title" style={{ fontSize: 15 }}>{al.title}</span>
                    <span className="muted small">{al.year}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="thread-empty">No albums in the archive yet. They arrive with MusicBrainz and Discogs data.</p>
            )}
          </div>
          <div className="thread-col">
            <div className="thread-head"><span>AFTER</span><span>→</span></div>
            {artist.after.length ? artist.after.map((r, i) => <Ref key={i} r={r} />) : <p className="thread-empty">Who this music reached next arrives as the archive grows.</p>}
          </div>
        </div>
      </section>

      {paths.length > 0 && (
        <section>
          <div className="section-label"><span>In these paths</span></div>
          <div className="path-grid">{paths.map((p) => <PathCard key={p.id} path={p} />)}</div>
        </section>
      )}

      <section>
        <div className="section-label"><span>Voices on {artist.name}</span><span>Sample slots</span></div>
        <Voices channels={voices} subject={artist.name} />
      </section>
    </div>
  );
}
