// A QR encoder, because `qrencode` should produce a code that actually scans.
//
// Scope: byte mode, versions 1 to 6, error correction level M with a fall back to
// level L when M cannot hold the payload (108 vs 136 bytes). Stopping at version 6
// avoids the version information block, which only exists from version 7 onwards.
(function () {
  // ── GF(256), primitive polynomial 0x11d ───────────────────────────────────
  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  (function () {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();
  const mul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];

  // g(x) = product of (x - a^i), coefficients highest degree first.
  function rsGenerator(n) {
    let g = [1];
    for (let i = 0; i < n; i++) {
      const next = new Array(g.length + 1).fill(0);
      for (let j = 0; j < g.length; j++) {
        next[j] ^= g[j];
        next[j + 1] ^= mul(g[j], EXP[i]);
      }
      g = next;
    }
    return g;
  }

  function rsRemainder(data, n) {
    const g = rsGenerator(n);
    const buf = new Array(data.length + n).fill(0);
    for (let i = 0; i < data.length; i++) buf[i] = data[i];
    for (let i = 0; i < data.length; i++) {
      const c = buf[i];
      if (!c) continue;
      for (let j = 0; j < g.length; j++) buf[i + j] ^= mul(g[j], c);
    }
    return buf.slice(data.length);
  }

  // ── level M capacity, versions 1..6 ───────────────────────────────────────
  // [ total data codewords, EC codewords per block, number of blocks ]
  const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34] };

  // Only versions whose blocks are all the same size, which is every one of these.
  const LEVELS = {
    M: {
      bits: 0b00,
      v: { 1: { data: 16, ec: 10, blocks: 1 }, 2: { data: 28, ec: 16, blocks: 1 },
           3: { data: 44, ec: 26, blocks: 1 }, 4: { data: 64, ec: 18, blocks: 2 },
           5: { data: 86, ec: 24, blocks: 2 }, 6: { data: 108, ec: 16, blocks: 4 } },
    },
    L: {
      bits: 0b01,
      v: { 1: { data: 19, ec: 7,  blocks: 1 }, 2: { data: 34, ec: 10, blocks: 1 },
           3: { data: 55, ec: 15, blocks: 1 }, 4: { data: 80, ec: 20, blocks: 1 },
           5: { data: 108, ec: 26, blocks: 1 }, 6: { data: 136, ec: 18, blocks: 2 } },
    },
  };

  // Prefer M, which survives more damage; drop to L only when the payload demands it.
  function pickPlan(byteLen) {
    const need = Math.ceil((4 + 8 + byteLen * 8) / 8);
    for (const level of ["M", "L"]) {
      for (let v = 1; v <= 6; v++) {
        if (need <= LEVELS[level].v[v].data) return { level, version: v };
      }
    }
    return null;
  }

  function buildCodewords(bytes, version, level) {
    const spec = LEVELS[level].v[version];
    const bits = [];
    const push = (value, len) => { for (let i = len - 1; i >= 0; i--) bits.push((value >> i) & 1); };

    push(0b0100, 4);            // byte mode
    push(bytes.length, 8);      // character count, 8 bits for versions 1..9
    for (const b of bytes) push(b, 8);

    const capacity = spec.data * 8;
    for (let i = 0; i < 4 && bits.length < capacity; i++) bits.push(0);   // terminator
    while (bits.length % 8) bits.push(0);

    const words = [];
    for (let i = 0; i < bits.length; i += 8) {
      let v = 0;
      for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
      words.push(v);
    }
    // Pad alternately with 0xEC / 0x11 until the version is full.
    const PAD = [0xEC, 0x11];
    while (words.length < spec.data) words.push(PAD[(words.length - bits.length / 8) % 2]);

    // Split into blocks, compute EC per block, then interleave.
    const per = spec.data / spec.blocks;
    const dataBlocks = [], ecBlocks = [];
    for (let b = 0; b < spec.blocks; b++) {
      const block = words.slice(b * per, (b + 1) * per);
      dataBlocks.push(block);
      ecBlocks.push(rsRemainder(block, spec.ec));
    }
    const out = [];
    for (let i = 0; i < per; i++) for (const b of dataBlocks) out.push(b[i]);
    for (let i = 0; i < spec.ec; i++) for (const b of ecBlocks) out.push(b[i]);
    return out;
  }

  // ── matrix ────────────────────────────────────────────────────────────────
  function buildMatrix(codewords, version, level) {
    const size = version * 4 + 17;
    const m = Array.from({ length: size }, () => new Array(size).fill(null));
    const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

    const setF = (r, c, v) => {
      if (r < 0 || c < 0 || r >= size || c >= size) return;
      m[r][c] = v; reserved[r][c] = true;
    };

    const finder = (r0, c0) => {
      for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
        const inner = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const ring = (r === 0 || r === 6 || c === 0 || c === 6);
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        setF(r0 + r, c0 + c, inner && (ring || core) ? 1 : 0);
      }
    };
    finder(0, 0); finder(0, size - 7); finder(size - 7, 0);

    // timing patterns
    for (let i = 8; i < size - 8; i++) {
      setF(6, i, i % 2 === 0 ? 1 : 0);
      setF(i, 6, i % 2 === 0 ? 1 : 0);
    }

    // alignment patterns, skipping the three finder corners
    const al = ALIGN[version];
    for (const r of al) for (const c of al) {
      if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) continue;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
        const edge = Math.max(Math.abs(dr), Math.abs(dc));
        setF(r + dr, c + dc, edge === 1 ? 0 : 1);
      }
    }

    setF(size - 8, 8, 1);                       // always-dark module

    // Reserve the format information areas. Index 6 is the timing pattern and is
    // skipped: format bits jump over it, and reserving it here would overwrite the
    // timing module at (6,8) and (8,6).
    for (let i = 0; i < 9; i++) {
      if (i === 6) continue;
      setF(8, i, 0); setF(i, 8, 0);
    }
    for (let i = 0; i < 8; i++) { setF(8, size - 1 - i, 0); setF(size - 1 - i, 8, 0); }

    // ── data placement, two columns at a time, upward then downward ──
    const bits = [];
    for (const w of codewords) for (let i = 7; i >= 0; i--) bits.push((w >> i) & 1);
    let bi = 0, up = true;
    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;                     // the vertical timing column
      for (let k = 0; k < size; k++) {
        const row = up ? size - 1 - k : k;
        for (const c of [col, col - 1]) {
          if (reserved[row][c]) continue;
          m[row][c] = bi < bits.length ? bits[bi++] : 0;
        }
      }
      up = !up;
    }
    return { m, reserved, size };
  }

  const MASKS = [
    (r, c) => (r + c) % 2 === 0,
    (r) => r % 2 === 0,
    (r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ];

  function penalty(grid, size) {
    let score = 0;
    // rule 1: runs of five or more
    for (let i = 0; i < size; i++) {
      for (const line of [grid[i], grid.map(r => r[i])]) {
        let run = 1;
        for (let j = 1; j < size; j++) {
          if (line[j] === line[j - 1]) { run++; if (run === 5) score += 3; else if (run > 5) score++; }
          else run = 1;
        }
      }
    }
    // rule 2: 2x2 blocks of one colour
    for (let r = 0; r < size - 1; r++) for (let c = 0; c < size - 1; c++) {
      const v = grid[r][c];
      if (v === grid[r][c + 1] && v === grid[r + 1][c] && v === grid[r + 1][c + 1]) score += 3;
    }
    // rule 3: finder-like patterns
    const A = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    const B = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    const hit = (line, i, pat) => pat.every((v, k) => line[i + k] === v);
    for (let i = 0; i < size; i++) {
      for (const line of [grid[i], grid.map(r => r[i])]) {
        for (let j = 0; j + 11 <= size; j++) if (hit(line, j, A) || hit(line, j, B)) score += 40;
      }
    }
    // rule 4: deviation from an even split of dark and light
    let dark = 0;
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) dark += grid[r][c];
    const pct = (dark * 100) / (size * size);
    score += Math.floor(Math.abs(pct - 50) / 5) * 10;
    return score;
  }

  // BCH(15,5) format information. The level bits sit above the mask number.
  function formatBits(mask, level) {
    let v = (LEVELS[level].bits << 3) | mask;
    let d = v << 10;
    for (let i = 4; i >= 0; i--) if (d & (1 << (i + 10))) d ^= 0x537 << i;
    return ((v << 10) | d) ^ 0x5412;
  }

  // Format information placement, ISO/IEC 18004 figure 25.
  //
  // Bit 0 is the least significant bit of the masked 15-bit word and goes to (0,8)
  // and (8,size-1), NOT to (8,0) and (size-1,8). Getting this mirrored produces a
  // symbol that a reader locates and then rejects, and it is invisible to a decoder
  // that reads back in the same wrong order.
  function placeFormat(m, size, mask, level) {
    const f = formatBits(mask, level);
    for (let i = 0; i < 15; i++) {
      const b = (f >> i) & 1;
      // the run down column 8: rows 0..5, then 7..8, then the bottom seven
      if (i < 6) m[i][8] = b;
      else if (i < 8) m[i + 1][8] = b;
      else m[size - 15 + i][8] = b;
      // the run along row 8: the right eight, then column 7, then columns 5..0
      if (i < 8) m[8][size - 1 - i] = b;
      else if (i < 9) m[8][7] = b;
      else m[8][14 - i] = b;
    }
    m[size - 8][8] = 1;   // the module that is always dark
  }

  // Returns a size x size array of 0/1, or null when the text does not fit.
  function encode(text) {
    const bytes = Array.from(new TextEncoder().encode(String(text)));
    const plan = pickPlan(bytes.length);
    if (!plan) return null;
    const { version, level } = plan;

    const codewords = buildCodewords(bytes, version, level);
    const { m, reserved, size } = buildMatrix(codewords, version, level);

    let best = null, bestScore = Infinity;
    for (let mask = 0; mask < 8; mask++) {
      const g = m.map((row, r) => row.map((v, c) => reserved[r][c] ? v : (v ^ (MASKS[mask](r, c) ? 1 : 0))));
      placeFormat(g, size, mask, level);
      const s = penalty(g, size);
      if (s < bestScore) { bestScore = s; best = g; }
    }
    return best;
  }

  // Two ASCII cells per module, so the code comes out square in a monospace grid.
  // Block-drawing characters would be neater but render double width under a CJK
  // fallback font, which would tear the code apart.
  function toAscii(grid, quiet = 2) {
    if (!grid) return null;
    const size = grid.length;
    const blank = "  ".repeat(size + quiet * 2);
    const rows = [];
    for (let i = 0; i < quiet; i++) rows.push(blank);
    for (let r = 0; r < size; r++) {
      let line = "  ".repeat(quiet);
      for (let c = 0; c < size; c++) line += grid[r][c] ? "##" : "  ";
      rows.push(line + "  ".repeat(quiet));
    }
    for (let i = 0; i < quiet; i++) rows.push(blank);
    return rows;
  }

  // rsRemainder is exported so the smoke test can check it against the published
  // QR test vector. Getting the Galois field wrong produces a code that looks
  // perfect and scans as nothing.
  window.QR = { encode, toAscii, _rsRemainder: rsRemainder };
})();
