import {writeFile} from 'node:fs/promises';
import {deflateSync} from 'node:zlib';
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);}
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, content) {
  const label = Buffer.from(type), length = Buffer.alloc(4), crc = Buffer.alloc(4);
  length.writeUInt32BE(content.length); crc.writeUInt32BE(crc32(Buffer.concat([label, content])));
  return Buffer.concat([length, label, content, crc]);
}
function distance(x, y, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}
for (const size of [192, 512]) {
  const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 2;
  const pixels = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const white = Math.min(distance(x / size, y / size, [.29, .51], [.44, .66]), distance(x / size, y / size, [.44, .66], [.72, .35])) < .045;
    const color = white ? [234, 244, 226] : [51, 93, 77];
    const i = y * (size * 3 + 1) + 1 + x * 3; for (let c = 0; c < 3; c++) pixels[i + c] = color[c];
  }
  await writeFile(`frontend/public/icon-${size}.png`, Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]));
}
