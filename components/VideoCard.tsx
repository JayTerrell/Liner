import type { Lean } from "@/lib/types";
import { Tag, runtime } from "./ui";

// Only what a card draws, so a server page can hand a card to a client
// component without dragging the whole data layer along.
export interface CardVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  durationSeconds: number;
  lean: Lean;
  channelName: string;
  reason?: string;
}

const watch = (id: string) => `https://www.youtube.com/watch?v=${id}`;
// The stored thumbnail is 320 wide, fine for a shelf and soft on the large
// start-here card, which gets YouTube's 480 wide one instead.
const big = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

// A card never shows more than one tag row, one title, one source line and
// one reason line. The reason lives in the tag row so the card stays that short.
export function VideoCard({
  v, variant = "shelf",
}: { v: CardVideo; variant?: "feature" | "compact" | "shelf" }) {
  const meta = (
    <div className="vmeta">
      <Tag lean={v.lean} />
      <span className="mono muted">{runtime(v.durationSeconds)}</span>
      {v.reason && variant !== "compact" && <span className="mono vwhy">{v.reason}</span>}
    </div>
  );

  if (variant === "compact") {
    return (
      <a href={watch(v.videoId)} target="_blank" rel="noreferrer" className="vcard vcard-compact">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={v.thumbnail} alt="" loading="lazy" className="vthumb vthumb-side" />
        <div className="vbody">
          {v.reason && <span className="mono vwhy">{v.reason}</span>}
          <span className="vtitle">{v.title}</span>
          <div className="vmeta">
            <Tag lean={v.lean} />
            <span className="mono muted">{runtime(v.durationSeconds)}</span>
          </div>
        </div>
      </a>
    );
  }

  return (
    <a
      href={watch(v.videoId)} target="_blank" rel="noreferrer"
      className={variant === "feature" ? "vcard vcard-feature" : "vcard"}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={variant === "feature" ? big(v.videoId) : v.thumbnail}
        alt="" loading="lazy" className="vthumb"
      />
      <div className="vbody">
        {meta}
        <span className="vtitle">{v.title}</span>
        <span className="muted small">{v.channelName}</span>
      </div>
    </a>
  );
}
