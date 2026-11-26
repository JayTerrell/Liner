export type Lean = "firsthand" | "secondhand" | "mixed";
export type PathKind = "guided" | "club" | "journey" | "open";

export interface Lane { id: string; label: string }

export interface LineageRef {
  id?: string;       // links to an artist page when the artist is in the archive
  name?: string;     // plain text when not (yet) in the archive
  note?: string;
}

export interface Artist {
  id: string;
  name: string;
  roles: string;
  years: string;
  lanes: string[];
  bio: string;
  before: LineageRef[];
  after: LineageRef[];
  mbid?: string;     // MusicBrainz artist ID, once matched
  wikidataQid?: string; // Wikidata ID, once matched: lets the portrait lookup skip MusicBrainz
}

export interface Album {
  id: string;
  artistId: string;
  title: string;
  year: number;
  blurb?: string;
  mbid?: string;     // MusicBrainz release-group ID, once matched
}

export interface PathItem {
  title: string;
  artist: string;
  year: string;
  albumId?: string;
  mbid?: string;     // MusicBrainz release-group ID, for items not yet in the album list
}

export interface Fork { glyph: string; title: string; by: string; change: string; n: string }

export interface LinerPath {
  id: string;
  kind: PathKind;
  badge: string;
  title: string;
  host: string;
  sample?: boolean;
  blurb: string;
  meta: string;
  along: number;
  done: number;
  cadence: string;
  whyNext?: string;
  listenFor?: string[];
  items: PathItem[];
  forks?: Fork[];
}

export interface Channel {
  id: string;
  name: string;
  lanes: string[];
  type: string;
  lean: Lean;
}

export interface Track { n: number; title: string; len: string; note: string }
export interface CreditRow { name: string; role: string; scope: string; artistId?: string }
export interface Story { tag: string; title: string; body: string }
