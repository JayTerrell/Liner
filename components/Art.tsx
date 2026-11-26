"use client";

import { useState } from "react";

// Deterministic muted palette so generated covers look intentional, not broken.
const TINTS = ["#3E8E6A", "#2F6E52", "#8C7A4B", "#6B4F3A", "#4A5F7A", "#7A4A55", "#55633F", "#5E5F5A", "#A3593E", "#3F6A73"];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function Cover({
  title, artist, mbid, className = "", rounded = false,
}: { title: string; artist: string; mbid?: string; className?: string; rounded?: boolean }) {
  const [state, setState] = useState<"loading" | "ok" | "failed">("loading");
  const tint = TINTS[hash(title + artist) % TINTS.length];
  const qs = new URLSearchParams({ title, artist, ...(mbid ? { mbid } : {}) });

  return (
    <div className={`art ${className}`} style={{ borderRadius: 0 }}>
      <div
        className="art-fallback"
        style={{ background: `linear-gradient(160deg, ${tint}, color-mix(in srgb, ${tint} 45%, #000))` }}
        aria-hidden
      >
        <span className="art-fallback-title">{title}</span>
        <span className="art-fallback-artist">{artist}</span>
      </div>
      {state !== "failed" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/art/album?${qs}`}
          alt={`${title} by ${artist}`}
          loading="lazy"
          className="art-img"
          style={{ opacity: state === "ok" ? 1 : 0 }}
          onLoad={() => setState("ok")}
          onError={() => setState("failed")}
        />
      )}
    </div>
  );
}

export function Portrait({
  name, mbid, qid, className = "", circle = false,
}: { name: string; mbid?: string; qid?: string; className?: string; circle?: boolean }) {
  const [state, setState] = useState<"loading" | "ok" | "failed">("loading");
  const tint = TINTS[hash(name) % TINTS.length];
  const initials = name.split(/[\s.]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const qs = new URLSearchParams({ name, ...(mbid ? { mbid } : {}), ...(qid ? { qid } : {}) });

  return (
    <div className={`art ${className}`} style={{ borderRadius: circle ? "50%" : 0 }}>
      <div
        className="art-fallback portrait-fallback"
        style={{ background: `linear-gradient(170deg, ${tint}, color-mix(in srgb, ${tint} 45%, #000))` }}
        aria-hidden
      >
        <span className="portrait-initials">{initials}</span>
      </div>
      {state !== "failed" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/art/artist?${qs}`}
          alt={name}
          loading="lazy"
          className="art-img portrait-img"
          style={{ opacity: state === "ok" ? 1 : 0 }}
          onLoad={() => setState("ok")}
          onError={() => setState("failed")}
        />
      )}
    </div>
  );
}
