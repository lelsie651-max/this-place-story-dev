import fs from 'node:fs/promises';
import path from 'node:path';
import { renderHomeWxml, renderHomeWxss, renderHomeGuide } from '../shared/home-layout.js';

/** Generate only the three owned artifacts; check mode performs no writes. */
async function generateHome(config, { projectRoot, check = false } = {}) {
  if (typeof projectRoot !== 'string' || !path.isAbsolute(projectRoot)) {
    throw new TypeError('projectRoot 必须为绝对路径');
  }
  if (typeof check !== 'boolean') throw new TypeError('check 必须为布尔值');
  const outputs = {
    'miniprogram/pages/index/index.wxml': renderHomeWxml(config),
    'miniprogram/pages/index/index.wxss': renderHomeWxss(config),
    'docs/home-layout-controls-guide.md': renderHomeGuide(config)
  };
  const files = [];
  for (const [relativePath, content] of Object.entries(outputs)) {
    const filename = path.join(projectRoot, relativePath);
    let previous = null;
    try {
      previous = await fs.readFile(filename, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    files.push({ path: relativePath, status: previous === null ? 'missing' : previous === content ? 'unchanged' : 'changed' });
  }
  const differences = files.filter((file) => file.status !== 'unchanged').map((file) => file.path);
  if (!check) {
    for (const relativePath of differences) {
      const filename = path.join(projectRoot, relativePath);
      await fs.mkdir(path.dirname(filename), { recursive: true });
      await fs.writeFile(filename, outputs[relativePath], 'utf8');
    }
  }
  return { check, ok: !check || differences.length === 0, files, differences, written: check ? [] : differences };
}

// A shared object keeps the API's generation call observable in rollback tests.
export default { generateHome };
