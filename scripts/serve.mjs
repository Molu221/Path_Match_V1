// Tiny local preview of the docs/ folder: npm run serve
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs");
const mime = { ".html": "text/html; charset=utf-8", ".json": "application/json", ".js": "text/javascript", ".css": "text/css" };
http.createServer((req, res) => {
  const p = new URL(req.url, "http://x").pathname; const f = path.normalize(path.join(root, p === "/" ? "index.html" : decodeURIComponent(p)));
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end("Not found"); } res.writeHead(200, { "Content-Type": mime[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-cache" }); res.end(b); });
}).listen(+process.env.PORT || 8080, () => console.log("Preview on http://localhost:" + (process.env.PORT || 8080)));
