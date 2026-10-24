const fs = require('node:fs/promises');
const path = require('node:path');

const sourceRoot = path.resolve(__dirname, '..');

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    if (args.some((arg) => arg !== '--check') || args.length > 1) {
      throw new TypeError('用法：node scripts/home-generator.js [--check]');
    }
    const { default: generator } = await import('../design-editor/scripts/home-generator-core.js');
    const config = JSON.parse(await fs.readFile(path.join(sourceRoot, 'design/home-index-elements.json'), 'utf8'));
    const result = await generator.generateHome(config, { projectRoot: sourceRoot, check: args.includes('--check') });
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  })().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
