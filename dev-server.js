// Minimal local dev server that mimics Vercel's static + serverless-function
// setup closely enough to test /api routes without installing the Vercel
// CLI. Production deployment is still plain static hosting on Vercel —
// this file is a local convenience only, never deployed.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = process.env.PORT || 3002;
const ROOT = __dirname;

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".xml": "application/xml",
  ".txt": "text/plain",
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname.startsWith("/api/")) {
    const handlerPath = path.join(ROOT, url.pathname + ".js");
    if (!fs.existsSync(handlerPath)) {
      res.writeHead(404).end("Not found");
      return;
    }
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        req.body = body ? JSON.parse(body) : {};
      } catch {
        req.body = {};
      }
      const handler = require(handlerPath);
      const wrappedRes = {
        setHeader: (k, v) => res.setHeader(k, v),
        status(code) {
          res.statusCode = code;
          return this;
        },
        json(obj) {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(obj));
        },
        end() {
          res.end();
        },
      };
      try {
        await handler(req, wrappedRes);
      } catch (err) {
        console.error(err);
        res.writeHead(500).end(JSON.stringify({ error: "Internal error" }));
      }
    });
    return;
  }

  let filePath = path.join(ROOT, url.pathname === "/" ? "/index.html" : url.pathname);
  if (!fs.existsSync(filePath) && !path.extname(filePath)) {
    // Clean-URL fallback (matches Vercel's own static hosting behavior):
    // /examples -> /examples.html
    const withHtml = filePath + ".html";
    if (fs.existsSync(withHtml)) filePath = withHtml;
  }
  if (!fs.existsSync(filePath)) {
    filePath = path.join(ROOT, "404.html");
    res.statusCode = 404;
  }
  const ext = path.extname(filePath);
  res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Dev server (static + /api) running at http://localhost:${PORT}`);
});
