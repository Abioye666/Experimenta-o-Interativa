export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const hypot = Math.hypot;

export function hash2(x, y) {
    // hash rápido determinístico (não-cripto)
    let n = x * 374761393 + y * 668265263;
    n = (n ^ (n >> 13)) * 1274126177;
    n = (n ^ (n >> 16)) >>> 0;
    return n / 4294967295;
}

export function noise2(x, y) {
    // value noise simples
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi);
    const b = hash2(xi + 1, yi);
    const c = hash2(xi, yi + 1);
    const d = hash2(xi + 1, yi + 1);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

// distância ponto->segmento (para borda do rasgo)
export function pointSegDist(px, py, ax, ay, bx, by) {
    const abx = bx - ax, aby = by - ay;
    const apx = px - ax, apy = py - ay;
    const ab2 = abx * abx + aby * aby || 1e-6;
    let t = (apx * abx + apy * aby) / ab2;
    t = clamp(t, 0, 1);
    const cx = ax + abx * t, cy = ay + aby * t;
    return hypot(px - cx, py - cy);
}
