import Link from "next/link";
import { notFound } from "next/navigation";
import { AlbumTabs } from "@/components/AlbumTabs";
import { Cover } from "@/components/Art";
import { PathCard } from "@/components/PathCard";
import {
  artistOf, channelsForLanes, detailFor, getAlbum, getAlbums, getArtists, neighbors, pathsForAlbum, videosForAlbum,
} from "@/lib/data";

export function generateStaticParams() {
  return getAlbums().map((a) => ({ id: a.id }));
}

export default async function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const album = getAlbum(id);
  if (!album) notFound();

  const artist = artistOf(album);
  const detail = detailFor(id);
  const { prev, next } = neighbors(album);
  const paths = pathsForAlbum(id);
  const artistNames = Object.fromEntries(getArtists().map((a) => [a.id, a.name]));

  return (
    <div className="page">
      <div>
        <Link href={`/artist/${artist.id}`} className="back">‹ {artist.name.toUpperCase()}</Link>
        <div className="head">
          <Cover title={album.title} artist={artist.name} mbid={album.mbid} />
          <div className="head-info">
            <div className="mono muted">Album · {album.year}</div>
            <h1 className="display">{album.title}</h1>
            <Link href={`/artist/${artist.id}`} className="link" style={{ fontSize: 20, fontWeight: 600 }}>{artist.name}</Link>
            {album.blurb && <p className="body-copy">{album.blurb}</p>}
          </div>
        </div>
      </div>

      <AlbumTabs
        tracks={detail.tracks}
        credits={detail.credits}
        stories={detail.stories}
        channels={channelsForLanes(artist.lanes ?? [], 4)}
        videos={videosForAlbum(album, 6)}
        subject={`${artist.name} ${album.title}`}
        artistNames={artistNames}
      />

      {(prev || next) && (
        <section>
          <div className="section-label"><span>Follow the thread · {artist.name}</span></div>
          <div className="card-grid">
            {prev ? (
              <Link href={`/album/${prev.id}`} className="voice">
                <span className="mono muted">← Before · {prev.year}</span>
                <span className="display-md" style={{ fontSize: 22 }}>{prev.title}</span>
              </Link>
            ) : <div />}
            {next ? (
              <Link href={`/album/${next.id}`} className="voice">
                <span className="mono muted">After · {next.year} →</span>
                <span className="display-md" style={{ fontSize: 22 }}>{next.title}</span>
              </Link>
            ) : <div />}
          </div>
        </section>
      )}

      {paths.length > 0 && (
        <section>
          <div className="section-label"><span>In these paths</span></div>
          <div className="path-grid">{paths.map((p) => <PathCard key={p.id} path={p} />)}</div>
        </section>
      )}
    </div>
  );
}
