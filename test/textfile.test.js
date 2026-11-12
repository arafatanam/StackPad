const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  decodeText,
  encodeText,
  normalizeText,
  fileStamp,
  sameStamp,
  writeFileAtomic,
  saveFileSafely,
  readTextFile,
  writeTextFile,
} = require("../lib/textfile");

let dir;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "stackpad-test-"));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const leftovers = () => fs.readdirSync(dir).filter((name) => name.endsWith(".tmp"));

describe("decodeText", () => {
  test("plain UTF-8", () => {
    assert.deepEqual(decodeText(Buffer.from("héllo ✓", "utf8")), {
      text: "héllo ✓",
      encoding: "utf-8",
    });
  });

  test("UTF-8 with BOM drops the BOM", () => {
    const buf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("abc")]);
    assert.deepEqual(decodeText(buf), { text: "abc", encoding: "utf-8-bom" });
  });

  test("UTF-16 LE and BE", () => {
    const le = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("hi ✓", "utf16le")]);
    assert.deepEqual(decodeText(le), { text: "hi ✓", encoding: "utf-16le" });

    const body = Buffer.from("hi ✓", "utf16le");
    body.swap16();
    const be = Buffer.concat([Buffer.from([0xfe, 0xff]), body]);
    assert.deepEqual(decodeText(be), { text: "hi ✓", encoding: "utf-16be" });
  });

  test("invalid UTF-8 falls back to Windows-1252 (ANSI)", () => {
    // 0xE9 = é, 0x80 = € in Windows-1252; neither is valid UTF-8 on its own.
    const result = decodeText(Buffer.from([0x63, 0x61, 0x66, 0xe9, 0x20, 0x80]));
    assert.deepEqual(result, { text: "café €", encoding: "windows-1252" });
  });

  test("empty file is UTF-8", () => {
    assert.deepEqual(decodeText(Buffer.alloc(0)), { text: "", encoding: "utf-8" });
  });
});

describe("encodeText", () => {
  for (const encoding of ["utf-8", "utf-8-bom", "utf-16le", "utf-16be"]) {
    test(`round-trips ${encoding}`, () => {
      const text = "Line one ✓\nLine two 🚀";
      const encoded = encodeText(text, encoding);
      assert.equal(encoded.encoding, encoding);
      assert.deepEqual(decodeText(encoded.buffer), { text, encoding });
    });
  }

  test("round-trips ANSI text", () => {
    const encoded = encodeText("café €", "windows-1252");
    assert.equal(encoded.encoding, "windows-1252");
    assert.deepEqual([...encoded.buffer], [0x63, 0x61, 0x66, 0xe9, 0x20, 0x80]);
  });

  test("every ANSI byte survives open and save unchanged", () => {
    const all = Buffer.from(Array.from({ length: 256 }, (_, i) => i));
    all[0] = 0x80; // make sure the bytes aren't valid UTF-8
    const decoded = decodeText(all);
    assert.equal(decoded.encoding, "windows-1252");
    assert.deepEqual(encodeText(decoded.text, "windows-1252").buffer, all);
  });

  test("ANSI text with characters ANSI can't store is upgraded to UTF-8", () => {
    const encoded = encodeText("café 🚀", "windows-1252");
    assert.equal(encoded.encoding, "utf-8");
    assert.equal(encoded.buffer.toString("utf8"), "café 🚀");
  });

  test("unknown encodings are written as UTF-8", () => {
    assert.equal(encodeText("x", "nonsense").encoding, "utf-8");
  });
});

describe("normalizeText", () => {
  test("detects CRLF and converts to \\n", () => {
    assert.deepEqual(normalizeText("a\r\nb\r\n"), { content: "a\nb\n", eol: "crlf" });
  });

  test("detects LF", () => {
    assert.deepEqual(normalizeText("a\nb"), { content: "a\nb", eol: "lf" });
  });

  test("lone CR becomes \\n", () => {
    assert.equal(normalizeText("a\rb").content, "a\nb");
  });

  test("single line uses the platform default", () => {
    const expected = process.platform === "win32" ? "crlf" : "lf";
    assert.equal(normalizeText("one line").eol, expected);
  });
});

describe("readTextFile / writeTextFile", () => {
  test("keeps CRLF line endings and encoding when saving", () => {
    const file = path.join(dir, "notes.txt");
    const original = Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from("first\r\nsecond\r\n", "utf16le"),
    ]);
    fs.writeFileSync(file, original);

    const opened = readTextFile(file);
    assert.equal(opened.content, "first\nsecond\n");
    assert.equal(opened.eol, "crlf");
    assert.equal(opened.encoding, "utf-16le");

    const result = writeTextFile(file, opened.content, opened.encoding, opened.eol);
    assert.equal(result.encoding, "utf-16le");
    assert.deepEqual(fs.readFileSync(file), original);
  });

  test("writes LF files with LF", () => {
    const file = path.join(dir, "unix.txt");
    writeTextFile(file, "a\nb\n", "utf-8", "lf");
    assert.equal(fs.readFileSync(file, "utf8"), "a\nb\n");
  });

  test("returns a stamp that matches the file on disk", () => {
    const file = path.join(dir, "stamped.txt");
    const { stamp } = writeTextFile(file, "hello", "utf-8", "lf");
    assert.ok(sameStamp(stamp, fileStamp(file)));
    assert.equal(stamp.size, 5);
  });

  test("returns the upgraded encoding when ANSI can't hold the text", () => {
    const file = path.join(dir, "ansi.txt");
    const { encoding } = writeTextFile(file, "emoji 🚀", "windows-1252", "lf");
    assert.equal(encoding, "utf-8");
    assert.equal(fs.readFileSync(file, "utf8"), "emoji 🚀");
  });
});

describe("crash-safe writing", () => {
  test("writeFileAtomic replaces the file and leaves no temp files", () => {
    const file = path.join(dir, "data.json");
    fs.writeFileSync(file, "old");
    writeFileAtomic(file, "new");
    assert.equal(fs.readFileSync(file, "utf8"), "new");
    assert.deepEqual(leftovers(), []);
  });

  test("a failed write leaves the original untouched", () => {
    const file = path.join(dir, "keep.txt");
    fs.writeFileSync(file, "precious");
    // Writing into a folder that doesn't exist fails before the swap.
    assert.throws(() => writeFileAtomic(path.join(dir, "missing", "keep.txt"), "x"));
    assert.equal(fs.readFileSync(file, "utf8"), "precious");
    assert.deepEqual(leftovers(), []);
  });

  test("saveFileSafely creates new files", () => {
    const file = path.join(dir, "brand-new.txt");
    saveFileSafely(file, Buffer.from("hi"));
    assert.equal(fs.readFileSync(file, "utf8"), "hi");
    assert.deepEqual(leftovers(), []);
  });

  test("saveFileSafely refuses to overwrite a read-only file", () => {
    const file = path.join(dir, "locked.txt");
    fs.writeFileSync(file, "locked");
    fs.chmodSync(file, 0o444);
    try {
      assert.throws(() => saveFileSafely(file, Buffer.from("changed")), /read-only/);
      assert.equal(fs.readFileSync(file, "utf8"), "locked");
    } finally {
      fs.chmodSync(file, 0o644);
    }
  });

  test("saveFileSafely writes through a symlink to its target", (t) => {
    const target = path.join(dir, "real.txt");
    const link = path.join(dir, "link.txt");
    fs.writeFileSync(target, "before");
    try {
      fs.symlinkSync(target, link);
    } catch (e) {
      t.skip("creating symlinks needs Developer Mode on Windows");
      return;
    }
    saveFileSafely(link, Buffer.from("after"));
    assert.ok(fs.lstatSync(link).isSymbolicLink(), "the link is still a link");
    assert.equal(fs.readFileSync(target, "utf8"), "after");
  });

  test("saveFileSafely keeps hard links pointing at the same file", (t) => {
    const a = path.join(dir, "a.txt");
    const b = path.join(dir, "b.txt");
    fs.writeFileSync(a, "shared");
    try {
      fs.linkSync(a, b);
    } catch (e) {
      t.skip("hard links aren't supported here");
      return;
    }
    saveFileSafely(a, Buffer.from("updated"));
    assert.equal(fs.readFileSync(b, "utf8"), "updated");
  });

  test("saveFileSafely keeps POSIX permissions", { skip: process.platform === "win32" }, () => {
    const file = path.join(dir, "script.sh");
    fs.writeFileSync(file, "echo hi");
    fs.chmodSync(file, 0o750);
    saveFileSafely(file, Buffer.from("echo bye"));
    assert.equal(fs.statSync(file).mode & 0o777, 0o750);
  });
});

describe("fileStamp", () => {
  test("is null for a missing file", () => {
    assert.equal(fileStamp(path.join(dir, "nope.txt")), null);
  });

  test("changes when the file's size changes", () => {
    const file = path.join(dir, "grow.txt");
    fs.writeFileSync(file, "a");
    const before = fileStamp(file);
    fs.writeFileSync(file, "ab");
    assert.equal(sameStamp(before, fileStamp(file)), false);
  });

  test("sameStamp is false when either side is missing", () => {
    assert.equal(sameStamp(null, { mtimeMs: 1, size: 1 }), false);
    assert.equal(sameStamp("missing", { mtimeMs: 1, size: 1 }), false);
  });
});
