import { PathCard } from "@/components/PathCard";
import { getPaths } from "@/lib/data";

export default function Journeys() {
  const paths = getPaths();
  const groups = [
    { label: "Expert-led courses", items: paths.filter((p) => p.kind === "guided") },
    { label: "Curated clubs", items: paths.filter((p) => p.kind === "club") },
    { label: "Learning journeys", items: paths.filter((p) => p.kind === "journey") },
    { label: "Open listening rooms", items: paths.filter((p) => p.kind === "open") },
  ].filter((g) => g.items.length);

  return (
    <div className="page">
      <section className="intro">
        <div className="mono muted">Paths</div>
        <h1 className="display" style={{ fontSize: "clamp(40px, 8vw, 80px)" }}>Two ways to lead.<br />One place to listen.</h1>
        <p className="body-copy">Experts teach what they know. Enthusiasts learn out loud. Every path carries a clear badge, so you know what you are joining.</p>
      </section>
      {groups.map((g) => (
        <section key={g.label}>
          <div className="section-label"><span>{g.label}</span></div>
          <div className="path-grid">
            {g.items.map((p) => <PathCard key={p.id} path={p} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
