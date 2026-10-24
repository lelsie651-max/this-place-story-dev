const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const sourceRoot = path.resolve(__dirname, '..');
const shared = import(pathToFileURL(path.join(sourceRoot, 'design-editor/shared/home-layout.js')).href);

/** Generate only the three owned artifacts; check mode performs no writes. */
async function generateHome(config, { projectRoot, check = false } = {}) {
  if (typeof projectRoot !== 'string' || !path.isAbsolute(projectRoot)) {
    throw new TypeError('projectRoot 必须为绝对路径');
  }
  if (typeof check !== 'boolean') throw new TypeError('check 必须为布尔值');
  const { renderHomeWxml, renderHomeWxss, renderHomeGuide } = await shared;
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

module.exports = { generateHome };

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    if (args.some((arg) => arg !== '--check') || args.length > 1) {
      throw new TypeError('用法：node scripts/home-generator.js [--check]');
    }
    const config = JSON.parse(await fs.readFile(path.join(sourceRoot, 'design/home-index-elements.json'), 'utf8'));
    const result = await generateHome(config, { projectRoot: sourceRoot, check: args.includes('--check') });
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  })().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
