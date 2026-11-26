import { PathCard } from "@/components/PathCard";
import { getPaths } from "@/lib/data";

export default function You() {
  const mine = getPaths().filter((p) => p.host === "Jay");
  const learning = getPaths().filter((p) => p.host !== "Jay").slice(0, 2);

  return (
    <div className="page">
      <section className="intro">
        <div className="mono muted">You</div>
        <h1 className="display" style={{ fontSize: "clamp(40px, 8vw, 80px)" }}>Your shelf</h1>
        <p className="body-copy">A sample shelf for now. Accounts, saved paths and notes arrive in a later pass.</p>
      </section>
      <section>
        <div className="section-label"><span>You host</span></div>
        <div className="path-grid">{mine.map((p) => <PathCard key={p.id} path={p} />)}</div>
      </section>
      <section>
        <div className="section-label"><span>You&apos;re learning in</span></div>
        <div className="path-grid">{learning.map((p) => <PathCard key={p.id} path={p} />)}</div>
      </section>
    </div>
  );
}
