import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

const ROOM_PATHS: Record<string, string> = {
  bedroom: 'data/rooms/bedroom.json',
  pirate_ship: 'data/rooms/pirate-ship.json',
  level_2: 'data/rooms/level_2.json',
  level_3: 'data/rooms/level_3.json',
  level_4: 'data/rooms/level_4.json',
};

const STORY_PATHS: Record<string, string> = {
  bedroom: 'data/story/bedroom-script.json',
  pirate_ship: 'data/story/pirate-ship-script.json',
  level_2: 'data/story/level_2-script.json',
  level_3: 'data/story/level_3-script.json',
  level_4: 'data/story/level_4-script.json',
};

const ITEMS_PATH = 'data/items.json';

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
            roomId?: string;
            room?: unknown;
            story?: unknown;
            items?: unknown;
          };

          const root = process.cwd();
          const written: string[] = [];
          const roomId = payload.roomId;

          if (payload.room) {
            const roomPath = roomId ? ROOM_PATHS[roomId] : ROOM_PATHS.bedroom;
            if (!roomPath) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: false, error: `Unknown roomId: ${roomId}` }));
              return;
            }
            writeJson(path.join(root, roomPath), payload.room);
            written.push(roomPath);
          }

          if (payload.story) {
            const storyPath = roomId ? STORY_PATHS[roomId] : STORY_PATHS.bedroom;
            if (!storyPath) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: false, error: `Unknown roomId for story: ${roomId}` }));
              return;
            }
            writeJson(path.join(root, storyPath), payload.story);
            written.push(storyPath);
          }

          if (payload.items) {
            writeJson(path.join(root, ITEMS_PATH), payload.items);
            written.push(ITEMS_PATH);
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
