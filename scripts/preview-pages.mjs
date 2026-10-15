import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Exercise the production artifact exactly where a project Pages site lives.
const root = await realpath(
  fileURLToPath(new URL("../client/dist/", import.meta.url)),
);
const prefix = "/FeudingFriends/";
const port = Number(process.env.PORT || 4173);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp3": "audio/mpeg",
};

createServer(async (request, response) => {
  const fail = (status) => response.writeHead(status).end();
  if (!["GET", "HEAD"].includes(request.method)) {
    response.setHeader("Allow", "GET, HEAD");
    return fail(405);
  }
  let pathname;
  try {
    pathname = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
  } catch {
    return fail(400);
  }
  if (pathname === prefix.slice(0, -1)) {
    return response.writeHead(308, { Location: prefix }).end();
  }
  if (!pathname.startsWith(prefix) || /[\\\0]/.test(pathname)) return fail(404);
  const parts = pathname.slice(prefix.length).split("/");
  if (parts.some((part) => part === "." || part === "..")) return fail(404);
  try {
    let candidate = resolve(root, ...parts);
    if (pathname.endsWith("/")) candidate = join(candidate, "index.html");
    const file = await realpath(candidate);
    if (!file.startsWith(`${root}${sep}`)) return fail(404);
    const info = await stat(file);
    if (!info.isFile()) return fail(404);
    response.writeHead(200, {
      "Content-Type": mime[extname(file)] || "application/octet-stream",
      "Content-Length": info.size,
      "X-Content-Type-Options": "nosniff",
    });
    if (request.method === "HEAD") return response.end();
    createReadStream(file)
      .on("error", () => response.destroy())
      .pipe(response);
  } catch {
    fail(404);
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Pages artifact: http://127.0.0.1:${port}${prefix}`);
});
