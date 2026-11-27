import Link from "next/link";
import type { Lean } from "@/lib/types";

// Small pieces every screen of the redesign shares. They hold no data and make
// no decisions: a screen passes in what to show.

export function runtime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m} min`;
}

const TAG: Record<Lean, { cls: string; label: string }> = {
  firsthand: { cls: "badge badge-first", label: "Firsthand" },
  secondhand: { cls: "badge badge-second", label: "Secondhand" },
  mixed: { cls: "badge badge-mixed", label: "Mixed" },
};

// Firsthand carries the green plate and secondhand the grey one, everywhere.
export function Tag({ lean }: { lean: Lean }) {
  const t = TAG[lean];
  return <span className={t.cls}>{t.label}</span>;
}

// A section's title on the left and, when there is more behind it, a link to
// the rest on the right. The link always says how much more.
export function SectionHeader({
  title, href, link,
}: { title: string; href?: string; link?: string }) {
  return (
    <div className="sec-head">
      <h2 className="sec-title">{title}</h2>
      {href && link && <Link href={href} className="sec-link">{link} →</Link>}
    </div>
  );
}

export function Crumbs({ trail }: { trail: { label: string; href?: string }[] }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {trail.map((t, i) => (
        <span key={i}>
          {i > 0 && " / "}
          {t.href ? <Link href={t.href}>{t.label}</Link> : t.label}
        </span>
      ))}
    </nav>
  );
}

// Anchors to the sections that exist on this page, and one link to everything.
export function JumpBar({
  items, all,
}: { items: { id: string; label: string }[]; all?: { href: string; label: string } }) {
  return (
    <nav className="jump" aria-label="On this page">
      {items.map((i) => <a key={i.id} href={`#${i.id}`} className="jump-item">{i.label}</a>)}
      {all && <Link href={all.href} className="jump-all">{all.label} →</Link>}
    </nav>
  );
}

export interface Neighbor { id?: string; name: string; note?: string }

// Who came before, where you are, who came after. Always the same three parts.
export function LineageStrip({
  name, before, after,
}: { name: string; before: Neighbor[]; after: Neighbor[] }) {
  const chips = (list: Neighbor[]) =>
    list.map((n, i) =>
      n.id ? (
        <Link key={i} href={`/artist/${n.id}`} className="chip-link">{n.name}</Link>
      ) : (
        <span key={i} className="chip-link chip-plain">{n.name}</span>
      ),
    );
  return (
    <section className="lineage" aria-label="Lineage">
      <div className="lineage-side">
        <span className="mono muted">Came before</span>
        <div className="row-gap">{chips(before)}</div>
      </div>
      <span className="lineage-arrow" aria-hidden>→</span>
      <div className="lineage-here">
        <span className="mono lineage-you">You are here</span>
        <span className="lineage-name">{name}</span>
      </div>
      <span className="lineage-arrow" aria-hidden>→</span>
      <div className="lineage-side">
        <span className="mono muted">Came after</span>
        <div className="row-gap">{chips(after)}</div>
      </div>
    </section>
  );
}

export interface NextTile { kind: string; name: string; why?: string; href: string }

// The end of every artist and album page: three places to go from here.
export function WhereNext({ tiles }: { tiles: NextTile[] }) {
  if (!tiles.length) return null;
  return (
    <section className="next-row" aria-label="Where to next">
      <div className="mono next-label">Where to next</div>
      <div className="next-tiles">
        {tiles.map((t) => (
          <Link key={t.href + t.kind} href={t.href} className="next-tile">
            <span className="mono muted">{t.kind}</span>
            <span className="next-name">{t.name}</span>
            {t.why && <span className="muted small">{t.why}</span>}
          </Link>
        ))}
      </div>
    </section>
  );
}
