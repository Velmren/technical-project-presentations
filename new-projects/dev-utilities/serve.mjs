import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
const root = path.resolve("dist");
http
  .createServer(async (req, res) => {
    try {
      let pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      if (pathname.startsWith("/projects/dev-utilities/"))
        pathname = pathname.slice("/projects/dev-utilities".length);
      let file = path.resolve(root, "." + pathname);
      if (!file.startsWith(root + path.sep) && file !== root) {
        res.writeHead(403).end();
        return;
      }
      if (path.extname(file) === "") file = path.join(file, "index.html");
      const data = await readFile(file);
      const types = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".png": "image/png",
        ".svg": "image/svg+xml",
        ".json": "application/json",
        ".woff2": "font/woff2",
      };
      res.setHeader(
        "Content-Type",
        types[path.extname(file)] || "application/octet-stream",
      );
      res.end(data);
    } catch {
      res.writeHead(404).end("Not found");
    }
  })
  .listen(4315, "127.0.0.1", () =>
    console.log("http://127.0.0.1:4315/projects/dev-utilities/"),
  );
