/**
 * The Music section's taste chips.
 *
 * The agenda itself is real: scripts/scrape-partyflock.mjs scrapes the
 * partyflock.nl genre agendas into public/partyflock-events.json (the deploy
 * workflow refreshes it daily), and the page filters that to the next month.
 * Each chip folds several partyflock genre slugs together — the mapping
 * lives in the scraper.
 */

export type EventKind = 'festival' | 'concert' | 'party';

/** one scraped partyflock event, as found in partyflock-events.json */
export interface MusicEvent {
  id: string;
  /** ISO start datetime */
  date: string;
  kind: EventKind;
  name: string;
  venue: string;
  city: string;
  genres: string[];
  url: string;
}

export interface MusicGenre {
  id: string;
  label: string;
  /** lo→hi gradient the spectrum field fades through, plus a spark/dust tint */
  palette: { lo: string; hi: string; spark: string };
  /** the field's musical personality: tempo, groundswell, transient spikes */
  field: { speed: number; swell: number; spike: number };
}

export const GENRES: MusicGenre[] = [
  {
    id: 'techno',
    label: 'Techno & House',
    palette: { lo: '#0d2b26', hi: '#2dffc3', spark: '#9ef2dc' },
    field: { speed: 2.7, swell: 2.1, spike: 1.5 },
  },
  {
    id: 'dnb',
    label: 'Drum & Bass',
    palette: { lo: '#0b1f3a', hi: '#45d4ff', spark: '#9fe5ff' },
    field: { speed: 4.1, swell: 1.5, spike: 2.6 },
  },
  {
    id: 'gabber',
    label: 'Hardcore & Gabber',
    palette: { lo: '#230606', hi: '#ff3d2e', spark: '#ff8a7a' },
    field: { speed: 5.2, swell: 1.3, spike: 3.4 },
  },
  {
    id: 'hardstyle',
    label: 'Hardstyle & Raw',
    palette: { lo: '#211c05', hi: '#ffe23a', spark: '#fff0a0' },
    field: { speed: 3.2, swell: 1.9, spike: 2.0 },
  },
  {
    id: 'hiphop',
    label: 'Hip-Hop & R&B',
    palette: { lo: '#2b1304', hi: '#ffb347', spark: '#ffd9a0' },
    field: { speed: 1.3, swell: 2.9, spike: 0.9 },
  },
  {
    id: 'rock',
    label: 'Rock',
    palette: { lo: '#2b0a0c', hi: '#ff5566', spark: '#ff9aa4' },
    field: { speed: 2.3, swell: 1.7, spike: 3.1 },
  },
  {
    id: 'thrash',
    label: 'Thrash & Heavy Metal',
    palette: { lo: '#181c22', hi: '#d6dde6', spark: '#eef3f8' },
    field: { speed: 3.5, swell: 1.6, spike: 2.8 },
  },
  {
    id: 'death',
    label: 'Death & Black Metal',
    palette: { lo: '#0c0e14', hi: '#a9c7d8', spark: '#d4e6f2' },
    field: { speed: 2.9, swell: 1.8, spike: 2.4 },
  },
  {
    id: 'doom',
    label: 'Doom & Sludge',
    palette: { lo: '#150f08', hi: '#c97f3f', spark: '#e6b27a' },
    field: { speed: 0.45, swell: 3.3, spike: 0.4 },
  },
  {
    id: 'metalcore',
    label: 'Metalcore & Punk',
    palette: { lo: '#190d2b', hi: '#b07aff', spark: '#d3b3ff' },
    field: { speed: 3.0, swell: 2.0, spike: 2.2 },
  },
  {
    id: 'indie',
    label: 'Indie & Alt',
    palette: { lo: '#14323a', hi: '#ffd2a8', spark: '#bfe8d9' },
    field: { speed: 1.5, swell: 2.3, spike: 0.7 },
  },
  {
    id: 'pop',
    label: 'Pop',
    palette: { lo: '#2e0f24', hi: '#ff7ad9', spark: '#ffc2ec' },
    field: { speed: 2.0, swell: 2.5, spike: 1.1 },
  },
  {
    id: 'jazz',
    label: 'Jazz & Soul',
    palette: { lo: '#221a08', hi: '#ffd75e', spark: '#ffe9ad' },
    field: { speed: 0.9, swell: 2.0, spike: 0.35 },
  },
  {
    id: 'classical',
    label: 'Classical',
    palette: { lo: '#131a2c', hi: '#dfe8ff', spark: '#c2d4ff' },
    field: { speed: 0.6, swell: 2.6, spike: 0.12 },
  },
  {
    id: 'latin',
    label: 'Latin & Afro',
    palette: { lo: '#16290b', hi: '#c5ff4a', spark: '#e2ffa3' },
    field: { speed: 2.4, swell: 2.4, spike: 1.3 },
  },
];
