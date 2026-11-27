"use client";

import Link from "next/link";
import { useState } from "react";
import { VideoCard, type CardVideo } from "./VideoCard";

export interface ShelfAlbum {
  id: string;
  title: string;
  year: number;
  count: number;
  videos: CardVideo[];
  albumHref: string;
  allHref: string;
}

const SHELF = 4;   // cards on a shelf
const TABS = 5;    // albums that get a tab; the rest sit behind one select

// One shelf at a time. Tabs for the five albums with the most videos, a select
// for the others, and a shelf that never holds more than four cards however
// many videos an album has: the rest is behind "See all".
export function AlbumShelf({ albums }: { albums: ShelfAlbum[] }) {
  const [sel, setSel] = useState(0);
  const cur = albums[sel];
  if (!cur) return null;
  const tabbed = albums.slice(0, TABS);
  const more = albums.slice(TABS);

  return (
    <div className="album-shelf">
      <div className="atabs" role="tablist" aria-label="Albums">
        {tabbed.map((a, i) => (
          <button
            key={a.id} type="button" role="tab" aria-selected={i === sel}
            className={i === sel ? "atab on" : "atab"} onClick={() => setSel(i)}
          >
            <span className="atab-name">{a.title}</span>
            <span className="mono">{a.count}</span>
          </button>
        ))}
        {more.length > 0 && (
          <select
            aria-label={`${more.length} more albums`}
            className={sel >= TABS ? "selectbox on" : "selectbox"}
            value={sel >= TABS ? String(sel) : ""}
            onChange={(e) => e.target.value && setSel(Number(e.target.value))}
          >
            <option value="">{`+${more.length} more albums`}</option>
            {more.map((a, i) => (
              <option key={a.id} value={String(TABS + i)}>{`${a.title} (${a.count})`}</option>
            ))}
          </select>
        )}
      </div>

      {cur.videos.length > 0 && (
        <div className="shelf-grid">
          {cur.videos.slice(0, SHELF).map((v) => <VideoCard key={v.videoId} v={v} />)}
        </div>
      )}

      <div className="shelf-actions">
        {cur.count > SHELF && (
          <Link href={cur.allHref} className="btn btn-line">{`See all ${cur.count} on ${cur.title}`}</Link>
        )}
        <Link href={cur.albumHref} className="sec-link">{`${cur.title}, ${cur.year}`} →</Link>
      </div>
    </div>
  );
}
