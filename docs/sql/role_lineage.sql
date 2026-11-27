-- Role lineage: for each person with a page, who held the same chair before and
-- after them with the same bandleader, in order of album release year.
--
-- A "chair" is what someone played or did on a record: bass, drums, tenor
-- saxophone, engineer, producer. A "leader" is the artist the album is billed
-- to. For Paul Chambers on Miles Davis albums the chair is bass and the leader
-- is Miles Davis, and the lineage is every other bassist on a Miles Davis
-- studio album, ordered by the year of their first appearance.
--
-- The people are everyone credited on an album in data/seed.yaml, found the same
-- way docs/sql/album_details.sql finds the albums, so this file never lists people
-- by hand and stays right as the seed grows.
--
-- Run by hand in a Snowflake worksheet, like the other files in docs/sql.
-- One record per row, joined with ~:
--   S|person_mbid|leader|chair|albums|from_year|to_year
--   B|person_mbid|leader|chair|rank|nb_mbid|nb_name|nb_from|nb_to|nb_albums    (started before)
--   A|person_mbid|leader|chair|rank|nb_mbid|nb_name|nb_from|nb_to|nb_albums    (started after)
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

targets as (
  select distinct l.ARTIST_MBID as mbid
  from LINER_DB.ANALYTICS.ALBUM_LINEUP l join map m on l.ALBUM_MBID = m.album_mbid
  where l.ARTIST_MBID is not null),

-- Studio albums only (an album with no secondary type), so compilations and
-- live records do not invent a lineage. The leader is the billed artist with a
-- small-group word removed, so "The Miles Davis Quintet" and "Miles Davis" are
-- one leader.
studio as (
  select ALBUM_MBID, RELEASE_YEAR,
         trim(regexp_replace(regexp_replace(ARTIST_CREDIT, '^[Tt]he ', ''),
              ' (Quintet|Quartet|Sextet|Trio|Septet|Octet|Nonet|Duo)$', '')) as leader
  from LINER_DB.ANALYTICS.ALBUMS
  where PRIMARY_TYPE = 'Album' and coalesce(SECONDARY_TYPES, '') = ''
    and RELEASE_YEAR is not null and ARTIST_CREDIT <> 'Various Artists'),
-- What each credit is, as a chair. For a player the attribute names the
-- instrument; for production credits the relationship is the chair and a
-- modifier such as "assistant" or "executive" rules the credit out.
seats as (
  select l.ARTIST_MBID as mbid, l.ARTIST_NAME as name, s.leader, s.ALBUM_MBID, s.RELEASE_YEAR as yr,
    case
      when lower(f.value::string) in ('bass','double bass','bass guitar','electric bass guitar','electric upright bass','acoustic bass guitar','upright bass','fretless bass','acoustic bass','electric bass','contrabass') then 'bass'
      when lower(f.value::string) in ('drums','drums (drum set)','drum set','drum kit') then 'drums'
      when lower(f.value::string) in ('piano','acoustic piano','grand piano','upright piano') then 'piano'
      when lower(f.value::string) in ('electric piano','rhodes piano','wurlitzer electric piano','electric grand piano') then 'electric piano'
      when lower(f.value::string) in ('organ','hammond organ','pipe organ') then 'organ'
      when lower(f.value::string) in ('keyboard','keyboards','synthesizer','clavinet') then 'keyboards'
      when lower(f.value::string) in ('guitar','electric guitar','acoustic guitar','classical guitar') then 'guitar'
      else lower(f.value::string)
    end as chair
  from LINER_DB.ANALYTICS.ALBUM_LINEUP l
  join studio s on s.ALBUM_MBID = l.ALBUM_MBID,
  lateral flatten(input => l.ATTRIBUTES) f
  where l.RELATIONSHIP = 'instrument' and l.ARTIST_MBID is not null
  union all
  select l.ARTIST_MBID, l.ARTIST_NAME, s.leader, s.ALBUM_MBID, s.RELEASE_YEAR,
    case when l.RELATIONSHIP in ('recording','mix','engineer','audio','mastering') then 'engineer' else 'producer' end
  from LINER_DB.ANALYTICS.ALBUM_LINEUP l
  join studio s on s.ALBUM_MBID = l.ALBUM_MBID
  where l.RELATIONSHIP in ('recording','mix','engineer','audio','mastering','producer')
    and l.ARTIST_MBID is not null
    and array_to_string(l.ATTRIBUTES, ',') not rlike '.*(assistant|executive|associate|additional).*'),
-- A person's stretch in a chair under a leader.
stints as (
  select mbid, any_value(name) as name, leader, chair,
         min(yr) as from_yr, max(yr) as to_yr, count(distinct ALBUM_MBID) as albums
  from seats where lower(name) <> lower(leader)
  group by mbid, leader, chair),
-- Each target's three leaders they worked with most, one chair per leader
-- (the one they filled most often), and only where it was more than a one-off.
mine as (
  select * from (
    select s.*, row_number() over (partition by s.mbid, s.leader order by s.albums desc, s.chair) as chair_rank
    from stints s join targets t on t.mbid = s.mbid) x
  where chair_rank = 1 and albums >= 2),
ranked as (
  select m.*, row_number() over (partition by m.mbid order by m.albums desc, m.leader) as leader_rank from mine m),
pick as (select * from ranked where leader_rank <= 3),
neighbours as (
  select p.mbid, p.leader, p.chair, n.mbid as nb_mbid, n.name as nb_name,
         n.from_yr as nb_from, n.to_yr as nb_to, n.albums as nb_albums,
         case when n.from_yr < p.from_yr then 'B' else 'A' end as side,
         row_number() over (partition by p.mbid, p.leader, p.chair,
                                         case when n.from_yr < p.from_yr then 'B' else 'A' end
                            order by case when n.from_yr < p.from_yr then -n.from_yr else n.from_yr end,
                                     n.albums desc) as rk
  from pick p
  join stints n on n.leader = p.leader and n.chair = p.chair
                and n.mbid <> p.mbid and n.from_yr <> p.from_yr),
lines as (
  select 'S|' || mbid || '|' || replace(leader,'|','/') || '|' || chair || '|' || albums || '|' || from_yr || '|' || to_yr as line,
         mbid, leader, 0 as ord, 0 as rk from pick
  union all
  select side || '|' || mbid || '|' || replace(leader,'|','/') || '|' || chair || '|' || rk || '|' || nb_mbid || '|'
         || replace(nb_name,'|','/') || '|' || nb_from || '|' || nb_to || '|' || nb_albums,
         mbid, leader, case when side = 'B' then 1 else 2 end, rk
  from neighbours where rk <= 4)
select listagg(line, '~') within group (order by mbid, leader, ord, rk) as payload from lines
