"use client";

import { useRef } from "react";
import type { Lane } from "@/lib/types";

// One control, not three. The genre list lives behind a native select, so it
// stays one line whether there are ten genres or two hundred, and on a phone
// it opens the system picker. Choosing a genre submits straight away: a
// filter you have to confirm is a filter that gets abandoned.
export function SearchBar({
  lanes, q = "", lane = "",
}: { lanes: Lane[]; q?: string; lane?: string }) {
  const form = useRef<HTMLFormElement>(null);

  return (
    <form ref={form} action="/search" role="search" className="searchbar">
      <select
        name="lane"
        defaultValue={lane}
        aria-label="Genre"
        className="searchbar-lane"
        onChange={() => form.current?.requestSubmit()}
      >
        <option value="">All genres</option>
        {lanes.map((l) => (
          <option key={l.id} value={l.id}>{l.label}</option>
        ))}
      </select>
      <input
        name="q"
        defaultValue={q}
        placeholder="An artist, an album, a question…"
        aria-label="Search Liner"
        className="searchbar-input"
      />
      <button className="searchbar-go" type="submit">Search</button>
    </form>
  );
}
