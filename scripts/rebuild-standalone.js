const path = require('path');
const { rebuild } = require('@electron/rebuild');

async function main() {
  const buildPath = path.resolve(__dirname, '..', '.next', 'standalone');

  await rebuild({
    buildPath,
    electronVersion: require('electron/package.json').version,
    onlyModules: ['better-sqlite3'],
    force: true,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});