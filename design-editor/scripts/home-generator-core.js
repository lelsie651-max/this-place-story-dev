import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderHomeWxml, renderHomeWxss, renderHomeGuide } from '../shared/home-layout.js';

const adaptationFile = fileURLToPath(new URL('../shared/home-adaptation.js', import.meta.url));

export async function renderHomeRuntime(config) {
  const source = await fs.readFile(adaptationFile, 'utf8');
  const design = { designWidth: config.designWidth, designHeight: config.designHeight };
  return '// Generated from the shared adaptation module and home configuration; do not edit.\n'
    + source.replace(/export function /g, 'function ')
    + `\nmodule.exports = { getAvailableRect, fitHome, resolveHomeElements, design: ${JSON.stringify(design)} };\n`;
}

export async function inspectHomeBackground(config, projectRoot, stagedFilename = null) {
  const background = config.elements.find((item) => item.designId === 'index-background-image');
  const source = background.imagePath || config.defaultImages[background.designId];
  const relative = source.replace(/^\/assets\//, 'miniprogram/assets/');
  if (!relative.startsWith('miniprogram/assets/') || relative.split('/').includes('..')) {
    throw new Error('固定设计背景必须使用本地图片以核对真实比例');
  }
  const bytes = await fs.readFile(stagedFilename || path.join(projectRoot, relative));
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new Error('首页背景不是有效的 PNG 文件');
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (!width || !height) throw new Error('背景图片尺寸无效');
  return { width, height, designHeightFromImage: config.designWidth * height / width };
}

/** Generate only the three owned artifacts; check mode performs no writes. */
async function generateHome(config, { projectRoot, check = false } = {}) {
  if (typeof projectRoot !== 'string' || !path.isAbsolute(projectRoot)) {
    throw new TypeError('projectRoot 必须为绝对路径');
  }
  if (typeof check !== 'boolean') throw new TypeError('check 必须为布尔值');
  const outputs = {
    'miniprogram/pages/index/index.wxml': renderHomeWxml(config),
    'miniprogram/pages/index/index.wxss': renderHomeWxss(config),
    'docs/home-layout-controls-guide.md': renderHomeGuide(config),
    'miniprogram/pages/index/home-adaptation.generated.js': await renderHomeRuntime(config)
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
