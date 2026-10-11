// Lenox, Massachusetts: the numbers every part of the figure reads.
// Terrain is modelled from published spot heights (village, Lenox Mountain, the lakes,
// the Housatonic), not a survey grid, so every elevation is approximate.

export const TOWN = {
  name: "Lenox",
  county: "Berkshire County",
  state: "Massachusetts",
  lat: 42.3565,
  lon: -73.2848,
  villageFt: 1207,
  areaSqMi: 21.7,
  population: 5095,
  incorporated: 1767,
};

// Model centre, a little south and east of the village so the river and both lakes fit.
export const CENTRE = { lat: 42.355, lon: -73.275 };
export const KM_PER_LAT = 111.0;
export const KM_PER_LON = 111.32 * Math.cos((CENTRE.lat * Math.PI) / 180);
export const N = 12;
export const CELL_KM = 0.8;
export const HALF_KM = (N * CELL_KM) / 2;

export const toKm = (lat, lon) => [(lon - CENTRE.lon) * KM_PER_LON, (lat - CENTRE.lat) * KM_PER_LAT];
export const toLatLon = (x, y) => [CENTRE.lat + y / KM_PER_LAT, CENTRE.lon + x / KM_PER_LON];

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const bump = (x, y, cx, cy, sx, sy) => Math.exp(-(((x - cx) ** 2) / (2 * sx * sx) + ((y - cy) ** 2) / (2 * sy * sy)));

// The Housatonic runs south through the east of the town (New Lenox, then Lenox Dale).
export const riverX = (y) => 2.35 + 0.2 * y;
const riverFloor = (y) => 950 + 5 * y;
// Yokun Ridge: Lenox Mountain's crest, trending south-west toward Stockbridge Bowl.
const ridgeX = (y) => -3.6 + 0.3 * (y - 2.9);

export const LAKES = [
  { name: "Stockbridge Bowl", lat: 42.333, lon: -73.316, rx: 0.62, ry: 1.05, ft: 926 },
  { name: "Laurel Lake", lat: 42.3225, lon: -73.272, rx: 0.5, ry: 0.35, ft: 1000 },
].map((lake) => ({ ...lake, at: toKm(lake.lat, lake.lon) }));

export function landFt(x, y) {
  let h = 990;
  h += 210 * bump(x, y, -0.8, 0.2, 1.5, 2.4);
  h += 1117 * Math.exp(-((y - 2.9) ** 2) / (2 * 6 * 6)) * Math.exp(-((x - ridgeX(y)) ** 2) / (2 * 0.9 * 0.9));
  const xr = riverX(y);
  h += 780 * smooth(xr + 0.4, xr + 2.8, x);
  h -= 170 * bump(x, y, LAKES[0].at[0], LAKES[0].at[1], 1.2, 1.5);
  const floor = riverFloor(y);
  h = floor + (h - floor) * smooth(0, 1.4, Math.abs(x - xr));
  return Math.max(920, h);
}

export function waterAt(x, y) {
  for (const lake of LAKES) {
    const u = (x - lake.at[0]) / lake.rx;
    const v = (y - lake.at[1]) / lake.ry;
    if (u * u + v * v <= 1) return { name: lake.name, ft: lake.ft };
  }
  if (Math.abs(x - riverX(y)) < 0.42) return { name: "Housatonic River", ft: Math.round(riverFloor(y)) };
  return null;
}

export const LANDMARKS = [
  { id: "village", name: "Lenox village", lat: 42.3565, lon: -73.2848 },
  { id: "summit", name: "Lenox Mountain", lat: 42.381, lon: -73.318 },
  { id: "tanglewood", name: "Tanglewood", lat: 42.348, lon: -73.31 },
  { id: "mount", name: "The Mount", lat: 42.3307, lon: -73.2825 },
].map((m) => ({ ...m, at: toKm(m.lat, m.lon) }));

const cellOf = ([x, y]) => [Math.floor((x + HALF_KM) / CELL_KM), Math.floor((y + HALF_KM) / CELL_KM)];

// One cell per column: i runs west to east, j south to north.
export const CELLS = [];
for (let j = 0; j < N; j++) {
  for (let i = 0; i < N; i++) {
    const x = -HALF_KM + (i + 0.5) * CELL_KM;
    const y = -HALF_KM + (j + 0.5) * CELL_KM;
    const water = waterAt(x, y);
    const ft = Math.round(water ? water.ft : landFt(x, y));
    const mark = LANDMARKS.find((m) => cellOf(m.at)[0] === i && cellOf(m.at)[1] === j);
    let place = mark?.name ?? water?.name;
    if (!place) {
      if (x > riverX(y) + 0.4) place = "October Mountain slopes";
      else if (ft > 1500) place = "Yokun Ridge";
      else if (Math.hypot(x + 0.8, y - 0.2) < 1.3) place = "Lenox village";
      else if (x > riverX(y) - 1.6) place = y > 0 ? "New Lenox" : "Lenox Dale";
      else place = "Lenox";
    }
    const [lat, lon] = toLatLon(x, y);
    CELLS.push({ i, j, x, y, ft, water: Boolean(water), place, mark: mark?.id ?? null, lat, lon });
  }
}

export const FT_MIN = Math.min(...CELLS.map((c) => c.ft));
export const FT_MAX = Math.max(...CELLS.map((c) => c.ft));

// The model's world size: the 9.6 km square becomes 91.2 units, heights exaggerated.
export const CELL = 8.4;
export const UNIT_KM = CELL_KM / CELL;
export const FT_PER_UNIT = 40;
export const EXAGGERATION = (FT_PER_UNIT * 0.3048) ** -1 * UNIT_KM * 1000;
export const heightOf = (ft) => 2 + (ft - 900) / FT_PER_UNIT;

// Compass names for a bearing in degrees.
const POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
export const compass = (deg) => POINTS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
