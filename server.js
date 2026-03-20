const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3456;
const DIR = __dirname;

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

http.createServer((req, res) => {
  if (req.url === "/api/planilha") {
    const hardcodedPath = "C:\\Users\\Pichau\\OneDrive - Mestra Engenharia Sustentável\\Mestra Engenharia Sustentável\\53 - INFRA - VCA CASAS TRP_DRN\\CONTROLE\\TRINCHEIRAS\\LOTES - TRINCHEIRAS.V01.xlsx";
    fs.readFile(hardcodedPath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Planilha não encontrada");
      } else {
        res.writeHead(200, { 
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        });
        res.end(data);
      }
    });
    return;
  }

  const urlPath = req.url.split('?')[0];
  let filePath = path.join(DIR, urlPath === "/" ? "index.html" : urlPath);
  const ext = path.extname(filePath);
  const contentType = MIME[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { 
      "Content-Type": contentType,
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
