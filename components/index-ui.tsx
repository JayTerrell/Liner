import Link from "next/link";
import {
  FORMAT_LABEL, LENGTH_LABEL, SOURCE_LABEL, SORT_LABEL, type IndexQuery, type IndexRow, type LengthKey,
  type SortKey, type SourceKey,
} from "@/lib/data";
import type { VideoFormat } from "@/lib/types";
import { LinkSelect } from "./LinkSelect";
import { Tag, runtime } from "./ui";

// The full index lives at one address and keeps every choice in the query
// string, so a filtered view can be shared and survives a refresh.
export function indexHref(base: string, q: IndexQuery) {
  const p = new URLSearchParams();
  if (q.source) p.set("source", q.source);
  if (q.format) p.set("format", q.format);
  if (q.length) p.set("length", q.length);
  if (q.album) p.set("album", q.album);
  if (q.voice) p.set("voice", q.voice);
  if (q.sort && q.sort !== "first") p.set("sort", q.sort);
  if (q.page && q.page > 1) p.set("page", String(q.page));
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}

// Changing a filter always goes back to the first page of the new results.
const change = (q: IndexQuery, patch: Partial<IndexQuery>): IndexQuery => ({ ...q, ...patch, page: undefined });

interface Facets {
  allSources: number;
  allAlbums: number;
  sources: { key: SourceKey; count: number }[];
  formats: { key: VideoFormat; count: number }[];
  lengths: { key: LengthKey; count: number }[];
  albums: { id: string; title: string; count: number }[];
}

function Option({ href, on, label, n }: { href: string; on: boolean; label: string; n: number }) {
  return (
    <Link href={href} className={on ? "rail-opt on" : "rail-opt"} aria-current={on ? "true" : undefined} scroll={false}>
      <span className="rail-opt-name">{label}</span>
      <span className="mono">{n}</span>
    </Link>
  );
}

const ALBUMS_SHOWN = 5;

export function FilterRail({ base, q, facets }: { base: string; q: IndexQuery; facets: Facets }) {
  const sum = (xs: { count: number }[]) => xs.reduce((n, x) => n + x.count, 0);
  const active = [q.source, q.format, q.length, q.album, q.voice].filter(Boolean).length;
  const topAlbums = facets.albums.slice(0, ALBUMS_SHOWN);
  const restAlbums = facets.albums.slice(ALBUMS_SHOWN);
  const albumInRest = restAlbums.some((a) => a.id === q.album);

  return (
    <aside className="rail">
      {/* On a phone the rail folds behind this label; on a wide screen it is
          always open. A checkbox does the folding so no script is needed. */}
      <input type="checkbox" id="rail-toggle" className="rail-check" />
      <label htmlFor="rail-toggle" className="rail-toggle mono">
        {active ? `Filters (${active})` : "Filters"}
      </label>
      <div className="rail-body">
        <div className="rail-group">
          <div className="mono rail-title">Source</div>
          <Option href={indexHref(base, change(q, { source: undefined }))} on={!q.source} label="All sources" n={facets.allSources} />
          {facets.sources.map((s) => (
            <Option key={s.key} href={indexHref(base, change(q, { source: s.key }))} on={q.source === s.key} label={SOURCE_LABEL[s.key]} n={s.count} />
          ))}
        </div>

        <div className="rail-group">
          <div className="mono rail-title">Format</div>
          <Option href={indexHref(base, change(q, { format: undefined }))} on={!q.format} label="All formats" n={sum(facets.formats)} />
          {facets.formats.map((f) => (
            <Option key={f.key} href={indexHref(base, change(q, { format: f.key }))} on={q.format === f.key} label={FORMAT_LABEL[f.key]} n={f.count} />
          ))}
        </div>

        <div className="rail-group">
          <div className="mono rail-title">Length</div>
          <Option href={indexHref(base, change(q, { length: undefined }))} on={!q.length} label="Any length" n={sum(facets.lengths)} />
          {facets.lengths.map((l) => (
            <Option key={l.key} href={indexHref(base, change(q, { length: l.key }))} on={q.length === l.key} label={LENGTH_LABEL[l.key]} n={l.count} />
          ))}
        </div>

        {facets.albums.length > 0 && (
          <div className="rail-group">
            <div className="mono rail-title">Album</div>
            <Option href={indexHref(base, change(q, { album: undefined }))} on={!q.album} label="All albums" n={facets.allAlbums} />
            {topAlbums.map((a) => (
              <Option key={a.id} href={indexHref(base, change(q, { album: a.id }))} on={q.album === a.id} label={a.title} n={a.count} />
            ))}
            {restAlbums.length > 0 && (
              <LinkSelect
                label={`${restAlbums.length} more albums`}
                className={albumInRest ? "selectbox selectbox-block on" : "selectbox selectbox-block"}
                value={albumInRest ? (q.album as string) : ""}
                options={[
                  { value: "", label: `+${restAlbums.length} more albums`, href: indexHref(base, change(q, {})) },
                  ...restAlbums.map((a) => ({ value: a.id, label: `${a.title} (${a.count})`, href: indexHref(base, change(q, { album: a.id })) })),
                ]}
              />
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

export function SortSelect({ base, q }: { base: string; q: IndexQuery }) {
  const sort = q.sort ?? "first";
  return (
    <div className="sortbox">
      <label className="mono muted" htmlFor="sort">Sort</label>
      <LinkSelect
        label="Sort" value={sort}
        options={(Object.keys(SORT_LABEL) as SortKey[]).map((k) => ({
          value: k, label: SORT_LABEL[k], href: indexHref(base, { ...q, sort: k, page: undefined }),
        }))}
      />
    </div>
  );
}

// "Showing 19 videos" plus one removable chip for each filter that is on.
export function Summary({
  base, q, total, voiceName, albumTitle,
}: { base: string; q: IndexQuery; total: number; voiceName?: string; albumTitle?: string }) {
  const chips: { label: string; href: string }[] = [];
  if (q.source) chips.push({ label: SOURCE_LABEL[q.source], href: indexHref(base, change(q, { source: undefined })) });
  if (q.format) chips.push({ label: FORMAT_LABEL[q.format], href: indexHref(base, change(q, { format: undefined })) });
  if (q.length) chips.push({ label: LENGTH_LABEL[q.length], href: indexHref(base, change(q, { length: undefined })) });
  if (q.album) chips.push({ label: albumTitle ?? "Album", href: indexHref(base, change(q, { album: undefined })) });
  if (q.voice) chips.push({ label: voiceName ?? "Voice", href: indexHref(base, change(q, { voice: undefined })) });
  return (
    <div className="summary">
      <span className="mono muted">Showing</span>
      <span className="summary-count">{total} {total === 1 ? "video" : "videos"}</span>
      {chips.map((c) => (
        <Link key={c.label} href={c.href} className="chip-x mono" aria-label={`Remove ${c.label}`} scroll={false}>{c.label} ×</Link>
      ))}
    </div>
  );
}

export function VideoRow({ row }: { row: IndexRow }) {
  const v = row.video;
  return (
    <a href={`https://www.youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noreferrer" className="vrow">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={v.thumbnail} alt="" loading="lazy" className="vthumb vthumb-row" />
      <div className="vrow-body">
        <div className="vmeta">
          <Tag lean={v.lean} />
          <span className="mono muted">{runtime(v.durationSeconds)}</span>
          <span className="mono vwhy">{FORMAT_LABEL[v.format]}</span>
        </div>
        <span className="vtitle vtitle-lg">{v.title}</span>
        <span className="muted small">
          {v.channelName}
          {row.albums.length > 0 && ` · About ${row.albums.map((a) => a.title).join(", ")}`}
        </span>
        {row.why && <span className="vrow-why small">{row.why}</span>}
      </div>
    </a>
  );
}

function pageList(page: number, pages: number): (number | "gap")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, 2, pages - 1, pages, page - 1, page, page + 1]);
  const out: (number | "gap")[] = [];
  let last = 0;
  for (const n of [...set].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b)) {
    if (n - last > 1) out.push("gap");
    out.push(n);
    last = n;
  }
  return out;
}

export function Pager({
  base, q, page, pages, total, pageSize,
}: { base: string; q: IndexQuery; page: number; pages: number; total: number; pageSize: number }) {
  if (pages <= 1) return null;
  const left = total - page * pageSize;
  return (
    <div className="index-foot">
      {page < pages && (
        <Link href={indexHref(base, { ...q, page: page + 1 })} className="btn">
          {`Next ${Math.min(pageSize, left)}`}
        </Link>
      )}
      <nav className="pgs" aria-label="Pages">
        {pageList(page, pages).map((n, i) =>
          n === "gap" ? (
            <span key={`g${i}`} className="pg pg-gap mono">…</span>
          ) : (
            <Link key={n} href={indexHref(base, { ...q, page: n })} className={n === page ? "pg on mono" : "pg mono"} aria-current={n === page ? "page" : undefined}>
              {n}
            </Link>
          ),
        )}
      </nav>
    </div>
  );
}
