import { defineConfig } from 'vite';

import {
  applyDesignToMiniprogram,
  buildApplyPlan,
  exportDesignFiles,
  saveUploadedAsset
} from './scripts/editor-api.js';

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function designEditorApiPlugin() {
  return {
    name: 'design-editor-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/__design_editor/')) {
          next();
          return;
        }

        try {
          if (req.method === 'POST' && req.url === '/__design_editor/plan') {
            const body = await readJsonBody(req);
            sendJson(res, 200, await buildApplyPlan(body.draft || {}));
            return;
          }

          if (req.method === 'POST' && req.url === '/__design_editor/export') {
            const body = await readJsonBody(req);
            sendJson(res, 200, await exportDesignFiles(body.draft || {}));
            return;
          }

          if (req.method === 'POST' && req.url === '/__design_editor/apply') {
            const body = await readJsonBody(req);
            sendJson(res, 200, await applyDesignToMiniprogram(body.draft || {}));
            return;
          }

          if (req.method === 'POST' && req.url === '/__design_editor/upload-asset') {
            const body = await readJsonBody(req);
            sendJson(res, 200, await saveUploadedAsset(body));
            return;
          }

          sendJson(res, 404, { message: 'Not found' });
        } catch (error) {
          sendJson(res, 500, {
            message: error instanceof Error ? error.message : 'Design editor API failed'
          });
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [designEditorApiPlugin()],
  server: {
    fs: {
      allow: ['..']
    }
  }
});
