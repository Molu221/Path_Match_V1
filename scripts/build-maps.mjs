// Builds docs/geo.js: the outlines the Market map draws in its Canada and World views.
//
// Source: Natural Earth (naturalearthdata.com), public domain, read from its GitHub mirror (nvkelso/natural-earth-vector, GeoJSON):
//   ne_50m_admin_1_states_provinces  the 13 provinces and territories
//   ne_50m_admin_0_countries         the United States and Greenland next to Canada, and every country for the world view
//   ne_50m_lakes                     the Great Lakes and the other big lakes
// The outlines are projected here (Lambert conformal conic for Canada, Equal Earth for the world), simplified to well under a pixel
// and written as SVG path strings, so the site needs no map library and no network request for a map. Nothing here is a posting count:
// the page colours the shapes from the postings it has loaded.
//
// Run:  node scripts/build-maps.mjs            (needs network access to raw.githubusercontent.com)
//       node scripts/build-maps.mjs --dir path (a folder that already holds the three files above)
// Output: docs/geo.js (loaded by the page only when a map view is opened)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/";
const FILES = ["ne_50m_admin_1_states_provinces", "ne_50m_admin_0_countries", "ne_50m_lakes"];
const dirArg = process.argv.indexOf("--dir") > 0 ? process.argv[process.argv.indexOf("--dir") + 1] : "";

/* where the page puts a bubble: the centre of each city market (the regular expressions that decide which postings belong to it are in docs/index.html, CITIES). Cities closer than a bubble are left out, so the bubbles never overlap. */
const CITY_XY = {
  MTL: [45.50, -73.57], TOR: [43.65, -79.38], OTT: [45.42, -75.70], QUE: [46.81, -71.21], VAN: [49.28, -123.12], CGY: [51.05, -114.07],
  EDM: [53.55, -113.49], WPG: [49.90, -97.14], HAL: [44.65, -63.57], SAS: [52.13, -106.67], REG: [50.45, -104.62]
};

const rad = (d) => (d * Math.PI) / 180;
/* Lambert conformal conic on a sphere: the projection Statistics Canada uses for its national maps (parallels 49 and 77, central meridian 96 W) */
function lambert() {
  const p1 = rad(49), p2 = rad(77), p0 = rad(49), l0 = rad(-96);
  const n = Math.log(Math.cos(p1) / Math.cos(p2)) / Math.log(Math.tan(Math.PI / 4 + p2 / 2) / Math.tan(Math.PI / 4 + p1 / 2));
  const F = (Math.cos(p1) * Math.pow(Math.tan(Math.PI / 4 + p1 / 2), n)) / n;
  const rho = (p) => F / Math.pow(Math.tan(Math.PI / 4 + p / 2), n);
  const r0 = rho(p0);
  return ([lon, lat]) => { const r = rho(rad(Math.min(89.9, Math.max(-60, lat)))), t = n * (rad(lon) - l0); return [r * Math.sin(t), -(r0 - r * Math.cos(t))]; };
}
/* Equal Earth (Savric, Patterson and Jenny, 2018): equal areas, so Canada is not stretched toward the pole */
function equalEarth() {
  const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
  return ([lon, lat]) => {
    const th = Math.asin(M * Math.sin(rad(lat))), t2 = th * th, t6 = t2 * t2 * t2;
    return [(rad(lon) * Math.cos(th)) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2))), -th * (A1 + A2 * t2 + t6 * (A3 + 3 * A4 * t2))];
  };
}

/* Ramer-Douglas-Peucker on a ring (closed: the first point is the last) */
function simplify(pts, eps) {
  if (pts.length < 5) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let md = 0, mi = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    for (let i = a + 1; i < b; i++) {
      const d = len ? Math.abs(dy * (pts[i][0] - ax) - dx * (pts[i][1] - ay)) / len : Math.hypot(pts[i][0] - ax, pts[i][1] - ay);
      if (d > md) { md = d; mi = i; }
    }
    if (md > eps && mi > 0) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const area = (r) => { let s = 0; for (let i = 0; i < r.length - 1; i++) s += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return s / 2; };
function centroid(r) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < r.length - 1; i++) { const f = r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; a += f; cx += (r[i][0] + r[i + 1][0]) * f; cy += (r[i][1] + r[i + 1][1]) * f; }
  return a ? [cx / (3 * a), cy / (3 * a)] : r[0];
}
const polys = (g) => (g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []);

/* a feature to rings in the unit of the final picture; rings that are smaller than a speck are dropped */
function rings(feature, proj, scale, eps, minArea) {
  const out = [];
  for (const poly of polys(feature.geometry)) {
    poly.forEach((ring, i) => {
      const p = simplify(ring.map((c) => { const q = proj(c); return [q[0] * scale, q[1] * scale]; }), eps);
      if (p.length >= 4 && Math.abs(area(p)) >= (i === 0 ? minArea : minArea * 4)) out.push({ ring: p, hole: i > 0 });
    });
  }
  return out;
}
const num = (v) => { const s = (Math.round(v * 10) / 10).toString(); return s === "-0" ? "0" : s; };
/* "M x y l dx dy ..." with one decimal; relative moves keep the file small */
function toPath(rs, ox, oy) {
  return rs.map(({ ring }) => {
    let s = "M" + num(ring[0][0] - ox) + " " + num(ring[0][1] - oy), px = Math.round((ring[0][0] - ox) * 10) / 10, py = Math.round((ring[0][1] - oy) * 10) / 10;
    for (let i = 1; i < ring.length - 1; i++) {
      const x = Math.round((ring[i][0] - ox) * 10) / 10, y = Math.round((ring[i][1] - oy) * 10) / 10, dx = Math.round((x - px) * 10) / 10, dy = Math.round((y - py) * 10) / 10;
      if (dx === 0 && dy === 0) continue;
      s += (i === 1 ? "l" : " ") + num(dx) + (dy < 0 ? "" : " ") + num(dy); px = x; py = y;
    }
    return s + "z";
  }).join("");
}
function bbox(all) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const { ring } of all) for (const [x, y] of ring) { if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y; }
  return [a, b, c, d];
}

async function load(name) {
  if (dirArg) return JSON.parse(fs.readFileSync(path.join(dirArg, name + ".geojson"), "utf8"));
  const r = await fetch(BASE + name + ".geojson");
  if (!r.ok) throw new Error(name + ": HTTP " + r.status);
  return r.json();
}

async function main() {
  const [adm1, adm0, lakes] = await Promise.all(FILES.map(load));
  const lam = lambert(), ee = equalEarth();

  /* ---- Canada ---- */
  const PROV = adm1.features.filter((f) => f.properties.admin === "Canada");
  const raw = PROV.map((f) => ({ code: f.properties.iso_3166_2.slice(3), name: f.properties.name, rs: rings(f, lam, 1, 0, 0) }));
  const [x0, y0, x1, y1] = bbox(raw.flatMap((p) => p.rs));
  const W = 1000, k = W / (x1 - x0), pad = 14;
  const S = (f) => rings(f, lam, k, 0.5, 1.5);
  const provinces = {};
  for (const f of PROV) {
    const code = f.properties.iso_3166_2.slice(3), rs = S(f);
    const big = rs.filter((r) => !r.hole).sort((a, b) => Math.abs(area(b.ring)) - Math.abs(area(a.ring)))[0];
    const c = centroid(big.ring);
    provinces[code] = { n: f.properties.name === "Québec" ? "Quebec" : f.properties.name, d: toPath(rs, x0 * k - pad, y0 * k - pad), c: [Math.round(c[0] - (x0 * k - pad)), Math.round(c[1] - (y0 * k - pad))] };
  }
  const H = Math.ceil((y1 - y0) * k + 2 * pad);
  const ctxCodes = new Set(["USA", "GRL"]);
  const context = adm0.features.filter((f) => ctxCodes.has(f.properties.ADM0_A3)).map((f) => ({ a: f.properties.ADM0_A3, d: toPath(rings(f, lam, k, 0.8, 6).filter((r) => { const b = bbox([r]); return b[2] > x0 * k - pad && b[0] < x1 * k + pad && b[3] > y0 * k - pad && b[1] < y1 * k + pad; }), x0 * k - pad, y0 * k - pad) }));
  const lakeRs = lakes.features.flatMap((f) => rings(f, lam, k, 0.8, 20).filter((r) => { const b = bbox([r]); return b[2] > x0 * k && b[0] < x1 * k && b[3] > y0 * k && b[1] < y1 * k; }));
  const cities = {};
  for (const [key, [lat, lon]] of Object.entries(CITY_XY)) { const q = lam([lon, lat]); cities[key] = [Math.round((q[0] * k - (x0 * k - pad)) * 10) / 10, Math.round((q[1] * k - (y0 * k - pad)) * 10) / 10]; }

  /* ---- the world ---- */
  const wf = adm0.features.filter((f) => f.properties.ADM0_A3 !== "ATA");
  const wraw = wf.flatMap((f) => rings(f, ee, 1, 0, 0));
  const [wx0, wy0, wx1, wy1] = bbox(wraw);
  const wk = W / (wx1 - wx0), wp = 6;
  const countries = wf.map((f) => ({ a: f.properties.ADM0_A3, n: f.properties.NAME || f.properties.ADMIN, d: toPath(rings(f, ee, wk, 0.6, 1), wx0 * wk - wp, wy0 * wk - wp) })).filter((c) => c.d);
  const WH = Math.ceil((wy1 - wy0) * wk + 2 * wp);
  /* where the World view writes "Canada": in the Atlantic off its east coast, with a line to the coast (the name does not fit on Canada itself at this size) */
  const wp1 = ee([-52, 40]), wp2 = ee([-62.5, 45.2]), wxy = (q) => [Math.round(q[0] * wk - (wx0 * wk - wp)), Math.round(q[1] * wk - (wy0 * wk - wp))];
  const label = { CAN: [...wxy(wp1), ...wxy(wp2)] };

  const geo = {
    source: "Natural Earth (public domain), 1:50m provinces, countries and lakes, simplified",
    canada: { w: W, h: H, provinces, context, lakes: toPath(lakeRs, x0 * k - pad, y0 * k - pad), cities },
    world: { w: W, h: WH, countries, label }
  };
  const out = "/* geo.js - the outlines of the Market map's Canada and World views. Generated by scripts/build-maps.mjs from Natural Earth (public domain); do not edit by hand. */\nwindow.PMGEO=" + JSON.stringify(geo) + ";\n";
  fs.writeFileSync(path.join(ROOT, "docs", "geo.js"), out);
  console.log("docs/geo.js", (out.length / 1024).toFixed(0) + " KB;", "Canada view " + W + "x" + H + ",", Object.keys(provinces).length + " provinces,", countries.length + " countries");
}
main().catch((e) => { console.error(e); process.exit(1); });
