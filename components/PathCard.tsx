import Link from "next/link";
import type { LinerPath } from "@/lib/types";
import { pathCovers } from "@/lib/data";
import { Cover } from "./Art";

export function badgeClass(kind: LinerPath["kind"]) {
  if (kind === "guided") return "badge badge-expert";
  if (kind === "open") return "badge badge-open";
  return "badge badge-peer";
}

export function PathCard({ path, feature = false }: { path: LinerPath; feature?: boolean }) {
  const covers = pathCovers(path, 4);
  return (
    <Link href={`/journeys/${path.id}`} className={feature ? "path-card path-feature" : "path-card"}>
      <div className="path-covers">
        {covers.map((c, i) => (
          <Cover key={i} title={c.title} artist={c.artist} mbid={c.mbid} />
        ))}
      </div>
      <div className="path-body">
        <div className="row-gap">
          <span className={badgeClass(path.kind)}>{path.badge}</span>
          {path.sample && <span className="badge badge-sample">SAMPLE</span>}
        </div>
        <h3 className="display path-title">{path.title}</h3>
        <p className="muted small">{path.host} · {path.meta}</p>
      </div>
    </Link>
  );
}
