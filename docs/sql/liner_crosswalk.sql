-- LINER: build the "crosswalk" tables (one row per artist / album with every outside ID)
-- Source: MusicBrainz data already in LINER_DB.RAW. No new downloads.
-- Run each numbered block in a Snowflake worksheet, one at a time, top to bottom.

-- 1) A new, separate area so this doesn't mix with the dbt models
CREATE SCHEMA IF NOT EXISTS LINER_DB.CROSSWALK;

-- 2) ARTISTS: Wikidata, Discogs, Spotify, Apple Music, YouTube, AllMusic, Wikipedia, Bandcamp
CREATE OR REPLACE TABLE LINER_DB.CROSSWALK.ARTIST_IDS AS
SELECT
  a.gid  AS artist_mbid,
  a.name AS artist_name,
  MAX(CASE WHEN u.url ILIKE '%wikidata.org/%'            THEN REGEXP_SUBSTR(u.url,'Q[0-9]+') END)                  AS wikidata_qid,
  MAX(CASE WHEN u.url ILIKE '%discogs.com/artist/%'      THEN REGEXP_SUBSTR(u.url,'/artist/([0-9]+)',1,1,'e',1) END) AS discogs_artist_id,
  MAX(CASE WHEN u.url ILIKE '%open.spotify.com/artist/%' THEN REGEXP_SUBSTR(u.url,'/artist/([A-Za-z0-9]+)',1,1,'e',1) END) AS spotify_artist_id,
  MAX(CASE WHEN u.url ILIKE '%music.apple.com/%/artist/%' THEN u.url END)                                           AS apple_music_url,
  MAX(CASE WHEN u.url ILIKE '%youtube.com/%' AND u.url NOT ILIKE '%music.youtube%' THEN u.url END)                  AS youtube_url,
  MAX(CASE WHEN u.url ILIKE '%allmusic.com/artist/%'     THEN u.url END)                                           AS allmusic_url,
  MAX(CASE WHEN u.url ILIKE '%wikipedia.org/wiki/%'      THEN u.url END)                                           AS wikipedia_url,
  MAX(CASE WHEN u.url ILIKE '%bandcamp.com%'             THEN u.url END)                                           AS bandcamp_url
FROM LINER_DB.RAW.MB_ARTIST a
JOIN LINER_DB.RAW.MB_L_ARTIST_URL l ON l.entity0 = a.id
JOIN LINER_DB.RAW.MB_URL u          ON u.id = l.entity1
GROUP BY a.gid, a.name;

-- 3) ALBUMS: Wikidata, Discogs master, streaming links
CREATE OR REPLACE TABLE LINER_DB.CROSSWALK.ALBUM_IDS AS
SELECT
  rg.gid  AS release_group_mbid,
  rg.name AS album_title,
  MAX(CASE WHEN u.url ILIKE '%wikidata.org/%'            THEN REGEXP_SUBSTR(u.url,'Q[0-9]+') END)                    AS wikidata_qid,
  MAX(CASE WHEN u.url ILIKE '%discogs.com/master/%'      THEN REGEXP_SUBSTR(u.url,'/master/([0-9]+)',1,1,'e',1) END)  AS discogs_master_id,
  MAX(CASE WHEN u.url ILIKE '%open.spotify.com/album/%'  THEN u.url END)                                             AS spotify_album_url,
  MAX(CASE WHEN u.url ILIKE '%music.apple.com/%/album/%' THEN u.url END)                                             AS apple_music_url,
  MAX(CASE WHEN u.url ILIKE '%allmusic.com/album/%'      THEN u.url END)                                             AS allmusic_url,
  MAX(CASE WHEN u.url ILIKE '%wikipedia.org/wiki/%'      THEN u.url END)                                             AS wikipedia_url
FROM LINER_DB.RAW.MB_RELEASE_GROUP rg
JOIN LINER_DB.RAW.MB_L_RELEASE_GROUP_URL l ON l.entity0 = rg.id
JOIN LINER_DB.RAW.MB_URL u                 ON u.id = l.entity1
GROUP BY rg.gid, rg.name;

-- 4) Check it worked: you should see Fela Kuti and J Dilla with IDs filled in
SELECT * FROM LINER_DB.CROSSWALK.ARTIST_IDS
WHERE artist_name IN ('Miles Davis','J Dilla','Fela Kuti','Erykah Badu');

SELECT COUNT(*) AS artists, COUNT(wikidata_qid) AS with_wikidata, COUNT(discogs_artist_id) AS with_discogs,
       COUNT(spotify_artist_id) AS with_spotify, COUNT(youtube_url) AS with_youtube
FROM LINER_DB.CROSSWALK.ARTIST_IDS;
