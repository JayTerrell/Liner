import type { Channel, Lean, VideoMatch } from "@/lib/types";

const LEAN: Record<Lean, { label: string; cls: string }> = {
  firsthand: { label: "FIRSTHAND", cls: "badge badge-first" },
  secondhand: { label: "SECONDHAND", cls: "badge badge-second" },
  mixed: { label: "MIXED", cls: "badge badge-mixed" },
};

function runtime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m} min`;
}

// Real ingested videos. The lean badge comes from the channel the video was
// published on, so it says how close the speaker is to the music, which is the
// distinction Liner is built around.
export function Voices({
  videos, channels, subject,
}: { videos: VideoMatch[]; channels: Channel[]; subject: string }) {
  if (videos.length) {
    return (
      <div className="card-grid voice-grid">
        {videos.map((v) => (
          <a
            key={v.videoId}
            className="voice voice-video"
            href={`https://www.youtube.com/watch?v=${v.videoId}`}
            target="_blank"
            rel="noreferrer"
          >
            {v.thumbnail && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.thumbnail} alt="" aria-hidden className="voice-thumb" loading="lazy" />
            )}
            <div className="row-gap">
              <span className={LEAN[v.lean].cls}>{LEAN[v.lean].label}</span>
              <span className="muted small">{runtime(v.durationSeconds)}</span>
            </div>
            <span className="voice-title">{v.title}</span>
            <span className="muted small">{v.channelName} →</span>
          </a>
        ))}
      </div>
    );
  }

  // Nothing ingested yet for this subject. Say so plainly and point at the
  // channels whose lanes cover it, rather than pretending there is content.
  if (!channels.length) {
    return <p className="thread-empty">No ingested video mentions {subject} yet.</p>;
  }
  return (
    <>
      <p className="thread-empty">
        No ingested video names {subject} yet. These channels cover the same ground:
      </p>
      <div className="card-grid">
        {channels.map((c) => (
          <a
            key={c.id}
            className="voice"
            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${subject} ${c.name}`)}`}
            target="_blank"
            rel="noreferrer"
          >
            <div className="row-gap">
              <span className={LEAN[c.lean].cls}>{LEAN[c.lean].label}</span>
              <span className="badge badge-sample">NOT INGESTED</span>
            </div>
            <span className="display-md" style={{ fontSize: 22 }}>{c.name}</span>
            <span className="muted small">{c.type} · search YouTube →</span>
          </a>
        ))}
      </div>
    </>
  );
}
