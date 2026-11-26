import Link from "next/link";
import { Cover, Portrait } from "@/components/Art";
import { badgeClass } from "@/components/PathCard";
import { artistOf, getLane, lanes, search } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: { searchParams: Promise<{ q?: string; lane?: string }> }) {
  const { q = "", lane } = await searchParams;
  const res = search(q, lane);
  const total = res.artists.length + res.albums.length + res.paths.length;
  const laneLabel = lane ? getLane(lane)?.label : undefined;

  return (
    <div className="page">
      <section className="intro">
        <div className="mono muted">Search</div>
        <h1 className="display" style={{ fontSize: "clamp(40px, 8vw, 80px)" }}>
          {laneLabel ? laneLabel : q ? `“${q}”` : "Start anywhere"}
        </h1>
        <form action="/search" className="hero-search" role="search">
          {lane && <input type="hidden" name="lane" value={lane} />}
          <input name="q" defaultValue={q} placeholder="An artist, an album, a sound, a question…" aria-label="Search Liner" />
          <button className="btn" type="submit">Search</button>
        </form>
        <div className="chips">
          <Link href={q ? `/search?q=${encodeURIComponent(q)}` : "/search"} className={lane ? "chip" : "chip on"}>All</Link>
          {lanes.map((l) => (
            <Link key={l.id} href={`/search?${q ? `q=${encodeURIComponent(q)}&` : ""}lane=${l.id}`} className={lane === l.id ? "chip on" : "chip"}>
              {l.label}
            </Link>
          ))}
        </div>
        <div className="mono muted">{total} results</div>
      </section>

      {total === 0 && <p className="empty">Nothing in the archive yet for that. It grows as sources are pulled in.</p>}

      {res.paths.length > 0 && (
        <section className="results-group">
          <div className="section-label"><span>Paths</span></div>
          {res.paths.map((p) => (
            <Link key={p.id} href={`/journeys/${p.id}`} className="res">
              <Cover title={p.items[0].title} artist={p.items[0].artist} />
              <div className="stack" style={{ gap: 4 }}>
                <div className="row-gap"><span className={badgeClass(p.kind)}>{p.badge}</span></div>
                <span className="row-title">{p.title}</span>
                <span className="muted small">{p.host} · {p.meta}</span>
              </div>
            </Link>
          ))}
        </section>
      )}

      {res.artists.length > 0 && (
        <section className="results-group">
          <div className="section-label"><span>Artists &amp; musicians</span></div>
          {res.artists.map((a) => (
            <Link key={a.id} href={`/artist/${a.id}`} className="res">
              <Portrait name={a.name} mbid={a.mbid} qid={a.wikidataQid} circle />
              <div className="stack" style={{ gap: 3 }}>
                <span className="row-title">{a.name}</span>
                <span className="muted small">{a.roles} · {a.years}</span>
              </div>
            </Link>
          ))}
        </section>
      )}

      {res.albums.length > 0 && (
        <section className="results-group">
          <div className="section-label"><span>Albums</span></div>
          {res.albums.map((al) => {
            const ar = artistOf(al);
            return (
              <Link key={al.id} href={`/album/${al.id}`} className="res">
                <Cover title={al.title} artist={ar.name} mbid={al.mbid} />
                <div className="stack" style={{ gap: 3 }}>
                  <span className="row-title">{al.title}</span>
                  <span className="muted small">{ar.name} · {al.year}</span>
                </div>
              </Link>
            );
          })}
        </section>
      )}
    </div>
  );
}
