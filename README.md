# Liner

A music-learning network. **Build a path. Invite people. Hear music differently together.**

Two ways to lead sit side by side: expert-led courses and enthusiast-led journeys. Every path carries a clear badge. Clear context, not gatekeeping.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

## Pictures

Artwork comes from open sources and is resolved on demand:

| Image | Source |
| --- | --- |
| Album covers | MusicBrainz → Cover Art Archive |
| Artist portraits | MusicBrainz → Wikidata → Wikimedia Commons |

Until an image resolves, every cover and portrait shows a generated typographic placeholder, so the app never looks broken.

Resolving is slow the first time (MusicBrainz allows about 1 request per second). Warm the cache once from a machine with internet access:

```bash
npm run art:warm
```

This writes `data/art-cache.json`. Commit it, and pages load with all artwork immediately.

Once artists and albums are matched to MusicBrainz IDs in the data pipeline, put them in the `mbid` field and the app skips the name search. This avoids wrong matches on ambiguous names.

## Screens built

- **Home**: start anywhere. Search up front, genre lanes, a featured path, paths grid, artists, album shelf.
- **Search**: by text and by genre lane (jazz, funk, soul, R&B, neo-soul, hip-hop, gospel, Afrobeat, Cuban/Latin, Tejano).
- **Artist**: portrait, bio, and the **thread**: before → the work → after.
- **Album**: tracks, credits, stories, voices. Follow the thread to the artist's previous and next album.
- **Paths**: expert courses, clubs, journeys and open rooms. The journey page has the next album, why it was chosen, what to listen for, the full path and forks.
- **You**: sample shelf.

## Data

`data/seed.json` is **sample data** for the design build. Music facts in it (years, personnel, relationships) were written from memory and must be verified against MusicBrainz and Discogs. Hosts marked `sample` are placeholders. 9th Wonder appears only as an illustrative host; there is no partnership.

All reads go through `lib/data.ts`. When the Snowflake → Postgres pipeline is ready, replace those functions with database queries; no page needs to change.

"Voices" cards are placeholders for ingested YouTube content. They show the firsthand/secondhand tag and link to a YouTube search until real, tagged items exist.

## Structure

```
app/            pages and the two image API routes
components/     Art (covers, portraits), Nav, PathCard, AlbumTabs, Voices
lib/            types, data access, art resolver
data/           seed.json, art-cache.json
scripts/        warm-art.ts
```

## Design system

Blue Note–inspired dark mode. Barlow Condensed (display), IBM Plex Mono (liner-notes labels), Barlow (body). Ink `#0D110F`, paper `#EEEBE3`, cream `#E9E4D6`, green `#3E8E6A` / `#7FC4A3`. Cream = expert-led, green outline = peer-led, grey = open.
