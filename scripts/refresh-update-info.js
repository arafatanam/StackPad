// Run after the Windows installer has been code-signed in CI.
//
// Signing changes the installer's bytes, so the checksum and size that
// electron-builder wrote into latest.yml (and the .blockmap used for small
// "differential" downloads) no longer match. The auto-updater would reject
// the download. This script rewrites them from the signed file.
//
// Usage: node scripts/refresh-update-info.js dist

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const distDir = path.resolve(process.argv[2] || "dist");
const ymlPath = path.join(distDir, "latest.yml");

function sha512(file) {
  return crypto.createHash("sha512").update(fs.readFileSync(file)).digest("base64");
}

async function rebuildBlockmap(file) {
  const blockmapFile = `${file}.blockmap`;
  if (!fs.existsSync(blockmapFile)) return;
  try {
    const { buildBlockMap } = require("app-builder-lib/out/targets/blockmap/blockmap");
    await buildBlockMap(file, "gzip", blockmapFile);
    console.log(`Rebuilt ${path.basename(blockmapFile)}`);
  } catch (e) {
    // Without a matching blockmap the updater simply downloads the whole
    // installer, so removing it is safe.
    fs.unlinkSync(blockmapFile);
    console.warn(`Couldn't rebuild the blockmap (${e.message}); removed it instead.`);
  }
}

async function main() {
  if (!fs.existsSync(ymlPath)) throw new Error(`${ymlPath} not found`);
  let yml = fs.readFileSync(ymlPath, "utf8");

  const fileName = /^path:\s*(.+)$/m.exec(yml)?.[1]?.trim().replace(/^['"]|['"]$/g, "");
  if (!fileName) throw new Error("latest.yml has no path entry");
  const installer = path.join(distDir, fileName);

  await rebuildBlockmap(installer);

  const hash = sha512(installer);
  const size = fs.statSync(installer).size;

  yml = yml
    .replace(/^(\s*sha512:\s*).+$/gm, `$1${hash}`)
    .replace(/^(\s*size:\s*).+$/gm, `$1${size}`);
  fs.writeFileSync(ymlPath, yml);

  console.log(`Updated latest.yml for ${fileName}: ${size} bytes`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
