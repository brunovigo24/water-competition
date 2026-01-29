// Forces Node console/stdout/stderr to write synchronously.
// Useful in sandboxed environments where async stream writes don't show up.
const fs = require("fs");
const util = require("util");

function toStr(x) {
  if (typeof x === "string") return x;
  return util.inspect(x, { colors: false, depth: 6, maxArrayLength: 50 });
}

function writeSync(fd, msg) {
  try {
    fs.writeSync(fd, msg);
  } catch {
    // ignore
  }
}

for (const key of ["log", "info", "warn", "error"]) {
  console[key] = (...args) => {
    const fd = key === "error" || key === "warn" ? 2 : 1;
    writeSync(fd, args.map(toStr).join(" ") + "\n");
  };
}

process.stdout.write = (chunk, enc, cb) => {
  writeSync(1, Buffer.isBuffer(chunk) ? chunk.toString(enc) : String(chunk));
  if (typeof enc === "function") enc();
  if (typeof cb === "function") cb();
  return true;
};

process.stderr.write = (chunk, enc, cb) => {
  writeSync(2, Buffer.isBuffer(chunk) ? chunk.toString(enc) : String(chunk));
  if (typeof enc === "function") enc();
  if (typeof cb === "function") cb();
  return true;
};

