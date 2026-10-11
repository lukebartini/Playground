import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../.claude/skills/anatomy/kit/iso-kit.mjs";
import * as G from "../../.claude/skills/anatomy/kit/lathe.mjs";
import * as A from "../../.claude/skills/anatomy/kit/audit.mjs";
import { tubePieces, tubeSvg } from "../../.claude/skills/anatomy/kit/tube.mjs";
import { turning } from "../../.claude/skills/anatomy/kit/turn-build.mjs";
import * as TA from "../../.claude/skills/anatomy/kit/turn-audit.mjs";
import { turnScript } from "../../.claude/skills/anatomy/scripts/inline-kit.mjs";
import * as M from "./model.mjs";
import { COASTS } from "./coasts.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const theme = argv.includes("--light") ? "light" : "dark";

const WIDTH = 680;
const HEIGHT = 470;
const AZIMUTH = 58;
const ELEVATION = 34;
const D2R = Math.PI / 180;

// The bench: one long board carrying the relief turntable (right) and the globe (left).
const BASE = { x: -130, y: -96, w: 276, d: 192, r: 10 };
const BASE_H = 14;
const FOOT_H = 5;
const TT = [44, 0];
const RT = 86;
const PED_R = 40;
const PED_TOP = 6;
const DISC_TOP = 11.5;
const DECK = 13;
const TRAY_IN = 50.6;
const TRAY_T = 3;
const FLOOR_TOP = 15;
const WALL_TOP = 19.5;
const GLOBE_AT = [-90, -18];
const RG = 24;
const RM = RG + 3.4;
const RING_R = 1.25;
export const RW = 9;
const STEM_R = 3;
const TILT = 23.44;

const V2 = [Math.cos(AZIMUTH * D2R), Math.sin(AZIMUTH * D2R)];
const ACROSS = [-V2[1], V2[0], 0];
const GLOBE_C = [GLOBE_AT[0], GLOBE_AT[1], 40 + RM + RING_R];

const tops = M.CELLS.map((c) => FLOOR_TOP + M.heightOf(c.ft));
const MODEL_TOP = Math.max(...tops) + 10;
export const P = k.fitProjection([...k.boxCorners(BASE, -BASE_H - FOOT_H, 0), [TT[0], TT[1], MODEL_TOP], [GLOBE_C[0], GLOBE_C[1], GLOBE_C[2] + RM + 2], [GLOBE_C[0] + ACROSS[0] * (RM + 2), GLOBE_C[1] + ACROSS[1] * (RM + 2), GLOBE_C[2]], [GLOBE_C[0] - ACROSS[0] * (RM + 2), GLOBE_C[1] - ACROSS[1] * (RM + 2), GLOBE_C[2]]], WIDTH, HEIGHT, { pad: 26, azimuth: AZIMUTH, elevation: ELEVATION });
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const VIEW = G.viewOf(P);
const SCALE = G.scaleOf(P);
const VERT = (x, y) => G.frameOf([x, y, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const f1 = (v) => v.toFixed(1);
const f3 = (v) => v.toFixed(3);

export const R = A.recorder(P);
const put = (item) => R.put({ ...item, shapes: item.shapes.map((shape, index) => R.solid(Object.assign(shape, { name: shape.name ?? (index ? `${item.name}#${index + 1}` : item.name) }))) });

// ---------------------------------------------------------------- bench
function bench() {
  for (const [x, y] of k.corners(BASE, 24)) {
    const svg = S(k.cylinder(x, y, 7.4, -BASE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }) + S(k.cylinder(x, y, 5.6, -BASE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" });
    put({ name: `stand.foot.${x}.${y}`, layer: "back", at: [x, y, -BASE_H - FOOT_H], svg, shapes: [A.cylinder(x, y, 7.4, -BASE_H - FOOT_H, 1.6, { ground: true }), A.cylinder(x, y, 5.6, -BASE_H - FOOT_H + 1.6, FOOT_H - 1.6)] });
  }
  const screws = k.corners(BASE, 8);
  const inner = L(k.sideSeam(BASE, -BASE_H + 4.5, P, 8), { tone: "faint" });
  const svg = S(k.slabOf(BASE, -BASE_H, BASE_H, P, 8, 1.6), { tone: "mid", inner }) + L(k.planOutline(k.insetPlan(BASE, 5), 0, P, 8), { tone: "faint" }) + L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }) + D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 });
  put({ name: "stand.base", layer: "back", at: [0, 0, -BASE_H], bias: -40, svg, shapes: [A.slab(BASE, -BASE_H, BASE_H, { ground: true })] });

  // The bearing pedestal the turntable rides on, with its bolt circle.
  const ped = S(k.cylinder(TT[0], TT[1], PED_R + 3, 0, 1.4, P, 72, 0.5), { tone: "lo" });
  put({ name: "stand.ped.flange", layer: "back", at: [TT[0], TT[1], 0], svg: ped + D(boltCircle(TT, PED_R + 1.4, 1.4, 16), { size: 0.45 }), shapes: [A.cylinder(TT[0], TT[1], PED_R + 3, 0, 1.4)] });
  const pedBody = S(k.cylinder(TT[0], TT[1], PED_R, 1.4, PED_TOP - 1.4, P, 72), { tone: "mid", inner: L(k.sideArc(TT[0], TT[1], PED_R, 3.6, P, 48), { tone: "faint" }) });
  put({ name: "stand.ped", layer: "back", at: [TT[0], TT[1], 1.4], svg: pedBody, shapes: [A.cylinder(TT[0], TT[1], PED_R, 1.4, PED_TOP - 1.4)] });

  // Scale bar: a ruler strip engraved in kilometres at the model's own scale.
  const KM = 1 / M.UNIT_KM;
  const strip = { x: -66, y: 76, w: 5 * KM + 8, d: 8, r: 1 };
  const t = k.topTicks(strip.x + 4, strip.x + 4 + 5 * KM, KM / 2, 2, strip.y + 0.01, 0.7, [2.2, 4], P);
  const halfKm = k.topTicks(strip.x + 4, strip.x + 4 + 5 * KM, KM / 10, 5, strip.y + 0.01, 0.7, [1.1, 0], P);
  const stripSvg = S(k.slabOf(strip, 0, 0.7, P, 3), { tone: "lo", crease: "none" }) + L(halfKm.minor, { tone: "faint" }) + L(t.minor, { tone: "lo" }) + L(t.major, { tone: "mid" });
  put({ name: "stand.scale", layer: "back", at: [strip.x + strip.w / 2, strip.y + strip.d / 2, 0], svg: stripSvg, shapes: [A.slab(strip, 0, 0.7)] });

  // Label plate with three engraved rule lines and two screws.
  const plate = { x: -116, y: 60, w: 40, d: 22, r: 1.6 };
  const rules = [[0.82, 6], [0.6, 11], [0.7, 16]].map(([len, y]) => L(k.lineOnTop([plate.x + 4, plate.y + y], [plate.x + 4 + (plate.w - 8) * len, plate.y + y], 0.8, P), { tone: "lo", free: true })).join("");
  const plateSvg = S(k.slabOf(plate, 0, 0.8, P, 4), { tone: "mid", crease: "faint" }) + L(k.planOutline(k.insetPlan(plate, 1.6), 0.8, P, 4), { tone: "faint" }) + rules + D([at([plate.x + 2.4, plate.y + plate.d / 2, 0.8]), at([plate.x + plate.w - 2.4, plate.y + plate.d / 2, 0.8])], { size: 0.5 });
  put({ name: "stand.label", layer: "back", at: [plate.x + plate.w / 2, plate.y + plate.d / 2, 0], svg: plateSvg, shapes: [A.slab(plate, 0, 0.8)] });

  // The bearing index: a post at the front of the turntable with a brass wedge reaching to the rim.
  const ix = [TT[0] + V2[0] * (RT + 8), TT[1] + V2[1] * (RT + 8)];
  const post = S(k.cylinder(ix[0], ix[1], 4.2, 0, 1.2, P, 28), { tone: "lo" }) + S(k.cylinder(ix[0], ix[1], 2.6, 1.2, DECK - 2.6, P, 24), { tone: "mid", crease: "none", inner: L(k.sideArc(ix[0], ix[1], 2.6, 4, P, 16), { tone: "faint" }) });
  put({ name: "stand.index.post", layer: "front", at: [ix[0], ix[1], 0], svg: post, shapes: [A.cylinder(ix[0], ix[1], 4.2, 0, 1.2), A.cylinder(ix[0], ix[1], 2.6, 1.2, DECK - 2.6)] });
  const c = V2[0];
  const s = V2[1];
  const wedge = [[RT + 0.8, -0.5], [RT + 0.8, 0.5], [RT + 10.6, 3.2], [RT + 10.6, -3.2]].map(([r, w]) => [TT[0] + c * r - s * w, TT[1] + s * r + c * w]);
  const wedgeSvg = S(k.extrude(wedge, DECK - 1.4, 1.6, P, { bevel: 0.3 }), { tone: "hi" }) + D([at([ix[0], ix[1], DECK + 0.2])], { size: 0.5 });
  put({ name: "stand.index", layer: "front", at: [ix[0], ix[1], DECK], svg: `<g data-mat="brass">${wedgeSvg}</g>`, shapes: [A.extruded(wedge, DECK - 1.4, 1.6)] });
}

const boltCircle = (c, r, z, n, phase = 0.5) => Array.from({ length: n }, (_, i) => {
  const a = ((i + phase) / n) * Math.PI * 2;
  return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
}).filter(([x, y]) => (x - c[0]) * V2[0] + (y - c[1]) * V2[1] > -r * 0.2).map(([x, y]) => at([x, y, z]));

// ---------------------------------------------------------------- globe
const AXIS = G.unit3(G.add3(G.mul3([0, 0, 1], Math.cos(TILT * D2R)), G.mul3(ACROSS, Math.sin(TILT * D2R))));
const E0 = G.unit3(G.sub3(VIEW, G.mul3(AXIS, G.dot3(VIEW, AXIS))));
const E1 = G.cross3(E0, AXIS);
const LON0 = M.TOWN.lon + 16;
const dirOf = (lat, lon) => {
  const p = lat * D2R;
  const l = (lon - LON0) * D2R;
  return G.add3(G.add3(G.mul3(E0, Math.cos(p) * Math.cos(l)), G.mul3(E1, Math.cos(p) * Math.sin(l))), G.mul3(AXIS, Math.sin(p)));
};
const onGlobe = (d, r = RG) => G.add3(GLOBE_C, G.mul3(d, r));
const toLimb = (d) => (G.dot3(d, VIEW) >= 0 ? d : G.unit3(G.sub3(d, G.mul3(VIEW, G.dot3(d, VIEW)))));
const densify = (ring, closed, step = 1.5) => {
  const out = [];
  const n = ring.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    const count = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / step));
    for (let j = 0; j < count; j++) out.push([a[0] + ((b[0] - a[0]) * j) / count, a[1] + ((b[1] - a[1]) * j) / count]);
  }
  if (!closed) out.push(ring[n - 1]);
  return out;
};
const visibleRuns = (dirs) => {
  const runs = [];
  let run = [];
  for (const d of dirs) {
    if (G.dot3(d, VIEW) > 0.02) run.push(at(onGlobe(d)));
    else if (run.length) {
      if (run.length > 1) runs.push(run);
      run = [];
    }
  }
  if (run.length > 1) runs.push(run);
  return runs.map((points) => k.pathOf(points)).join("");
};

function globe() {
  // Turned pedestal: foot, ogee and stem up to the meridian ring.
  const STEM_TOP = GLOBE_C[2] - RM - RING_R;
  const pf = [[0, 24], [2.4, 24], [2.4, 22.4], [3.6, 21.6, 1], [5.4, 19.4, 1], [7.4, 15.4, 1], [9.4, 10.8, 1], [11.2, 7.6, 1], [12.4, 6.4], [12.4, 5.2], [14.2, 4.4], [14.2, STEM_R]];
  const F = VERT(GLOBE_AT[0], GLOBE_AT[1]);
  const foot = G.solidOf(pf, F, P, { smooth: true });
  const footSeam = L(G.arcOf(F, 1.2, 24, P), { tone: "faint" });
  put({ name: "stand.globe.foot", layer: "front", at: [GLOBE_AT[0], GLOBE_AT[1], 0], svg: `<g data-mat="gunmetal">${S(foot, { tone: "mid", inner: footSeam })}</g>`, shapes: [A.solid(F, pf, { ground: true })] });
  const stem = G.solidOf([[14.2, STEM_R], [STEM_TOP - 3, STEM_R], [STEM_TOP - 3, STEM_R + 1.2], [STEM_TOP, STEM_R + 1.2]], F, P);
  put({ name: "stand.globe.stem", layer: "front", at: [GLOBE_AT[0], GLOBE_AT[1], 14.2], svg: `<g data-mat="brass">${S(stem, { tone: "mid", inner: L(G.arcOf(F, STEM_TOP - 3, STEM_R + 1.2, P), { tone: "faint" }) })}</g>`, shapes: [A.solid(F, [[14.2, STEM_R], [STEM_TOP - 3, STEM_R], [STEM_TOP - 3, STEM_R + 1.2], [STEM_TOP, STEM_R + 1.2]])] });

  // The meridian ring stands in the vertical plane facing the viewer, carrying the tilted axis.
  const RF = G.frameOf(GLOBE_C, [V2[0], V2[1], 0], ACROSS, [0, 0, 1]);
  const ringPts = G.arcPoints(RF, 0, RM, -Math.PI / 2, Math.PI * 1.5, 96);
  const pieces = tubePieces(ringPts, RING_R, P, { maxLength: 9, closed: true, rings: { pitch: 2.4, fade: [0.15, 0.6], tone: "faint" } });
  pieces.forEach((piece, index) => {
    put({ name: `stand.globe.ring.${index}`, layer: "front", at: piece.mid, svg: `<g data-mat="brass">${tubeSvg(piece, { tone: "hi" })}</g>`, shapes: [A.tube(piece.points, RING_R, { owner: "stand.globe.ring" })] });
  });
  R.route("stand.globe.ring", ringPts, RING_R, { closed: true, touch: ["stand.globe.stem", "stand.globe.pin.n", "stand.globe.pin.s"] });

  // Axis pins from the poles to the ring.
  for (const sign of [1, -1]) {
    const a = G.mul3(AXIS, sign);
    const PF = G.frameAlong(GLOBE_C, a);
    const s0 = RG + 1.1;
    const s1 = RM - Math.sqrt(RING_R * RING_R - 0.8 * 0.8);
    const pin = G.disc(s0, s1, 0.8, PF, P);
    const cap = G.disc(RG, s0, 1.9, PF, P);
    put({ name: `stand.globe.pin.${sign > 0 ? "n" : "s"}`, layer: "front", at: G.pointOf(PF, (s0 + s1) / 2, 0, 0), svg: `<g data-mat="brass">${S(cap, { tone: "hi" })}${S(pin, { tone: "mid" })}</g>`, shapes: [A.disc(PF, s0, s1, 0.8, { owner: "stand.globe.ring" }), A.disc(PF, RG, s0, 1.9)] });
  }

  // The globe: smooth sphere, land, graticule and the Lenox pin.
  const ball = G.sphereOf(GLOBE_C, RG, P, { steps: 64 });
  const lands = COASTS.map((ring) => {
    const points = densify(ring, true).map(([lat, lon]) => at(onGlobe(toLimb(dirOf(lat, lon)))));
    return k.pathOf(points, true);
  }).join("");
  const coast = COASTS.map((ring) => visibleRuns(densify(ring, true).concat([ring[0]]).map(([lat, lon]) => dirOf(lat, lon)))).join("");
  const grat = [];
  for (const lat of [-60, -30, 0, 30, 60]) grat.push(visibleRuns(Array.from({ length: 181 }, (_, i) => dirOf(lat, -180 + i * 2))));
  for (let lon = -180; lon < 180; lon += 30) grat.push(visibleRuns(Array.from({ length: 91 }, (_, i) => dirOf(-88 + i * (176 / 90), lon))));
  const lenoxLat = visibleRuns(Array.from({ length: 181 }, (_, i) => dirOf(M.TOWN.lat, -180 + i * 2)));
  const inner = `<path class="lx-land" d="${lands}"/>` + L(grat.join(""), { tone: "faint" }) + L(lenoxLat, { tone: "lo", className: "lx-parallel" }) + L(coast, { tone: "lo" });
  put({ name: "stand.globe.ball", layer: "front", at: GLOBE_C, svg: `<g class="lx-globe">${S(ball, { tone: "hi", inner })}</g>`, shapes: [A.ball(GLOBE_C, RG)] });

  const dL = dirOf(M.TOWN.lat, M.TOWN.lon);
  const LF = G.frameAlong(GLOBE_C, dL);
  const HEAD = 1.7;
  const STEM_L = 5.2;
  const pinStem = G.disc(RG - 0.05, RG + STEM_L - Math.sqrt(HEAD * HEAD - 0.32 * 0.32) + 0.1, 0.32, LF, P);
  const headC = onGlobe(dL, RG + STEM_L);
  const head = G.sphereOf(headC, HEAD, P, { steps: 24 });
  put({ name: "stand.globe.lenox", layer: "front", at: headC, bias: 2, svg: `<g data-mat="brass">${S(pinStem, { tone: "mid" })}${S(head, { tone: "hi", lit: true })}</g>${D([at(onGlobe(dL))], { size: 0.55, tone: "hi" })}`, shapes: [A.disc(LF, RG - 0.05, RG + STEM_L - 1.6, 0.32), A.ball(headC, HEAD)] });
}

// ---------------------------------------------------------------- the turning relief
export const T = turning(P, { recorder: R });
const model = T.group("model", { turn: { pivot: TT } });
// The thumbwheel that drives the deck's knurled rim, front right of the index.
const DRIVE_AT = (() => {
  const a = Math.atan2(V2[1], V2[0]) - 38 * D2R;
  return [TT[0] + (RT + RW) * Math.cos(a), TT[1] + (RT + RW) * Math.sin(a)];
})();
const drive = T.group("drive", { turn: { pivot: DRIVE_AT } });
const LIVE = T.layer("model");
T.stack(["back", "model", "front"]);
export const follow = (values) => ({ ...values, drive: -((values.model ?? 0) * 86) / 9 });
export const poses = () => Array.from({ length: 720 }, (_, i) => follow({ model: i * 0.5 }));

const ringPath = (r, steps = 240) => Array.from({ length: steps }, (_, j) => `${j ? "L" : "M"}${f3(r * Math.cos((j / steps) * Math.PI * 2))} ${f3(r * Math.sin((j / steps) * Math.PI * 2))}`).join("") + "Z";
const compassFace = () => {
  // Plane coordinates: x east, y north, centred on the pivot. Bearing b points to (sin b, cos b).
  const minor = [];
  const major = [];
  const rim = RT - 2.6;
  for (let i = 0; i < 72; i++) {
    const b = (i / 72) * Math.PI * 2;
    const len = i % 6 ? 1.6 : 3.2;
    (i % 6 ? minor : major).push(`M${f3(Math.sin(b) * rim)} ${f3(Math.cos(b) * rim)}L${f3(Math.sin(b) * (rim - len))} ${f3(Math.cos(b) * (rim - len))}`);
  }
  const letters = [["N", 0], ["E", 90], ["S", 180], ["W", 270]].map(([t, b]) => {
    const r = t === "N" ? 70.4 : 69.6;
    return `<text class="iso-face-text" data-tone="${t === "N" ? "hi" : "mid"}" font-size="${t === "N" ? 5.2 : 4.2}" text-anchor="middle" transform="translate(${f3(Math.sin(b * D2R) * r)} ${f3(Math.cos(b * D2R) * r)}) rotate(${f1(-b)}) translate(0 1.6)">${t}</text>`;
  }).join("");
  const numerals = [30, 60, 120, 150, 210, 240, 300, 330].map((b) => `<text class="iso-face-text" data-tone="lo" font-size="2.6" text-anchor="middle" transform="translate(${f3(Math.sin(b * D2R) * (rim - 5.6))} ${f3(Math.cos(b * D2R) * (rim - 5.6))}) rotate(${f1(-b)}) translate(0 0.9)">${String(b).padStart(3, "0")}</text>`).join("");
  return `<path class="iso-line" data-tone="lo" d="${ringPath(rim)}"/><path class="iso-line" data-tone="lo" d="${minor.join("")}"/><path class="iso-line" data-tone="mid" d="${major.join("")}"/>${letters}${numerals}<path class="iso-line" data-tone="faint" d="${ringPath(RT - 0.6)}"/>`;
};

function relief() {
  const F = VERT(TT[0], TT[1]);
  T.round({ name: "deck.disc", group: model, layer: LIVE, F, s0: PED_TOP, s1: DISC_TOP, r: RT, tone: "mid", crease: "lo", material: "gunmetal", details: { ribs: { s0: PED_TOP + 0.8, s1: DISC_TOP - 0.8, count: 220, fade: [0.08, 0.5], seams: true, tone: "lo" } } });
  const bevel = T.round({ name: "deck.top", group: model, layer: LIVE, F, s0: DISC_TOP, s1: DECK, r: [RT, RT - 1.4], tone: "hi", crease: "lo" });
  T.plane({ part: bevel, o: [TT[0], TT[1], DECK], u: [1, 0, 0], v: [0, 1, 0], svg: compassFace(), fade: [0.04, 0.3] });

  // North arrow: a brass wedge on the deck pointing at N.
  const arrow = [[-3.4, TRAY_IN + TRAY_T + 2.4], [3.4, TRAY_IN + TRAY_T + 2.4], [0, TRAY_IN + TRAY_T + 10.6]].map(([x, y]) => [TT[0] + x, TT[1] + y]);
  T.prism({ name: "deck.north", group: model, layer: LIVE, F: { o: [0, 0, 0], a: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] }, polygon: arrow, s0: DECK, s1: DECK + 1.2, tone: "hi", crease: "lo", bevel: 0.3, material: "brass", details: { dots: [{ at: [DECK + 1.2, TT[0], TT[1] + TRAY_IN + TRAY_T + 4.6], normal: [0, 0, 1], size: 0.45 }] } });

  // The tray: a floor plate and four frame bars with screws.
  const tray = (name, plan, z0, z1, extra = {}) => T.prism({ name, group: model, layer: LIVE, plan: { ...plan, x: plan.x + TT[0], y: plan.y + TT[1] }, z: z0, h: z1 - z0, steps: 2, tone: "mid", crease: "faint", bevel: 0.4, material: "steel", ...extra });
  tray("tray.floor", { x: -TRAY_IN, y: -TRAY_IN, w: 2 * TRAY_IN, d: 2 * TRAY_IN, r: 0.6 }, DECK, FLOOR_TOP, { tone: "lo", bevel: 0 });
  const O = TRAY_IN + TRAY_T;
  const screwsOn = (pts) => pts.map(([x, y]) => ({ at: [WALL_TOP, x + TT[0], y + TT[1]], normal: [0, 0, 1], size: 0.42, tone: "mid" }));
  tray("tray.n", { x: -O, y: TRAY_IN, w: 2 * O, d: TRAY_T, r: 0.6 }, DECK, WALL_TOP, { details: { dots: screwsOn([[-O + 1.5, TRAY_IN + 1.5], [0, TRAY_IN + 1.5], [O - 1.5, TRAY_IN + 1.5]]) } });
  tray("tray.s", { x: -O, y: -O, w: 2 * O, d: TRAY_T, r: 0.6 }, DECK, WALL_TOP, { details: { dots: screwsOn([[-O + 1.5, -O + 1.5], [0, -O + 1.5], [O - 1.5, -O + 1.5]]) } });
  tray("tray.e", { x: TRAY_IN, y: -TRAY_IN, w: TRAY_T, d: 2 * TRAY_IN, r: 0.6 }, DECK, WALL_TOP, { details: { dots: screwsOn([[TRAY_IN + 1.5, 0]]) } });
  tray("tray.w", { x: -O, y: -TRAY_IN, w: TRAY_T, d: 2 * TRAY_IN, r: 0.6 }, DECK, WALL_TOP, { details: { dots: screwsOn([[-O + 1.5, 0]]) } });

  // 144 columns: one per 0.8 km square, as tall as the ground under it.
  const half = (M.CELL - 0.5) / 2;
  for (const cell of M.CELLS) {
    const cx = TT[0] + cell.x / M.UNIT_KM;
    const cy = TT[1] + cell.y / M.UNIT_KM;
    const h = M.heightOf(cell.ft);
    const name = `${cell.water ? "w" : "c"}.${cell.i}.${cell.j}`;
    T.prism({ name, group: model, layer: LIVE, plan: { x: cx - half, y: cy - half, w: 2 * half, d: 2 * half, r: 0 }, z: FLOOR_TOP, h, steps: 1, tone: cell.water ? "lo" : "hi", crease: cell.water ? "faint" : "lo", lit: cell.mark === "village" });
  }

  // Engraved maker's label on the north frame bar's outer face.
  const north = T.parts.find((part) => part.name === "tray.n");
  const label = `<text class="iso-face-text" data-tone="lo" font-size="2.5" letter-spacing="0.9" text-anchor="middle" transform="translate(0 0.9)">LENOX · BERKSHIRE CO. · MASS. · 1 : 95 000</text>`;
  T.plane({ part: north, o: [TT[0], TT[1] + TRAY_IN + TRAY_T, (DECK + WALL_TOP) / 2], u: [1, 0, 0], v: [0, 0, -1], normal: [0, 1, 0], svg: label, fade: [0.05, 0.35] });

  // Drive: axle post on the bench, knurled wheel on the rim's height, hub and a crank knob.
  const DF = VERT(DRIVE_AT[0], DRIVE_AT[1]);
  T.round({ name: "drive.post", group: drive, layer: LIVE, F: DF, s0: 0, s1: PED_TOP + 0.6, r: 3.2, tone: "mid", material: "steel" });
  T.round({ name: "drive.wheel", group: drive, layer: LIVE, F: DF, s0: PED_TOP + 0.6, s1: DISC_TOP - 0.4, r: RW, tone: "hi", crease: "lo", material: "brass", details: { ribs: { s0: PED_TOP + 1.1, s1: DISC_TOP - 0.9, count: 40, fade: [0.08, 0.5], seams: true, tone: "lo" } } });
  T.round({ name: "drive.hub", group: drive, layer: LIVE, F: DF, s0: DISC_TOP - 0.4, s1: DISC_TOP + 0.8, r: 4.2, tone: "mid", material: "steel", details: { bolts: [{ s: DISC_TOP + 0.8, r: 2.8, count: 3, size: 0.4, phase: 0.2 }] } });
  const KNOB = [DRIVE_AT[0] + 6.4, DRIVE_AT[1]];
  T.round({ name: "drive.knob", group: drive, layer: LIVE, F: VERT(KNOB[0], KNOB[1]), s0: DISC_TOP - 0.4, s1: DISC_TOP + 5.4, r: 1.5, ends: ["flat", "dome"], tone: "hi", material: "rubber" });

  // Brass map pins: the village (tall) and three landmarks.
  for (const mark of M.LANDMARKS) {
    const cell = M.CELLS.find((c) => c.mark === mark.id);
    const x = TT[0] + mark.at[0] / M.UNIT_KM;
    const y = TT[1] + mark.at[1] / M.UNIT_KM;
    const cx = TT[0] + cell.x / M.UNIT_KM;
    const cy = TT[1] + cell.y / M.UNIT_KM;
    const px = Math.min(cx + half - 1.6, Math.max(cx - half + 1.6, x));
    const py = Math.min(cy + half - 1.6, Math.max(cy - half + 1.6, y));
    const top = FLOOR_TOP + M.heightOf(cell.ft);
    const tall = mark.id === "village" ? 11 : 6.5;
    const head = mark.id === "village" ? 1.9 : 1.35;
    T.round({ name: `pin.${mark.id}.stem`, group: model, layer: LIVE, F: VERT(px, py), s0: top, s1: top + tall, r: 0.34, tone: "mid", material: "steel" });
    T.round({ name: `pin.${mark.id}.head`, group: model, layer: LIVE, F: VERT(px, py), s0: top + tall, s1: top + tall + head * 1.6, r: head, ends: ["flat", "dome"], tone: "hi", material: mark.id === "village" ? "brass" : "chrome" });
  }
}

bench();
globe();
relief();
const verify = argv.includes("--verify");
// Each static part goes to the layer its relation to the turning relief proves (globe parts
// above the deck's reach are over it, the ones the cylinder rule puts behind are under it).
let out = null;
for (let pass = 0; pass < 4 && !out; pass++) {
  try {
    out = T.build({ statics: R.items, poses, verify });
  } catch (error) {
    const moves = [...String(error.message).matchAll(/static (\S+) is .* move it to a layer (under|over) model/g)];
    if (!moves.length) throw error;
    for (const [, name, side] of moves) R.items.find((item) => item.name === name).layer = side === "under" ? "back" : "front";
  }
}
A.settle(R, P);
const layerOf = (name) => R.items.filter((item) => item.layer === name).sort((a, b) => a.key - b.key).map((item) => item.svg);
const BACK = [`<path class="iso-halo" d="${k.haloOf(BASE, -BASE_H - FOOT_H, BASE_H, P)}"/>`, ...layerOf("back")];
const FRONT = layerOf("front");
if (argv.includes("--audit")) {
  A.auditOrExit(R, P);
  TA.orbitOrExit(T, R, P, { sweep: { at: (x) => follow({ model: x }), from: 0, to: 360, frame: 0.5 }, quick: argv.includes("--quick"), only: argv.find((a) => a.startsWith("--only="))?.slice(7).split(",") ?? null });
}

const LABEL = "A museum relief model of Lenox, Massachusetts on a compass turntable: 144 columns, one per 0.8 km square, each as tall as the ground it stands for, with the Housatonic River, Laurel Lake and Stockbridge Bowl as low water columns and brass pins at the village, Lenox Mountain, Tanglewood and The Mount. Beside it a desk globe carries the same brass pin at 42.36° N, 73.28° W.";
const backSvg = k.figureSvg({ width: WIDTH, height: HEIGHT, label: LABEL, body: BACK });
const staticSvg = (list) => `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg iso-layer" viewBox="0 0 ${WIDTH} ${HEIGHT}" aria-hidden="true">${list.join("")}</svg>`;
const stage = `<div class="iso-stage iso-turn lx-stage" tabindex="0" role="slider" aria-label="Relief model of Lenox: drag to turn it, or use the arrow keys; hover a column to read its height" aria-valuemin="0" aria-valuemax="359" aria-valuenow="0" aria-valuetext="seen from the north">${backSvg}${out.layerSvg("model", { width: WIDTH, height: HEIGHT })}${staticSvg(FRONT)}</div>`;

const COLUMNS = M.CELLS.map((c) => ({ n: `${c.water ? "w" : "c"}.${c.i}.${c.j}`, x: TT[0] + c.x / M.UNIT_KM, y: TT[1] + c.y / M.UNIT_KM, z: FLOOR_TOP + M.heightOf(c.ft), ft: c.ft, p: c.place, w: c.water ? 1 : 0, lat: +c.lat.toFixed(3), lon: +c.lon.toFixed(3) }));
const DATA = { turn: out.data, pivot: TT, half: (M.CELL - 0.5) / 2, floor: FLOOR_TOP, view: [WIDTH, HEIGHT], v: V2, columns: COLUMNS, town: M.TOWN };
const LIVE_JS = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA)).replace("const follow = null;", `const follow = ${follow.toString()};\nconst POINTS = ${JSON.stringify(["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"])};\nconst compass = ${M.compass.toString()};`);
const TINT = M.CELLS.filter((c) => !c.water).map((c) => `.iso-live [data-name="c.${c.i}.${c.j}"]{--lx-t:${Math.round(100 * Math.pow((c.ft - M.FT_MIN) / (M.FT_MAX - M.FT_MIN), 0.8))}}`).join("\n");
const CSS = out.css + "\n" + TINT + "\n" + readFileSync(join(HERE, "lenox.css"), "utf8");
const body = k.plateHtml({
  fig: "Fig 1",
  title: "Lenox, Massachusetts",
  hint: "Drag to turn · arrows · hover a column",
  readout: "seen from N · 000°",
  keys: [
    { mark: "raised", label: "Relief columns, 0.8 km squares, heights ×8" },
    { mark: "lit", label: "Lenox village, 1,207 ft, brass pin" },
    { mark: "flat", label: "Water: Housatonic River, Laurel Lake, Stockbridge Bowl" },
  ],
  caption: `Lenox sits at 42.36° N, 73.28° W in Berkshire County, western Massachusetts: a ${M.TOWN.areaSqMi} sq mi town of ${M.TOWN.population.toLocaleString("en-US")} people (2020) in the Housatonic valley. Yokun Ridge and Lenox Mountain (2,126 ft) wall it in on the west, the village sits on a terrace near 1,200 ft, and the Housatonic flows south through New Lenox and Lenox Dale toward Long Island Sound, with October Mountain rising east of it. Heights are modelled from published spot elevations, not a survey grid, so each column is approximate. The brass pin on the globe and the brass pin on the relief mark the same place.`,
  body: `<style>${CSS}</style>${stage}`,
});
const page = k.pageHtml({ title: "Lenox, Massachusetts", theme, body, script: turnScript() + (verify ? `window.__isoVerify = ${JSON.stringify(out.verify)};\n` : "") + LIVE_JS, width: 720 });
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const name = `lenox${verify ? "-verify" : ""}${theme === "light" ? "-light" : ""}.html`;
  writeFileSync(join(HERE, name), page);
  console.log(`wrote ${name} · ${(page.length / 1024).toFixed(0)} KB · ${out.report.parts} parts · ${out.report.layers.map((l) => `${l.name}: ${l.planar} planes, ${l.dynamic} dynamic`).join(" · ")} · build ${out.report.seconds.toFixed(1)} s`);
}

export { out };
