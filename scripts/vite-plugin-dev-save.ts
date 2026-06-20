import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

const ALLOWED = {
  room: 'data/rooms/bedroom.json',
  story: 'data/story/bedroom-script.json',
  items: 'data/items.json',
} as const;

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

export function devSavePlugin(): Plugin {
  return {
    name: 'dev-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/__dev/save' || req.method !== 'POST') {
          next();
          return;
        }

        try {
          const body = await readBody(req);
          const payload = JSON.parse(body) as {
            room?: unknown;
            story?: unknown;
            items?: unknown;
          };

          const root = process.cwd();
          const written: string[] = [];

          if (payload.room) {
            writeJson(path.join(root, ALLOWED.room), payload.room);
            written.push(ALLOWED.room);
          }
          if (payload.story) {
            writeJson(path.join(root, ALLOWED.story), payload.story);
            written.push(ALLOWED.story);
          }
          if (payload.items) {
            writeJson(path.join(root, ALLOWED.items), payload.items);
            written.push(ALLOWED.items);
          }

          if (written.length === 0) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: 'No files to save.' }));
            return;
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, written }));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: String(err) }));
        }
      });
    },
  };
}
