var __accessCheck = (obj, member, msg) => {
  if (!member.has(obj))
    throw TypeError("Cannot " + msg);
};
var __privateGet = (obj, member, getter) => {
  __accessCheck(obj, member, "read from private field");
  return getter ? getter.call(obj) : member.get(obj);
};
var __privateAdd = (obj, member, value) => {
  if (member.has(obj))
    throw TypeError("Cannot add the same private member more than once");
  member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
};
var __privateSet = (obj, member, value, setter) => {
  __accessCheck(obj, member, "write to private field");
  setter ? setter.call(obj, value) : member.set(obj, value);
  return value;
};
var _stream, _entry, _mtime, _a;
let id = 0;
const symbolDispose$2 = Symbol.dispose || Symbol.for("dispose");
const IoError = class Error2 {
  constructor(msg) {
    this.msg = msg;
  }
  toDebugString() {
    return this.msg;
  }
};
let InputStream$3 = class InputStream {
  /**
   * @param {InputStreamHandler} handler
   */
  constructor(handler) {
    if (!handler)
      console.trace("no handler");
    this.id = ++id;
    this.handler = handler;
  }
  read(len) {
    if (this.handler.read)
      return this.handler.read(len);
    return this.handler.blockingRead.call(this, len);
  }
  blockingRead(len) {
    return this.handler.blockingRead.call(this, len);
  }
  skip(len) {
    if (this.handler.skip)
      return this.handler.skip.call(this, len);
    if (this.handler.read) {
      const bytes = this.handler.read.call(this, len);
      return BigInt(bytes.byteLength);
    }
    return this.blockingSkip.call(this, len);
  }
  blockingSkip(len) {
    if (this.handler.blockingSkip)
      return this.handler.blockingSkip.call(this, len);
    const bytes = this.handler.blockingRead.call(this, len);
    return BigInt(bytes.byteLength);
  }
  subscribe() {
    console.log(`[streams] Subscribe to input stream ${this.id}`);
  }
  [symbolDispose$2]() {
    if (this.handler.drop)
      this.handler.drop.call(this);
  }
};
let OutputStream$3 = class OutputStream {
  /**
   * @param {OutputStreamHandler} handler
   */
  constructor(handler) {
    if (!handler)
      console.trace("no handler");
    this.id = ++id;
    this.open = true;
    this.handler = handler;
  }
  checkWrite(len) {
    if (!this.open)
      return 0n;
    if (this.handler.checkWrite)
      return this.handler.checkWrite.call(this, len);
    return 1000000n;
  }
  write(buf) {
    this.handler.write.call(this, buf);
  }
  blockingWriteAndFlush(buf) {
    this.handler.write.call(this, buf);
  }
  flush() {
    if (this.handler.flush)
      this.handler.flush.call(this);
  }
  blockingFlush() {
    this.open = true;
  }
  writeZeroes(len) {
    this.write.call(this, new Uint8Array(Number(len)));
  }
  blockingWriteZeroes(len) {
    this.blockingWrite.call(this, new Uint8Array(Number(len)));
  }
  blockingWriteZeroesAndFlush(len) {
    this.blockingWriteAndFlush.call(this, new Uint8Array(Number(len)));
  }
  splice(src, len) {
    const spliceLen = Math.min(len, this.checkWrite.call(this));
    const bytes = src.read(spliceLen);
    this.write.call(this, bytes);
    return bytes.byteLength;
  }
  blockingSplice(_src, _len) {
    console.log(`[streams] Blocking splice ${this.id}`);
  }
  forward(_src) {
    console.log(`[streams] Forward ${this.id}`);
  }
  subscribe() {
    console.log(`[streams] Subscribe to output stream ${this.id}`);
  }
  [symbolDispose$2]() {
  }
};
const error = { Error: IoError };
const streams = { InputStream: InputStream$3, OutputStream: OutputStream$3 };
const { InputStream: InputStream$2, OutputStream: OutputStream$2 } = streams;
let _cwd$1 = null;
let _fileData = { dir: {} };
const timeZero = {
  seconds: BigInt(0),
  nanoseconds: 0
};
function getChildEntry(parentEntry, subpath, openFlags) {
  if (subpath === "." && _rootPreopen && descriptorGetEntry(_rootPreopen[0]) === parentEntry) {
    subpath = _cwd$1;
    if (subpath.startsWith("/") && subpath !== "/")
      subpath = subpath.slice(1);
  }
  let entry = parentEntry;
  let segmentIdx;
  do {
    if (!entry || !entry.dir)
      throw "not-directory";
    segmentIdx = subpath.indexOf("/");
    const segment = segmentIdx === -1 ? subpath : subpath.slice(0, segmentIdx);
    if (segment === "." || segment === "")
      return entry;
    if (segment === "..")
      throw "no-entry";
    if (!entry.dir[segment] && openFlags.create)
      entry = entry.dir[segment] = openFlags.directory ? { dir: {} } : { source: new Uint8Array([]) };
    else
      entry = entry.dir[segment];
  } while (segmentIdx !== -1);
  if (!entry)
    throw "no-entry";
  return entry;
}
function getSource(fileEntry) {
  if (typeof fileEntry.source === "string") {
    fileEntry.source = new TextEncoder().encode(fileEntry.source);
  }
  return fileEntry.source;
}
let DirectoryEntryStream$1 = class DirectoryEntryStream {
  constructor(entries) {
    this.idx = 0;
    this.entries = entries;
  }
  readDirectoryEntry() {
    if (this.idx === this.entries.length)
      return null;
    const [name, entry] = this.entries[this.idx];
    this.idx += 1;
    return {
      name,
      type: entry.dir ? "directory" : "regular-file"
    };
  }
};
let Descriptor$1 = (_a = class {
  constructor(entry, isStream) {
    __privateAdd(this, _stream, void 0);
    __privateAdd(this, _entry, void 0);
    __privateAdd(this, _mtime, 0);
    if (isStream)
      __privateSet(this, _stream, entry);
    else
      __privateSet(this, _entry, entry);
  }
  _getEntry(descriptor) {
    return __privateGet(descriptor, _entry);
  }
  readViaStream(_offset) {
    const source = getSource(__privateGet(this, _entry));
    let offset = Number(_offset);
    return new InputStream$2({
      blockingRead(len) {
        if (offset === source.byteLength)
          throw { tag: "closed" };
        const bytes = source.slice(offset, offset + Number(len));
        offset += bytes.byteLength;
        return bytes;
      }
    });
  }
  writeViaStream(_offset) {
    const entry = __privateGet(this, _entry);
    let offset = Number(_offset);
    return new OutputStream$2({
      write(buf) {
        const newSource = new Uint8Array(buf.byteLength + entry.source.byteLength);
        newSource.set(entry.source, 0);
        newSource.set(buf, offset);
        offset += buf.byteLength;
        entry.source = newSource;
        return buf.byteLength;
      }
    });
  }
  appendViaStream() {
    console.log(`[filesystem] APPEND STREAM`);
  }
  advise(descriptor, offset, length, advice) {
    console.log(`[filesystem] ADVISE`, descriptor, offset, length, advice);
  }
  syncData() {
    console.log(`[filesystem] SYNC DATA`);
  }
  getFlags() {
    console.log(`[filesystem] FLAGS FOR`);
  }
  getType() {
    if (__privateGet(this, _stream))
      return "fifo";
    if (__privateGet(this, _entry).dir)
      return "directory";
    if (__privateGet(this, _entry).source)
      return "regular-file";
    return "unknown";
  }
  setSize(size) {
    console.log(`[filesystem] SET SIZE`, size);
  }
  setTimes(dataAccessTimestamp, dataModificationTimestamp) {
    console.log(`[filesystem] SET TIMES`, dataAccessTimestamp, dataModificationTimestamp);
  }
  read(length, offset) {
    const source = getSource(__privateGet(this, _entry));
    return [source.slice(offset, offset + length), offset + length >= source.byteLength];
  }
  write(buffer, offset) {
    if (offset !== 0)
      throw "invalid-seek";
    __privateGet(this, _entry).source = buffer;
    return buffer.byteLength;
  }
  readDirectory() {
    var _a2;
    if (!((_a2 = __privateGet(this, _entry)) == null ? void 0 : _a2.dir))
      throw "bad-descriptor";
    return new DirectoryEntryStream$1(Object.entries(__privateGet(this, _entry).dir).sort(([a], [b]) => a > b ? 1 : -1));
  }
  sync() {
    console.log(`[filesystem] SYNC`);
  }
  createDirectoryAt(path) {
    const entry = getChildEntry(__privateGet(this, _entry), path, { create: true, directory: true });
    if (entry.source)
      throw "exist";
  }
  stat() {
    let type = "unknown", size = BigInt(0);
    if (__privateGet(this, _entry).source) {
      type = "directory";
    } else if (__privateGet(this, _entry).dir) {
      type = "regular-file";
      const source = getSource(__privateGet(this, _entry));
      size = BigInt(source.byteLength);
    }
    return {
      type,
      linkCount: BigInt(0),
      size,
      dataAccessTimestamp: timeZero,
      dataModificationTimestamp: timeZero,
      statusChangeTimestamp: timeZero
    };
  }
  statAt(_pathFlags, path) {
    const entry = getChildEntry(__privateGet(this, _entry), path);
    let type = "unknown", size = BigInt(0);
    if (entry.source) {
      type = "regular-file";
      const source = getSource(entry);
      size = BigInt(source.byteLength);
    } else if (entry.dir) {
      type = "directory";
    }
    return {
      type,
      linkCount: BigInt(0),
      size,
      dataAccessTimestamp: timeZero,
      dataModificationTimestamp: timeZero,
      statusChangeTimestamp: timeZero
    };
  }
  setTimesAt() {
    console.log(`[filesystem] SET TIMES AT`);
  }
  linkAt() {
    console.log(`[filesystem] LINK AT`);
  }
  openAt(_pathFlags, path, openFlags, _descriptorFlags, _modes) {
    const childEntry = getChildEntry(__privateGet(this, _entry), path, openFlags);
    return new _a(childEntry);
  }
  readlinkAt() {
    console.log(`[filesystem] READLINK AT`);
  }
  removeDirectoryAt() {
    console.log(`[filesystem] REMOVE DIR AT`);
  }
  renameAt() {
    console.log(`[filesystem] RENAME AT`);
  }
  symlinkAt() {
    console.log(`[filesystem] SYMLINK AT`);
  }
  unlinkFileAt() {
    console.log(`[filesystem] UNLINK FILE AT`);
  }
  isSameObject(other) {
    return other === this;
  }
  metadataHash() {
    let upper = BigInt(0);
    upper += BigInt(__privateGet(this, _mtime));
    return { upper, lower: BigInt(0) };
  }
  metadataHashAt(_pathFlags, _path) {
    let upper = BigInt(0);
    upper += BigInt(__privateGet(this, _mtime));
    return { upper, lower: BigInt(0) };
  }
}, _stream = new WeakMap(), _entry = new WeakMap(), _mtime = new WeakMap(), _a);
const descriptorGetEntry = Descriptor$1.prototype._getEntry;
delete Descriptor$1.prototype._getEntry;
let _preopens = [[new Descriptor$1(_fileData), "/"]], _rootPreopen = _preopens[0];
const preopens = {
  getDirectories() {
    return _preopens;
  }
};
const types = {
  Descriptor: Descriptor$1,
  DirectoryEntryStream: DirectoryEntryStream$1
};
const { InputStream: InputStream$1, OutputStream: OutputStream$1 } = streams;
const symbolDispose$1 = Symbol.dispose ?? Symbol.for("dispose");
let _env = [], _args = [], _cwd = null;
const environment = {
  getEnvironment() {
    return _env;
  },
  getArguments() {
    return _args;
  },
  initialCwd() {
    return _cwd;
  }
};
class ComponentExit extends Error {
  constructor(ok) {
    super(`Component exited ${ok ? "successfully" : "with error"}`);
    this.exitError = true;
    this.ok = ok;
  }
}
const exit$1 = {
  exit(status) {
    throw new ComponentExit(status.tag === "err" ? true : false);
  }
};
const stdinStream = new InputStream$1({
  blockingRead(_len) {
  },
  subscribe() {
  },
  [symbolDispose$1]() {
  }
});
let textDecoder = new TextDecoder();
const stdoutStream = new OutputStream$1({
  write(contents) {
    console.log(textDecoder.decode(contents));
  },
  blockingFlush() {
  },
  [symbolDispose$1]() {
  }
});
const stderrStream = new OutputStream$1({
  write(contents) {
    console.error(textDecoder.decode(contents));
  },
  blockingFlush() {
  },
  [symbolDispose$1]() {
  }
});
const stdin = {
  InputStream: InputStream$1,
  getStdin() {
    return stdinStream;
  }
};
const stdout = {
  OutputStream: OutputStream$1,
  getStdout() {
    return stdoutStream;
  }
};
const stderr = {
  OutputStream: OutputStream$1,
  getStderr() {
    return stderrStream;
  }
};
let TerminalInput$1 = class TerminalInput {
};
let TerminalOutput$1 = class TerminalOutput {
};
const terminalStdoutInstance = new TerminalOutput$1();
const terminalStderrInstance = new TerminalOutput$1();
const terminalStdinInstance = new TerminalInput$1();
const terminalInput = {
  TerminalInput: TerminalInput$1
};
const terminalOutput = {
  TerminalOutput: TerminalOutput$1
};
const terminalStderr = {
  TerminalOutput: TerminalOutput$1,
  getTerminalStderr() {
    return terminalStderrInstance;
  }
};
const terminalStdin = {
  TerminalInput: TerminalInput$1,
  getTerminalStdin() {
    return terminalStdinInstance;
  }
};
const terminalStdout = {
  TerminalOutput: TerminalOutput$1,
  getTerminalStdout() {
    return terminalStdoutInstance;
  }
};
const MAX_BYTES = 65536;
let insecureRandomValue1, insecureRandomValue2;
const random = {
  getRandomBytes(len) {
    const bytes = new Uint8Array(Number(len));
    if (len > MAX_BYTES) {
      for (var generated = 0; generated < len; generated += MAX_BYTES) {
        crypto.getRandomValues(bytes.slice(generated, generated + MAX_BYTES));
      }
    } else {
      crypto.getRandomValues(bytes);
    }
    return bytes;
  },
  getRandomU64() {
    return crypto.getRandomValues(new BigUint64Array(1))[0];
  },
  insecureRandom() {
    if (insecureRandomValue1 === void 0) {
      insecureRandomValue1 = random.getRandomU64();
      insecureRandomValue2 = random.getRandomU64();
    }
    return [insecureRandomValue1, insecureRandomValue2];
  }
};
const { getEnvironment } = environment;
const { exit } = exit$1;
const { getStderr } = stderr;
const { getStdin } = stdin;
const { getStdout } = stdout;
const { TerminalInput: TerminalInput2 } = terminalInput;
const { TerminalOutput: TerminalOutput2 } = terminalOutput;
const { getTerminalStderr } = terminalStderr;
const { getTerminalStdin } = terminalStdin;
const { getTerminalStdout } = terminalStdout;
const { getDirectories } = preopens;
const {
  Descriptor,
  DirectoryEntryStream: DirectoryEntryStream2,
  filesystemErrorCode
} = types;
const { Error: Error$1 } = error;
const {
  InputStream: InputStream2,
  OutputStream: OutputStream2
} = streams;
const { getRandomBytes } = random;
const base64Compile = (str) => WebAssembly.compile(typeof Buffer !== "undefined" ? Buffer.from(str, "base64") : Uint8Array.from(atob(str), (b) => b.charCodeAt(0)));
class ComponentError extends Error {
  constructor(value) {
    const enumerable = typeof value !== "string";
    super(enumerable ? `${String(value)} (see error.payload)` : value);
    Object.defineProperty(this, "payload", { value, enumerable });
  }
}
let dv = new DataView(new ArrayBuffer());
const dataView = (mem) => dv.buffer === mem.buffer ? dv : dv = new DataView(mem.buffer);
const isNode = typeof process !== "undefined" && process.versions && process.versions.node;
let _fs;
async function fetchCompile(url) {
  if (isNode) {
    _fs = _fs || await Promise.resolve().then(() => __viteBrowserExternal$1);
    return WebAssembly.compile(await _fs.readFile(url));
  }
  return fetch(url).then(WebAssembly.compileStreaming);
}
function getErrorPayload(e) {
  if (e && hasOwnProperty.call(e, "payload"))
    return e.payload;
  return e;
}
const hasOwnProperty = Object.prototype.hasOwnProperty;
const instantiateCore = WebAssembly.instantiate;
const symbolDispose = Symbol.dispose || Symbol.for("dispose");
function throwUninitialized() {
  throw new TypeError("Wasm uninitialized use `await $init` first");
}
const toUint64 = (val) => BigInt.asUintN(64, BigInt(val));
function toUint32(val) {
  return val >>> 0;
}
const utf8Decoder = new TextDecoder();
const utf8Encoder = new TextEncoder();
let utf8EncodedLen = 0;
function utf8Encode(s, realloc, memory) {
  if (typeof s !== "string")
    throw new TypeError("expected a string");
  if (s.length === 0) {
    utf8EncodedLen = 0;
    return 1;
  }
  let allocLen = 0;
  let ptr = 0;
  let writtenTotal = 0;
  while (s.length > 0) {
    ptr = realloc(ptr, allocLen, 1, allocLen += s.length * 2);
    const { read, written } = utf8Encoder.encodeInto(
      s,
      new Uint8Array(memory.buffer, ptr + writtenTotal, allocLen - writtenTotal)
    );
    writtenTotal += written;
    s = s.slice(read);
  }
  utf8EncodedLen = writtenTotal;
  return ptr;
}
let exports0;
let exports1;
function trampoline8() {
  const ret = getStderr();
  if (!(ret instanceof OutputStream2)) {
    throw new Error('Resource error: Not a valid "OutputStream" resource.');
  }
  var handle0 = handleCnt2++;
  handleTable2.set(handle0, { rep: ret, own: true });
  return handle0;
}
function trampoline9(arg0) {
  let variant0;
  switch (arg0) {
    case 0: {
      variant0 = {
        tag: "ok",
        val: void 0
      };
      break;
    }
    case 1: {
      variant0 = {
        tag: "err",
        val: void 0
      };
      break;
    }
    default: {
      throw new TypeError("invalid variant discriminant for expected");
    }
  }
  exit(variant0);
}
function trampoline10() {
  const ret = getStdin();
  if (!(ret instanceof InputStream2)) {
    throw new Error('Resource error: Not a valid "InputStream" resource.');
  }
  var handle0 = handleCnt1++;
  handleTable1.set(handle0, { rep: ret, own: true });
  return handle0;
}
function trampoline11() {
  const ret = getStdout();
  if (!(ret instanceof OutputStream2)) {
    throw new Error('Resource error: Not a valid "OutputStream" resource.');
  }
  var handle0 = handleCnt2++;
  handleTable2.set(handle0, { rep: ret, own: true });
  return handle0;
}
let exports2;
function trampoline12(arg0) {
  const ret = getDirectories();
  var vec3 = ret;
  var len3 = vec3.length;
  var result3 = realloc0(0, 0, 4, len3 * 12);
  for (let i = 0; i < vec3.length; i++) {
    const e = vec3[i];
    const base = result3 + i * 12;
    var [tuple0_0, tuple0_1] = e;
    if (!(tuple0_0 instanceof Descriptor)) {
      throw new Error('Resource error: Not a valid "Descriptor" resource.');
    }
    var handle1 = handleCnt3++;
    handleTable3.set(handle1, { rep: tuple0_0, own: true });
    dataView(memory0).setInt32(base + 0, handle1, true);
    var ptr2 = utf8Encode(tuple0_1, realloc0, memory0);
    var len2 = utf8EncodedLen;
    dataView(memory0).setInt32(base + 8, len2, true);
    dataView(memory0).setInt32(base + 4, ptr2, true);
  }
  dataView(memory0).setInt32(arg0 + 4, len3, true);
  dataView(memory0).setInt32(arg0 + 0, result3, true);
}
let memory0;
let realloc0;
function trampoline13(arg0, arg1, arg2) {
  var handle1 = arg0;
  var rsc0 = handleTable3.get(handle1).rep;
  let ret;
  try {
    ret = { tag: "ok", val: Descriptor.prototype.readViaStream.call(rsc0, BigInt.asUintN(64, arg1)) };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  var variant4 = ret;
  switch (variant4.tag) {
    case "ok": {
      const e = variant4.val;
      dataView(memory0).setInt8(arg2 + 0, 0, true);
      if (!(e instanceof InputStream2)) {
        throw new Error('Resource error: Not a valid "InputStream" resource.');
      }
      var handle2 = handleCnt1++;
      handleTable1.set(handle2, { rep: e, own: true });
      dataView(memory0).setInt32(arg2 + 4, handle2, true);
      break;
    }
    case "err": {
      const e = variant4.val;
      dataView(memory0).setInt8(arg2 + 0, 1, true);
      var val3 = e;
      let enum3;
      switch (val3) {
        case "access": {
          enum3 = 0;
          break;
        }
        case "would-block": {
          enum3 = 1;
          break;
        }
        case "already": {
          enum3 = 2;
          break;
        }
        case "bad-descriptor": {
          enum3 = 3;
          break;
        }
        case "busy": {
          enum3 = 4;
          break;
        }
        case "deadlock": {
          enum3 = 5;
          break;
        }
        case "quota": {
          enum3 = 6;
          break;
        }
        case "exist": {
          enum3 = 7;
          break;
        }
        case "file-too-large": {
          enum3 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum3 = 9;
          break;
        }
        case "in-progress": {
          enum3 = 10;
          break;
        }
        case "interrupted": {
          enum3 = 11;
          break;
        }
        case "invalid": {
          enum3 = 12;
          break;
        }
        case "io": {
          enum3 = 13;
          break;
        }
        case "is-directory": {
          enum3 = 14;
          break;
        }
        case "loop": {
          enum3 = 15;
          break;
        }
        case "too-many-links": {
          enum3 = 16;
          break;
        }
        case "message-size": {
          enum3 = 17;
          break;
        }
        case "name-too-long": {
          enum3 = 18;
          break;
        }
        case "no-device": {
          enum3 = 19;
          break;
        }
        case "no-entry": {
          enum3 = 20;
          break;
        }
        case "no-lock": {
          enum3 = 21;
          break;
        }
        case "insufficient-memory": {
          enum3 = 22;
          break;
        }
        case "insufficient-space": {
          enum3 = 23;
          break;
        }
        case "not-directory": {
          enum3 = 24;
          break;
        }
        case "not-empty": {
          enum3 = 25;
          break;
        }
        case "not-recoverable": {
          enum3 = 26;
          break;
        }
        case "unsupported": {
          enum3 = 27;
          break;
        }
        case "no-tty": {
          enum3 = 28;
          break;
        }
        case "no-such-device": {
          enum3 = 29;
          break;
        }
        case "overflow": {
          enum3 = 30;
          break;
        }
        case "not-permitted": {
          enum3 = 31;
          break;
        }
        case "pipe": {
          enum3 = 32;
          break;
        }
        case "read-only": {
          enum3 = 33;
          break;
        }
        case "invalid-seek": {
          enum3 = 34;
          break;
        }
        case "text-file-busy": {
          enum3 = 35;
          break;
        }
        case "cross-device": {
          enum3 = 36;
          break;
        }
        default: {
          if (e instanceof Error) {
            console.error(e);
          }
          throw new TypeError(`"${val3}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg2 + 4, enum3, true);
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
}
function trampoline14(arg0, arg1, arg2) {
  var handle1 = arg0;
  var rsc0 = handleTable3.get(handle1).rep;
  let ret;
  try {
    ret = { tag: "ok", val: Descriptor.prototype.writeViaStream.call(rsc0, BigInt.asUintN(64, arg1)) };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  var variant4 = ret;
  switch (variant4.tag) {
    case "ok": {
      const e = variant4.val;
      dataView(memory0).setInt8(arg2 + 0, 0, true);
      if (!(e instanceof OutputStream2)) {
        throw new Error('Resource error: Not a valid "OutputStream" resource.');
      }
      var handle2 = handleCnt2++;
      handleTable2.set(handle2, { rep: e, own: true });
      dataView(memory0).setInt32(arg2 + 4, handle2, true);
      break;
    }
    case "err": {
      const e = variant4.val;
      dataView(memory0).setInt8(arg2 + 0, 1, true);
      var val3 = e;
      let enum3;
      switch (val3) {
        case "access": {
          enum3 = 0;
          break;
        }
        case "would-block": {
          enum3 = 1;
          break;
        }
        case "already": {
          enum3 = 2;
          break;
        }
        case "bad-descriptor": {
          enum3 = 3;
          break;
        }
        case "busy": {
          enum3 = 4;
          break;
        }
        case "deadlock": {
          enum3 = 5;
          break;
        }
        case "quota": {
          enum3 = 6;
          break;
        }
        case "exist": {
          enum3 = 7;
          break;
        }
        case "file-too-large": {
          enum3 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum3 = 9;
          break;
        }
        case "in-progress": {
          enum3 = 10;
          break;
        }
        case "interrupted": {
          enum3 = 11;
          break;
        }
        case "invalid": {
          enum3 = 12;
          break;
        }
        case "io": {
          enum3 = 13;
          break;
        }
        case "is-directory": {
          enum3 = 14;
          break;
        }
        case "loop": {
          enum3 = 15;
          break;
        }
        case "too-many-links": {
          enum3 = 16;
          break;
        }
        case "message-size": {
          enum3 = 17;
          break;
        }
        case "name-too-long": {
          enum3 = 18;
          break;
        }
        case "no-device": {
          enum3 = 19;
          break;
        }
        case "no-entry": {
          enum3 = 20;
          break;
        }
        case "no-lock": {
          enum3 = 21;
          break;
        }
        case "insufficient-memory": {
          enum3 = 22;
          break;
        }
        case "insufficient-space": {
          enum3 = 23;
          break;
        }
        case "not-directory": {
          enum3 = 24;
          break;
        }
        case "not-empty": {
          enum3 = 25;
          break;
        }
        case "not-recoverable": {
          enum3 = 26;
          break;
        }
        case "unsupported": {
          enum3 = 27;
          break;
        }
        case "no-tty": {
          enum3 = 28;
          break;
        }
        case "no-such-device": {
          enum3 = 29;
          break;
        }
        case "overflow": {
          enum3 = 30;
          break;
        }
        case "not-permitted": {
          enum3 = 31;
          break;
        }
        case "pipe": {
          enum3 = 32;
          break;
        }
        case "read-only": {
          enum3 = 33;
          break;
        }
        case "invalid-seek": {
          enum3 = 34;
          break;
        }
        case "text-file-busy": {
          enum3 = 35;
          break;
        }
        case "cross-device": {
          enum3 = 36;
          break;
        }
        default: {
          if (e instanceof Error) {
            console.error(e);
          }
          throw new TypeError(`"${val3}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg2 + 4, enum3, true);
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
}
function trampoline15(arg0, arg1) {
  var handle1 = arg0;
  var rsc0 = handleTable3.get(handle1).rep;
  let ret;
  try {
    ret = { tag: "ok", val: Descriptor.prototype.appendViaStream.call(rsc0) };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  var variant4 = ret;
  switch (variant4.tag) {
    case "ok": {
      const e = variant4.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      if (!(e instanceof OutputStream2)) {
        throw new Error('Resource error: Not a valid "OutputStream" resource.');
      }
      var handle2 = handleCnt2++;
      handleTable2.set(handle2, { rep: e, own: true });
      dataView(memory0).setInt32(arg1 + 4, handle2, true);
      break;
    }
    case "err": {
      const e = variant4.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      var val3 = e;
      let enum3;
      switch (val3) {
        case "access": {
          enum3 = 0;
          break;
        }
        case "would-block": {
          enum3 = 1;
          break;
        }
        case "already": {
          enum3 = 2;
          break;
        }
        case "bad-descriptor": {
          enum3 = 3;
          break;
        }
        case "busy": {
          enum3 = 4;
          break;
        }
        case "deadlock": {
          enum3 = 5;
          break;
        }
        case "quota": {
          enum3 = 6;
          break;
        }
        case "exist": {
          enum3 = 7;
          break;
        }
        case "file-too-large": {
          enum3 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum3 = 9;
          break;
        }
        case "in-progress": {
          enum3 = 10;
          break;
        }
        case "interrupted": {
          enum3 = 11;
          break;
        }
        case "invalid": {
          enum3 = 12;
          break;
        }
        case "io": {
          enum3 = 13;
          break;
        }
        case "is-directory": {
          enum3 = 14;
          break;
        }
        case "loop": {
          enum3 = 15;
          break;
        }
        case "too-many-links": {
          enum3 = 16;
          break;
        }
        case "message-size": {
          enum3 = 17;
          break;
        }
        case "name-too-long": {
          enum3 = 18;
          break;
        }
        case "no-device": {
          enum3 = 19;
          break;
        }
        case "no-entry": {
          enum3 = 20;
          break;
        }
        case "no-lock": {
          enum3 = 21;
          break;
        }
        case "insufficient-memory": {
          enum3 = 22;
          break;
        }
        case "insufficient-space": {
          enum3 = 23;
          break;
        }
        case "not-directory": {
          enum3 = 24;
          break;
        }
        case "not-empty": {
          enum3 = 25;
          break;
        }
        case "not-recoverable": {
          enum3 = 26;
          break;
        }
        case "unsupported": {
          enum3 = 27;
          break;
        }
        case "no-tty": {
          enum3 = 28;
          break;
        }
        case "no-such-device": {
          enum3 = 29;
          break;
        }
        case "overflow": {
          enum3 = 30;
          break;
        }
        case "not-permitted": {
          enum3 = 31;
          break;
        }
        case "pipe": {
          enum3 = 32;
          break;
        }
        case "read-only": {
          enum3 = 33;
          break;
        }
        case "invalid-seek": {
          enum3 = 34;
          break;
        }
        case "text-file-busy": {
          enum3 = 35;
          break;
        }
        case "cross-device": {
          enum3 = 36;
          break;
        }
        default: {
          if (e instanceof Error) {
            console.error(e);
          }
          throw new TypeError(`"${val3}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg1 + 4, enum3, true);
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
}
function trampoline16(arg0, arg1) {
  var handle1 = arg0;
  var rsc0 = handleTable3.get(handle1).rep;
  let ret;
  try {
    ret = { tag: "ok", val: Descriptor.prototype.getType.call(rsc0) };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  var variant4 = ret;
  switch (variant4.tag) {
    case "ok": {
      const e = variant4.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      var val2 = e;
      let enum2;
      switch (val2) {
        case "unknown": {
          enum2 = 0;
          break;
        }
        case "block-device": {
          enum2 = 1;
          break;
        }
        case "character-device": {
          enum2 = 2;
          break;
        }
        case "directory": {
          enum2 = 3;
          break;
        }
        case "fifo": {
          enum2 = 4;
          break;
        }
        case "symbolic-link": {
          enum2 = 5;
          break;
        }
        case "regular-file": {
          enum2 = 6;
          break;
        }
        case "socket": {
          enum2 = 7;
          break;
        }
        default: {
          if (e instanceof Error) {
            console.error(e);
          }
          throw new TypeError(`"${val2}" is not one of the cases of descriptor-type`);
        }
      }
      dataView(memory0).setInt8(arg1 + 1, enum2, true);
      break;
    }
    case "err": {
      const e = variant4.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      var val3 = e;
      let enum3;
      switch (val3) {
        case "access": {
          enum3 = 0;
          break;
        }
        case "would-block": {
          enum3 = 1;
          break;
        }
        case "already": {
          enum3 = 2;
          break;
        }
        case "bad-descriptor": {
          enum3 = 3;
          break;
        }
        case "busy": {
          enum3 = 4;
          break;
        }
        case "deadlock": {
          enum3 = 5;
          break;
        }
        case "quota": {
          enum3 = 6;
          break;
        }
        case "exist": {
          enum3 = 7;
          break;
        }
        case "file-too-large": {
          enum3 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum3 = 9;
          break;
        }
        case "in-progress": {
          enum3 = 10;
          break;
        }
        case "interrupted": {
          enum3 = 11;
          break;
        }
        case "invalid": {
          enum3 = 12;
          break;
        }
        case "io": {
          enum3 = 13;
          break;
        }
        case "is-directory": {
          enum3 = 14;
          break;
        }
        case "loop": {
          enum3 = 15;
          break;
        }
        case "too-many-links": {
          enum3 = 16;
          break;
        }
        case "message-size": {
          enum3 = 17;
          break;
        }
        case "name-too-long": {
          enum3 = 18;
          break;
        }
        case "no-device": {
          enum3 = 19;
          break;
        }
        case "no-entry": {
          enum3 = 20;
          break;
        }
        case "no-lock": {
          enum3 = 21;
          break;
        }
        case "insufficient-memory": {
          enum3 = 22;
          break;
        }
        case "insufficient-space": {
          enum3 = 23;
          break;
        }
        case "not-directory": {
          enum3 = 24;
          break;
        }
        case "not-empty": {
          enum3 = 25;
          break;
        }
        case "not-recoverable": {
          enum3 = 26;
          break;
        }
        case "unsupported": {
          enum3 = 27;
          break;
        }
        case "no-tty": {
          enum3 = 28;
          break;
        }
        case "no-such-device": {
          enum3 = 29;
          break;
        }
        case "overflow": {
          enum3 = 30;
          break;
        }
        case "not-permitted": {
          enum3 = 31;
          break;
        }
        case "pipe": {
          enum3 = 32;
          break;
        }
        case "read-only": {
          enum3 = 33;
          break;
        }
        case "invalid-seek": {
          enum3 = 34;
          break;
        }
        case "text-file-busy": {
          enum3 = 35;
          break;
        }
        case "cross-device": {
          enum3 = 36;
          break;
        }
        default: {
          if (e instanceof Error) {
            console.error(e);
          }
          throw new TypeError(`"${val3}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg1 + 1, enum3, true);
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
}
function trampoline17(arg0, arg1) {
  var handle1 = arg0;
  var rsc0 = handleTable3.get(handle1).rep;
  let ret;
  try {
    ret = { tag: "ok", val: Descriptor.prototype.stat.call(rsc0) };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  var variant11 = ret;
  switch (variant11.tag) {
    case "ok": {
      const e = variant11.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      var { type: v2_0, linkCount: v2_1, size: v2_2, dataAccessTimestamp: v2_3, dataModificationTimestamp: v2_4, statusChangeTimestamp: v2_5 } = e;
      var val3 = v2_0;
      let enum3;
      switch (val3) {
        case "unknown": {
          enum3 = 0;
          break;
        }
        case "block-device": {
          enum3 = 1;
          break;
        }
        case "character-device": {
          enum3 = 2;
          break;
        }
        case "directory": {
          enum3 = 3;
          break;
        }
        case "fifo": {
          enum3 = 4;
          break;
        }
        case "symbolic-link": {
          enum3 = 5;
          break;
        }
        case "regular-file": {
          enum3 = 6;
          break;
        }
        case "socket": {
          enum3 = 7;
          break;
        }
        default: {
          if (v2_0 instanceof Error) {
            console.error(v2_0);
          }
          throw new TypeError(`"${val3}" is not one of the cases of descriptor-type`);
        }
      }
      dataView(memory0).setInt8(arg1 + 8, enum3, true);
      dataView(memory0).setBigInt64(arg1 + 16, toUint64(v2_1), true);
      dataView(memory0).setBigInt64(arg1 + 24, toUint64(v2_2), true);
      var variant5 = v2_3;
      if (variant5 === null || variant5 === void 0) {
        dataView(memory0).setInt8(arg1 + 32, 0, true);
      } else {
        const e2 = variant5;
        dataView(memory0).setInt8(arg1 + 32, 1, true);
        var { seconds: v4_0, nanoseconds: v4_1 } = e2;
        dataView(memory0).setBigInt64(arg1 + 40, toUint64(v4_0), true);
        dataView(memory0).setInt32(arg1 + 48, toUint32(v4_1), true);
      }
      var variant7 = v2_4;
      if (variant7 === null || variant7 === void 0) {
        dataView(memory0).setInt8(arg1 + 56, 0, true);
      } else {
        const e2 = variant7;
        dataView(memory0).setInt8(arg1 + 56, 1, true);
        var { seconds: v6_0, nanoseconds: v6_1 } = e2;
        dataView(memory0).setBigInt64(arg1 + 64, toUint64(v6_0), true);
        dataView(memory0).setInt32(arg1 + 72, toUint32(v6_1), true);
      }
      var variant9 = v2_5;
      if (variant9 === null || variant9 === void 0) {
        dataView(memory0).setInt8(arg1 + 80, 0, true);
      } else {
        const e2 = variant9;
        dataView(memory0).setInt8(arg1 + 80, 1, true);
        var { seconds: v8_0, nanoseconds: v8_1 } = e2;
        dataView(memory0).setBigInt64(arg1 + 88, toUint64(v8_0), true);
        dataView(memory0).setInt32(arg1 + 96, toUint32(v8_1), true);
      }
      break;
    }
    case "err": {
      const e = variant11.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      var val10 = e;
      let enum10;
      switch (val10) {
        case "access": {
          enum10 = 0;
          break;
        }
        case "would-block": {
          enum10 = 1;
          break;
        }
        case "already": {
          enum10 = 2;
          break;
        }
        case "bad-descriptor": {
          enum10 = 3;
          break;
        }
        case "busy": {
          enum10 = 4;
          break;
        }
        case "deadlock": {
          enum10 = 5;
          break;
        }
        case "quota": {
          enum10 = 6;
          break;
        }
        case "exist": {
          enum10 = 7;
          break;
        }
        case "file-too-large": {
          enum10 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum10 = 9;
          break;
        }
        case "in-progress": {
          enum10 = 10;
          break;
        }
        case "interrupted": {
          enum10 = 11;
          break;
        }
        case "invalid": {
          enum10 = 12;
          break;
        }
        case "io": {
          enum10 = 13;
          break;
        }
        case "is-directory": {
          enum10 = 14;
          break;
        }
        case "loop": {
          enum10 = 15;
          break;
        }
        case "too-many-links": {
          enum10 = 16;
          break;
        }
        case "message-size": {
          enum10 = 17;
          break;
        }
        case "name-too-long": {
          enum10 = 18;
          break;
        }
        case "no-device": {
          enum10 = 19;
          break;
        }
        case "no-entry": {
          enum10 = 20;
          break;
        }
        case "no-lock": {
          enum10 = 21;
          break;
        }
        case "insufficient-memory": {
          enum10 = 22;
          break;
        }
        case "insufficient-space": {
          enum10 = 23;
          break;
        }
        case "not-directory": {
          enum10 = 24;
          break;
        }
        case "not-empty": {
          enum10 = 25;
          break;
        }
        case "not-recoverable": {
          enum10 = 26;
          break;
        }
        case "unsupported": {
          enum10 = 27;
          break;
        }
        case "no-tty": {
          enum10 = 28;
          break;
        }
        case "no-such-device": {
          enum10 = 29;
          break;
        }
        case "overflow": {
          enum10 = 30;
          break;
        }
        case "not-permitted": {
          enum10 = 31;
          break;
        }
        case "pipe": {
          enum10 = 32;
          break;
        }
        case "read-only": {
          enum10 = 33;
          break;
        }
        case "invalid-seek": {
          enum10 = 34;
          break;
        }
        case "text-file-busy": {
          enum10 = 35;
          break;
        }
        case "cross-device": {
          enum10 = 36;
          break;
        }
        default: {
          if (e instanceof Error) {
            console.error(e);
          }
          throw new TypeError(`"${val10}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg1 + 8, enum10, true);
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
}
function trampoline18(arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
  var handle1 = arg0;
  var rsc0 = handleTable3.get(handle1).rep;
  if ((arg1 & 4294967294) !== 0) {
    throw new TypeError("flags have extraneous bits set");
  }
  var flags2 = {
    symlinkFollow: Boolean(arg1 & 1)
  };
  var ptr3 = arg2;
  var len3 = arg3;
  var result3 = utf8Decoder.decode(new Uint8Array(memory0.buffer, ptr3, len3));
  if ((arg4 & 4294967280) !== 0) {
    throw new TypeError("flags have extraneous bits set");
  }
  var flags4 = {
    create: Boolean(arg4 & 1),
    directory: Boolean(arg4 & 2),
    exclusive: Boolean(arg4 & 4),
    truncate: Boolean(arg4 & 8)
  };
  if ((arg5 & 4294967232) !== 0) {
    throw new TypeError("flags have extraneous bits set");
  }
  var flags5 = {
    read: Boolean(arg5 & 1),
    write: Boolean(arg5 & 2),
    fileIntegritySync: Boolean(arg5 & 4),
    dataIntegritySync: Boolean(arg5 & 8),
    requestedWriteSync: Boolean(arg5 & 16),
    mutateDirectory: Boolean(arg5 & 32)
  };
  let ret;
  try {
    ret = { tag: "ok", val: Descriptor.prototype.openAt.call(rsc0, flags2, result3, flags4, flags5) };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  var variant8 = ret;
  switch (variant8.tag) {
    case "ok": {
      const e = variant8.val;
      dataView(memory0).setInt8(arg6 + 0, 0, true);
      if (!(e instanceof Descriptor)) {
        throw new Error('Resource error: Not a valid "Descriptor" resource.');
      }
      var handle6 = handleCnt3++;
      handleTable3.set(handle6, { rep: e, own: true });
      dataView(memory0).setInt32(arg6 + 4, handle6, true);
      break;
    }
    case "err": {
      const e = variant8.val;
      dataView(memory0).setInt8(arg6 + 0, 1, true);
      var val7 = e;
      let enum7;
      switch (val7) {
        case "access": {
          enum7 = 0;
          break;
        }
        case "would-block": {
          enum7 = 1;
          break;
        }
        case "already": {
          enum7 = 2;
          break;
        }
        case "bad-descriptor": {
          enum7 = 3;
          break;
        }
        case "busy": {
          enum7 = 4;
          break;
        }
        case "deadlock": {
          enum7 = 5;
          break;
        }
        case "quota": {
          enum7 = 6;
          break;
        }
        case "exist": {
          enum7 = 7;
          break;
        }
        case "file-too-large": {
          enum7 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum7 = 9;
          break;
        }
        case "in-progress": {
          enum7 = 10;
          break;
        }
        case "interrupted": {
          enum7 = 11;
          break;
        }
        case "invalid": {
          enum7 = 12;
          break;
        }
        case "io": {
          enum7 = 13;
          break;
        }
        case "is-directory": {
          enum7 = 14;
          break;
        }
        case "loop": {
          enum7 = 15;
          break;
        }
        case "too-many-links": {
          enum7 = 16;
          break;
        }
        case "message-size": {
          enum7 = 17;
          break;
        }
        case "name-too-long": {
          enum7 = 18;
          break;
        }
        case "no-device": {
          enum7 = 19;
          break;
        }
        case "no-entry": {
          enum7 = 20;
          break;
        }
        case "no-lock": {
          enum7 = 21;
          break;
        }
        case "insufficient-memory": {
          enum7 = 22;
          break;
        }
        case "insufficient-space": {
          enum7 = 23;
          break;
        }
        case "not-directory": {
          enum7 = 24;
          break;
        }
        case "not-empty": {
          enum7 = 25;
          break;
        }
        case "not-recoverable": {
          enum7 = 26;
          break;
        }
        case "unsupported": {
          enum7 = 27;
          break;
        }
        case "no-tty": {
          enum7 = 28;
          break;
        }
        case "no-such-device": {
          enum7 = 29;
          break;
        }
        case "overflow": {
          enum7 = 30;
          break;
        }
        case "not-permitted": {
          enum7 = 31;
          break;
        }
        case "pipe": {
          enum7 = 32;
          break;
        }
        case "read-only": {
          enum7 = 33;
          break;
        }
        case "invalid-seek": {
          enum7 = 34;
          break;
        }
        case "text-file-busy": {
          enum7 = 35;
          break;
        }
        case "cross-device": {
          enum7 = 36;
          break;
        }
        default: {
          if (e instanceof Error) {
            console.error(e);
          }
          throw new TypeError(`"${val7}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg6 + 4, enum7, true);
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
}
function trampoline19(arg0, arg1) {
  var handle1 = arg0;
  var rsc0 = handleTable3.get(handle1).rep;
  let ret;
  try {
    ret = { tag: "ok", val: Descriptor.prototype.metadataHash.call(rsc0) };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  var variant4 = ret;
  switch (variant4.tag) {
    case "ok": {
      const e = variant4.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      var { lower: v2_0, upper: v2_1 } = e;
      dataView(memory0).setBigInt64(arg1 + 8, toUint64(v2_0), true);
      dataView(memory0).setBigInt64(arg1 + 16, toUint64(v2_1), true);
      break;
    }
    case "err": {
      const e = variant4.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      var val3 = e;
      let enum3;
      switch (val3) {
        case "access": {
          enum3 = 0;
          break;
        }
        case "would-block": {
          enum3 = 1;
          break;
        }
        case "already": {
          enum3 = 2;
          break;
        }
        case "bad-descriptor": {
          enum3 = 3;
          break;
        }
        case "busy": {
          enum3 = 4;
          break;
        }
        case "deadlock": {
          enum3 = 5;
          break;
        }
        case "quota": {
          enum3 = 6;
          break;
        }
        case "exist": {
          enum3 = 7;
          break;
        }
        case "file-too-large": {
          enum3 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum3 = 9;
          break;
        }
        case "in-progress": {
          enum3 = 10;
          break;
        }
        case "interrupted": {
          enum3 = 11;
          break;
        }
        case "invalid": {
          enum3 = 12;
          break;
        }
        case "io": {
          enum3 = 13;
          break;
        }
        case "is-directory": {
          enum3 = 14;
          break;
        }
        case "loop": {
          enum3 = 15;
          break;
        }
        case "too-many-links": {
          enum3 = 16;
          break;
        }
        case "message-size": {
          enum3 = 17;
          break;
        }
        case "name-too-long": {
          enum3 = 18;
          break;
        }
        case "no-device": {
          enum3 = 19;
          break;
        }
        case "no-entry": {
          enum3 = 20;
          break;
        }
        case "no-lock": {
          enum3 = 21;
          break;
        }
        case "insufficient-memory": {
          enum3 = 22;
          break;
        }
        case "insufficient-space": {
          enum3 = 23;
          break;
        }
        case "not-directory": {
          enum3 = 24;
          break;
        }
        case "not-empty": {
          enum3 = 25;
          break;
        }
        case "not-recoverable": {
          enum3 = 26;
          break;
        }
        case "unsupported": {
          enum3 = 27;
          break;
        }
        case "no-tty": {
          enum3 = 28;
          break;
        }
        case "no-such-device": {
          enum3 = 29;
          break;
        }
        case "overflow": {
          enum3 = 30;
          break;
        }
        case "not-permitted": {
          enum3 = 31;
          break;
        }
        case "pipe": {
          enum3 = 32;
          break;
        }
        case "read-only": {
          enum3 = 33;
          break;
        }
        case "invalid-seek": {
          enum3 = 34;
          break;
        }
        case "text-file-busy": {
          enum3 = 35;
          break;
        }
        case "cross-device": {
          enum3 = 36;
          break;
        }
        default: {
          if (e instanceof Error) {
            console.error(e);
          }
          throw new TypeError(`"${val3}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg1 + 8, enum3, true);
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
}
function trampoline20(arg0, arg1) {
  var handle1 = arg0;
  var rsc0 = handleTable0.get(handle1).rep;
  const ret = filesystemErrorCode(rsc0);
  var variant3 = ret;
  if (variant3 === null || variant3 === void 0) {
    dataView(memory0).setInt8(arg1 + 0, 0, true);
  } else {
    const e = variant3;
    dataView(memory0).setInt8(arg1 + 0, 1, true);
    var val2 = e;
    let enum2;
    switch (val2) {
      case "access": {
        enum2 = 0;
        break;
      }
      case "would-block": {
        enum2 = 1;
        break;
      }
      case "already": {
        enum2 = 2;
        break;
      }
      case "bad-descriptor": {
        enum2 = 3;
        break;
      }
      case "busy": {
        enum2 = 4;
        break;
      }
      case "deadlock": {
        enum2 = 5;
        break;
      }
      case "quota": {
        enum2 = 6;
        break;
      }
      case "exist": {
        enum2 = 7;
        break;
      }
      case "file-too-large": {
        enum2 = 8;
        break;
      }
      case "illegal-byte-sequence": {
        enum2 = 9;
        break;
      }
      case "in-progress": {
        enum2 = 10;
        break;
      }
      case "interrupted": {
        enum2 = 11;
        break;
      }
      case "invalid": {
        enum2 = 12;
        break;
      }
      case "io": {
        enum2 = 13;
        break;
      }
      case "is-directory": {
        enum2 = 14;
        break;
      }
      case "loop": {
        enum2 = 15;
        break;
      }
      case "too-many-links": {
        enum2 = 16;
        break;
      }
      case "message-size": {
        enum2 = 17;
        break;
      }
      case "name-too-long": {
        enum2 = 18;
        break;
      }
      case "no-device": {
        enum2 = 19;
        break;
      }
      case "no-entry": {
        enum2 = 20;
        break;
      }
      case "no-lock": {
        enum2 = 21;
        break;
      }
      case "insufficient-memory": {
        enum2 = 22;
        break;
      }
      case "insufficient-space": {
        enum2 = 23;
        break;
      }
      case "not-directory": {
        enum2 = 24;
        break;
      }
      case "not-empty": {
        enum2 = 25;
        break;
      }
      case "not-recoverable": {
        enum2 = 26;
        break;
      }
      case "unsupported": {
        enum2 = 27;
        break;
      }
      case "no-tty": {
        enum2 = 28;
        break;
      }
      case "no-such-device": {
        enum2 = 29;
        break;
      }
      case "overflow": {
        enum2 = 30;
        break;
      }
      case "not-permitted": {
        enum2 = 31;
        break;
      }
      case "pipe": {
        enum2 = 32;
        break;
      }
      case "read-only": {
        enum2 = 33;
        break;
      }
      case "invalid-seek": {
        enum2 = 34;
        break;
      }
      case "text-file-busy": {
        enum2 = 35;
        break;
      }
      case "cross-device": {
        enum2 = 36;
        break;
      }
      default: {
        if (e instanceof Error) {
          console.error(e);
        }
        throw new TypeError(`"${val2}" is not one of the cases of error-code`);
      }
    }
    dataView(memory0).setInt8(arg1 + 1, enum2, true);
  }
}
function trampoline21(arg0, arg1, arg2) {
  var handle1 = arg0;
  var rsc0 = handleTable1.get(handle1).rep;
  let ret;
  try {
    ret = { tag: "ok", val: InputStream2.prototype.read.call(rsc0, BigInt.asUintN(64, arg1)) };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  var variant5 = ret;
  switch (variant5.tag) {
    case "ok": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg2 + 0, 0, true);
      var val2 = e;
      var len2 = val2.byteLength;
      var ptr2 = realloc0(0, 0, 1, len2 * 1);
      var src2 = new Uint8Array(val2.buffer || val2, val2.byteOffset, len2 * 1);
      new Uint8Array(memory0.buffer, ptr2, len2 * 1).set(src2);
      dataView(memory0).setInt32(arg2 + 8, len2, true);
      dataView(memory0).setInt32(arg2 + 4, ptr2, true);
      break;
    }
    case "err": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg2 + 0, 1, true);
      var variant4 = e;
      switch (variant4.tag) {
        case "last-operation-failed": {
          const e2 = variant4.val;
          dataView(memory0).setInt8(arg2 + 4, 0, true);
          if (!(e2 instanceof Error$1)) {
            throw new Error('Resource error: Not a valid "Error" resource.');
          }
          var handle3 = handleCnt0++;
          handleTable0.set(handle3, { rep: e2, own: true });
          dataView(memory0).setInt32(arg2 + 8, handle3, true);
          break;
        }
        case "closed": {
          dataView(memory0).setInt8(arg2 + 4, 1, true);
          break;
        }
        default: {
          throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant4.tag)}\` (received \`${variant4}\`) specified for \`StreamError\``);
        }
      }
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
}
function trampoline22(arg0, arg1, arg2) {
  var handle1 = arg0;
  var rsc0 = handleTable1.get(handle1).rep;
  let ret;
  try {
    ret = { tag: "ok", val: InputStream2.prototype.blockingRead.call(rsc0, BigInt.asUintN(64, arg1)) };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  var variant5 = ret;
  switch (variant5.tag) {
    case "ok": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg2 + 0, 0, true);
      var val2 = e;
      var len2 = val2.byteLength;
      var ptr2 = realloc0(0, 0, 1, len2 * 1);
      var src2 = new Uint8Array(val2.buffer || val2, val2.byteOffset, len2 * 1);
      new Uint8Array(memory0.buffer, ptr2, len2 * 1).set(src2);
      dataView(memory0).setInt32(arg2 + 8, len2, true);
      dataView(memory0).setInt32(arg2 + 4, ptr2, true);
      break;
    }
    case "err": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg2 + 0, 1, true);
      var variant4 = e;
      switch (variant4.tag) {
        case "last-operation-failed": {
          const e2 = variant4.val;
          dataView(memory0).setInt8(arg2 + 4, 0, true);
          if (!(e2 instanceof Error$1)) {
            throw new Error('Resource error: Not a valid "Error" resource.');
          }
          var handle3 = handleCnt0++;
          handleTable0.set(handle3, { rep: e2, own: true });
          dataView(memory0).setInt32(arg2 + 8, handle3, true);
          break;
        }
        case "closed": {
          dataView(memory0).setInt8(arg2 + 4, 1, true);
          break;
        }
        default: {
          throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant4.tag)}\` (received \`${variant4}\`) specified for \`StreamError\``);
        }
      }
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
}
function trampoline23(arg0, arg1) {
  var handle1 = arg0;
  var rsc0 = handleTable2.get(handle1).rep;
  let ret;
  try {
    ret = { tag: "ok", val: OutputStream2.prototype.checkWrite.call(rsc0) };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  var variant4 = ret;
  switch (variant4.tag) {
    case "ok": {
      const e = variant4.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      dataView(memory0).setBigInt64(arg1 + 8, toUint64(e), true);
      break;
    }
    case "err": {
      const e = variant4.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      var variant3 = e;
      switch (variant3.tag) {
        case "last-operation-failed": {
          const e2 = variant3.val;
          dataView(memory0).setInt8(arg1 + 8, 0, true);
          if (!(e2 instanceof Error$1)) {
            throw new Error('Resource error: Not a valid "Error" resource.');
          }
          var handle2 = handleCnt0++;
          handleTable0.set(handle2, { rep: e2, own: true });
          dataView(memory0).setInt32(arg1 + 12, handle2, true);
          break;
        }
        case "closed": {
          dataView(memory0).setInt8(arg1 + 8, 1, true);
          break;
        }
        default: {
          throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant3.tag)}\` (received \`${variant3}\`) specified for \`StreamError\``);
        }
      }
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
}
function trampoline24(arg0, arg1, arg2, arg3) {
  var handle1 = arg0;
  var rsc0 = handleTable2.get(handle1).rep;
  var ptr2 = arg1;
  var len2 = arg2;
  var result2 = new Uint8Array(memory0.buffer.slice(ptr2, ptr2 + len2 * 1));
  let ret;
  try {
    ret = { tag: "ok", val: OutputStream2.prototype.write.call(rsc0, result2) };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  var variant5 = ret;
  switch (variant5.tag) {
    case "ok": {
      variant5.val;
      dataView(memory0).setInt8(arg3 + 0, 0, true);
      break;
    }
    case "err": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg3 + 0, 1, true);
      var variant4 = e;
      switch (variant4.tag) {
        case "last-operation-failed": {
          const e2 = variant4.val;
          dataView(memory0).setInt8(arg3 + 4, 0, true);
          if (!(e2 instanceof Error$1)) {
            throw new Error('Resource error: Not a valid "Error" resource.');
          }
          var handle3 = handleCnt0++;
          handleTable0.set(handle3, { rep: e2, own: true });
          dataView(memory0).setInt32(arg3 + 8, handle3, true);
          break;
        }
        case "closed": {
          dataView(memory0).setInt8(arg3 + 4, 1, true);
          break;
        }
        default: {
          throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant4.tag)}\` (received \`${variant4}\`) specified for \`StreamError\``);
        }
      }
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
}
function trampoline25(arg0, arg1, arg2, arg3) {
  var handle1 = arg0;
  var rsc0 = handleTable2.get(handle1).rep;
  var ptr2 = arg1;
  var len2 = arg2;
  var result2 = new Uint8Array(memory0.buffer.slice(ptr2, ptr2 + len2 * 1));
  let ret;
  try {
    ret = { tag: "ok", val: OutputStream2.prototype.blockingWriteAndFlush.call(rsc0, result2) };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  var variant5 = ret;
  switch (variant5.tag) {
    case "ok": {
      variant5.val;
      dataView(memory0).setInt8(arg3 + 0, 0, true);
      break;
    }
    case "err": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg3 + 0, 1, true);
      var variant4 = e;
      switch (variant4.tag) {
        case "last-operation-failed": {
          const e2 = variant4.val;
          dataView(memory0).setInt8(arg3 + 4, 0, true);
          if (!(e2 instanceof Error$1)) {
            throw new Error('Resource error: Not a valid "Error" resource.');
          }
          var handle3 = handleCnt0++;
          handleTable0.set(handle3, { rep: e2, own: true });
          dataView(memory0).setInt32(arg3 + 8, handle3, true);
          break;
        }
        case "closed": {
          dataView(memory0).setInt8(arg3 + 4, 1, true);
          break;
        }
        default: {
          throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant4.tag)}\` (received \`${variant4}\`) specified for \`StreamError\``);
        }
      }
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
}
function trampoline26(arg0, arg1) {
  var handle1 = arg0;
  var rsc0 = handleTable2.get(handle1).rep;
  let ret;
  try {
    ret = { tag: "ok", val: OutputStream2.prototype.blockingFlush.call(rsc0) };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  var variant4 = ret;
  switch (variant4.tag) {
    case "ok": {
      variant4.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      break;
    }
    case "err": {
      const e = variant4.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      var variant3 = e;
      switch (variant3.tag) {
        case "last-operation-failed": {
          const e2 = variant3.val;
          dataView(memory0).setInt8(arg1 + 4, 0, true);
          if (!(e2 instanceof Error$1)) {
            throw new Error('Resource error: Not a valid "Error" resource.');
          }
          var handle2 = handleCnt0++;
          handleTable0.set(handle2, { rep: e2, own: true });
          dataView(memory0).setInt32(arg1 + 8, handle2, true);
          break;
        }
        case "closed": {
          dataView(memory0).setInt8(arg1 + 4, 1, true);
          break;
        }
        default: {
          throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant3.tag)}\` (received \`${variant3}\`) specified for \`StreamError\``);
        }
      }
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
}
function trampoline27(arg0, arg1) {
  const ret = getRandomBytes(BigInt.asUintN(64, arg0));
  var val0 = ret;
  var len0 = val0.byteLength;
  var ptr0 = realloc0(0, 0, 1, len0 * 1);
  var src0 = new Uint8Array(val0.buffer || val0, val0.byteOffset, len0 * 1);
  new Uint8Array(memory0.buffer, ptr0, len0 * 1).set(src0);
  dataView(memory0).setInt32(arg1 + 4, len0, true);
  dataView(memory0).setInt32(arg1 + 0, ptr0, true);
}
function trampoline28(arg0) {
  const ret = getEnvironment();
  var vec3 = ret;
  var len3 = vec3.length;
  var result3 = realloc0(0, 0, 4, len3 * 16);
  for (let i = 0; i < vec3.length; i++) {
    const e = vec3[i];
    const base = result3 + i * 16;
    var [tuple0_0, tuple0_1] = e;
    var ptr1 = utf8Encode(tuple0_0, realloc0, memory0);
    var len1 = utf8EncodedLen;
    dataView(memory0).setInt32(base + 4, len1, true);
    dataView(memory0).setInt32(base + 0, ptr1, true);
    var ptr2 = utf8Encode(tuple0_1, realloc0, memory0);
    var len2 = utf8EncodedLen;
    dataView(memory0).setInt32(base + 12, len2, true);
    dataView(memory0).setInt32(base + 8, ptr2, true);
  }
  dataView(memory0).setInt32(arg0 + 4, len3, true);
  dataView(memory0).setInt32(arg0 + 0, result3, true);
}
function trampoline29(arg0) {
  const ret = getTerminalStdin();
  var variant1 = ret;
  if (variant1 === null || variant1 === void 0) {
    dataView(memory0).setInt8(arg0 + 0, 0, true);
  } else {
    const e = variant1;
    dataView(memory0).setInt8(arg0 + 0, 1, true);
    if (!(e instanceof TerminalInput2)) {
      throw new Error('Resource error: Not a valid "TerminalInput" resource.');
    }
    var handle0 = handleCnt6++;
    handleTable6.set(handle0, { rep: e, own: true });
    dataView(memory0).setInt32(arg0 + 4, handle0, true);
  }
}
function trampoline30(arg0) {
  const ret = getTerminalStdout();
  var variant1 = ret;
  if (variant1 === null || variant1 === void 0) {
    dataView(memory0).setInt8(arg0 + 0, 0, true);
  } else {
    const e = variant1;
    dataView(memory0).setInt8(arg0 + 0, 1, true);
    if (!(e instanceof TerminalOutput2)) {
      throw new Error('Resource error: Not a valid "TerminalOutput" resource.');
    }
    var handle0 = handleCnt7++;
    handleTable7.set(handle0, { rep: e, own: true });
    dataView(memory0).setInt32(arg0 + 4, handle0, true);
  }
}
function trampoline31(arg0) {
  const ret = getTerminalStderr();
  var variant1 = ret;
  if (variant1 === null || variant1 === void 0) {
    dataView(memory0).setInt8(arg0 + 0, 0, true);
  } else {
    const e = variant1;
    dataView(memory0).setInt8(arg0 + 0, 1, true);
    if (!(e instanceof TerminalOutput2)) {
      throw new Error('Resource error: Not a valid "TerminalOutput" resource.');
    }
    var handle0 = handleCnt7++;
    handleTable7.set(handle0, { rep: e, own: true });
    dataView(memory0).setInt32(arg0 + 4, handle0, true);
  }
}
let realloc1;
let postReturn0;
function trampoline0(handle) {
  const handleEntry = handleTable4.get(handle);
  if (!handleEntry) {
    throw new Error(`Resource error: Invalid handle ${handle}`);
  }
  handleTable4.delete(handle);
  if (handleEntry.own && handleEntry.rep[symbolDispose]) {
    handleEntry.rep[symbolDispose]();
  }
}
function trampoline1(handle) {
  const handleEntry = handleTable0.get(handle);
  if (!handleEntry) {
    throw new Error(`Resource error: Invalid handle ${handle}`);
  }
  handleTable0.delete(handle);
  if (handleEntry.own && handleEntry.rep[symbolDispose]) {
    handleEntry.rep[symbolDispose]();
  }
}
function trampoline2(handle) {
  const handleEntry = handleTable1.get(handle);
  if (!handleEntry) {
    throw new Error(`Resource error: Invalid handle ${handle}`);
  }
  handleTable1.delete(handle);
  if (handleEntry.own && handleEntry.rep[symbolDispose]) {
    handleEntry.rep[symbolDispose]();
  }
}
function trampoline3(handle) {
  const handleEntry = handleTable2.get(handle);
  if (!handleEntry) {
    throw new Error(`Resource error: Invalid handle ${handle}`);
  }
  handleTable2.delete(handle);
  if (handleEntry.own && handleEntry.rep[symbolDispose]) {
    handleEntry.rep[symbolDispose]();
  }
}
function trampoline4(handle) {
  const handleEntry = handleTable3.get(handle);
  if (!handleEntry) {
    throw new Error(`Resource error: Invalid handle ${handle}`);
  }
  handleTable3.delete(handle);
  if (handleEntry.own && handleEntry.rep[symbolDispose]) {
    handleEntry.rep[symbolDispose]();
  }
}
function trampoline5(handle) {
  const handleEntry = handleTable5.get(handle);
  if (!handleEntry) {
    throw new Error(`Resource error: Invalid handle ${handle}`);
  }
  handleTable5.delete(handle);
  if (handleEntry.own && handleEntry.rep[symbolDispose]) {
    handleEntry.rep[symbolDispose]();
  }
}
function trampoline6(handle) {
  const handleEntry = handleTable7.get(handle);
  if (!handleEntry) {
    throw new Error(`Resource error: Invalid handle ${handle}`);
  }
  handleTable7.delete(handle);
  if (handleEntry.own && handleEntry.rep[symbolDispose]) {
    handleEntry.rep[symbolDispose]();
  }
}
function trampoline7(handle) {
  const handleEntry = handleTable6.get(handle);
  if (!handleEntry) {
    throw new Error(`Resource error: Invalid handle ${handle}`);
  }
  handleTable6.delete(handle);
  if (handleEntry.own && handleEntry.rep[symbolDispose]) {
    handleEntry.rep[symbolDispose]();
  }
}
function generate(arg0, arg1) {
  if (!_initialized)
    throwUninitialized();
  var ptr0 = realloc1(0, 0, 4, 52);
  var val1 = arg0;
  var len1 = val1.byteLength;
  var ptr1 = realloc1(0, 0, 1, len1 * 1);
  var src1 = new Uint8Array(val1.buffer || val1, val1.byteOffset, len1 * 1);
  new Uint8Array(memory0.buffer, ptr1, len1 * 1).set(src1);
  dataView(memory0).setInt32(ptr0 + 4, len1, true);
  dataView(memory0).setInt32(ptr0 + 0, ptr1, true);
  var { name: v2_0, noTypescript: v2_1, instantiation: v2_2, map: v2_3, compat: v2_4, noNodejsCompat: v2_5, base64Cutoff: v2_6, tlaCompat: v2_7, validLiftingOptimization: v2_8, tracing: v2_9, noNamespacedExports: v2_10 } = arg1;
  var ptr3 = utf8Encode(v2_0, realloc1, memory0);
  var len3 = utf8EncodedLen;
  dataView(memory0).setInt32(ptr0 + 12, len3, true);
  dataView(memory0).setInt32(ptr0 + 8, ptr3, true);
  var variant4 = v2_1;
  if (variant4 === null || variant4 === void 0) {
    dataView(memory0).setInt8(ptr0 + 16, 0, true);
  } else {
    const e = variant4;
    dataView(memory0).setInt8(ptr0 + 16, 1, true);
    dataView(memory0).setInt8(ptr0 + 17, e ? 1 : 0, true);
  }
  var variant6 = v2_2;
  if (variant6 === null || variant6 === void 0) {
    dataView(memory0).setInt8(ptr0 + 18, 0, true);
  } else {
    const e = variant6;
    dataView(memory0).setInt8(ptr0 + 18, 1, true);
    var variant5 = e;
    switch (variant5.tag) {
      case "async": {
        dataView(memory0).setInt8(ptr0 + 19, 0, true);
        break;
      }
      case "sync": {
        dataView(memory0).setInt8(ptr0 + 19, 1, true);
        break;
      }
      default: {
        throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant5.tag)}\` (received \`${variant5}\`) specified for \`InstantiationMode\``);
      }
    }
  }
  var variant11 = v2_3;
  if (variant11 === null || variant11 === void 0) {
    dataView(memory0).setInt8(ptr0 + 20, 0, true);
  } else {
    const e = variant11;
    dataView(memory0).setInt8(ptr0 + 20, 1, true);
    var vec10 = e;
    var len10 = vec10.length;
    var result10 = realloc1(0, 0, 4, len10 * 16);
    for (let i = 0; i < vec10.length; i++) {
      const e2 = vec10[i];
      const base = result10 + i * 16;
      var [tuple7_0, tuple7_1] = e2;
      var ptr8 = utf8Encode(tuple7_0, realloc1, memory0);
      var len8 = utf8EncodedLen;
      dataView(memory0).setInt32(base + 4, len8, true);
      dataView(memory0).setInt32(base + 0, ptr8, true);
      var ptr9 = utf8Encode(tuple7_1, realloc1, memory0);
      var len9 = utf8EncodedLen;
      dataView(memory0).setInt32(base + 12, len9, true);
      dataView(memory0).setInt32(base + 8, ptr9, true);
    }
    dataView(memory0).setInt32(ptr0 + 28, len10, true);
    dataView(memory0).setInt32(ptr0 + 24, result10, true);
  }
  var variant12 = v2_4;
  if (variant12 === null || variant12 === void 0) {
    dataView(memory0).setInt8(ptr0 + 32, 0, true);
  } else {
    const e = variant12;
    dataView(memory0).setInt8(ptr0 + 32, 1, true);
    dataView(memory0).setInt8(ptr0 + 33, e ? 1 : 0, true);
  }
  var variant13 = v2_5;
  if (variant13 === null || variant13 === void 0) {
    dataView(memory0).setInt8(ptr0 + 34, 0, true);
  } else {
    const e = variant13;
    dataView(memory0).setInt8(ptr0 + 34, 1, true);
    dataView(memory0).setInt8(ptr0 + 35, e ? 1 : 0, true);
  }
  var variant14 = v2_6;
  if (variant14 === null || variant14 === void 0) {
    dataView(memory0).setInt8(ptr0 + 36, 0, true);
  } else {
    const e = variant14;
    dataView(memory0).setInt8(ptr0 + 36, 1, true);
    dataView(memory0).setInt32(ptr0 + 40, toUint32(e), true);
  }
  var variant15 = v2_7;
  if (variant15 === null || variant15 === void 0) {
    dataView(memory0).setInt8(ptr0 + 44, 0, true);
  } else {
    const e = variant15;
    dataView(memory0).setInt8(ptr0 + 44, 1, true);
    dataView(memory0).setInt8(ptr0 + 45, e ? 1 : 0, true);
  }
  var variant16 = v2_8;
  if (variant16 === null || variant16 === void 0) {
    dataView(memory0).setInt8(ptr0 + 46, 0, true);
  } else {
    const e = variant16;
    dataView(memory0).setInt8(ptr0 + 46, 1, true);
    dataView(memory0).setInt8(ptr0 + 47, e ? 1 : 0, true);
  }
  var variant17 = v2_9;
  if (variant17 === null || variant17 === void 0) {
    dataView(memory0).setInt8(ptr0 + 48, 0, true);
  } else {
    const e = variant17;
    dataView(memory0).setInt8(ptr0 + 48, 1, true);
    dataView(memory0).setInt8(ptr0 + 49, e ? 1 : 0, true);
  }
  var variant18 = v2_10;
  if (variant18 === null || variant18 === void 0) {
    dataView(memory0).setInt8(ptr0 + 50, 0, true);
  } else {
    const e = variant18;
    dataView(memory0).setInt8(ptr0 + 50, 1, true);
    dataView(memory0).setInt8(ptr0 + 51, e ? 1 : 0, true);
  }
  const ret = exports1.generate(ptr0);
  let variant28;
  switch (dataView(memory0).getUint8(ret + 0, true)) {
    case 0: {
      var len21 = dataView(memory0).getInt32(ret + 8, true);
      var base21 = dataView(memory0).getInt32(ret + 4, true);
      var result21 = [];
      for (let i = 0; i < len21; i++) {
        const base = base21 + i * 16;
        var ptr19 = dataView(memory0).getInt32(base + 0, true);
        var len19 = dataView(memory0).getInt32(base + 4, true);
        var result19 = utf8Decoder.decode(new Uint8Array(memory0.buffer, ptr19, len19));
        var ptr20 = dataView(memory0).getInt32(base + 8, true);
        var len20 = dataView(memory0).getInt32(base + 12, true);
        var result20 = new Uint8Array(memory0.buffer.slice(ptr20, ptr20 + len20 * 1));
        result21.push([result19, result20]);
      }
      var len23 = dataView(memory0).getInt32(ret + 16, true);
      var base23 = dataView(memory0).getInt32(ret + 12, true);
      var result23 = [];
      for (let i = 0; i < len23; i++) {
        const base = base23 + i * 8;
        var ptr22 = dataView(memory0).getInt32(base + 0, true);
        var len22 = dataView(memory0).getInt32(base + 4, true);
        var result22 = utf8Decoder.decode(new Uint8Array(memory0.buffer, ptr22, len22));
        result23.push(result22);
      }
      var len26 = dataView(memory0).getInt32(ret + 24, true);
      var base26 = dataView(memory0).getInt32(ret + 20, true);
      var result26 = [];
      for (let i = 0; i < len26; i++) {
        const base = base26 + i * 12;
        var ptr24 = dataView(memory0).getInt32(base + 0, true);
        var len24 = dataView(memory0).getInt32(base + 4, true);
        var result24 = utf8Decoder.decode(new Uint8Array(memory0.buffer, ptr24, len24));
        let enum25;
        switch (dataView(memory0).getUint8(base + 8, true)) {
          case 0: {
            enum25 = "function";
            break;
          }
          case 1: {
            enum25 = "instance";
            break;
          }
          default: {
            throw new TypeError("invalid discriminant specified for ExportType");
          }
        }
        result26.push([result24, enum25]);
      }
      variant28 = {
        tag: "ok",
        val: {
          files: result21,
          imports: result23,
          exports: result26
        }
      };
      break;
    }
    case 1: {
      var ptr27 = dataView(memory0).getInt32(ret + 4, true);
      var len27 = dataView(memory0).getInt32(ret + 8, true);
      var result27 = utf8Decoder.decode(new Uint8Array(memory0.buffer, ptr27, len27));
      variant28 = {
        tag: "err",
        val: result27
      };
      break;
    }
    default: {
      throw new TypeError("invalid variant discriminant for expected");
    }
  }
  postReturn0(ret);
  if (variant28.tag === "err") {
    throw new ComponentError(variant28.val);
  }
  return variant28.val;
}
const handleTable0 = /* @__PURE__ */ new Map();
let handleCnt0 = 0;
const handleTable1 = /* @__PURE__ */ new Map();
let handleCnt1 = 0;
const handleTable2 = /* @__PURE__ */ new Map();
let handleCnt2 = 0;
const handleTable3 = /* @__PURE__ */ new Map();
let handleCnt3 = 0;
const handleTable4 = /* @__PURE__ */ new Map();
const handleTable5 = /* @__PURE__ */ new Map();
const handleTable6 = /* @__PURE__ */ new Map();
let handleCnt6 = 0;
const handleTable7 = /* @__PURE__ */ new Map();
let handleCnt7 = 0;
let _initialized = false;
const $init = (async () => {
  const module1 = fetchCompile(new URL("data:application/wasm;base64,AGFzbQEAAAABcBFgAX8AYAJ/fwBgA39+fwBgBH9/f38AYAd/f39/f39/AGABfwF/YAN/f38AYAJ+fwBgBH9/f38Bf2AFf39/f38AYAABf2ADf39/AX9gAn9/AX9gCX9/f39/fn5/fwF/YAN/f34AYAV/fn5+fgBgAAACmREiA2VudgZtZW1vcnkCAAAsd2FzaTpmaWxlc3lzdGVtL3ByZW9wZW5zQDAuMi4wLXJjLTIwMjMtMTEtMTAPZ2V0LWRpcmVjdG9yaWVzAAApd2FzaTpmaWxlc3lzdGVtL3R5cGVzQDAuMi4wLXJjLTIwMjMtMTEtMTAlW3Jlc291cmNlLWRyb3BdZGlyZWN0b3J5LWVudHJ5LXN0cmVhbQAAKXdhc2k6ZmlsZXN5c3RlbS90eXBlc0AwLjIuMC1yYy0yMDIzLTExLTEwG1ttZXRob2RdZGVzY3JpcHRvci5nZXQtdHlwZQABKXdhc2k6ZmlsZXN5c3RlbS90eXBlc0AwLjIuMC1yYy0yMDIzLTExLTEwFWZpbGVzeXN0ZW0tZXJyb3ItY29kZQABIXdhc2k6aW8vZXJyb3JAMC4yLjAtcmMtMjAyMy0xMS0xMBRbcmVzb3VyY2UtZHJvcF1lcnJvcgAAI3dhc2k6aW8vc3RyZWFtc0AwLjIuMC1yYy0yMDIzLTExLTEwG1tyZXNvdXJjZS1kcm9wXWlucHV0LXN0cmVhbQAAI3dhc2k6aW8vc3RyZWFtc0AwLjIuMC1yYy0yMDIzLTExLTEwHFtyZXNvdXJjZS1kcm9wXW91dHB1dC1zdHJlYW0AACl3YXNpOmZpbGVzeXN0ZW0vdHlwZXNAMC4yLjAtcmMtMjAyMy0xMS0xMBlbcmVzb3VyY2UtZHJvcF1kZXNjcmlwdG9yAAAmd2FzaTpyYW5kb20vcmFuZG9tQDAuMi4wLXJjLTIwMjMtMTEtMTAQZ2V0LXJhbmRvbS1ieXRlcwAHD19fbWFpbl9tb2R1bGVfXwxjYWJpX3JlYWxsb2MACCh3YXNpOmNsaS9lbnZpcm9ubWVudEAwLjIuMC1yYy0yMDIzLTExLTEwD2dldC1lbnZpcm9ubWVudAAAKXdhc2k6ZmlsZXN5c3RlbS90eXBlc0AwLjIuMC1yYy0yMDIzLTExLTEwIlttZXRob2RdZGVzY3JpcHRvci5yZWFkLXZpYS1zdHJlYW0AAil3YXNpOmZpbGVzeXN0ZW0vdHlwZXNAMC4yLjAtcmMtMjAyMy0xMS0xMCNbbWV0aG9kXWRlc2NyaXB0b3Iud3JpdGUtdmlhLXN0cmVhbQACKXdhc2k6ZmlsZXN5c3RlbS90eXBlc0AwLjIuMC1yYy0yMDIzLTExLTEwJFttZXRob2RdZGVzY3JpcHRvci5hcHBlbmQtdmlhLXN0cmVhbQABKXdhc2k6ZmlsZXN5c3RlbS90eXBlc0AwLjIuMC1yYy0yMDIzLTExLTEwF1ttZXRob2RdZGVzY3JpcHRvci5zdGF0AAEpd2FzaTpmaWxlc3lzdGVtL3R5cGVzQDAuMi4wLXJjLTIwMjMtMTEtMTAaW21ldGhvZF1kZXNjcmlwdG9yLm9wZW4tYXQABCl3YXNpOmZpbGVzeXN0ZW0vdHlwZXNAMC4yLjAtcmMtMjAyMy0xMS0xMCBbbWV0aG9kXWRlc2NyaXB0b3IubWV0YWRhdGEtaGFzaAABJHdhc2k6c29ja2V0cy90Y3BAMC4yLjAtcmMtMjAyMy0xMS0xMBlbcmVzb3VyY2UtZHJvcF10Y3Atc29ja2V0AAAsd2FzaTpjbGkvdGVybWluYWwtb3V0cHV0QDAuMi4wLXJjLTIwMjMtMTEtMTAeW3Jlc291cmNlLWRyb3BddGVybWluYWwtb3V0cHV0AAArd2FzaTpjbGkvdGVybWluYWwtaW5wdXRAMC4yLjAtcmMtMjAyMy0xMS0xMB1bcmVzb3VyY2UtZHJvcF10ZXJtaW5hbC1pbnB1dAAAI3dhc2k6Y2xpL3N0ZGVyckAwLjIuMC1yYy0yMDIzLTExLTEwCmdldC1zdGRlcnIACiF3YXNpOmNsaS9leGl0QDAuMi4wLXJjLTIwMjMtMTEtMTAEZXhpdAAAIndhc2k6Y2xpL3N0ZGluQDAuMi4wLXJjLTIwMjMtMTEtMTAJZ2V0LXN0ZGluAAojd2FzaTpjbGkvc3Rkb3V0QDAuMi4wLXJjLTIwMjMtMTEtMTAKZ2V0LXN0ZG91dAAKK3dhc2k6Y2xpL3Rlcm1pbmFsLXN0ZGluQDAuMi4wLXJjLTIwMjMtMTEtMTASZ2V0LXRlcm1pbmFsLXN0ZGluAAAsd2FzaTpjbGkvdGVybWluYWwtc3Rkb3V0QDAuMi4wLXJjLTIwMjMtMTEtMTATZ2V0LXRlcm1pbmFsLXN0ZG91dAAALHdhc2k6Y2xpL3Rlcm1pbmFsLXN0ZGVyckAwLjIuMC1yYy0yMDIzLTExLTEwE2dldC10ZXJtaW5hbC1zdGRlcnIAACN3YXNpOmlvL3N0cmVhbXNAMC4yLjAtcmMtMjAyMy0xMS0xMBlbbWV0aG9kXWlucHV0LXN0cmVhbS5yZWFkAAIjd2FzaTppby9zdHJlYW1zQDAuMi4wLXJjLTIwMjMtMTEtMTAiW21ldGhvZF1pbnB1dC1zdHJlYW0uYmxvY2tpbmctcmVhZAACI3dhc2k6aW8vc3RyZWFtc0AwLjIuMC1yYy0yMDIzLTExLTEwIVttZXRob2Rdb3V0cHV0LXN0cmVhbS5jaGVjay13cml0ZQABI3dhc2k6aW8vc3RyZWFtc0AwLjIuMC1yYy0yMDIzLTExLTEwG1ttZXRob2Rdb3V0cHV0LXN0cmVhbS53cml0ZQADI3dhc2k6aW8vc3RyZWFtc0AwLjIuMC1yYy0yMDIzLTExLTEwLlttZXRob2Rdb3V0cHV0LXN0cmVhbS5ibG9ja2luZy13cml0ZS1hbmQtZmx1c2gAAyN3YXNpOmlvL3N0cmVhbXNAMC4yLjAtcmMtMjAyMy0xMS0xMCRbbWV0aG9kXW91dHB1dC1zdHJlYW0uYmxvY2tpbmctZmx1c2gAAQM/PggKCwYIDAEMAQUBDAwLCAUICQ0ADAoBBAEBAwAABgUMDAUMBQEFBQAODgEDAQABAQYGBgYKAAoACwsLDwsQBhADfwFBAAt/AUEAC38BQQALB80BDQ5mZF9wcmVzdGF0X2dldAAtE2NhYmlfaW1wb3J0X3JlYWxsb2MAIRNjYWJpX2V4cG9ydF9yZWFsbG9jACUJcHJvY19leGl0ADQTZmRfcHJlc3RhdF9kaXJfbmFtZQAuC2Vudmlyb25fZ2V0ACYRZW52aXJvbl9zaXplc19nZXQAKA9mZF9maWxlc3RhdF9nZXQALAlwYXRoX29wZW4AMwdmZF9yZWFkAC8KcmFuZG9tX2dldAA1CGZkX2Nsb3NlACoIZmRfd3JpdGUAMQqAlAE+kAgBAX8QXiMAQTBrIgQkAAJAAkACQAJAAkAgAA0AIAENABAiIgAoAgBB9c6hiwJHDQEgACgC/P8DQfXOoYsCRw0CAkACQCAAQQxqKAIAIgFFDQAgASACIAMQIyECDAELIAAoAgQiAUUNBCACIAFqQX9qQQAgAmtxIgIgA2oiAyACTyADEEAgASAAQQhqKAIAaiIDIAFPIAMQQEsNBSAAQQA2AgQLIARBMGokACACDwsgBEEgOgAvIARB7NK5qwY2ACsgBELhyIWDx66ZuSA3ACMgBEL16JWjhqSYuiA3ABsgBELi2JWD0ozesuMANwATIARC9dzJq5bsmLThADcACyAEQQtqQSUQOkHxABA8IARBCjoACyAEQQtqQQEQOgAACyAEQSA6AC8gBEHs0rmrBjYAKyAEQuHIhYPHrpm5IDcAIyAEQvXolaOGpJi6IDcAGyAEQuLYlYPSjN6y4wA3ABMgBEL13MmrluyYtOEANwALIARBC2pBJRA6QeQSEDwgBEG6wAA7AAsgBEELakECEDogBEEKOgAbIARC7sCYi5aN27LkADcAEyAEQuHmzaumjt207wA3AAsgBEELakEREDogBEEKOgALIARBC2pBARA6AAALIARBIDoALyAEQezSuasGNgArIARC4ciFg8eumbkgNwAjIARC9eiVo4akmLogNwAbIARC4tiVg9KM3rLjADcAEyAEQvXcyauW7Ji04QA3AAsgBEELakElEDpB5RIQPCAEQbrAADsACyAEQQtqQQIQOiAEQQo6ABsgBELuwJiLlo3bsuQANwATIARC4ebNq6aO3bTvADcACyAEQQtqQREQOiAEQQo6AAsgBEELakEBEDoAAAsgBEEgOgAvIARB7NK5qwY2ACsgBELhyIWDx66ZuSA3ACMgBEL16JWjhqSYuiA3ABsgBELi2JWD0ozesuMANwATIARC9dzJq5bsmLThADcACyAEQQtqQSUQOkHbARA8IARBusAAOwALIARBC2pBAhA6IARBCjoALyAEQfXmlaMGNgArIARC4djJq5aM2bwgNwAjIARC5MqR44Lkm7kgNwAbIARC7+iBgafum7vpADcAEyAEQuLqmbPWzJyQ7gA3AAsgBEELakElEDogBEEKOgALIARBC2pBARA6AAALIARBIDoALyAEQezSuasGNgArIARC4ciFg8eumbkgNwAjIARC9eiVo4akmLogNwAbIARC4tiVg9KM3rLjADcAEyAEQvXcyauW7Ji04QA3AAsgBEELakElEDpB4gEQPCAEQbrAADsACyAEQQtqQQIQOiAEQfkUOwAXIARB5dq9kwc2ABMgBELv6tGD8s2ZkO0ANwALIARBC2pBDhA6IARBCjoACyAEQQtqQQEQOgAACxUBAX8CQBBVIgANABA2IgAQVgsgAAv4AQEBfyMAQTBrIgMkAAJAIAAgAWogACgCgK0DakF/akEAIAFrcSIBIABrIAJqIgJBgK0DSw0AIAAgAjYCgK0DIANBMGokACABDwsgA0EgOgAvIANB7NK5qwY2ACsgA0LhyIWDx66ZuSA3ACMgA0L16JWjhqSYuiA3ABsgA0Li2JWD0ozesuMANwATIANC9dzJq5bsmLThADcACyADQQtqQSUQOkGPARA8IANBusAAOwALIANBC2pBAhA6IANB+RQ7ABcgA0Hl2r2TBzYAEyADQu/q0YPyzZmQ7QA3AAsgA0ELakEOEDogA0EKOgALIANBC2pBARA6AAALnwMBAn8jAEEwayIDJAACQAJAIAAoAgANACAAKAIIIQQgACABNgIIIARFDQEgA0EgOgAvIANB7NK5qwY2ACsgA0LhyIWDx66ZuSA3ACMgA0L16JWjhqSYuiA3ABsgA0Li2JWD0ozesuMANwATIANC9dzJq5bsmLThADcACyADQQtqQSUQOkHNARA8IANBusAAOwALIANBC2pBAhA6IANC8sCEk9fM27AKNwAbIANC5cCE8/aNnbTlADcAEyADQu/slZP3zty39AA3AAsgA0ELakEYEDogA0EKOgALIANBC2pBARA6AAALIANBIDoALyADQezSuasGNgArIANC4ciFg8eumbkgNwAjIANC9eiVo4akmLogNwAbIANC4tiVg9KM3rLjADcAEyADQvXcyauW7Ji04QA3AAsgA0ELakElEDpBxgEQPCADQbrAADsACyADQQtqQQIQOiADQe/IldMANgATIANC4uqZs9bMnJDtADcACyADQQtqQQwQOiADQQo6AAsgA0ELakEBEDoAAAsgAhAAIABBADYCCCADQTBqJAALrQQBAX8QXiMAQTBrIgQkAAJAAkACQCAADQAgAQ0AECIiACgCAEH1zqGLAkcNASAAKAL8/wNB9c6hiwJHDQIgAEGw0ABqIAIgAxAjIQAgBEEwaiQAIAAPCyAEQSA6AC8gBEHs0rmrBjYAKyAEQuHIhYPHrpm5IDcAIyAEQvXolaOGpJi6IDcAGyAEQuLYlYPSjN6y4wA3ABMgBEL13MmrluyYtOEANwALIARBC2pBJRA6QfkBEDwgBEEKOgALIARBC2pBARA6AAALIARBIDoALyAEQezSuasGNgArIARC4ciFg8eumbkgNwAjIARC9eiVo4akmLogNwAbIARC4tiVg9KM3rLjADcAEyAEQvXcyauW7Ji04QA3AAsgBEELakElEDpB5BIQPCAEQbrAADsACyAEQQtqQQIQOiAEQQo6ABsgBELuwJiLlo3bsuQANwATIARC4ebNq6aO3bTvADcACyAEQQtqQREQOiAEQQo6AAsgBEELakEBEDoAAAsgBEEgOgAvIARB7NK5qwY2ACsgBELhyIWDx66ZuSA3ACMgBEL16JWjhqSYuiA3ABsgBELi2JWD0ozesuMANwATIARC9dzJq5bsmLThADcACyAEQQtqQSUQOkHlEhA8IARBusAAOwALIARBC2pBAhA6IARBCjoAGyAEQu7AmIuWjduy5AA3ABMgBELh5s2rpo7dtO8ANwALIARBC2pBERA6IARBCjoACyAEQQtqQQEQOgAAC68EAQR/EF4jAEEwayICJAACQAJAECIiAygCAEH1zqGLAkcNACADKAL8/wNB9c6hiwJHDQEgAiADECcCQCACKAIEIgRFDQAgAigCACIDIARBBHRqIQUDQCAAIAE2AgAgASADKAIAIANBBGoiBCgCABBdIAQoAgBqIgFBPToAACABQQFqIANBCGooAgAgA0EMaiIBKAIAEF0gASgCAGoiAUEAOgAAIAFBAWohASAAQQRqIQAgA0EQaiIDIAVHDQALCyACQTBqJABBAA8LIAJBIDoALyACQezSuasGNgArIAJC4ciFg8eumbkgNwAjIAJC9eiVo4akmLogNwAbIAJC4tiVg9KM3rLjADcAEyACQvXcyauW7Ji04QA3AAsgAkELakElEDpB5BIQPCACQbrAADsACyACQQtqQQIQOiACQQo6ABsgAkLuwJiLlo3bsuQANwATIAJC4ebNq6aO3bTvADcACyACQQtqQREQOiACQQo6AAsgAkELakEBEDoAAAsgAkEgOgAvIAJB7NK5qwY2ACsgAkLhyIWDx66ZuSA3ACMgAkL16JWjhqSYuiA3ABsgAkLi2JWD0ozesuMANwATIAJC9dzJq5bsmLThADcACyACQQtqQSUQOkHlEhA8IAJBusAAOwALIAJB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EDogBEEKOgAoIARC7sCYi5aN27LkADcAICAEQuHmzaumjt207wA3ABggBEEYakEREDogBEEKOgAYIARBGGpBARA6AAALIARBIDoAPCAEQezSuasGNgA4IARC4ciFg8eumbkgNwAwIARC9eiVo4akmLogNwAoIARC4tiVg9KM3rLjADcAICAEQvXcyauW7Ji04QA3ABggBEEYakElEDpBtQEQPCAEQbrAADsAGCAEQRhqQQIQOiAEQQo6ACIgBEHkygE7ACAgBELh5JXzlozItu8ANwAYIARBGGpBCxA6IARBCjoAGCAEQRhqQQEQOgAACyAEQSA6ADwgBEHs0rmrBjYAOCAEQuHIhYPHrpm5IDcAMCAEQvXolaOGpJi6IDcAKCAEQuLYlYPSjN6y4wA3ACAgBEL13MmrluyYtOEANwAYIARBGGpBJRA6QbkBEDwgBEG6wAA7ABggBEEYakECEDogBEEKOgAwIARC8sCIq+fM2bLyADcAKCAEQuXAhPP2jZ205QA3ACAgBELv7JWT987ct/QANwAYIARBGGpBGRA6IARBCjoAGCAEQRhqQQEQOgAACyAEQSA6ADwgBEHs0rmrBjYAOCAEQuHIhYPHrpm5IDcAMCAEQvXolaOGpJi6IDcAKCAEQuLYlYPSjN6y4wA3ACAgBEL13MmrluyYtOEANwAYIARBGGpBJRA6QZQHEDwgBEG6wAA7ABggBEEYakECEDogBEEKOgAoIARC7sCYi5aN27LkADcAICAEQuHmzaumjt207wA3ABggBEEYakEREDogBEEKOgAYIARBGGpBARA6AAALIARBIDoAPCAEQezSuasGNgA4IARC4ciFg8eumbkgNwAwIARC9eiVo4akmLogNwAoIARC4tiVg9KM3rLjADcAICAEQvXcyauW7Ji04QA3ABggBEEYakElEDpBlQcQPCAEQbrAADsAGCAEQRhqQQIQOiAEQQo6ACggBELuwJiLlo3bsuQANwAgIARC4ebNq6aO3bTvADcAGCAEQRhqQREQOiAEQQo6ABggBEEYakEBEDoAAAs/AQJ/IwBBEGsiASQAIAAgAUEOahADAkACQCABLQAODQBBHSECDAELIAEtAA8QRiECCyAAEAQgAUEQaiQAIAILoAYBBX8QXiMAQTBrIgQkAAJAAkACQAJAAkACQBBXQX5qQX1xDQACQAJA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ADwgCUHs0rmrBjYAOCAJQuHIhYPHrpm5IDcAMCAJQvXolaOGpJi6IDcAKCAJQuLYlYPSjN6y4wA3ACAgCUL13MmrluyYtOEANwAYIAlBGGpBJRA6QeUSEDwgCUG6wAA7ABggCUEYakECEDogCUEKOgAoIAlC7sCYi5aN27LkADcAICAJQuHmzaumjt207wA3ABggCUEYakEREDogCUEKOgAYIAlBGGpBARA6AAALIAktABEQRiEACyALIAsoAgBBAWo2AgALIAlB0ABqJAAgAEH//wNxC/MBAQF/EF4jAEEwayIBJAAgAEEARxBIIAFBIDoALiABQezSuasGNgAqIAFC4ciFg8eumbkgNwAiIAFC9eiVo4akmLogNwAaIAFC4tiVg9KM3rLjADcAEiABQvXcyauW7Ji04QA3AAogAUEKakElEDpBkg8QPCABQbrAADsACiABQQpqQQIQOiABQaEUOwAuIAFB5fClowc2ACogAUKgyKWj5u2JuiA3ACIgAULl3NGLxq7at+4ANwAaIAFC9MCk64aO27LtADcAEiABQujezaOHpJm86QA3AAogAUEKakEmEDogAUEKOgAKIAFBCmpBARA6AAALnQgBA38QXiMAQTBrIgIkAAJAAkACQAJAAkACQBBXQX5qQX1xDQAQIiIDKAIAQfXOoYsCRw0BIAMoAvz/A0H1zqGLAkcNAiADQQxqKAIADQMgAygCBCEEIAMgADYCBCAEDQQgA0EIaiABNgIAIAGtIAJBCGoQCCACKAIIIQEgA0EANgIEIAEgAEcNBQsgAkEwaiQAQQAPCyACQSA6ACwgAkHs0rmrBjYAKCACQuHIhYPHrpm5IDcAICACQvXolaOGpJi6IDcAGCACQuLYlYPSjN6y4wA3ABAgAkL13MmrluyYtOEANwAIIAJBCGpBJRA6QeQSEDwgAkG6wAA7AAggAkEIakECEDogAkEKOgAYIAJC7sCYi5aN27LkADcAECACQuHmzaumjt207wA3AAggAkEIakEREDogAkEKOgAIIAJBCGpBARA6AAALIAJBIDoALCACQezSuasGNgAoIAJC4ciFg8eumbkgNwAgIAJC9eiVo4akmLogNwAYIAJC4tiVg9KM3rLjADcAECACQvXcyauW7Ji04QA3AAggAkEIakElEDpB5RIQPCACQbrAADsACCACQQhqQQIQOiACQQo6ABggAkLuwJiLlo3bsuQANwAQIAJC4ebNq6aO3bTvADcACCACQQhqQREQOiACQQo6AAggAkEIakEBEDoAAAsgAkEgOgAsIAJB7NK5qwY2ACggAkLhyIWDx66ZuSA3ACAgAkL16JWjhqSYuiA3ABggAkLi2JWD0ozesuMANwAQIAJC9dzJq5bsmLThADcACCACQQhqQSUQOkG1ARA8IAJBusAAOwAIIAJBCGpBAhA6IAJBCjoAEiACQeTKATsAECACQuHklfOWjMi27wA3AAggAkEIakELEDogAkEKOgAIIAJBCGpBARA6AAALIAJBIDoALCACQezSuasGNgAoIAJC4ciFg8eumbkgNwAgIAJC9eiVo4akmLogNwAYIAJC4tiVg9KM3rLjADcAECACQvXcyauW7Ji04QA3AAggAkEIakElEDpBuQEQPCACQbrAADsACCACQQhqQQIQOiACQQo6ACAgAkLywIir58zZsvIANwAYIAJC5cCE8/aNnbTlADcAECACQu/slZP3zty39AA3AAggAkEIakEZEDogAkEKOgAIIAJBCGpBARA6AAALIAJBIDoALCACQezSuasGNgAoIAJC4ciFg8eumbkgNwAgIAJC9eiVo4akmLogNwAYIAJC4tiVg9KM3rLjADcAECACQvXcyauW7Ji04QA3AAggAkEIakElEDpBtg8QPCACQbrAADsACCACQQhqQQIQOiACQQo6ABggAkLuwJiLlo3bsuQANwAQIAJC4ebNq6aO3bTvADcACCACQQhqQREQOiACQQo6AAggAkEIakEBEDoAAAv2AgECfyMAQTBrIgAkAAJAEFdBAkcNAEEDEFhBAEEAQQhBgIAEEAkhAUEEEFggAUIANwIEIAFB9c6hiwI2AgAgAUEMakIANwIAIAFCADcD0P8DIAFBADYCyP8DIAFBADYCvP0DIAFCADcDsP0DIAFBAjYCnDAgAUHY/wNqQgA3AwAgAUHg/wNqQgA3AwAgAUHl/wNqQgA3AAAgAUH1zqGLAjYC/P8DIAFBrtwAOwH4/wMgAUEANgLw/wMgAEEwaiQAIAEPCyAAQSA6AC8gAEHs0rmrBjYAKyAAQuHIhYPHrpm5IDcAIyAAQvXolaOGpJi6IDcAGyAAQuLYlYPSjN6y4wA3ABMgAEL13MmrluyYtOEANwALIABBC2pBJRA6QYQTEDwgAEG6wAA7AAsgAEELakECEDogAEEKOgAbIABC7sCYi5aN27LkADcAEyAAQuHmzaumjt207wA3AAsgAEELakEREDogAEEKOgALIABBC2pBARA6AAAL4AIGA38CfgF/AX4CfwV+IwBB8ABrIgIkACABKAIAIAJBCGoQDiACQRBqLQAAIQECQAJAAkACQCACLQAIDQAgAkHYAGohAyACQcAAai0AACEEQgAhBSACQShqLQAADQFCACEGDAILIABCAjcDSAwCCyACQThqKAIAIQcgAkEwaikDACEIQgEhBgsgAkEgaiEJIAJBGGohCiADLQAAIQMCQAJAIARB/wFxDQAMAQsgAkHQAGooAgAhBCACQcgAaikDACELQgEhBQsgCSkDACEMIAopAwAhDQJAAkAgA0H/AXENAEIAIQ4MAQsgAkHoAGooAgAhAyACQeAAaikDACEPQgEhDgsgACADNgJYIAAgDzcDUCAAIA43A0ggACAENgJAIAAgCzcDOCAAIAU3AzAgACAHNgIoIAAgCDcDICAAIAY3AxggACAMNwMQIAAgDTcDCAsgACABOgAAIAJB8ABqJAALbgEBfyMAQRBrIgckACABKAIAIAJB/wFxIAMgBCAFQf8BcSAGQf8BcSAHQQhqEA8CQAJAIActAAgNACAAIAdBDGooAgA2AgRBACEGDAELIAAgB0EMai0AADoAAUEBIQYLIAAgBjoAACAHQRBqJAALawEBfyMAQSBrIgIkACABKAIAIAJBCGoQEAJAAkAgAi0ACA0AIABBEGogAkEIakEQaikDADcDACAAIAJBEGopAwA3AwhBACEBDAELIAAgAkEQai0AADoAAUEBIQELIAAgAToAACACQSBqJAALPwECfyMAQRBrIgIkACACEBQiAzYCDCACIAJBDGogACABEDsCQCACKAIADQAgAigCBBAECyADEAYgAkEQaiQAC2oBAX8jAEEQayIEJAAgASgCACACIAMgBEEEahAfAkACQAJAAkAgBC0ABA0AQQIhAwwBCyAEQQhqLQAARQ0BQQEhAwsMAQsgBEEMaigCACEBQQAhAwsgACABNgIEIAAgAzYCACAEQRBqJAALNAEBfyMAQRBrIgEkAAJAAkAgAA0AIAFBMDoADyABQQ9qQQEQOgwBCyAAED0LIAFBEGokAAs+AQJ/IwBBEGsiASQA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c2lfc25hcHNob3RfcHJldmlldzEB7kFfAGJfWk4yMndhc2lfc25hcHNob3RfcHJldmlldzExMWRlc2NyaXB0b3JzMTFEZXNjcmlwdG9yczNuZXcxOWdldF9wcmVvcGVuc19pbXBvcnQxN2g2YjgyYThhZTNjMGQ1YWVkRQGhAV9aTjEyNV8kTFQkd2FzaV9zbmFwc2hvdF9wcmV2aWV3MS4uYmluZGluZ3MuLndhc2kuLmZpbGVzeXN0ZW0uLnR5cGVzLi5EaXJlY3RvcnlFbnRyeVN0cmVhbSR1MjAkYXMkdTIwJHdpdF9iaW5kZ2VuLi5XYXNtUmVzb3VyY2UkR1QkNGRyb3A0ZHJvcDE3aGMxMTU4MmZjZmI4NGFlOGJFAnBfWk4yMndhc2lfc25hcHNob3RfcHJldmlldzE4YmluZGluZ3M0d2FzaTEwZmlsZXN5c3RlbTV0eXBlczEwRGVzY3JpcHRvcjhnZXRfdHlwZTEwd2l0X2ltcG9ydDE3aDYxMTViMjMyZTgxNWQ0NDlFA3JfWk4yMndhc2lfc25hcHNob3RfcHJldmlldzE4YmluZGluZ3M0d2FzaTEwZmlsZXN5c3RlbTV0eXBlczIxZmlsZXN5c3RlbV9lcnJvcl9jb2RlMTB3aXRfaW1wb3J0MTdoOTgyMThkNWI1MDg3MDQyYUUEigFfWk4xMDJfJExUJHdhc2lfc25hcHNob3RfcHJldmlldzEuLmJpbmRpbmdzLi53YXNpLi5pby4uZXJyb3IuLkVycm9yJHUyMCRhcyR1MjAkd2l0X2JpbmRnZW4uLldhc21SZXNvdXJjZSRHVCQ0ZHJvcDRkcm9wMTdoM2ZmMjUyNzg0MTk3ZmNhM0UFkgFfWk4xMTBfJExUJHdhc2lfc25hcHNob3RfcHJldmlldzEuLmJpbmRpbmdzLi53YXNpLi5pby4uc3RyZWFtcy4uSW5wdXRTdHJlYW0kdTIwJGFzJHUyMCR3aXRfYmluZGdlbi4uV2FzbVJlc291cmNlJEdUJDRkcm9wNGRyb3AxN2g4YjFlZWQyYzIwYWUwMjJiRQaTAV9aTjExMV8kTFQkd2FzaV9zbmFwc2hvdF9wcmV2aWV3MS4uYmluZGluZ3MuLndhc2kuLmlvLi5zdHJlYW1zLi5PdXRwdXRTdHJlYW0kdTIwJGFzJHUyMCR3aXRfYmluZGdlbi4uV2FzbVJlc291cmNlJEdUJDRkcm9wNGRyb3AxN2gwNzM5ZDQ2OWUxNTM2OThkRQeXAV9aTjExNV8kTFQkd2FzaV9zbmFwc2hvdF9wcmV2aWV3MS4uYmluZGluZ3MuLndhc2kuLmZpbGVzeXN0ZW0uLnR5cGVzLi5EZXNjcmlwdG9yJHUyMCRhcyR1MjAkd2l0X2JpbmRnZW4uLldhc21SZXNvdXJjZSRHVCQ0ZHJvcDRkcm9wMTdoMTdhNDI1ZWEwNDU0N2FiMkUIaV9aTjIyd2FzaV9zbmFwc2hvdF9wcmV2aWV3MThiaW5kaW5nczR3YXNpNnJhbmRvbTZyYW5kb20xNmdldF9yYW5kb21fYnl0ZXMxMHdpdF9pbXBvcnQxN2hiNTE3MjljY2ZlMTVhMmRiRQlHX1pOMjJ3YXNpX3NuYXBzaG90X3ByZXZpZXcxNVN0YXRlM25ldzEyY2FiaV9yZWFsbG9jMTdoOGZjZWVkNjFjOGU1ZjdlZUUKXl9aTjIyd2FzaV9zbmFwc2hvdF9wcmV2aWV3MTVTdGF0ZTE1Z2V0X2Vudmlyb25tZW50MjJnZXRfZW52aXJvbm1lbnRfaW1wb3J0MTdoYTk5MGQ3M2RmOWM1Y2I4NEULeF9aTjIyd2FzaV9zbmFwc2hvdF9wcmV2aWV3MThiaW5kaW5nczR3YXNpMTBmaWxlc3lzdGVtNXR5cGVzMTBEZXNjcmlwdG9yMTVyZWFkX3ZpYV9zdHJlYW0xMHdpdF9pbXBvcnQxN2gwNDY5OTNiZWEwMDYyNGY3RQx5X1pOMjJ3YXNpX3NuYXBzaG90X3ByZXZpZXcxOGJpbmRpbmdzNHdhc2kxMGZpbGVzeXN0ZW01dHlwZXMxMERlc2NyaXB0b3IxNndyaXRlX3ZpYV9zdHJlYW0xMHdpdF9pbXBvcnQxN2hlZjFhOTViNjZhNjI1MDU3RQ16X1pOMjJ3YXNpX3NuYXBzaG90X3ByZXZpZXcxOGJpbmRpbmdzNHdhc2kxMGZpbGVzeXN0ZW01dHlwZXMxMERlc2NyaXB0b3IxN2FwcGVuZF92aWFfc3RyZWFtMTB3aXRfaW1wb3J0MTdoYjZjZGMyYTdmNTlhMGQyMkUObF9aTjIyd2FzaV9zbmFwc2hvdF9wcmV2aWV3MThiaW5kaW5nczR3YXNpMTBmaWxlc3lzdGVtNXR5cGVzMTBEZXNjcmlwdG9yNHN0YXQxMHdpdF9pbXBvcnQxN2hlYzdjMTAzNThmOGNiYTU2RQ9vX1pOMjJ3YXNpX3NuYXBzaG90X3ByZXZpZXcxOGJpbmRpbmdzNHdhc2kxMGZpbGVzeXN0ZW01dHlwZXMxMERlc2NyaXB0b3I3b3Blbl9hdDEwd2l0X2ltcG9ydDE3aGEyZDRlMzY3MDE0NjRkZmFFEHZfWk4yMndhc2lfc25hcHNob3RfcHJldmlldzE4YmluZGluZ3M0d2FzaTEwZmlsZXN5c3RlbTV0eXBlczEwRGVzY3JpcHRvcjEzbWV0YWRhdGFfaGFzaDEwd2l0X2ltcG9ydDE3aDY5ZmQwM2JmMDk3MzQxNzVFEZEBX1pOMTA5XyRMVCR3YXNpX3NuYXBzaG90X3ByZXZpZXcxLi5iaW5kaW5ncy4ud2FzaS4uc29ja2V0cy4udGNwLi5UY3BTb2NrZXQkdTIwJGFzJHUyMCR3aXRfYmluZGdlbi4uV2FzbVJlc291cmNlJEdUJDRkcm9wNGRyb3AxN2g2YjhjMDUyZDY1ODY4NDc4RRKeAV9aTjEyMl8kTFQkd2FzaV9zbmFwc2hvdF9wcmV2aWV3MS4uYmluZGluZ3MuLndhc2kuLmNsaS4udGVybWluYWxfb3V0cHV0Li5UZXJtaW5hbE91dHB1dCR1MjAkYXMkdTIwJHdpdF9iaW5kZ2VuLi5XYXNtUmVzb3VyY2UkR1QkNGRyb3A0ZHJvcDE3aDEzZjM3MTc0Y2EzZDY1ZTFFE5wBX1pOMTIwXyRMVCR3YXNpX3NuYXBzaG90X3ByZXZpZXcxLi5iaW5kaW5ncy4ud2FzaS4uY2xpLi50ZXJtaW5hbF9pbnB1dC4uVGVybWluYWxJbnB1dCR1MjAkYXMkdTIwJHdpdF9iaW5kZ2VuLi5XYXNtUmVzb3VyY2UkR1QkNGRyb3A0ZHJvcDE3aDE0YjMxZjAyMjRjYmU5ZjZFFGBfWk4yMndhc2lfc25hcHNob3RfcHJldmlldzE4YmluZGluZ3M0d2FzaTNjbGk2c3RkZXJyMTBnZXRfc3RkZXJyMTB3aXRfaW1wb3J0MTdoZTcyMmRhNDhmZmQyZmI3M0UVV19aTjIyd2FzaV9zbmFwc2hvdF9wcmV2aWV3MThiaW5kaW5nczR3YXNpM2NsaTRleGl0NGV4aXQxMHdpdF9pbXBvcnQxN2g4YjZiYmFhYzgyYzY3Yjk3RRZdX1pOMjJ3YXNpX3NuYXBzaG90X3ByZXZpZXcxOGJpbmRpbmdzNHdhc2kzY2xpNXN0ZGluOWdldF9zdGRpbjEwd2l0X2ltcG9ydDE3aGViZWY0YzA4Y2RkM2Y4MTFFF2BfWk4yMndhc2lfc25hcHNob3RfcHJldmlldzE4YmluZGluZ3M0d2FzaTNjbGk2c3Rkb3V0MTBnZXRfc3Rkb3V0MTB3aXRfaW1wb3J0MTdoMjYyZTc2NDMxOTUzNzJhNkUYcV9aTjIyd2FzaV9zbmFwc2hvdF9wcmV2aWV3MThiaW5kaW5nczR3YXNpM2NsaTE0dGVybWluYWxfc3RkaW4xOGdldF90ZXJtaW5hbF9zdGRpbjEwd2l0X2ltcG9ydDE3aDkyYzI5ZTRhMmI2MzY1ZjhFGXNfWk4yMndhc2lfc25hcHNob3RfcHJldmlldzE4YmluZGluZ3M0d2FzaTNjbGkxNXRlcm1pbmFsX3N0ZG91dDE5Z2V0X3Rlcm1pbmFsX3N0ZG91dDEwd2l0X2ltcG9ydDE3aGQ1ZWM0MTgxMGUwZjVlOTBFGnNfWk4yMndhc2lfc25hcHNob3RfcHJldmlldzE4YmluZGluZ3M0d2FzaTNjbGkxNXRlcm1pbmFsX3N0ZGVycjE5Z2V0X3Rlcm1pbmFsX3N0ZGVycjEwd2l0X2ltcG9ydDE3aGM4Y2JmMTk3ZDM4NDY3Y2JFG2ZfWk4yMndhc2lfc25hcHNob3RfcHJldmlldzE4YmluZGluZ3M0d2FzaTJpbzdzdHJlYW1zMTFJbnB1dFN0cmVhbTRyZWFkMTB3aXRfaW1wb3J0MTdoZTI5M2NmN2U5NWZlODgzNEUccF9aTjIyd2FzaV9zbmFwc2hvdF9wcmV2aWV3MThiaW5kaW5nczR3YXNpMmlvN3N0cmVhbXMxMUlucHV0U3RyZWFtMTNibG9ja2luZ19yZWFkMTB3aXRfaW1wb3J0MTdoMmVjNWY3MTFiMTY2MjI1NkUdb19aTjIyd2FzaV9zbmFwc2hvdF9wcmV2aWV3MThiaW5kaW5nczR3YXNpMmlvN3N0cmVhbXMxMk91dHB1dFN0cmVhbTExY2hlY2tfd3JpdGUxMHdpdF9pbXBvcnQxN2hmZGIzNzQyZWI4ZjNmYjliRR5oX1pOMjJ3YXNpX3NuYXBzaG90X3ByZXZpZXcxOGJpbmRpbmdzNHdhc2kyaW83c3RyZWFtczEyT3V0cHV0U3RyZWFtNXdyaXRlMTB3aXRfaW1wb3J0MTdoMjIzNzk1MTdjNTczM2JjNEUffF9aTjIyd2FzaV9zbmFwc2hvdF9wcmV2aWV3MThiaW5kaW5nczR3YXNpMmlvN3N0cmVhbXMxMk91dHB1dFN0cmVhbTI0YmxvY2tpbmdfd3JpdGVfYW5kX2ZsdXNoMTB3aXRfaW1wb3J0MTdoYWY1NzgyMDMxODlkODFiY0Ugcl9aTjIyd2FzaV9zbmFwc2hvdF9wcmV2aWV3MThiaW5kaW5nczR3YXNpMmlvN3N0cmVhbXMxMk91dHB1dFN0cmVhbTE0YmxvY2tpbmdfZmx1c2gxMHdpdF9pbXBvcnQxN2hhMjQ3MTRkNTRjYzI4OWMyRSETY2FiaV9pbXBvcnRfcmVhbGxvYyI5X1pOMjJ3YXNpX3NuYXBzaG90X3ByZXZpZXcxNVN0YXRlM3B0cjE3aDQ0YjliYWY5MGQxNjQ5NTZFIz9fWk4yMndhc2lfc25hcHNob3RfcHJldmlldzE5QnVtcEFyZW5hNWFsbG9jMTdoMjVjNmI1Y2RkNWJhZTU2N0UkSF9aTjIyd2FzaV9zbmFwc2hvdF9wcmV2aWV3MTExSW1wb3J0QWxsb2MxMHdpdGhfYXJlbmExN2gyOWNlOWFkNTZiMjUxMDA2RSUTY2FiaV9leHBvcnRfcmVhbGxvYyYLZW52aXJvbl9nZXQnRl9aTjIyd2FzaV9zbmFwc2hvdF9wcmV2aWV3MTVTdGF0ZTE1Z2V0X2Vudmlyb25tZW50MTdoM2JmNzBlMWQ3Y2YzZmU3Y0UoEWVudmlyb25fc2l6ZXNfZ2V0KUJfWk4yMndhc2lfc25hcHNob3RfcHJldmlldzE1U3RhdGUxMWRlc2NyaXB0b3JzMTdoNDQ4OTYyZDAzYTg4MjRhNkUqCGZkX2Nsb3NlK0ZfWk4yMndhc2lfc25hcHNob3RfcHJldmlldzE1U3RhdGUxNWRlc2NyaXB0b3JzX211dDE3aGMxMjZiYWY0ODQ0NmYzNGJFLA9mZF9maWxlc3RhdF9nZXQtDmZkX3ByZXN0YXRfZ2V0LhNmZF9wcmVzdGF0X2Rpcl9uYW1lLwdmZF9yZWFkMEZfWk4yMndhc2lfc25hcHNob3RfcHJldmlldzEyMXN0cmVhbV9lcnJvcl90b19lcnJubzE3aDBiMDZjNDkzM2VjMzczZTZFMQhmZF93cml0ZTJDX1pOMjJ3YXNpX3NuYXBzaG90X3ByZXZpZXcxMTJCbG9ja2luZ01vZGU1d3JpdGUxN2g2ODVkNWExMmI4ODc0NDUzRTMJcGF0aF9vcGVuNAlwcm9jX2V4aXQ1CnJhbmRvbV9nZXQ2OV9aTjIyd2FzaV9zbmFwc2hvdF9wcmV2aWV3MTVTdGF0ZTNuZXcxN2gwYjY1ZTYzZjFlZDdjYTMzRTdgX1pOMjJ3YXNpX3NuYXBzaG90X3ByZXZpZXcxOGJpbmRpbmdzNHdhc2kxMGZpbGVzeXN0ZW01dHlwZXMxMERlc2NyaXB0b3I0c3RhdDE3aDY3MWJjM2JjMzA2OGQ2ZGJFOGNfWk4yMndhc2lfc25hcHNob3RfcHJldmlldzE4YmluZGluZ3M0d2FzaTEwZmlsZXN5c3RlbTV0eXBlczEwRGVzY3JpcHRvcjdvcGVuX2F0MTdoNDUxNTBiNDAxZWQ0MjcyZkU5al9aTjIyd2FzaV9zbmFwc2hvdF9wcmV2aWV3MThiaW5kaW5nczR3YXNpMTBmaWxlc3lzdGVtNXR5cGVzMTBEZXNjcmlwdG9yMTNtZXRhZGF0YV9oYXNoMTdoZGYyMWE2MDNlNjcwZTZmNkU6PF9aTjIyd2FzaV9zbmFwc2hvdF9wcmV2aWV3MTZtYWNyb3M1cHJpbnQxN2g5MTEwNDNiOTNjNGE5Y2E4RTtwX1pOMjJ3YXNpX3NuYXBzaG90X3ByZXZpZXcxOGJpbmRpbmdzNHdhc2kyaW83c3RyZWFtczEyT3V0cHV0U3RyZWFtMjRibG9ja2luZ193cml0ZV9hbmRfZmx1c2gxN2hjZDExMThmZmEzZGJhOTAyRTxCX1pOMjJ3YXNpX3NuYXBzaG90X3ByZXZpZXcxNm1hY3JvczEwZXByaW50X3UzMjE3aGNiOTAxNDc1NDhhZDJlMzJFPW1fWk4yMndhc2lfc25hcHNob3RfcHJldmlldzE2bWFjcm9zMTBlcHJpbnRfdTMyMTVlcHJpbnRfdTMyX2ltcGwxN2gwNTYyZjMyMmZjMjI1YWMyRS5sbHZtLjEwNzkzMjYxMzQ5NTc2ODc0MTA5PosBX1pOOTdfJExUJGNvcmUuLm9wdGlvbi4uT3B0aW9uJExUJFQkR1QkJHUyMCRhcyR1MjAkd2FzaV9zbmFwc2hvdF9wcmV2aWV3MS4uVHJhcHBpbmdVbndyYXAkTFQkVCRHVCQkR1QkMTV0cmFwcGluZ191bndyYXAxN2gwZTFjYzc5MDFhMDk1ZDdmRT+LAV9aTjk3XyRMVCRjb3JlLi5vcHRpb24uLk9wdGlvbiRMVCRUJEdUJCR1MjAkYXMkdTIwJHdhc2lfc25hcHNob3RfcHJldmlldzEuLlRyYXBwaW5nVW53cmFwJExUJFQkR1QkJEdUJDE1dHJhcHBpbmdfdW53cmFwMTdoNTU4Y2U2ZDRhZDdhNDZmOUVAiwFfWk45N18kTFQkY29yZS4ub3B0aW9uLi5PcHRpb24kTFQkVCRHVCQkdTIwJGFzJHUyMCR3YXNpX3NuYXBzaG90X3ByZXZpZXcxLi5UcmFwcGluZ1Vud3JhcCRMVCRUJEdUJCRHVCQxNXRyYXBwaW5nX3Vud3JhcDE3aGE3NzQ1ZGE3YmZkYjg1NzlFQZABX1pOMTAxXyRMVCRjb3JlLi5yZXN1bHQuLlJlc3VsdCRMVCRUJEMkRSRHVCQkdTIwJGFzJHUyMCR3YXNpX3NuYXBzaG90X3ByZXZpZXcxLi5UcmFwcGluZ1Vud3JhcCRMVCRUJEdUJCRHVCQxNXRyYXBwaW5nX3Vud3JhcDE3aDQwNjMzNmE2NGEwYjNjOWJFQpABX1pOMTAxXyRMVCRjb3JlLi5yZXN1bHQuLlJlc3VsdCRMVCRUJEMkRSRHVCQkdTIwJGFzJHUyMCR3YXNpX3NuYXBzaG90X3ByZXZpZXcxLi5UcmFwcGluZ1Vud3JhcCRMVCRUJEdUJCRHVCQxNXRyYXBwaW5nX3Vud3JhcDE3aDY0Njc0NWJiYjFiMDAzODNFQ5ABX1pOMTAxXyRMVCRjb3JlLi5yZXN1bHQuLlJlc3VsdCRMVCRUJEMkRSRHVCQkdTIwJGFzJHUyMCR3YXNpX3NuYXBzaG90X3ByZXZpZXcxLi5UcmFwcGluZ1Vud3JhcCRMVCRUJEdUJCRHVCQxNXRyYXBwaW5nX3Vud3JhcDE3aDlkODBiNDVlOGY3ZDI0ZmZFRJABX1pOMTAxXyRMVCRjb3JlLi5yZXN1bHQuLlJlc3VsdCRMVCRUJEMkRSRHVCQkdTIwJGFzJHUyMCR3YXNpX3NuYXBzaG90X3ByZXZpZXcxLi5UcmFwcGluZ1Vud3JhcCRMVCRUJEdUJCRHVCQxNXRyYXBwaW5nX3Vud3JhcDE3aGE1OTNiZDE0YjQ0MTA4OTdFRZABX1pOMTAxXyRMVCRjb3JlLi5yZXN1bHQuLlJlc3VsdCRMVCRUJEMkRSRHVCQkdTIwJGFzJHUyMCR3YXNpX3NuYXBzaG90X3ByZXZpZXcxLi5UcmFwcGluZ1Vud3JhcCRMVCRUJEdUJCRHVCQxNXRyYXBwaW5nX3Vud3JhcDE3aGFiMTEzODc4NGU1NGE3OThFRs8BX1pOMjJ3YXNpX3NuYXBzaG90X3ByZXZpZXcxMTUyXyRMVCRpbXBsJHUyMCRjb3JlLi5jb252ZXJ0Li5Gcm9tJExUJHdhc2lfc25hcHNob3RfcHJldmlldzEuLmJpbmRpbmdzLi53YXNpLi5maWxlc3lzdGVtLi50eXBlcy4uRXJyb3JDb2RlJEdUJCR1MjAkZm9yJHUyMCR3YXNpLi5saWJfZ2VuZXJhdGVkLi5FcnJubyRHVCQ0ZnJvbTE3aGQ5MzMyZDFjOGQ0NzBmNjBFR9cBX1pOMjJ3YXNpX3NuYXBzaG90X3ByZXZpZXcxMTYwXyRMVCRpbXBsJHUyMCRjb3JlLi5jb252ZXJ0Li5Gcm9tJExUJHdhc2lfc25hcHNob3RfcHJldmlldzEuLmJpbmRpbmdzLi53YXNpLi5maWxlc3lzdGVtLi50eXBlcy4uRGVzY3JpcHRvclR5cGUkR1QkJHUyMCRmb3IkdTIwJHdhc2kuLmxpYl9nZW5lcmF0ZWQuLkZpbGV0eXBlJEdUJDRmcm9tMTdoMmQzYjQyODk0ZWNmMzA0ZkVIS19aTjIyd2FzaV9zbmFwc2hvdF9wcmV2aWV3MThiaW5kaW5nczR3YXNpM2NsaTRleGl0NGV4aXQxN2g3ZGQ3ZjgxODA1MzYwN2EzRUlaX1pOMjJ3YXNpX3NuYXBzaG90X3ByZXZpZXcxOGJpbmRpbmdzNHdhc2kyaW83c3RyZWFtczExSW5wdXRTdHJlYW00cmVhZDE3aDJlMzBkNWJlZWRhZjRkYTRFSmRfWk4yMndhc2lfc25hcHNob3RfcHJldmlldzE4YmluZGluZ3M0d2FzaTJpbzdzdHJlYW1zMTFJbnB1dFN0cmVhbTEzYmxvY2tpbmdfcmVhZDE3aDM1MDE1N2YyNmJlMmQ5NjNFS2NfWk4yMndhc2lfc25hcHNob3RfcHJldmlldzE4YmluZGluZ3M0d2FzaTJpbzdzdHJlYW1zMTJPdXRwdXRTdHJlYW0xMWNoZWNrX3dyaXRlMTdoYTI3MzA1NzBhMjdlMWYyZUVMXF9aTjIyd2FzaV9zbmFwc2hvdF9wcmV2aWV3MThiaW5kaW5nczR3YXNpMmlvN3N0cmVhbXMxMk91dHB1dFN0cmVhbTV3cml0ZTE3aDk0MWI3MzllZTU5OWUyNjdFTWZfWk4yMndhc2lfc25hcHNob3RfcHJldmlldzE4YmluZGluZ3M0d2FzaTJpbzdzdHJlYW1zMTJPdXRwdXRTdHJlYW0xNGJsb2NraW5nX2ZsdXNoMTdoNDVkZGY0MTg2NTgzMTVhN0VOgAFfWk40Y29yZTNwdHI2OGRyb3BfaW5fcGxhY2UkTFQkd2FzaV9zbmFwc2hvdF9wcmV2aWV3MS4uZGVzY3JpcHRvcnMuLkRlc2NyaXB0b3IkR1QkMTdoNWE4NWRmNjRlYTBjZmIxNkUubGx2bS4xMTAzMzI5ODA0MjM3NTM3NzA0OE9VX1pOMjJ3YXNpX3NuYXBzaG90X3ByZXZpZXcxMTFkZXNjcmlwdG9yczdTdHJlYW1zMTVnZXRfcmVhZF9zdHJlYW0xN2g1YTFkOTA0MzZhNTc5MjA1RVBWX1pOMjJ3YXNpX3NuYXBzaG90X3ByZXZpZXcxMTFkZXNjcmlwdG9yczdTdHJlYW1zMTZnZXRfd3JpdGVfc3RyZWFtMTdoMjI5NzRhZWRkNWQwNTExNUVRTV9aTjIyd2FzaV9zbmFwc2hvdF9wcmV2aWV3MTExZGVzY3JpcHRvcnMxMURlc2NyaXB0b3JzM25ldzE3aDkwNTY3ZjQyYjRkOTM1NzlFUk5fWk4yMndhc2lfc25hcHNob3RfcHJldmlldzExMWRlc2NyaXB0b3JzMTFEZXNjcmlwdG9yczRvcGVuMTdoMzA5YTM0MzlmNzk5ZmM2M0VTT19aTjIyd2FzaV9zbmFwc2hvdF9wcmV2aWV3MTExZGVzY3JpcHRvcnMxMURlc2NyaXB0b3JzNWNsb3NlMTdoMDQxNGY5YTA0ZDlmMzUxY0VUUV9aTjIyd2FzaV9zbmFwc2hvdF9wcmV2aWV3MTExZGVzY3JpcHRvcnMxMURlc2NyaXB0b3JzN2dldF9kaXIxN2g3ZTlhYTdmMzQ4OTk5MWUwRVUNZ2V0X3N0YXRlX3B0clYNc2V0X3N0YXRlX3B0clcUZ2V0X2FsbG9jYXRpb25fc3RhdGVYFHNldF9hbGxvY2F0aW9uX3N0YXRlWTVfWk4xN2NvbXBpbGVyX2J1aWx0aW5zM21lbTZtZW1jcHkxN2hkZDlmOWJkZDY3MGJmMjI2RVo1X1pOMTdjb21waWxlcl9idWlsdGluczNtZW02bWVtc2V0MTdoMTMxYmZkOWM1YjE1NGQyNkVbBm1lbXNldFwIX19tdWx0aTNdBm1lbWNweV4OYWxsb2NhdGVfc3RhY2sHOAMAD19fc3RhY2tfcG9pbnRlcgESaW50ZXJuYWxfc3RhdGVfcHRyAhBhbGxvY2F0aW9uX3N0YXRlAFUJcHJvZHVjZXJzAghsYW5ndWFnZQEEUnVzdAAMcHJvY2Vzc2VkLWJ5AQVydXN0YyUxLjc1LjAtbmlnaHRseSAoZmVlNTUxOGNkIDIwMjMtMTEtMDUp", self.location));
  const module2 = base64Compile("AGFzbQEAAAABUQxgAX8AYAN/fn8AYAJ/fwBgB39/f39/f38AYAR/f39/AGACfn8AYAl/f39/f35+f38Bf2ACf38Bf2AEf39/fwF/YAF/AX9gA39/fwF/YAF/AAMgHwABAQICAgMCAgEBAgQEAgUAAAAABgcHCAgHBwkHCgsEBQFwAR8fB50BIAEwAAABMQABATIAAgEzAAMBNAAEATUABQE2AAYBNwAHATgACAE5AAkCMTAACgIxMQALAjEyAAwCMTMADQIxNAAOAjE1AA8CMTYAEAIxNwARAjE4ABICMTkAEwIyMAAUAjIxABUCMjIAFgIyMwAXAjI0ABgCMjUAGQIyNgAaAjI3ABsCMjgAHAIyOQAdAjMwAB4IJGltcG9ydHMBAAqZAx8JACAAQQARAAALDQAgACABIAJBAREBAAsNACAAIAEgAkECEQEACwsAIAAgAUEDEQIACwsAIAAgAUEEEQIACwsAIAAgAUEFEQIACxUAIAAgASACIAMgBCAFIAZBBhEDAAsLACAAIAFBBxECAAsLACAAIAFBCBECAAsNACAAIAEgAkEJEQEACw0AIAAgASACQQoRAQALCwAgACABQQsRAgALDwAgACABIAIgA0EMEQQACw8AIAAgASACIANBDREEAAsLACAAIAFBDhECAAsLACAAIAFBDxEFAAsJACAAQRARAAALCQAgAEEREQAACwkAIABBEhEAAAsJACAAQRMRAAALGQAgACABIAIgAyAEIAUgBiAHIAhBFBEGAAsLACAAIAFBFREHAAsLACAAIAFBFhEHAAsPACAAIAEgAiADQRcRCAALDwAgACABIAIgA0EYEQgACwsAIAAgAUEZEQcACwsAIAAgAUEaEQcACwkAIABBGxEJAAsLACAAIAFBHBEHAAsNACAAIAEgAkEdEQoACwkAIABBHhELAAsALglwcm9kdWNlcnMBDHByb2Nlc3NlZC1ieQENd2l0LWNvbXBvbmVudAYwLjE5LjAAkhAEbmFtZQATEndpdC1jb21wb25lbnQ6c2hpbQH1Dx8ARWluZGlyZWN0LXdhc2k6ZmlsZXN5c3RlbS9wcmVvcGVuc0AwLjIuMC1yYy0yMDIzLTExLTEwLWdldC1kaXJlY3RvcmllcwFVaW5kaXJlY3Qtd2FzaTpmaWxlc3lzdGVtL3R5cGVzQDAuMi4wLXJjLTIwMjMtMTEtMTAtW21ldGhvZF1kZXNjcmlwdG9yLnJlYWQtdmlhLXN0cmVhbQJWaW5kaXJlY3Qtd2FzaTpmaWxlc3lzdGVtL3R5cGVzQDAuMi4wLXJjLTIwMjMtMTEtMTAtW21ldGhvZF1kZXNjcmlwdG9yLndyaXRlLXZpYS1zdHJlYW0DV2luZGlyZWN0LXdhc2k6ZmlsZXN5c3RlbS90eXBlc0AwLjIuMC1yYy0yMDIzLTExLTEwLVttZXRob2RdZGVzY3JpcHRvci5hcHBlbmQtdmlhLXN0cmVhbQROaW5kaXJlY3Qtd2FzaTpmaWxlc3lzdGVtL3R5cGVzQDAuMi4wLXJjLTIwMjMtMTEtMTAtW21ldGhvZF1kZXNjcmlwdG9yLmdldC10eXBlBUppbmRpcmVjdC13YXNpOmZpbGVzeXN0ZW0vdHlwZXNAMC4yLjAtcmMtMjAyMy0xMS0xMC1bbWV0aG9kXWRlc2NyaXB0b3Iuc3RhdAZNaW5kaXJlY3Qtd2FzaTpmaWxlc3lzdGVtL3R5cGVzQDAuMi4wLXJjLTIwMjMtMTEtMTAtW21ldGhvZF1kZXNjcmlwdG9yLm9wZW4tYXQHU2luZGlyZWN0LXdhc2k6ZmlsZXN5c3RlbS90eXBlc0AwLjIuMC1yYy0yMDIzLTExLTEwLVttZXRob2RdZGVzY3JpcHRvci5tZXRhZGF0YS1oYXNoCEhpbmRpcmVjdC13YXNpOmZpbGVzeXN0ZW0vdHlwZXNAMC4yLjAtcmMtMjAyMy0xMS0xMC1maWxlc3lzdGVtLWVycm9yLWNvZGUJRmluZGlyZWN0LXdhc2k6aW8vc3RyZWFtc0AwLjIuMC1yYy0yMDIzLTExLTEwLVttZXRob2RdaW5wdXQtc3RyZWFtLnJlYWQKT2luZGlyZWN0LXdhc2k6aW8vc3RyZWFtc0AwLjIuMC1yYy0yMDIzLTExLTEwLVttZXRob2RdaW5wdXQtc3RyZWFtLmJsb2NraW5nLXJlYWQLTmluZGlyZWN0LXdhc2k6aW8vc3RyZWFtc0AwLjIuMC1yYy0yMDIzLTExLTEwLVttZXRob2Rdb3V0cHV0LXN0cmVhbS5jaGVjay13cml0ZQxIaW5kaXJlY3Qtd2FzaTppby9zdHJlYW1zQDAuMi4wLXJjLTIwMjMtMTEtMTAtW21ldGhvZF1vdXRwdXQtc3RyZWFtLndyaXRlDVtpbmRpcmVjdC13YXNpOmlvL3N0cmVhbXNAMC4yLjAtcmMtMjAyMy0xMS0xMC1bbWV0aG9kXW91dHB1dC1zdHJlYW0uYmxvY2tpbmctd3JpdGUtYW5kLWZsdXNoDlFpbmRpcmVjdC13YXNpOmlvL3N0cmVhbXNAMC4yLjAtcmMtMjAyMy0xMS0xMC1bbWV0aG9kXW91dHB1dC1zdHJlYW0uYmxvY2tpbmctZmx1c2gPQGluZGlyZWN0LXdhc2k6cmFuZG9tL3JhbmRvbUAwLjIuMC1yYy0yMDIzLTExLTEwLWdldC1yYW5kb20tYnl0ZXMQQWluZGlyZWN0LXdhc2k6Y2xpL2Vudmlyb25tZW50QDAuMi4wLXJjLTIwMjMtMTEtMTAtZ2V0LWVudmlyb25tZW50EUdpbmRpcmVjdC13YXNpOmNsaS90ZXJtaW5hbC1zdGRpbkAwLjIuMC1yYy0yMDIzLTExLTEwLWdldC10ZXJtaW5hbC1zdGRpbhJJaW5kaXJlY3Qtd2FzaTpjbGkvdGVybWluYWwtc3Rkb3V0QDAuMi4wLXJjLTIwMjMtMTEtMTAtZ2V0LXRlcm1pbmFsLXN0ZG91dBNJaW5kaXJlY3Qtd2FzaTpjbGkvdGVybWluYWwtc3RkZXJyQDAuMi4wLXJjLTIwMjMtMTEtMTAtZ2V0LXRlcm1pbmFsLXN0ZGVychQmYWRhcHQtd2FzaV9zbmFwc2hvdF9wcmV2aWV3MS1wYXRoX29wZW4VLGFkYXB0LXdhc2lfc25hcHNob3RfcHJldmlldzEtZmRfZmlsZXN0YXRfZ2V0FidhZGFwdC13YXNpX3NuYXBzaG90X3ByZXZpZXcxLXJhbmRvbV9nZXQXJGFkYXB0LXdhc2lfc25hcHNob3RfcHJldmlldzEtZmRfcmVhZBglYWRhcHQtd2FzaV9zbmFwc2hvdF9wcmV2aWV3MS1mZF93cml0ZRkoYWRhcHQtd2FzaV9zbmFwc2hvdF9wcmV2aWV3MS1lbnZpcm9uX2dldBouYWRhcHQtd2FzaV9zbmFwc2hvdF9wcmV2aWV3MS1lbnZpcm9uX3NpemVzX2dldBslYWRhcHQtd2FzaV9zbmFwc2hvdF9wcmV2aWV3MS1mZF9jbG9zZRwrYWRhcHQtd2FzaV9zbmFwc2hvdF9wcmV2aWV3MS1mZF9wcmVzdGF0X2dldB0wYWRhcHQtd2FzaV9zbmFwc2hvdF9wcmV2aWV3MS1mZF9wcmVzdGF0X2Rpcl9uYW1lHiZhZGFwdC13YXNpX3NuYXBzaG90X3ByZXZpZXcxLXByb2NfZXhpdA");
  const module3 = base64Compile("AGFzbQEAAAABUQxgAX8AYAN/fn8AYAJ/fwBgB39/f39/f38AYAR/f39/AGACfn8AYAl/f39/f35+f38Bf2ACf38Bf2AEf39/fwF/YAF/AX9gA39/fwF/YAF/AALAASAAATAAAAABMQABAAEyAAEAATMAAgABNAACAAE1AAIAATYAAwABNwACAAE4AAIAATkAAQACMTAAAQACMTEAAgACMTIABAACMTMABAACMTQAAgACMTUABQACMTYAAAACMTcAAAACMTgAAAACMTkAAAACMjAABgACMjEABwACMjIABwACMjMACAACMjQACAACMjUABwACMjYABwACMjcACQACMjgABwACMjkACgACMzAACwAIJGltcG9ydHMBcAEfHwklAQBBAAsfAAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHgAuCXByb2R1Y2VycwEMcHJvY2Vzc2VkLWJ5AQ13aXQtY29tcG9uZW50BjAuMTkuMAAcBG5hbWUAFRR3aXQtY29tcG9uZW50OmZpeHVwcw");
  ({ exports: exports0 } = await instantiateCore(await module2));
  ({ exports: exports1 } = await instantiateCore(await module0, {
    wasi_snapshot_preview1: {
      environ_get: exports0["25"],
      environ_sizes_get: exports0["26"],
      fd_close: exports0["27"],
      fd_filestat_get: exports0["21"],
      fd_prestat_dir_name: exports0["29"],
      fd_prestat_get: exports0["28"],
      fd_read: exports0["23"],
      fd_write: exports0["24"],
      path_open: exports0["20"],
      proc_exit: exports0["30"],
      random_get: exports0["22"]
    }
  }));
  ({ exports: exports2 } = await instantiateCore(await module1, {
    __main_module__: {
      cabi_realloc: exports1.cabi_realloc
    },
    env: {
      memory: exports1.memory
    },
    "wasi:cli/environment@0.2.0-rc-2023-11-10": {
      "get-environment": exports0["16"]
    },
    "wasi:cli/exit@0.2.0-rc-2023-11-10": {
      exit: trampoline9
    },
    "wasi:cli/stderr@0.2.0-rc-2023-11-10": {
      "get-stderr": trampoline8
    },
    "wasi:cli/stdin@0.2.0-rc-2023-11-10": {
      "get-stdin": trampoline10
    },
    "wasi:cli/stdout@0.2.0-rc-2023-11-10": {
      "get-stdout": trampoline11
    },
    "wasi:cli/terminal-input@0.2.0-rc-2023-11-10": {
      "[resource-drop]terminal-input": trampoline7
    },
    "wasi:cli/terminal-output@0.2.0-rc-2023-11-10": {
      "[resource-drop]terminal-output": trampoline6
    },
    "wasi:cli/terminal-stderr@0.2.0-rc-2023-11-10": {
      "get-terminal-stderr": exports0["19"]
    },
    "wasi:cli/terminal-stdin@0.2.0-rc-2023-11-10": {
      "get-terminal-stdin": exports0["17"]
    },
    "wasi:cli/terminal-stdout@0.2.0-rc-2023-11-10": {
      "get-terminal-stdout": exports0["18"]
    },
    "wasi:filesystem/preopens@0.2.0-rc-2023-11-10": {
      "get-directories": exports0["0"]
    },
    "wasi:filesystem/types@0.2.0-rc-2023-11-10": {
      "[method]descriptor.append-via-stream": exports0["3"],
      "[method]descriptor.get-type": exports0["4"],
      "[method]descriptor.metadata-hash": exports0["7"],
      "[method]descriptor.open-at": exports0["6"],
      "[method]descriptor.read-via-stream": exports0["1"],
      "[method]descriptor.stat": exports0["5"],
      "[method]descriptor.write-via-stream": exports0["2"],
      "[resource-drop]descriptor": trampoline4,
      "[resource-drop]directory-entry-stream": trampoline0,
      "filesystem-error-code": exports0["8"]
    },
    "wasi:io/error@0.2.0-rc-2023-11-10": {
      "[resource-drop]error": trampoline1
    },
    "wasi:io/streams@0.2.0-rc-2023-11-10": {
      "[method]input-stream.blocking-read": exports0["10"],
      "[method]input-stream.read": exports0["9"],
      "[method]output-stream.blocking-flush": exports0["14"],
      "[method]output-stream.blocking-write-and-flush": exports0["13"],
      "[method]output-stream.check-write": exports0["11"],
      "[method]output-stream.write": exports0["12"],
      "[resource-drop]input-stream": trampoline2,
      "[resource-drop]output-stream": trampoline3
    },
    "wasi:random/random@0.2.0-rc-2023-11-10": {
      "get-random-bytes": exports0["15"]
    },
    "wasi:sockets/tcp@0.2.0-rc-2023-11-10": {
      "[resource-drop]tcp-socket": trampoline5
    }
  }));
  memory0 = exports1.memory;
  realloc0 = exports2.cabi_import_realloc;
  await instantiateCore(await module3, {
    "": {
      $imports: exports0.$imports,
      "0": trampoline12,
      "1": trampoline13,
      "10": trampoline22,
      "11": trampoline23,
      "12": trampoline24,
      "13": trampoline25,
      "14": trampoline26,
      "15": trampoline27,
      "16": trampoline28,
      "17": trampoline29,
      "18": trampoline30,
      "19": trampoline31,
      "2": trampoline14,
      "20": exports2.path_open,
      "21": exports2.fd_filestat_get,
      "22": exports2.random_get,
      "23": exports2.fd_read,
      "24": exports2.fd_write,
      "25": exports2.environ_get,
      "26": exports2.environ_sizes_get,
      "27": exports2.fd_close,
      "28": exports2.fd_prestat_get,
      "29": exports2.fd_prestat_dir_name,
      "3": trampoline15,
      "30": exports2.proc_exit,
      "4": trampoline16,
      "5": trampoline17,
      "6": trampoline18,
      "7": trampoline19,
      "8": trampoline20,
      "9": trampoline21
    }
  });
  realloc1 = exports1.cabi_realloc;
  postReturn0 = exports1.cabi_post_generate;
  exports1["cabi_post_generate-types"];
  _initialized = true;
})();
let initialized = (() => new Promise((resolve, reject) => {
  $init.then(() => {
    resolve(true);
  });
}))();
const transpile = function(component, options) {
  return initialized.then(() => {
    return generate(component, options);
  });
};
const __viteBrowserExternal = {};
const __viteBrowserExternal$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({ __proto__: null, default: __viteBrowserExternal }, Symbol.toStringTag, { value: "Module" }));
export {
  transpile
};