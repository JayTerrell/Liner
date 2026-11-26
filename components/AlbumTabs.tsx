"use client";

import Link from "next/link";
import { useState } from "react";
import { Portrait } from "./Art";
import { Voices } from "./Voices";
import type { Channel, CreditRow, Story, Track, VideoMatch } from "@/lib/types";

type Tab = "tracks" | "credits" | "stories" | "voices";

export function AlbumTabs({
  tracks, credits, stories, channels, videos, subject, artistNames,
}: {
  tracks: Track[]; credits: CreditRow[]; stories: Story[]; channels: Channel[]; videos: VideoMatch[]; subject: string;
  artistNames: Record<string, string>;
}) {
  const [tab, setTab] = useState<Tab>("tracks");
  const tabs: Tab[] = ["tracks", "credits", "stories", "voices"];

  // Credits are never truncated: an album can carry ninety people, and being
  // ninetieth is no reason to be left out. They page instead.
  const PER_PAGE = 15;
  const [page, setPage] = useState(0);
  const pages = Math.ceil(credits.length / PER_PAGE);
  const pageOf = credits.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "tab on" : "tab"} onClick={() => { setTab(t); setPage(0); }}>
            {t}
          </button>
        ))}
      </div>

      {tab === "tracks" && (
        tracks.length ? tracks.map((t) => (
          <div key={t.n} className="track">
            <span className="mono muted" style={{ paddingTop: 5 }}>{t.n}</span>
            <div className="stack" style={{ gap: 4 }}>
              <span className="display-md" style={{ fontSize: 22 }}>{t.title}</span>
              <span className="muted small">{t.note}</span>
            </div>
            <span className="mono muted" style={{ paddingTop: 5 }}>{t.len}</span>
          </div>
        )) : <p className="empty">Track list arrives with MusicBrainz data.</p>
      )}

      {tab === "credits" && (
        credits.length ? (
          <>
            {pageOf.map((c, i) => {
              // Everyone credited has a page: a curated artist by slug, anyone
              // else by their MusicBrainz ID.
              const href = c.artistId ? `/artist/${c.artistId}` : c.mbid ? `/artist/${c.mbid}` : undefined;
              const inner = (
                <>
                  {c.artistId ? (
                    <Portrait name={artistNames[c.artistId] ?? c.name} circle />
                  ) : (
                    <div className="art" style={{ borderRadius: "50%", display: "grid", placeItems: "center" }}>
                      <span className="mono">{c.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>
                    </div>
                  )}
                  <div className="stack" style={{ gap: 2 }}>
                    <span style={{ fontWeight: 600, fontSize: 16 }}>{c.name}</span>
                    <span className="muted small">{c.role} · {c.scope}</span>
                  </div>
                  <span className="mono" style={{ color: "var(--green-light)", fontSize: 10 }}>{href ? "VIEW →" : ""}</span>
                </>
              );
              return href ? (
                <Link key={`${c.mbid ?? c.name}-${i}`} href={href} className="credit">{inner}</Link>
              ) : (
                <div key={`${c.name}-${i}`} className="credit">{inner}</div>
              );
            })}
            {pages > 1 && (
              <nav className="pager" aria-label="Credits pages">
                <button
                  type="button" className="pager-step" disabled={page === 0}
                  onClick={() => setPage((n) => Math.max(0, n - 1))}
                >←</button>
                {Array.from({ length: pages }, (_, n) => (
                  <button
                    key={n} type="button"
                    className={n === page ? "pager-num on" : "pager-num"}
                    aria-current={n === page ? "true" : undefined}
                    onClick={() => setPage(n)}
                  >{n + 1}</button>
                ))}
                <button
                  type="button" className="pager-step" disabled={page === pages - 1}
                  onClick={() => setPage((n) => Math.min(pages - 1, n + 1))}
                >→</button>
              </nav>
            )}
          </>
        ) : <p className="empty">Credits arrive with Discogs and MusicBrainz data.</p>
      )}

      {tab === "stories" && (
        stories.length ? (
          <div className="stack" style={{ gap: 12, paddingTop: 12 }}>
            {stories.map((s, i) => (
              <div key={i} className="card">
                <span className="mono" style={{ color: "var(--green-light)", fontSize: 10 }}>{s.tag}</span>
                <span className="display-md" style={{ fontSize: 22 }}>{s.title}</span>
                <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--body)" }}>{s.body}</p>
              </div>
            ))}
          </div>
        ) : <p className="empty">Stories come from creators and historians once their content is pulled in.</p>
      )}

      {tab === "voices" && (
        <div style={{ paddingTop: 12 }}>
          <Voices videos={videos} channels={channels} subject={subject} />
        </div>
      )}
    </div>
  );
}
