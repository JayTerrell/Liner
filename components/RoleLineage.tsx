"use client";

import { useState } from "react";
import type { RoleLineage as Lineage } from "@/lib/types";
import { LineageStrip } from "./ui";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const label = (l: Lineage) => `${cap(l.chair)} with ${l.leader}`;

// Who held this person's chair before and after them, under the bandleader they
// worked with most. A person who worked with several bandleaders gets one
// select to switch between them, so the strip stays one strip.
export function RoleLineage({ name, entries }: { name: string; entries: Lineage[] }) {
  const [i, setI] = useState(0);
  const cur = entries[i];
  if (!cur) return null;
  const year = (n: { name: string; id?: string; from: number }) => ({ id: n.id, name: n.name, meta: String(n.from) });

  const heading =
    entries.length > 1 ? (
      <select aria-label="Chair and bandleader" className="selectbox on" value={i} onChange={(e) => setI(Number(e.target.value))}>
        {entries.map((e, k) => <option key={k} value={k}>{label(e)}</option>)}
      </select>
    ) : (
      <span className="lineage-title">{label(cur)}</span>
    );

  return (
    <LineageStrip
      name={name} heading={heading} hereMeta={String(cur.from)}
      before={cur.before.map(year)} after={cur.after.map(year)}
    />
  );
}
