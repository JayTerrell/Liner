import Link from "next/link";

const EXPLORE = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Search the archive" },
  { href: "/journeys", label: "Paths" },
  { href: "/you", label: "Your shelf" },
];

const START = [
  { href: "/journeys/miles-davis-journey", label: "The Miles Davis Journey" },
  { href: "/artist/a-tribe-called-quest", label: "A Tribe Called Quest" },
  { href: "/album/kind-of-blue", label: "Kind of Blue" },
];

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-inner">
        <div className="footer-about">
          <Link href="/" className="wordmark">LINER</Link>
          <p className="footer-blurb">
            Liner is a home for people who want to learn music by listening deeply. Build a path through an
            artist or an era, invite others to listen along, and hear the records differently together.
          </p>
        </div>
        <nav className="footer-col" aria-label="Explore Liner">
          <span className="mono muted">Explore</span>
          {EXPLORE.map((l) => (
            <Link key={l.href} href={l.href}>{l.label}</Link>
          ))}
        </nav>
        <nav className="footer-col" aria-label="Start somewhere">
          <span className="mono muted">Start somewhere</span>
          {START.map((l) => (
            <Link key={l.href} href={l.href}>{l.label}</Link>
          ))}
        </nav>
      </div>
      <div className="wrap">
        <p className="footer-base mono muted">Build a path · Invite people · Hear music differently together</p>
      </div>
    </footer>
  );
}
