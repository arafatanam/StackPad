// Reading and writing text files: encodings, line endings and crash-safe
// saving. Kept free of Electron so it can be tested with plain Node.

const fs = require("fs");
const path = require("path");

// ---- Encodings ----
//
// The editor always works with "\n" line endings and plain JS strings. Each
// file remembers the encoding and line-ending style it was opened with, and
// is written back the same way, so saving never silently converts it.

const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

// Windows-1252 ("ANSI") matches Latin-1 except for bytes 0x80-0x9F. The
// table is spelled out because some Node versions decode that range as
// Latin-1 control characters. Unassigned bytes map to the same code point,
// as browsers do, so every byte survives a round trip.
const CP1252_HIGH = [
  0x20ac, 0x81, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021,
  0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x8d, 0x017d, 0x8f,
  0x90, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x9d, 0x017e, 0x0178,
];
const CP1252_REVERSE = new Map(CP1252_HIGH.map((code, i) => [code, 0x80 + i]));

function decodeCp1252(buffer) {
  let text = "";
  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    text += String.fromCharCode(byte >= 0x80 && byte <= 0x9f ? CP1252_HIGH[byte - 0x80] : byte);
  }
  return text;
}

function decodeText(buffer) {
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return { text: buffer.toString("utf8", 3), encoding: "utf-8-bom" };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    return { text: buffer.toString("utf16le", 2), encoding: "utf-16le" };
  }
  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    return {
      text: new TextDecoder("utf-16be").decode(buffer.subarray(2)),
      encoding: "utf-16be",
    };
  }
  try {
    return { text: utf8Decoder.decode(buffer), encoding: "utf-8" };
  } catch (e) {
    return { text: decodeCp1252(buffer), encoding: "windows-1252" };
  }
}

function encodeCp1252(text) {
  const bytes = Buffer.alloc(text.length);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80 || (code >= 0xa0 && code <= 0xff)) {
      bytes[i] = code;
    } else if (CP1252_REVERSE.has(code)) {
      bytes[i] = CP1252_REVERSE.get(code);
    } else {
      return null; // character not representable in ANSI
    }
  }
  return bytes;
}

function encodeText(text, encoding) {
  switch (encoding) {
    case "utf-8-bom":
      return {
        buffer: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text, "utf8")]),
        encoding,
      };
    case "utf-16le":
      return {
        buffer: Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")]),
        encoding,
      };
    case "utf-16be": {
      const body = Buffer.from(text, "utf16le");
      body.swap16();
      return { buffer: Buffer.concat([Buffer.from([0xfe, 0xff]), body]), encoding };
    }
    case "windows-1252": {
      const bytes = encodeCp1252(text);
      // Text typed since opening may not fit ANSI (e.g. emoji); upgrade to UTF-8
      // rather than losing characters.
      if (bytes) return { buffer: bytes, encoding };
      return { buffer: Buffer.from(text, "utf8"), encoding: "utf-8" };
    }
    default:
      return { buffer: Buffer.from(text, "utf8"), encoding: "utf-8" };
  }
}

const defaultEol = (platform = process.platform) => (platform === "win32" ? "crlf" : "lf");

function normalizeText(text) {
  const eol = text.includes("\r\n") ? "crlf" : text.includes("\n") ? "lf" : defaultEol();
  return { content: text.replace(/\r\n?/g, "\n"), eol };
}

// ---- Change detection ----

// A cheap fingerprint of a file on disk, used to notice edits made by other
// programs. Returns null when the file doesn't exist.
function fileStamp(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return { mtimeMs: Math.floor(stat.mtimeMs), size: stat.size };
  } catch (e) {
    return null;
  }
}

function sameStamp(a, b) {
  return Boolean(a && b && a.mtimeMs === b.mtimeMs && a.size === b.size);
}

// ---- Crash-safe writing ----

// Antivirus scanners and search indexers on Windows briefly lock freshly
// written files, which makes an immediate rename fail. Retry a few times.
function renameWithRetry(from, to) {
  const waits = [0, 20, 60, 150];
  for (let i = 0; ; i++) {
    try {
      fs.renameSync(from, to);
      return;
    } catch (e) {
      const retryable = e.code === "EPERM" || e.code === "EACCES" || e.code === "EBUSY";
      if (!retryable || i === waits.length - 1) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, waits[i + 1]);
    }
  }
}

function writeAndSync(target, data, flags) {
  const fd = fs.openSync(target, flags);
  try {
    fs.writeFileSync(fd, data);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

// Writes the complete new contents to a temporary file next to the target,
// flushes it to disk, then swaps it into place. If anything goes wrong part
// way (crash, power cut, full disk), the original file is left untouched.
function writeFileAtomic(filePath, data, { mode } = {}) {
  const dir = path.dirname(filePath);
  const tmp = path.join(
    dir,
    `.${path.basename(filePath)}.${process.pid}.${Date.now().toString(36)}.tmp`,
  );
  try {
    writeAndSync(tmp, data, "wx");
    if (mode !== undefined && process.platform !== "win32") fs.chmodSync(tmp, mode);
    renameWithRetry(tmp, filePath);
  } catch (e) {
    try {
      fs.unlinkSync(tmp);
    } catch (cleanupError) {
      // Already gone.
    }
    throw e;
  }
}

// Saves a user's document. The file is replaced atomically where possible;
// when the folder doesn't allow creating a temporary file, or the file can't
// be replaced (a hard link, or Windows refusing to swap a hidden or system
// file), it falls back to writing in place.
function saveFileSafely(filePath, data) {
  let target = filePath;
  try {
    target = fs.realpathSync(filePath); // replace a symlink's target, not the link
  } catch (e) {
    // New file: nothing to resolve.
  }

  let stat = null;
  try {
    stat = fs.statSync(target);
  } catch (e) {
    // New file.
  }

  if (stat) {
    // Renaming over a read-only file can succeed on Linux, which would
    // quietly ignore the user's protection. Refuse the same way Notepad does.
    try {
      fs.accessSync(target, fs.constants.W_OK);
    } catch (e) {
      const err = new Error("The file is read-only. Use Save As to save a copy.");
      err.code = e.code || "EACCES";
      throw err;
    }
  }

  if (stat && stat.nlink > 1) {
    writeAndSync(target, data, "w"); // keep every hard link pointing at the same file
    return;
  }

  try {
    writeFileAtomic(target, data, { mode: stat ? stat.mode & 0o7777 : undefined });
    if (stat && process.platform !== "win32") {
      try {
        fs.chownSync(target, stat.uid, stat.gid);
      } catch (e) {
        // Only possible when running as the owner's admin; harmless otherwise.
      }
    }
  } catch (e) {
    writeAndSync(target, data, "w");
  }
}

// ---- Text files ----

function readTextFile(filePath) {
  const { text, encoding } = decodeText(fs.readFileSync(filePath));
  return { ...normalizeText(text), encoding, stamp: fileStamp(filePath) };
}

// Returns the encoding actually used (ANSI can be upgraded to UTF-8) and the
// file's new stamp.
function writeTextFile(filePath, content, encoding, eol) {
  const text = eol === "lf" ? content : content.replace(/\n/g, "\r\n");
  const encoded = encodeText(text, encoding);
  saveFileSafely(filePath, encoded.buffer);
  return { encoding: encoded.encoding, stamp: fileStamp(filePath) };
}

module.exports = {
  decodeText,
  encodeText,
  defaultEol,
  normalizeText,
  fileStamp,
  sameStamp,
  writeFileAtomic,
  saveFileSafely,
  readTextFile,
  writeTextFile,
};
