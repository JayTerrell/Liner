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

  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "tab on" : "tab"} onClick={() => setTab(t)}>
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
        credits.length ? credits.map((c, i) => {
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
              <span className="mono" style={{ color: "var(--green-light)", fontSize: 10 }}>{c.artistId ? "VIEW →" : ""}</span>
            </>
          );
          return c.artistId ? (
            <Link key={i} href={`/artist/${c.artistId}`} className="credit">{inner}</Link>
          ) : (
            <div key={i} className="credit">{inner}</div>
          );
        }) : <p className="empty">Credits arrive with Discogs and MusicBrainz data.</p>
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
