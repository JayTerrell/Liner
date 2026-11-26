-- Tracks and credits for every album in data/seed.yaml, from LINER_DB.
--
-- Run by hand in a Snowflake worksheet, the same way docs/sql/liner_crosswalk.sql
-- was. Liner cannot reach Snowflake at request time, so the result is written to
-- data/albums/details.yaml and committed, and the site reads that file. When the
-- move to Postgres happens this becomes a scheduled job instead.
--
-- Output is one pipe-delimited record per row, joined with ~ (LISTAGG needs a
-- literal delimiter, so chr(10) is rejected), so it can be pasted straight into
-- scripts/build-album-details.ts.
--   T|album_id|disc|track_no|title|seconds
--   C|album_id|person|role|tracks_played|instruments

with seed as (select * from values ('kind-of-blue','Miles Davis','Kind of Blue',1959),('milestones','Miles Davis','Milestones',1958),('bitches-brew','Miles Davis','Bitches Brew',1970),('round-about-midnight','Miles Davis','''Round About Midnight',1957),('sketches-of-spain','Miles Davis','Sketches of Spain',1960),('in-a-silent-way','Miles Davis','In a Silent Way',1969),('tutu','Miles Davis','Tutu',1986),('blue-train','John Coltrane','Blue Train',1958),('giant-steps','John Coltrane','Giant Steps',1960),('my-favorite-things','John Coltrane','My Favorite Things',1961),('a-love-supreme','John Coltrane','A Love Supreme',1965),('portrait-in-jazz','Bill Evans','Portrait in Jazz',1960),('sunday-at-the-village-vanguard','Bill Evans','Sunday at the Village Vanguard',1961),('waltz-for-debby','Bill Evans','Waltz for Debby',1961),('brilliant-corners','Thelonious Monk','Brilliant Corners',1957),('mingus-ah-um','Charles Mingus','Mingus Ah Um',1959),('maiden-voyage','Herbie Hancock','Maiden Voyage',1965),('head-hunters','Herbie Hancock','Head Hunters',1973),('shape-of-jazz-to-come','Ornette Coleman','The Shape of Jazz to Come',1959),('moanin','Art Blakey','Moanin''',1958),('live-at-the-apollo','James Brown','Live at the Apollo',1963),('stand','Sly and the Family Stone','Stand!',1969),('riot','Sly and the Family Stone','There''s a Riot Goin'' On',1971),('mothership-connection','Parliament','Mothership Connection',1975),('talking-book','Stevie Wonder','Talking Book',1972),('innervisions','Stevie Wonder','Innervisions',1973),('songs-in-the-key-of-life','Stevie Wonder','Songs in the Key of Life',1976),('whats-going-on','Marvin Gaye','What''s Going On',1971),('curtis','Curtis Mayfield','Curtis',1970),('super-fly','Curtis Mayfield','Super Fly',1972),('purple-rain','Prince','Purple Rain',1984),('sign-o-the-times','Prince','Sign o'' the Times',1987),('off-the-wall','Michael Jackson','Off the Wall',1979),('thriller','Michael Jackson','Thriller',1982),('brown-sugar','D''Angelo','Brown Sugar',1995),('voodoo','D''Angelo','Voodoo',2000),('black-messiah','D''Angelo','Black Messiah',2014),('baduizm','Erykah Badu','Baduizm',1997),('mamas-gun','Erykah Badu','Mama''s Gun',2000),('black-radio','Robert Glasper','Black Radio',2012),('feels','Snoh Aalegra','Feels',2017),('ugh-those-feels-again','Snoh Aalegra','Ugh, Those Feels Again',2019),('temporary-highs','Snoh Aalegra','Temporary Highs in the Violet Skies',2021),('peoples-instinctive-travels','A Tribe Called Quest','People''s Instinctive Travels and the Paths of Rhythm',1990),('low-end-theory','A Tribe Called Quest','The Low End Theory',1991),('midnight-marauders','A Tribe Called Quest','Midnight Marauders',1993),('donuts','J Dilla','Donuts',2006),('southernplayalistic','OutKast','Southernplayalisticadillacmuzik',1994),('atliens','OutKast','ATLiens',1996),('aquemini','OutKast','Aquemini',1998),('it-takes-a-nation','Public Enemy','It Takes a Nation of Millions to Hold Us Back',1988),('gentleman','Fela Kuti','Gentleman',1973),('confusion','Fela Kuti','Confusion',1975),('expensive-shit','Fela Kuti','Expensive Shit',1975),('zombie','Fela Kuti','Zombie',1977),('dance-mania','Tito Puente','Dance Mania',1958),('buena-vista-social-club','Buena Vista Social Club','Buena Vista Social Club',1997),('ven-conmigo','Selena','Ven Conmigo',1990),('selena-live','Selena','Live!',1993),('amor-prohibido','Selena','Amor Prohibido',1994),('amazing-grace','Aretha Franklin','Amazing Grace',1972) as s(seed_id, artist, title, yr)),

-- Seven albums whose MusicBrainz title or artist credit differs too much to
-- match on name: MusicBrainz bills Fela as "Fela Ransome Kuti" in the 1970s,
-- writes Sign o the Times with a peace symbol, and files the 1963 James Brown
-- album as "The James Brown Show: Live At The Apollo".
manual as (select * from values ('expensive-shit','b16d9280-f25e-3648-8a8e-1141efd55669'),('gentleman','d23c4512-1ef6-3adb-8c4d-f4c13ed096e2'),('confusion','d1ce6ef8-a9de-3a81-81d5-79dc78d81c06'),('zombie','517cbfb2-2279-4af9-8ca7-1c4c1a444925'),('sign-o-the-times','90718403-7634-3786-84bf-2053a7bd4f4c'),('live-at-the-apollo','a2bad96f-a572-38f2-b362-5865dedc0d35'),('riot','d8b8448a-2634-3e92-ac86-cf55e018f825') as m(seed_id, album_mbid)),

auto as (
  select seed_id, album_mbid from (
    select n.seed_id, a.ALBUM_MBID as album_mbid,
           row_number() over (partition by n.seed_id order by
             case when a.PRIMARY_TYPE='Album' and coalesce(a.SECONDARY_TYPES,'')='' then 0 else 1 end,
             abs(coalesce(a.RELEASE_YEAR,9999) - n.yr), a.EDITION_COUNT desc) rn
    from (select seed_id, yr,
                 lower(regexp_replace(title,'[^a-zA-Z0-9]','')) tkey,
                 lower(regexp_replace(artist,'[^a-zA-Z0-9]','')) akey
          from seed) n
    join LINER_DB.ANALYTICS.ALBUMS a
      on lower(regexp_replace(a.TITLE,'[^a-zA-Z0-9]','')) = n.tkey
     and lower(regexp_replace(a.ARTIST_CREDIT,'[^a-zA-Z0-9]','')) like n.akey || '%'
  ) where rn = 1),

-- A hand-checked id always wins over a name match.
map as (
  select seed_id, album_mbid from manual
  union all
  select seed_id, album_mbid from auto where seed_id not in (select seed_id from manual)),

tracks as (
  select 'T|' || m.seed_id || '|' || coalesce(t.DISC_NUMBER,1) || '|' || t.TRACK_NUMBER
         || '|' || replace(t.TRACK_TITLE,'|','/') || '|' || coalesce(round(t.LENGTH_MS/1000),0) as line,
         m.seed_id, 1 as ord, t.DISC_NUMBER as a, t.TRACK_NUMBER as b
  from map m join LINER_DB.ANALYTICS.ALBUM_TRACKS t on t.ALBUM_MBID = m.album_mbid),

-- At most 15 people per album, the ones who played on most of it first, so a
-- credits tab stays readable.
credits as (
  select line, seed_id, ord, a, b from (
    -- ATTRIBUTES holds the actual instrument ("trumpet", "double bass"),
    -- which is far better than the bare relationship name "instrument".
    select 'C|' || m.seed_id || '|' || replace(l.ARTIST_NAME,'|','/') || '|'
           || replace(l.RELATIONSHIP,'|','/') || '|' || coalesce(l.TRACK_COUNT,0) || '|'
           || coalesce(replace(array_to_string(l.ATTRIBUTES, ', '),'|','/'),'') as line,
           m.seed_id, 2 as ord, coalesce(l.TRACK_COUNT,0) as a, 0 as b,
           row_number() over (partition by m.seed_id
             order by coalesce(l.TRACK_COUNT,0) desc, l.ARTIST_NAME) rn
    from map m join LINER_DB.ANALYTICS.ALBUM_LINEUP l on l.ALBUM_MBID = m.album_mbid)
  where rn <= 15)

select listagg(line, '~') within group (order by seed_id, ord, a, b) as payload
from (select * from tracks union all select * from credits)
