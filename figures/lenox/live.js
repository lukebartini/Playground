const DATA = __DATA__;
const follow = null;
const stage = document.querySelector(".lx-stage");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const SPEED = 9;
let angle = 0;
let target = 0;
let frame = 0;
let last = 0;
let visible = false;
let touring = !still.matches;
let idle = 0;
let drawn = null;
let hover = null;
let pointer = null;
let own = false;
let ctl = null;
let cost = 0;
let odd = false;
const liveLayer = stage.querySelector('[data-live="model"]');
const groupOf = (name) => liveLayer.querySelector(`[data-name="${name}"]`);

const fmt = (n) => n.toLocaleString("en-US");
const bearingOf = () => {
  // Where the viewer stands, as a bearing in the model's own north-up frame.
  const north = ctl.anchor("model", [DATA.pivot[0], DATA.pivot[1], 0], [0, 1, 0]).direction;
  const east = [north[1], -north[0]];
  const b = (Math.atan2(DATA.v[0] * east[0] + DATA.v[1] * east[1], DATA.v[0] * north[0] + DATA.v[1] * north[1]) * 180) / Math.PI;
  return (b + 360) % 360;
};
const show = () => {
  const b = bearingOf();
  const facing = `seen from ${compass(b)} · ${String(Math.round(b) % 360).padStart(3, "0")}°`;
  const cell = hover === null ? null : DATA.columns[hover];
  const text = cell ? `${cell.p} · ≈${fmt(Math.round(cell.ft / 10) * 10)} ft · ${cell.lat.toFixed(3)}° N ${Math.abs(cell.lon).toFixed(3)}° W` : facing;
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(Math.round(b) % 360));
  stage.setAttribute("aria-valuetext", facing);
};
const hold = () => {
  touring = false;
  clearTimeout(idle);
  idle = setTimeout(() => {
    touring = !still.matches;
    run();
  }, 4200);
};
const controller = TURN.mount(stage, DATA.turn, {
  follow,
  onHold: () => {
    touring = false;
    clearTimeout(idle);
  },
  onFrame: (turned) => {
    ctl = turned;
    if (!own) angle = target = drawn = turned.values.model;
    pick();
    show();
  },
});

// Hit-test the columns: the nearest column whose projected box holds the pointer.
const inside = (pt, hull) => {
  let sign = 0;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const c = (b[0] - a[0]) * (pt[1] - a[1]) - (b[1] - a[1]) * (pt[0] - a[0]);
    if (c === 0) continue;
    if (!sign) sign = Math.sign(c);
    else if (Math.sign(c) !== sign) return false;
  }
  return true;
};
const hullOf = (points) => {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper = [];
  for (const q of p.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
};
function pick() {
  if (!ctl) return;
  let best = null;
  let bestDepth = -Infinity;
  if (pointer) {
    const V = ctl.cams().world.V;
    const h = DATA.half;
    DATA.columns.forEach((c, index) => {
      const centre = null;
      const corners = [];
      for (const [dx, dy] of [[-h, -h], [h, -h], [h, h], [-h, h]]) for (const z of [DATA.floor, c.z]) corners.push(ctl.anchor("model", [c.x + dx, c.y + dy, z]).screen);
      if (!inside(pointer, hullOf(corners))) return;
      const top = ctl.anchor("model", [c.x, c.y, c.z]).world;
      const depth = top[0] * V[0] + top[1] * V[1] + top[2] * V[2];
      void centre;
      if (depth > bestDepth) {
        bestDepth = depth;
        best = index;
      }
    });
  }
  if (best === hover) return;
  if (hover !== null) groupOf(DATA.columns[hover].n)?.removeAttribute("data-hover");
  hover = best;
  if (hover !== null) groupOf(DATA.columns[hover].n)?.setAttribute("data-hover", "");
}

const draw = () => {
  own = true;
  controller.set({ model: angle });
  own = false;
  drawn = angle;
};
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring) target += SPEED * dt;
  angle = still.matches ? target : angle + (target - angle) * (1 - Math.exp(-dt / 0.14));
  if (Math.abs(target - angle) < 1e-3) angle = target;
  // Adaptive half rate: when a frame's render runs long, draw the live layer every other frame.
  odd = !odd;
  if ((drawn === null || Math.abs(angle - drawn) > 1e-4) && (cost < 14 || odd || angle === target)) {
    const t0 = performance.now();
    draw();
    const spent = performance.now() - t0;
    cost += (spent - cost) * 0.2;
    if (cost < 9) odd = true;
  }
  const settled = !touring && angle === target;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
};
new IntersectionObserver(
  (entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) run();
    else if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  },
  { rootMargin: "120px 0px" },
).observe(stage);

const toView = (event) => {
  const rect = stage.getBoundingClientRect();
  return [((event.clientX - rect.left) * DATA.view[0]) / rect.width, ((event.clientY - rect.top) * DATA.view[1]) / rect.height];
};
let drag = null;
stage.addEventListener("pointerdown", (event) => {
  hold();
  drag = { from: controller.angleAt(event.clientX, event.clientY, 13, "model"), base: target, id: event.pointerId, captured: false };
});
stage.addEventListener("pointermove", (event) => {
  pointer = toView(event);
  if (!drag || event.pointerId !== drag.id) {
    pick();
    show();
    return;
  }
  hold();
  const delta = controller.angleAt(event.clientX, event.clientY, 13, "model") - drag.from;
  if (!drag.captured && Math.abs(delta) > 1.5) {
    drag.captured = true;
    stage.setPointerCapture(event.pointerId);
    stage.setAttribute("data-drag", "");
  }
  if (!drag.captured) return;
  target = drag.base + delta;
  run();
});
stage.addEventListener("pointerleave", () => {
  pointer = null;
  pick();
  show();
});
const release = (event) => {
  if (!drag || event.pointerId !== drag.id) return;
  drag = null;
  stage.removeAttribute("data-drag");
  try {
    stage.releasePointerCapture(event.pointerId);
  } catch {}
};
stage.addEventListener("pointerup", release);
stage.addEventListener("pointercancel", release);
stage.addEventListener("keydown", (event) => {
  const step = event.shiftKey ? 45 : 15;
  let next = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") next = Math.round(target / 15) * 15 - step;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = Math.round(target / 15) * 15 + step;
  if (event.key === "Home") next = 0;
  if (next === null) return;
  event.preventDefault();
  hold();
  target = next;
  run();
});
if (still.matches) touring = false;
draw();
show();
