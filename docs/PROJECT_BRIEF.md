# Liner: Project Brief and Handoff

Last updated: 2026-11-25. Written at the end of a Claude chat session so a Claude Code session can pick up cleanly.

## 1. Who you're working with

Jay Sephus, founder of Liner (side project, Frisco TX). Lifelong music fan, strong data/analytics background, **not a software developer**. Explain software steps in plain language, no jargon (npm, caches, build steps), and walk through one step at a time. Be concise and direct. When a task needs him to click or paste something, give numbered steps.

## 2. What Liner is

A music-learning network (working name; check trademark/domain before committing). Tagline: *Build a path. Invite people. Hear music differently together.*

- Two ways to lead sit side by side: **expert-led courses** and **enthusiast-led journeys**. Every path carries a clear badge. Principle: *clear context, not gatekeeping*.
- A living archive of music history: content about albums and artists is cataloged under each artist/album, with journeys (e.g. a jazz course, a Snoh Aalegra deep-dive on how she honors Prince and Michael Jackson) and live listening sessions.
- Creators can bring existing content (e.g. a YouTube channel); each item is assessed and sorted under the artists, albums and musicians it covers.
- Every piece of content is tagged **firsthand** (speaker worked with or personally knew the subject) vs **secondhand** (historical retelling). Firsthand is ranked higher and showcased.
- Genres in scope: funk, soul, R&B, neo-soul, jazz, hip-hop, gospel, Afrobeat, Cuban/Latin, Tejano.
- Design direction (agreed): exhibits/journeys-first home with search one tap away ("start anywhere"); a lineage/thread view (before → work → after) on every artist page; works on web and mobile; museum feel (curated exhibits up front, archive behind).
- Keep path, room, chapter and album objects separate in the data model.
- Visual system: Blue Note-inspired dark mode. Barlow Condensed (display), IBM Plex Mono (labels), Barlow (body). Ink `#0D110F`, paper `#EEEBE3`, cream `#E9E4D6`, green `#3E8E6A` / `#7FC4A3`. Badges: cream = expert-led, green outline = peer-led, grey = open.
- Business direction (for context, nothing built): ~$5/month membership; creator tiers; large revenue share to featured artists by engagement; creators can paywall premium pieces.
- **Music facts must be flagged as needing verification** against MusicBrainz and Discogs. Never present remembered facts as verified.

## 3. What exists today

### 3a. Web app (done, deployed)
- Repo: `JayTerrell/Liner`, branch `main`. Live at `https://liner-gamma.vercel.app` (Vercel, auto-deploys on every push to `main`).
- Stack: Next.js 15 (App Router), React 19, TypeScript, plain global CSS with design tokens. Google Fonts via `<link>`.
- Screens: Home, Search (text + genre lane), Journeys list and detail, Artist (thread: before → work → after), Album (tracks, credits, stories, voices tabs, prev/next thread), You (sample shelf).
- Data: `data/seed.json` is **sample data** (31 artists, 63 albums, 8 paths, 13 sample channels). All reads go through `lib/data.ts`, the single swap-point for the real database. No page should need to change when that happens.
- Pictures: album covers via MusicBrainz → Cover Art Archive; artist portraits via MusicBrainz → Wikidata (P18) → Wikimedia Commons. Resolver is `lib/art-resolver.ts`, served by `app/api/art/album` and `app/api/art/artist`, with generated typographic/initials fallbacks. `npm run art:warm` pre-fills `data/art-cache.json` (not yet run or committed).
- Live check on 2026-11-25: most covers and portraits resolve. **Still showing placeholders:** albums Walkin', Bags' Groove, What's Going On; artists Fela Kuti, J Dilla. These matched poorly by name. Fix by filling the optional `mbid` fields in `seed.json` (see next steps).
- Host names in `seed.json` are placeholders (`sample: true`). 9th Wonder is shown only as an illustrative host; there is no partnership.

### 3b. Data warehouse (Snowflake, database `LINER_DB`)
- `RAW`: full MusicBrainz dump loaded (dump version `20261121-002203`, loaded 2026-11-22), tables named `MB_*` (e.g. `MB_ARTIST` 3.05M rows, `MB_RELEASE_GROUP` 4.66M, `MB_RECORDING` 41M, `MB_URL` 23M, plus the `MB_L_*` link tables and `MB_LOAD_LOG`). **No tag or genre tables are loaded.**
- `ANALYTICS`: dbt-built models (`STG_MB__*` staging views, `ALBUMS`, `ALBUM_TRACKS`, `ALBUM_LINEUP`, `EDGES`, `ALBUM_TWIN_RELEASES`, `GOLDEN_LINEUPS` with golden-row tests). Pattern: load raw on a schedule with no AI, clean in dbt, match to MusicBrainz IDs, test with golden rows.
- `CROSSWALK` (new, created 2026-11-25 by running `docs/sql/liner_crosswalk.sql` by hand, not yet a dbt model):
  - `ARTIST_IDS` (2,086,280 artists): `artist_mbid`, `wikidata_qid`, `discogs_artist_id`, `spotify_artist_id`, `apple_music_url`, `youtube_url`, `allmusic_url`, `wikipedia_url`, `bandcamp_url`. Counts: 290,749 with Wikidata, 1,286,537 Discogs, 473,135 Spotify, 199,941 YouTube.
  - `ALBUM_IDS` (574,239 release groups): `release_group_mbid`, `wikidata_qid`, `discogs_master_id`, `spotify_album_url`, `apple_music_url`, `allmusic_url`, `wikipedia_url`. Counts: 186,265 Wikidata, 353,514 Discogs master, only 1,420 Spotify (MusicBrainz mostly stores streaming links on releases, not release groups).
  - Spot checks (good candidates for golden tests): Miles Davis `561d854a-6a28-4aa7-8c99-323e6ce46c2a` → Q93341, Discogs 23755; Fela Kuti `6514cffa-fbe0-4965-ad88-e998ead8a82a` → Q313868, Discogs 19812; J Dilla `cbcbb22c-3a8d-46af-b4ba-09c98f0d7931` → Q352218, Discogs 33373; Erykah Badu `321531fc-db73-4ffa-a959-61a61a2908c1` → Q223875, Discogs 10995.
- Snowflake has **no external access integrations**, so it cannot fetch from the web itself. Pulls from outside must run elsewhere and load into `RAW`.
- Observation: `MB_LOAD_LOG` shows some tables logged twice (e.g. `MB_AREA`), probably a reload. Worth confirming nothing is double-loaded.
- Ask Jay how the MusicBrainz dump was loaded (script vs the Snowflake upload button) before adding new loads, so new loads match the existing method.

### 3c. YouTube channel list
A 70-row Google-Sheets-style artifact "Liner Channel List" (columns: Channel, Genre lane, Content type, Firsthand lean, Priority P1-P3, Source status Yours/Found in search/From memory, Notes, Handle/URL). It is a private claude.ai artifact, so export it or ask Jay to paste it in. The Handle/URL column is blank, to be filled using the YouTube Data API. Seed channels Jay supplied: you'll hear it, Digging the Greats, Robert Glasper's Black Radio Exchange, Talib Kweli's podcast, Questlove's podcast, Sway in the Morning, Big Boi.

### 3d. Chosen tagging pipeline for imported videos
Free rules filter first, then Jev (TypeSafe AI; Jay has access) to decide keep/skip, then AI tagging on the kept fraction, then merge with MusicBrainz and Discogs to build lineages, graphs and artist stories. Caveat: the official YouTube API cannot download other people's captions, so transcript sourcing needs a separate decision.

## 4. Constraints to know

- Data pulls must be **replicable and scheduled, not run through AI**. Suggested home: GitHub Actions scheduled workflows that load into `LINER_DB.RAW`.
- In Claude chat sessions the sandbox cannot reach MusicBrainz, Wikidata, Discogs, Cover Art Archive or Wikimedia (proxy 403). Anything needing those must run on Jay's machine, GitHub Actions or Vercel. Claude Code on Jay's computer may not have that limit; verify first.
- The Snowflake connector used in chat could read but refused `CREATE` statements. Jay ran the crosswalk script himself in a worksheet. Check whether Claude Code has write access.
- MusicBrainz asks for ~1 request/second and a descriptive User-Agent. Discogs needs a personal token (60 requests/minute authenticated).
- No secrets are stored in the repo. Snowflake and Discogs credentials will go in GitHub secrets (and Vercel environment variables for the app).

## 5. What's next (suggested order)

1. **Fix the five missing pictures (quick win).** Look up exact MBIDs for the five items in section 3a from `CROSSWALK` / `RAW`, put them in the `mbid` fields in `data/seed.json`, push. Consider letting the portrait resolver use `wikidata_qid` directly (skips the MusicBrainz search step).
2. **Genre lanes.** Download the MusicBrainz "derived" dump (tag, artist_tag, release_group_tag, genre tables), load into `RAW` the same way the main dump was loaded, then build a dbt model that maps tags to the ten lanes and flags the artists/albums that matter. This replaces carrying 2M artists nobody will browse. Golden-test it on known artists per lane.
3. **Turn the crosswalk into dbt models** with tests (use the spot checks above) so it rebuilds on every dump refresh.
4. **Scheduled pulls (GitHub Actions → `RAW`):** Wikidata (birthplace, dates, band membership, genre/instrument), Discogs (personnel, credits, labels, release details; needs token), Cover Art Archive availability keyed on MBIDs, release-level streaming links from MusicBrainz.
5. **Fill the YouTube sheet's Handle/URL column** with the YouTube Data API, find more funk/neo-soul/Afrobeat/Cuban/Tejano channels, and start ingesting video metadata.
6. **Web app features:** journey-creation flow (first real journey: "Snoh Aalegra and the Prince / Michael Jackson Thread"), tagging review screen for firsthand/secondhand, then swap `lib/data.ts` from seed JSON to Postgres fed from Snowflake per artist.
7. **Housekeeping:** commit a warmed `data/art-cache.json`, decide on deployment protection while data is sample, check the "Liner" name.

## 6. Open questions for Jay

- How was the MusicBrainz dump loaded (script or upload button)?
- Does Claude Code in his setup have network access to MusicBrainz, Wikidata and Discogs, and write access to Snowflake?
- Discogs account/token available?
- Where should scheduled jobs run (GitHub Actions is the suggested default)?
