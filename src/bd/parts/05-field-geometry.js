/* ================= field geometry (feet; home at origin, +y toward CF, +x toward 1B) ================= */
const BASE = [{ x: 0, y: 0 }, { x: 63.64, y: 63.64 }, { x: 0, y: 127.28 }, { x: -63.64, y: 63.64 }];
const POSN = { P: { x: 0, y: 58 }, C: { x: 0, y: -5 }, '1B': { x: 70, y: 82 }, '2B': { x: 34, y: 128 }, SS: { x: -36, y: 126 }, '3B': { x: -70, y: 80 }, LF: { x: -118, y: 238 }, CF: { x: 0, y: 292 }, RF: { x: 118, y: 238 } };
const fenceR = a => 332 + 74 * Math.pow(Math.max(0, 1 - Math.abs(a) / (45 * DEG)), 1.25);
const FENCE_H = 11;
const GRAV = 32, DRAG = 0.00125;

