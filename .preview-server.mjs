/**
 * Zero-dependency static preview server for the AI Studio preview environment.
 * Not needed on cPanel (Apache serves the HTML/CSS/JS files directly).
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const PORT = Number(process.env.PORT || 3000);
const ROOT = process.cwd();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  const rawUrl = req.url || "/";
  const pathname = decodeURIComponent(rawUrl.split("?")[0]);
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(ROOT, safePath === "/" ? "index.html" : safePath);

  // Prevent path traversal and block dotfiles/firebase rules
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const rel = path.relative(ROOT, filePath);
  if (rel.startsWith(".") || rel.startsWith("firebase" + path.sep) || rel === "firebase") {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  res.writeHead(200, {
    "Content-Type": contentType,
    "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    "Cache-Control": "no-cache",
  });

  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`HMM HMM static preview server running at http://0.0.0.0:${PORT}`);
});
