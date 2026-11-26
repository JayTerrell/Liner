import Link from "next/link";
import { notFound } from "next/navigation";
import { Cover } from "@/components/Art";
import { badgeClass } from "@/components/PathCard";
import { getAlbum, getPath, getPaths } from "@/lib/data";

export function generateStaticParams() {
  return getPaths().map((p) => ({ id: p.id }));
}

export default async function PathPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const path = getPath(id);
  if (!path) notFound();

  const total = path.items.length;
  const pct = Math.round((path.done / total) * 100);
  const next = path.items[path.done];
  const first = path.items[0]?.year;
  const last = path.items[total - 1]?.year;

  return (
    <div className="page">
      <div className="j-head">
        <Link href="/journeys" className="back" style={{ padding: "14px 0 0" }}>‹ ALL PATHS</Link>
        <div className="row-gap">
          <span className={badgeClass(path.kind)}>{path.badge}</span>
          {path.sample && <span className="badge badge-sample">SAMPLE</span>}
        </div>
        <h1 className="display">{path.title}</h1>
        <div style={{ fontSize: 16 }}><b style={{ fontWeight: 600 }}>{path.host}</b></div>
        <p className="body-copy">{path.blurb}</p>
        <div className="mono muted" style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{total} albums · {path.done} done · {path.cadence}</span>
          <span>{path.along} along</span>
        </div>
        <div className="progress"><div style={{ width: `${pct}%` }} /></div>
        <div className="row-gap">
          {["Follow", "Save", "Start alongside", "Fork"].map((a) => (
            <span key={a} className="chip" title="Arrives with accounts" style={{ opacity: 0.6 }}>{a}</span>
          ))}
        </div>
      </div>

      {next && (
        <div className="next-box">
          <div className="mono" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Next · {path.done + 1} / {total}</span><span>{path.cadence}</span>
          </div>
          <div className="next-grid">
            <h2 className="display">{next.title}</h2>
            <Cover title={next.title} artist={next.artist} mbid={next.mbid ?? (next.albumId ? getAlbum(next.albumId)?.mbid : undefined)} />
          </div>
          <div className="mono">{next.artist} · {next.year}</div>
          {path.whyNext && (
            <div className="next-rule">
              <span className="mono">Why I chose this next</span>
              <p style={{ fontSize: 16, lineHeight: 1.45 }}>{path.whyNext}</p>
            </div>
          )}
          {path.listenFor && (
            <div className="stack" style={{ gap: 6 }}>
              <span className="mono">What I&apos;m listening for</span>
              {path.listenFor.map((l, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "22px 1fr", fontSize: 15 }}>
                  <span className="mono">{i + 1}</span><span>{l}</span>
                </div>
              ))}
            </div>
          )}
          {path.kind === "journey" && (
            <div style={{ color: "#173d2c", fontWeight: 600, fontSize: 14 }}>
              I&apos;m still learning. Bring questions, observations and recommendations.
            </div>
          )}
        </div>
      )}

      <section>
        <div className="section-label"><span>The path</span><span>{first} → {last}</span></div>
        {path.items.map((it, i) => {
          const done = i < path.done;
          const isNext = i === path.done;
          const content = (
            <>
              <span className="row-num" style={{ color: isNext ? "var(--ink)" : done ? "#5e5f5a" : "var(--paper)" }}>{String(i + 1).padStart(2, "0")}</span>
              <Cover title={it.title} artist={it.artist} mbid={it.mbid ?? (it.albumId ? getAlbum(it.albumId)?.mbid : undefined)} />
              <div className="stack" style={{ gap: 2, minWidth: 0 }}>
                <span className="row-title">{it.title}</span>
                <span className="muted small">{it.artist} · {it.year}</span>
              </div>
              <span className="row-status" style={{ color: isNext ? undefined : done ? "var(--muted)" : "var(--body)" }}>
                {done ? "listened" : isNext ? "next" : "upcoming"}
              </span>
            </>
          );
          const cls = isNext ? "row-link row-next" : "row-link";
          return it.albumId ? (
            <Link key={i} href={`/album/${it.albumId}`} className={cls}>{content}</Link>
          ) : (
            <div key={i} className={cls}>{content}</div>
          );
        })}
      </section>

      {path.forks && (
        <section>
          <div className="section-label"><span>Forks + branches · {path.forks.length}</span></div>
          {path.forks.map((f, i) => (
            <div key={i} className="fork">
              <span style={{ color: "var(--green-light)", fontFamily: "IBM Plex Mono, monospace", fontSize: 15 }}>{f.glyph}</span>
              <div className="stack" style={{ gap: 3 }}>
                <span className="display-md" style={{ fontSize: 18 }}>{f.title}</span>
                <span className="muted small">{f.by} · {f.change}</span>
              </div>
              <span className="mono muted" style={{ fontSize: 10 }}>{f.n}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
