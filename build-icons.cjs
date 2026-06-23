// Dependency-free PNG icon generator (pure Node + zlib).
// Renders a full-bleed gradient chat-bubble icon at 3x supersampling.
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const SS = 3; // supersampling factor for anti-aliasing

function lerp(a, b, t) { return a + (b - a) * t; }

// Draw one icon into an RGBA buffer at the given size.
function render(size) {
  const W = size * SS;
  const buf = Buffer.alloc(W * W * 4);

  const set = (x, y, r, g, b, a) => {
    const i = (y * W + x) * 4;
    const ia = a / 255;
    buf[i]     = Math.round(lerp(buf[i],     r, ia));
    buf[i + 1] = Math.round(lerp(buf[i + 1], g, ia));
    buf[i + 2] = Math.round(lerp(buf[i + 2], b, ia));
    buf[i + 3] = Math.min(255, buf[i + 3] + a);
  };

  // 1) Full-bleed vertical gradient background (indigo -> violet).
  for (let y = 0; y < W; y++) {
    const t = y / (W - 1);
    const r = Math.round(lerp(0x4f, 0x7c, t)); // 4f46e5 -> 7c3aed-ish
    const g = Math.round(lerp(0x46, 0x3a, t));
    const b = Math.round(lerp(0xe5, 0xed, t));
    for (let x = 0; x < W; x++) set(x, y, r, g, b, 255);
  }

  // 2) White chat bubble within the maskable safe zone (~center 62%).
  const cx = W / 2;
  const bw = W * 0.52;          // bubble width
  const bh = W * 0.40;          // bubble height
  const bx = cx - bw / 2;
  const by = W * 0.26;
  const rad = bh * 0.34;        // corner radius
  const white = [255, 255, 255];

  const insideRoundRect = (x, y, x0, y0, w, h, r) => {
    const x1 = x0 + w, y1 = y0 + h;
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const dx = Math.min(x - x0, x1 - x) ;
    const dy = Math.min(y - y0, y1 - y);
    if (dx > r || dy > r) return true;
    const ddx = r - Math.min(dx, r);
    const ddy = r - Math.min(dy, r);
    return ddx * ddx + ddy * ddy <= r * r;
  };

  for (let y = Math.floor(by); y < by + bh + W * 0.12; y++) {
    for (let x = Math.floor(bx - W * 0.02); x < bx + bw + W * 0.02; x++) {
      if (x < 0 || y < 0 || x >= W || y >= W) continue;
      let on = insideRoundRect(x + 0.5, y + 0.5, bx, by, bw, bh, rad);
      // Speech-bubble tail (triangle at bottom-left).
      const tailTopY = by + bh - 1;
      const tx0 = bx + bw * 0.20;
      if (!on && y >= tailTopY && y < tailTopY + bh * 0.34) {
        const prog = (y - tailTopY) / (bh * 0.34);
        const left = tx0;
        const right = lerp(tx0 + bw * 0.16, tx0, prog);
        if (x >= left && x <= right) on = true;
      }
      if (on) set(x, y, white[0], white[1], white[2], 255);
    }
  }

  // 3) Three dots inside the bubble (indigo).
  const dotR = bw * 0.058;
  const dotY = by + bh * 0.46;
  const dotColor = [0x4f, 0x46, 0xe5];
  for (let k = -1; k <= 1; k++) {
    const dcx = cx + k * bw * 0.26;
    for (let y = Math.floor(dotY - dotR - 2); y <= dotY + dotR + 2; y++) {
      for (let x = Math.floor(dcx - dotR - 2); x <= dcx + dotR + 2; x++) {
        if (x < 0 || y < 0 || x >= W || y >= W) continue;
        const d = Math.hypot(x + 0.5 - dcx, y + 0.5 - dotY);
        if (d <= dotR) set(x, y, dotColor[0], dotColor[1], dotColor[2], 255);
      }
    }
  }

  // 4) Downsample SSxSS -> size (box filter).
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * W + (x * SS + sx)) * 4;
          r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; a += buf[i + 3];
        }
      }
      const n = SS * SS;
      const o = (y * size + x) * 4;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
      out[o + 3] = Math.round(a / n);
    }
  }
  return out;
}

// Minimal PNG encoder.
function crc32(buf) {
  let c, table = crc32.table || (crc32.table = (() => {
    const t = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(rgba, size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const outDir = path.join(__dirname, "icons");
fs.mkdirSync(outDir, { recursive: true });
for (const size of [180, 192, 512]) {
  const rgba = render(size);
  const png = encodePNG(rgba, size);
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), png);
  console.log(`wrote icons/icon-${size}.png (${png.length} bytes)`);
}
