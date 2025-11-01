import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateSync } from "node:zlib";

const root = process.cwd();
const assetsDir = path.join(root, "assets");

const ICONS = [
  { size: 16, color: [0x34, 0x78, 0xf6, 0xff] },
  { size: 48, color: [0x2e, 0x3c, 0x59, 0xff] },
  { size: 128, color: [0x23, 0x25, 0x31, 0xff] },
];

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUInt32BE(value) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(value >>> 0, 0);
  return buf;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const length = writeUInt32BE(data.length);
  const crc = writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([length, typeBuf, data, crc]);
}

function createPng({ size, color }) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // color type RGBA
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  const pixel = Buffer.from(color);
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 4)]);
  for (let i = 0; i < size; i++) {
    pixel.copy(row, 1 + i * 4);
  }
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    row.copy(raw, y * (size * 4 + 1));
  }

  const compressed = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", compressed),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);
}

await mkdir(assetsDir, { recursive: true });

await Promise.all(
  ICONS.map(async (icon) => {
    const png = createPng(icon);
    const output = path.join(assetsDir, `icon${icon.size}.png`);
    await writeFile(output, png);
    console.log(`Generated ${path.relative(root, output)} (${png.length} bytes)`);
  })
);
