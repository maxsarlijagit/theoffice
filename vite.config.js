import { defineConfig } from 'vite';
import path from 'path';
import fs from 'node:fs';

const artRoot = path.resolve(process.cwd(), 'art');
const mapsRoot = path.resolve(process.cwd(), 'maps');

function getContentType(filePath) {
  if (filePath.toLowerCase().endsWith('.png')) return 'image/png';
  if (filePath.toLowerCase().endsWith('.json')) return 'application/json';
  return 'application/octet-stream';
}

function serveFolder(root, urlPrefix) {
  return (request, response, next) => {
    if (!request.url?.startsWith(urlPrefix)) {
      next();
      return;
    }

    const relativePath = decodeURIComponent(request.url.replace(urlPrefix, ''));
    const filePath = path.resolve(root, relativePath);

    if (!filePath.startsWith(root) || !fs.existsSync(filePath)) {
      next();
      return;
    }

    response.setHeader('Content-Type', getContentType(filePath));
    fs.createReadStream(filePath).pipe(response);
  };
}

function copyStaticFolder(from, to) {
  if (!fs.existsSync(from)) return;

  fs.mkdirSync(to, { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}

export default defineConfig({
  root: './',
  publicDir: 'public',
  plugins: [
    {
      name: 'theoffice-static-art-and-maps',
      configureServer(server) {
        server.middlewares.use(serveFolder(artRoot, '/art/'));
        server.middlewares.use(serveFolder(mapsRoot, '/maps/'));
      },
      writeBundle() {
        copyStaticFolder(artRoot, path.resolve(process.cwd(), 'dist/art'));
        copyStaticFolder(mapsRoot, path.resolve(process.cwd(), 'dist/maps'));
      },
    },
  ],
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
});
