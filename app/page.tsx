import Link from "next/link";
import { Cover, Portrait } from "@/components/Art";
import { PathCard } from "@/components/PathCard";
import { getAlbum, getArtist, getPath, getPaths, lanes, sampleNote, artistOf } from "@/lib/data";

const PEOPLE = [
  "miles-davis", "prince", "stevie-wonder", "fela-kuti", "j-dilla",
  "erykah-badu", "selena", "john-coltrane", "a-tribe-called-quest", "aretha-franklin",
];
const SHELF = [
  "kind-of-blue", "low-end-theory", "innervisions", "zombie", "voodoo", "amor-prohibido",
  "a-love-supreme", "whats-going-on", "aquemini", "purple-rain", "amazing-grace", "donuts",
];

export default function Home() {
  const featured = getPath("miles-davis-journey")!;
  const rest = getPaths().filter((p) => p.id !== featured.id);

  return (
    <div className="page">
      <section className="intro">
        <div className="mono muted">Build a path · invite people · hear music differently together</div>
        <h1 className="display">
          Start anywhere.<br />
          <em>Follow the thread.</em>
        </h1>
        <form action="/search" className="hero-search" role="search">
          <input name="q" placeholder="An artist, an album, a sound, a question…" aria-label="Search Liner" />
          <button className="btn" type="submit">Search</button>
        </form>
        <div className="picker">
          <span className="picker-label">Or start with a genre</span>
          <div className="chips">
            {lanes.map((l) => (
              <Link key={l.id} href={`/search?lane=${l.id}`} className="chip">{l.label}</Link>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="section-label"><span>Featured path</span><Link href="/journeys" className="link">All paths →</Link></div>
        <PathCard path={featured} feature />
      </section>

      <section>
        <div className="section-label"><span>Paths on Liner</span><span>Brass = expert-led · Emerald = peer-led · Steel = open</span></div>
        <div className="path-grid">
          {rest.map((p) => <PathCard key={p.id} path={p} />)}
        </div>
      </section>

      <section>
        <div className="section-label"><span>Meet the artists</span></div>
        <div className="people-row">
          {PEOPLE.map((id) => {
            const a = getArtist(id)!;
            return (
              <Link key={id} href={`/artist/${id}`} className="person">
                <span className="ring"><Portrait name={a.name} mbid={a.mbid} qid={a.wikidataQid} circle /></span>
                <span className="person-name">{a.name}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <div className="section-label"><span>From the archive</span><Link href="/search" className="link">Browse all →</Link></div>
        <div className="cover-grid">
          {SHELF.map((id) => {
            const al = getAlbum(id)!;
            const ar = artistOf(al);
            return (
              <Link key={id} href={`/album/${id}`} className="cover-tile">
                <Cover title={al.title} artist={ar.name} mbid={al.mbid} />
                <span className="tile-title">{al.title}</span>
                <span className="muted small">{ar.name} · {al.year}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <div className="cta-box">
          <div className="mono" style={{ color: "var(--green-light)" }}>Start a journey</div>
          <h2 className="display">You don&apos;t need to be an expert.</h2>
          <p className="body-copy">What do you want to learn through listening? Pick an artist, an era, a producer. Bring people along.</p>
          <div><Link href="/journeys" className="btn">Build a path →</Link></div>
        </div>
      </section>

      <p className="note-foot">Sample data for design. Hosts marked SAMPLE are placeholders. {sampleNote}</p>
    </div>
  );
}
