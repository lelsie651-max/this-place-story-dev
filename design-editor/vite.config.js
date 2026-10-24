import { defineConfig } from 'vite';

import {
  applyDesignToMiniprogram,
  buildApplyPlan,
  exportDesignFiles,
  saveUploadedAsset,
  readHomeConfig,
  saveHomeConfig,
  readHomeAsset,
  uploadHomeAsset
} from './scripts/editor-api.js';

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 13 * 1024 * 1024) throw Object.assign(new Error('请求内容超过大小限制。'), { statusCode: 413 });
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
    handleHotUpdate(context) {
      // Saved home configuration is re-read over the API, not through HMR.
      if (context.file.replace(/\\/g, '/').endsWith('/design/home-index-elements.json')) return [];
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/__design_editor/')) {
          next();
          return;
        }

        try {
          const url = new URL(req.url, 'http://localhost');
          if (url.pathname.startsWith('/__design_editor/home-')) {
            if (req.method === 'POST' && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {
              sendJson(res, 403, { message: '请从本地编辑器页面保存。' });
              return;
            }
            if (req.method === 'GET' && url.pathname === '/__design_editor/home-config') {
              sendJson(res, 200, await readHomeConfig());
              return;
            }
            if (req.method === 'POST' && url.pathname === '/__design_editor/home-config') {
              sendJson(res, 200, await saveHomeConfig(await readJsonBody(req)));
              return;
            }
            if (req.method === 'POST' && url.pathname === '/__design_editor/home-upload') {
              sendJson(res, 200, await uploadHomeAsset(await readJsonBody(req)));
              return;
            }
            if (req.method === 'GET' && url.pathname === '/__design_editor/home-asset') {
              const asset = await readHomeAsset(url.searchParams.get('path'));
              if (asset.redirect) {
                res.statusCode = 302;
                res.setHeader('Location', asset.redirect);
                res.end();
              } else {
                res.setHeader('Content-Type', asset.mime);
                res.setHeader('X-Content-Type-Options', 'nosniff');
                res.setHeader('Cache-Control', 'no-cache');
                res.end(asset.bytes);
              }
              return;
            }
          }
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
          sendJson(res, error.statusCode || 500, {
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
