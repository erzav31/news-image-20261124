// news-image-20261124 — "THE WORLD IN ONE DAY"
// A deterministic program that draws a dense broadsheet poster of Tuesday
// 24 November 2026 world news and writes it as a 1024x1024 PNG.
// Node 22, standard library only (node:fs, node:path, node:zlib).
// No network, no randomness, no clock: two runs write identical bytes.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

// ---------------------------------------------------------------------------
// PNG encoder (truecolour, 8-bit, filter 0 per scanline)
// ---------------------------------------------------------------------------

const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}

function encodePNG(width: number, height: number, rgb: Uint8Array): Buffer {
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0;
    Buffer.from(rgb.buffer, y * width * 3, width * 3).copy(raw, y * (1 + width * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// 5x7 bitmap font (uppercase + digits + punctuation), one byte per row.
// ---------------------------------------------------------------------------

type Glyph = number[];
const FONT: Record<string, Glyph> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  '0': [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  '2': [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  '3': [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  '5': [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  '6': [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  '.': [0x00, 0x00, 0x00, 0x00, 0x00, 0x0c, 0x0c],
  ',': [0x00, 0x00, 0x00, 0x00, 0x0c, 0x04, 0x08],
  ':': [0x00, 0x0c, 0x0c, 0x00, 0x0c, 0x0c, 0x00],
  ';': [0x00, 0x0c, 0x0c, 0x00, 0x0c, 0x04, 0x08],
  "'": [0x04, 0x04, 0x08, 0x00, 0x00, 0x00, 0x00],
  '-': [0x00, 0x00, 0x00, 0x0e, 0x00, 0x00, 0x00],
  '/': [0x01, 0x01, 0x02, 0x04, 0x08, 0x10, 0x10],
  '(': [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ')': [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  '%': [0x19, 0x19, 0x02, 0x04, 0x08, 0x13, 0x13],
  '+': [0x00, 0x04, 0x04, 0x1f, 0x04, 0x04, 0x00],
  $: [0x04, 0x0f, 0x14, 0x0e, 0x05, 0x1e, 0x04],
  '&': [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
  '?': [0x0e, 0x11, 0x01, 0x02, 0x04, 0x00, 0x04],
  '!': [0x04, 0x04, 0x04, 0x04, 0x04, 0x00, 0x04],
  '=': [0x00, 0x00, 0x1f, 0x00, 0x1f, 0x00, 0x00],
  '"': [0x0a, 0x0a, 0x0a, 0x00, 0x00, 0x00, 0x00],
  ' ': [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
};

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

const W = 1024;
const H = 1024;
const px = new Uint8Array(W * H * 3);

type RGB = [number, number, number];
const PAPER: RGB = [247, 243, 232];
const INK: RGB = [26, 26, 26];
const RED: RGB = [179, 32, 44];
const NAVY: RGB = [20, 33, 61];
const WHITE: RGB = [250, 248, 242];
const GREY: RGB = [107, 107, 107];
const RULE: RGB = [201, 194, 176];
const MAPDOT: RGB = [38, 70, 120];

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * W + xx) * 3;
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
    }
  }
}

function drawText(text: string, x: number, y: number, scale: number, c: RGB): void {
  const s = text.toUpperCase().replace(/[’‘]/g, "'").replace(/—/g, '-');
  let cx = x;
  for (const ch of s) {
    const g = FONT[ch] ?? FONT[' '];
    for (let r = 0; r < 7; r++) {
      const row = g[r];
      for (let col = 0; col < 5; col++) {
        if (row & (0x10 >> col)) fillRect(cx + col * scale, y + r * scale, scale, scale, c);
      }
    }
    cx += 5 * scale + 1;
  }
}

function textWidth(text: string, scale: number): number {
  return text.length * (5 * scale + 1) - 1;
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (next.length <= maxChars) {
      cur = next;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------------------
// The day's news — 48 stories first reported Tuesday 24 November 2026.
// Region counts are computed from this array at render time, so the strip
// can never disagree with the grid.
// ---------------------------------------------------------------------------

type Region = 'EUROPE' | 'MIDDLE EAST' | 'ASIA' | 'AMERICAS' | 'AFRICA' | 'OCEANIA';
const REGION_COLOR: Record<Region, RGB> = {
  EUROPE: [29, 78, 216],
  'MIDDLE EAST': [194, 65, 12],
  ASIA: [21, 128, 61],
  AMERICAS: [124, 58, 237],
  AFRICA: [146, 64, 14],
  OCEANIA: [14, 116, 144],
};

const STORIES: { region: Region; headline: string }[] = [
  // EUROPE (12)
  { region: 'EUROPE', headline: "RUSSIAN STRIKE HITS KYIV GOVT QUARTER" },
  { region: 'EUROPE', headline: 'MOSCOW: ESTONIA ACTS NEAR WAR' },
  { region: 'EUROPE', headline: 'LATVIA PM REFUSES TO RESTORE RUSSIA TIES' },
  { region: 'EUROPE', headline: 'MURMANSK GOVERNOR HELD ON GRAFT' },
  { region: 'EUROPE', headline: 'FRANCE CONDEMNS POLAND BREACH' },
  { region: 'EUROPE', headline: 'POLAND: WRECKAGE WAS SOVIET MISSILES' },
  { region: 'EUROPE', headline: 'LE PEN LISTS UKRAINE WAR SCENARIOS' },
  { region: 'EUROPE', headline: 'MOSCOW MAY ORBIT NUCLEAR SPACECRAFT' },
  { region: 'EUROPE', headline: 'NATO CHIEF: SPACE IS NOW A SECURITY FRONT' },
  { region: 'EUROPE', headline: 'UK POLICE CLEAR 12,000 FROM CONCERT' },
  { region: 'EUROPE', headline: 'ARMENIA UNVEILS DRAFT PEACE CONSTITUTION' },
  { region: 'EUROPE', headline: 'RUSSIA HAULS DRONE-HIT SHIP' },
  // MIDDLE EAST (10)
  { region: 'MIDDLE EAST', headline: 'ISRAELI FIRE KILLS PALESTINIAN IN GAZA' },
  { region: 'MIDDLE EAST', headline: 'WEST BANK RAID: MASS ARRESTS' },
  { region: 'MIDDLE EAST', headline: "OXFAM: GAZA NOW A 'TOXIC WASTELAND'" },
  { region: 'MIDDLE EAST', headline: 'ISRAELI STRIKE ON CAR IN GAZA KILLS TWO' },
  { region: 'MIDDLE EAST', headline: 'GAZA GROUP EXECUTES ALLEGED COLLABORATORS' },
  { region: 'MIDDLE EAST', headline: 'IRAN WARNS EU BASES IN MISSILE RANGE' },
  { region: 'MIDDLE EAST', headline: 'THREE TANKERS HIT MINES IN HORMUZ' },
  { region: 'MIDDLE EAST', headline: 'IRAQ LEADER IN EGYPT ON FIRST VISIT' },
  { region: 'MIDDLE EAST', headline: 'HOUTHI ATTACKS IN TAIZ KILL 2, WOUND 8' },
  { region: 'MIDDLE EAST', headline: '23 ISRAELI SOLDIERS DIED BY SUICIDE' },
  // ASIA (11)
  { region: 'ASIA', headline: 'CHINA OFFICIAL GETS DEATH FOR LEAKS' },
  { region: 'ASIA', headline: 'CHINA TO EASE VISAS FOR INDIANS' },
  { region: 'ASIA', headline: 'S. KOREA MINISTER QUITS OVER AI CHEATS' },
  { region: 'ASIA', headline: 'VIETNAM ACTS ON SURPLUS, US PRESSURE' },
  { region: 'ASIA', headline: 'GARMENT WORKERS REJECT PAY OFFER' },
  { region: 'ASIA', headline: 'MYANMAR TOLD TO HEED ICJ GENOCIDE RULING' },
  { region: 'ASIA', headline: 'TALIBAN POST GUARDS FOR VANISHING FORESTS' },
  { region: 'ASIA', headline: 'THAI COURT FREES MP ICE RAKCHANOK ON BAIL' },
  { region: 'ASIA', headline: 'THAI MARCHERS WALK 16 KM TO REFINERY' },
  { region: 'ASIA', headline: 'TOXIC ARSENIC FOUND IN N. THAILAND RIVERS' },
  { region: 'ASIA', headline: 'INDIA PLEDGES EUR 1.4BN FOR NEPAL' },
  { region: 'ASIA', headline: 'INDONESIA HOLDS SHIP WITH 405T CHEMICALS' },
  { region: 'ASIA', headline: 'TRAIN HITS MINIBUS IN N. SUMATRA, 3 HURT' },
  // AMERICAS (6)
  { region: 'AMERICAS', headline: "'EL CHAPO ISIDRO' TO FACE TRIAL IN MEXICO" },
  { region: 'AMERICAS', headline: 'TRUMP MAY DROP KIM NUCLEAR DEMAND' },
  { region: 'AMERICAS', headline: 'TRUMP BACKS NATO UKRAINE DEAL' },
  { region: 'AMERICAS', headline: 'US PROBES NVIDIA CHIP SALES TO CHINA' },
  { region: 'AMERICAS', headline: 'US DEBT HITS WEAPONS WATCHDOG' },
  { region: 'AMERICAS', headline: 'PANAMA, FIRST QUANTUM RESUME MINE TALKS' },
  { region: 'AMERICAS', headline: 'US SEEKS $1.1BN CRYPTO FORFEIT' },
  // AFRICA (3)
  { region: 'AFRICA', headline: 'BENGHAZI BLAST KILLS RUSSIAN CREW' },
  { region: 'AFRICA', headline: 'UN WARNS LIBYA MUST NOT BECOME WAR ARENA' },
  { region: 'AFRICA', headline: 'SUDANESE PARENTS ENDURE WAR' },
  // OCEANIA (2)
  { region: 'OCEANIA', headline: 'HANSON FACES BIGGEST TEST IN STATE VOTE' },
  { region: 'OCEANIA', headline: 'AUSTRALIA: SHOPPERS HIT BY STORE COLLAPSE' },
  { region: 'OCEANIA', headline: 'FIJI CLOSES SCHOOLS 5 DAYS IN DROUGHT' },
];

const BIG_NUMBERS: { value: string; label: string }[] = [
  { value: '12,000', label: 'PEOPLE CLEARED FROM UK CONCERT - #10' },
  { value: '4,500 KM', label: 'MISSILE RANGE IRAN CLAIMS VS EU - #18' },
  { value: '23', label: 'ISRAELI SOLDIER SUICIDES IN 2026 - #22' },
  { value: '3', label: 'TANKERS HIT BY MINES IN HORMUZ - #19' },
  { value: '405 T', label: 'TONNES OF CHEMICALS ON HELD SHIP - #34' },
  { value: '5 DAYS', label: 'DAYS FIJI SCHOOLS SHUT IN DROUGHT - #48' },
];

const TIMELINE: { time: string; text: string }[] = [
  { time: '00:30', text: 'S. KOREA MINISTER QUITS' },
  { time: '00:32', text: "'EL CHAPO ISIDRO' TO FACE TRIAL" },
  { time: '01:37', text: 'RUSSIAN STRIKE HITS KYIV' },
  { time: '01:59', text: 'US SEEKS $1.1BN CRYPTO FORFEIT' },
  { time: '05:29', text: 'INDONESIA HOLDS SHIP WITH CHEMICALS' },
  { time: '06:25', text: 'TRAIN HITS MINIBUS IN N. SUMATRA' },
];

// Dotted world map: land runs [row, firstCol, lastCol] on a 64 x 28 grid.
// Equirectangular (lon -180..180 left to right, lat 90..-90 top to bottom).
const MAP_RUNS: [number, number, number][] = [
  [1, 9, 11], [1, 23, 26],
  [2, 3, 20], [2, 22, 27], [2, 34, 36], [2, 40, 63],
  [3, 4, 21], [3, 23, 26], [3, 33, 37], [3, 39, 63],
  [4, 5, 21], [4, 30, 30], [4, 33, 36], [4, 38, 63],
  [5, 6, 20], [5, 30, 38], [5, 39, 62],
  [6, 9, 20], [6, 29, 38], [6, 39, 58], [6, 60, 61],
  [7, 10, 19], [7, 29, 37], [7, 39, 55], [7, 60, 60],
  [8, 10, 18], [8, 30, 36], [8, 38, 42], [8, 43, 56],
  [9, 10, 13], [9, 29, 40], [9, 39, 43], [9, 44, 54],
  [10, 11, 14], [10, 29, 40], [10, 40, 43], [10, 44, 47], [10, 50, 54],
  [11, 13, 15], [11, 29, 40], [11, 45, 47], [11, 50, 55],
  [12, 18, 23], [12, 30, 39], [12, 46, 46], [12, 50, 55],
  [13, 18, 24], [13, 30, 39], [13, 51, 57],
  [14, 18, 25], [14, 31, 38], [14, 51, 58],
  [15, 18, 25], [15, 31, 38], [15, 53, 57],
  [16, 19, 25], [16, 32, 37], [16, 52, 58],
  [17, 19, 24], [17, 32, 37], [17, 41, 41], [17, 52, 59],
  [18, 19, 23], [18, 33, 36], [18, 52, 59],
  [19, 20, 22], [19, 33, 35], [19, 53, 58],
  [20, 20, 22], [20, 61, 62],
  [21, 20, 21], [21, 61, 61],
  [22, 20, 21],
  [23, 20, 20],
];

// Red-dot cities on the map (grid col, row): Kyiv, Gaza, Hormuz, Benghazi, Seoul, Bangkok, Jakarta, Suva.
const MAP_MARKS: [number, number][] = [
  [37, 6],
  [38, 9],
  [42, 10],
  [36, 9],
  [55, 8],
  [50, 12],
  [51, 15],
  [63, 17],
];

// ---------------------------------------------------------------------------
// Layout + render
// ---------------------------------------------------------------------------

const MX = 20; // page margin
const CW = W - 2 * MX; // 984 content width

function render(): void {
  fillRect(0, 0, W, H, PAPER);
  // Thin page frame.
  fillRect(4, 4, W - 8, 2, INK);
  fillRect(4, H - 4, W - 8, 2, INK);
  fillRect(4, 4, 2, H - 8, INK);
  fillRect(W - 6, 4, 2, H - 8, INK);

  // ---- Masthead ------------------------------------------------------------
  drawText('THE WORLD IN ONE DAY', MX, 12, 5, INK);
  drawText("TUESDAY 24 NOVEMBER 2026 - THE WORLD'S NEWS IN ONE IMAGE", MX, 54, 2, GREY);
  fillRect(MX, 76, CW, 3, INK);

  // DATE CHECK box (top right)
  const bx = 692;
  const bw = W - MX - bx;
  fillRect(bx, 8, bw, 68, WHITE);
  fillRect(bx, 8, bw, 2, RED);
  fillRect(bx, 74, bw, 2, RED);
  fillRect(bx, 8, 2, 68, RED);
  fillRect(bx + bw - 2, 8, 2, 68, RED);
  drawText('DATE CHECK', bx + 10, 12, 2, RED);
  const dc = wrapText('EVERY STORY HERE WAS FIRST REPORTED ON TUESDAY 24 NOVEMBER 2026', 26);
  dc.forEach((ln, i) => drawText(ln, bx + 10, 28 + i * 15, 2, INK));

  // ---- Hero band -----------------------------------------------------------
  fillRect(MX, 84, CW, 52, NAVY);
  drawText("RUSSIAN STRIKE HITS KYIV'S GOVERNMENT QUARTER", MX + 12, 92, 3, WHITE);
  drawText('A BUILDING BESIDE THE PRESIDENTIAL OFFICE IS HIT IN THE CAPITAL', MX + 12, 116, 2, [200, 208, 224]);

  // ---- Six big numbers -----------------------------------------------------
  const bw6 = Math.floor(CW / 6);
  BIG_NUMBERS.forEach((bn, i) => {
    const x = MX + i * bw6;
    fillRect(x, 142, bw6 - 6, 50, WHITE);
    fillRect(x, 142, bw6 - 6, 2, RED);
    drawText(bn.value, x + 8, 150, 3, RED);
    const lab = wrapText(bn.label, 22);
    if (lab.length > 2) throw new Error(`big-number label wraps to ${lab.length} lines: ${bn.label}`);
    lab.forEach((ln, j) => drawText(ln, x + 8, 172 + j * 10, 1, INK));
  });

  // ---- Region strip (counts computed from STORIES) -------------------------
  const counts = new Map<Region, number>();
  for (const s of STORIES) counts.set(s.region, (counts.get(s.region) ?? 0) + 1);
  const order: Region[] = ['EUROPE', 'MIDDLE EAST', 'ASIA', 'AMERICAS', 'AFRICA', 'OCEANIA'];
  const strip =
    order.map((r) => `${r} ${counts.get(r) ?? 0}`).join(' | ') +
    ` | TOTAL ${STORIES.length}`;
  fillRect(MX, 198, CW, 26, INK);
  drawText(strip, MX + 12, 204, 2, WHITE);

  // ---- Story grid: 4 columns x 12 rows ------------------------------------
  const cols = 4;
  const gutter = 12;
  const colW = Math.floor((CW - gutter * (cols - 1)) / cols);
  const rowH = 48;
  const gridY = 230;
  const maxChars = Math.floor((colW - 4) / 11); // scale-2 char advance = 11px
  STORIES.forEach((s, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = MX + col * (colW + gutter);
    const y = gridY + row * rowH;
    const n = String(idx + 1).padStart(2, '0');
    drawText(n, x, y, 2, RED);
    fillRect(x + 26, y + 2, 10, 10, REGION_COLOR[s.region]);
    drawText(s.region, x + 40, y, 2, REGION_COLOR[s.region]);
    const lines = wrapText(s.headline, maxChars);
    if (lines.length > 2) throw new Error(`headline wraps to ${lines.length} lines: ${s.headline}`);
    lines.forEach((ln, j) => drawText(ln, x, y + 16 + j * 15, 2, INK));
    if (row < 11) fillRect(x, y + rowH - 3, colW, 1, RULE);
  });

  // ---- Bottom band: timeline (left) + dotted world map (right) -------------
  const bandY = gridY + 12 * rowH + 8; // 814
  const midX = 512;

  // Timeline
  drawText('THE DAY AS REPORTED - TIMES UTC', MX, bandY, 2, RED);
  fillRect(MX, bandY + 20, midX - MX - 16, 2, INK);
  TIMELINE.forEach((t, i) => {
    const y = bandY + 30 + i * 24;
    drawText(t.time, MX, y, 2, RED);
    drawText(t.text, MX + 62, y, 2, INK);
  });

  // Map
  const mapX = midX;
  const mapY = bandY + 30;
  drawText('WHERE THE DAY HAPPENED', mapX, bandY, 2, RED);
  fillRect(mapX, bandY + 20, W - MX - mapX, 2, INK);
  const cellW = 7;
  const cellH = 5;
  for (const [r, c0, c1] of MAP_RUNS) {
    for (let c = c0; c <= c1; c++) fillRect(mapX + c * cellW, mapY + r * cellH, 4, 4, MAPDOT);
  }
  for (const [c, r] of MAP_MARKS) {
    fillRect(mapX + c * cellW - 1, mapY + r * cellH - 1, 5, 5, RED);
  }
  drawText('RED DOTS: KYIV, GAZA, HORMUZ, BENGHAZI,', mapX, mapY + 24 * cellH + 4, 2, INK);
  drawText('SEOUL, BANGKOK, JAKARTA, SUVA', mapX, mapY + 24 * cellH + 20, 2, INK);

  // ---- Footer ---------------------------------------------------------------
  fillRect(MX, 1000, CW, 2, INK);
  drawText('48 STORIES, FIRST REPORTED 24 NOV 2026 (UTC) - SOURCES: WIRE REPORTS', MX, 1006, 2, GREY);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// Sanity checks before drawing (fail loudly, never silently ship a bad poster).
if (STORIES.length !== 48) throw new Error(`expected 48 stories, got ${STORIES.length}`);
for (const [r, c0, c1] of MAP_RUNS) {
  if (r < 0 || r > 27 || c0 < 0 || c1 > 63 || c0 > c1) throw new Error(`bad map run: ${r},${c0},${c1}`);
}

render();
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'entry.png'), encodePNG(W, H, px));
