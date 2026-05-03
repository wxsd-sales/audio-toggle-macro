import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const root = resolve(".");
const port = Number(process.env.PORT ?? process.argv[2] ?? 4173);
const host = process.env.HOST ?? "127.0.0.1";

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function getFilePath(url) {
  const requestUrl = new URL(url, `http://${host}:${port}`);
  const decodedPath = decodeURIComponent(requestUrl.pathname);
  const routePath =
    decodedPath === "/" || decodedPath === "/web" ? "/web/index.html" : decodedPath;
  const filePath = normalize(join(root, routePath));

  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
    return null;
  }

  try {
    const stats = statSync(filePath);
    if (stats.isDirectory()) return join(filePath, "index.html");
    if (stats.isFile()) return filePath;
  } catch {
    return null;
  }

  return null;
}

const server = createServer((request, response) => {
  const filePath = getFilePath(request.url ?? "/");

  if (!filePath) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const contentType = contentTypes[extname(filePath)] ?? "application/octet-stream";
  response.writeHead(200, { "content-type": contentType });
  createReadStream(filePath).pipe(response);
});

server.listen(port, host, () => {
  console.log(`Audio Toggle config wizard: http://${host}:${port}/web/`);
});
