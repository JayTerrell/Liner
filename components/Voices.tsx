import type { Channel } from "@/lib/types";

const LEAN: Record<Channel["lean"], { label: string; cls: string }> = {
  firsthand: { label: "FIRSTHAND", cls: "badge badge-first" },
  secondhand: { label: "SECONDHAND", cls: "badge badge-second" },
  mixed: { label: "MIXED", cls: "badge badge-mixed" },
};

// Placeholder slots showing where ingested videos and interviews will appear.
// Each links to a YouTube search until real items are tagged and stored.
export function Voices({ channels, subject }: { channels: Channel[]; subject: string }) {
  if (!channels.length) return <p className="thread-empty">Videos and interviews arrive with the YouTube ingest.</p>;
  return (
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
            <span className="badge badge-sample">SAMPLE</span>
          </div>
          <span className="display-md" style={{ fontSize: 22 }}>{c.name}</span>
          <span className="muted small">{c.type} · search YouTube for {subject} →</span>
        </a>
      ))}
    </div>
  );
}
