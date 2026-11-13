// Puts this version's CHANGELOG notes into the "What's new" field of a
// Microsoft Store draft submission.
//
// Usage: node scripts/store-release-notes.js <version> <submission.json> <out.json>
// <submission.json> is the output of `msstore submission get <productId>`.

const fs = require("fs");

const [version, inFile, outFile] = process.argv.slice(2);
if (!version || !inFile || !outFile) {
  console.error("Usage: node scripts/store-release-notes.js <version> <submission.json> <out.json>");
  process.exit(2);
}

// The CHANGELOG section for this version, as plain text the Store can show.
function notesFor(v) {
  const lines = fs.readFileSync("CHANGELOG.md", "utf8").split(/\r?\n/);
  const start = lines.findIndex((l) => new RegExp(`^## \[?${v.replace(/\./g, "\.")}\]?`).test(l));
  if (start === -1) return "";
  const out = [];
  for (const line of lines.slice(start + 1)) {
    if (/^## /.test(line)) break;
    out.push(
      line
        .replace(/^### (.*)/, "$1:")
        .replace(/^\s*[-*] /, "• ")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/`([^`]*)`/g, "$1")
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1"),
    );
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 1500);
}

// The CLI prints the submission JSON, sometimes after a few status lines.
const raw = fs.readFileSync(inFile, "utf8");
const submission = JSON.parse(raw.slice(raw.indexOf("{")));
const notes = notesFor(version);
if (!notes) {
  console.error(`No CHANGELOG section for ${version}; "What's new" left unchanged.`);
  process.exit(1);
}

// Set every "releaseNotes" field inside the listings, whatever the casing.
let changed = 0;
(function walk(node) {
  if (!node || typeof node !== "object") return;
  for (const key of Object.keys(node)) {
    if (/^releasenotes$/i.test(key) && typeof node[key] === "string") {
      node[key] = notes;
      changed++;
    } else {
      walk(node[key]);
    }
  }
})(submission.listings || submission.Listings || submission);

if (!changed) {
  console.error('No "What\'s new" field found in the submission.');
  process.exit(1);
}
fs.writeFileSync(outFile, JSON.stringify(submission));
console.log(`Updated "What's new" in ${changed} listing(s).`);
