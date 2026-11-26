import Link from "next/link";

const TABS = [
  { href: "/", label: "Home", icon: "◉" },
  { href: "/search", label: "Search", icon: "⌕" },
  { href: "/journeys", label: "Paths", icon: "≡" },
  { href: "/you", label: "You", icon: "●" },
];

export function Nav() {
  return (
    <>
      <header className="topbar">
        <div className="wrap topbar-inner">
          <Link href="/" className="wordmark">LINER</Link>
          <nav className="topnav" aria-label="Main">
            {TABS.map((t) => (
              <Link key={t.href} href={t.href}>{t.label}</Link>
            ))}
          </nav>
          <form action="/search" className="topsearch" role="search">
            <input name="q" placeholder="Start anywhere: an artist, album, era…" aria-label="Search" />
          </form>
        </div>
      </header>
      <nav className="tabbar" aria-label="Main">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href}>
            <span className="tab-icon">{t.icon}</span>
            <span>{t.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
