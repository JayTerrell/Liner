import Link from "next/link";
import { notFound } from "next/navigation";
import { Cover, Portrait } from "@/components/Art";
import { PathCard } from "@/components/PathCard";
import { Voices } from "@/components/Voices";
import {
  albumsByArtist, allArtistIds, artistOf, channelsForLanes, creditsFor, getAlbum, getArtist, getLane,
  pathsForArtist, videosForArtist,
} from "@/lib/data";
import type { LineageRef } from "@/lib/types";

// Curated artists by slug, and everyone who exists only through a credit by
// MusicBrainz ID.
export function generateStaticParams() {
  return allArtistIds().map((id) => ({ id }));
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
  const lanes = artist.lanes ?? [];
  const voices = channelsForLanes(lanes, 4);
  const clips = videosForArtist(artist.id, 6);
  const credits = creditsFor(artist.id);
  // The thread is a curated judgement about influence. Nobody has written one
  // for a session player, so their page leaves the section out rather than
  // showing three empty columns.
  const hasThread = Boolean(artist.bio || artist.before?.length || artist.after?.length || albums.length);

  return (
    <div className="page">
      <div>
        <Link href="/search" className="back">‹ BACK TO SEARCH</Link>
        <div className="head">
          <Portrait name={artist.name} mbid={artist.mbid} qid={artist.wikidataQid} className="ratio-45" />
          <div className="head-info">
            {lanes.length > 0 && (
              <div className="row-gap">
                {lanes.map((l) => (
                  <Link key={l} href={`/search?lane=${l}`} className="badge badge-peer">{getLane(l)?.label ?? l}</Link>
                ))}
              </div>
            )}
            <h1 className="display">{artist.name}</h1>
            {(artist.roles || artist.years) && (
              <div className="mono muted">{[artist.roles, artist.years].filter(Boolean).join(" · ")}</div>
            )}
            {artist.bio && <p className="body-copy">{artist.bio}</p>}
          </div>
        </div>
      </div>

      {hasThread && (
      <section>
        <div className="section-label"><span>The thread · before → work → after</span></div>
        <div className="thread">
          <div className="thread-col">
            <div className="thread-head"><span>BEFORE</span><span>←</span></div>
            {artist.before?.length ? artist.before.map((r, i) => <Ref key={i} r={r} />) : <p className="thread-empty">Roots and influences arrive as the archive grows.</p>}
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
            {artist.after?.length ? artist.after.map((r, i) => <Ref key={i} r={r} />) : <p className="thread-empty">Who this music reached next arrives as the archive grows.</p>}
          </div>
        </div>
      </section>
      )}

      {credits.length > 0 && (
        <section>
          <div className="section-label"><span>Credited on</span></div>
          <div className="credit-list">
            {credits.map((c, i) => {
              const al = getAlbum(c.albumId);
              if (!al) return null;
              return (
                <Link key={`${c.albumId}-${i}`} href={`/album/${al.id}`} className="res">
                  <Cover title={al.title} artist={artistOf(al).name} mbid={al.mbid} />
                  <div className="stack" style={{ gap: 3 }}>
                    <span className="row-title">{al.title}</span>
                    <span className="muted small">{artistOf(al).name} · {al.year}</span>
                    <span className="muted small">{c.role} · {c.scope}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {paths.length > 0 && (
        <section>
          <div className="section-label"><span>In these paths</span></div>
          <div className="path-grid">{paths.map((p) => <PathCard key={p.id} path={p} />)}</div>
        </section>
      )}

      {(clips.length > 0 || voices.length > 0) && (
        <section>
          <div className="section-label"><span>Voices on {artist.name}</span></div>
          <Voices videos={clips} channels={voices} subject={artist.name} />
        </section>
      )}
    </div>
  );
}
