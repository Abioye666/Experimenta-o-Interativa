import { Config as P } from './config.js';
import { clamp, lerp, hypot, noise2 } from './utils.js';
import { ParticleSystem } from './ParticleSystem.js';

export class TearSurface {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d", { alpha: false });

        // Offscreen canvases
        this.tex = document.createElement("canvas");
        this.tctx = this.tex.getContext("2d");

        this.sheet = document.createElement("canvas");
        this.sctx = this.sheet.getContext("2d");

        this.mask = document.createElement("canvas");
        this.mctx = this.mask.getContext("2d");

        this.W = 0;
        this.H = 0;
        this.DPR = 1;

        this.pointer = {
            x: 0, y: 0, px: 0, py: 0,
            vx: 0, vy: 0, speed: 0,
            down: false,
            inside: false,
            dirx: 1, diry: 0,
            justDown: false,
            justUp: false
        };

        this.tears = [];
        this.particleSystem = new ParticleSystem();

        this.bindEvents();
        this.resize();
    }

    bindEvents() {
        const setPointerFromEvent = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) * this.DPR;
            const y = (e.clientY - rect.top) * this.DPR;
            this.pointer.x = x;
            this.pointer.y = y;
        };

        this.canvas.addEventListener("pointermove", (e) => {
            setPointerFromEvent(e);
        }, { passive: true });

        this.canvas.addEventListener("pointerdown", (e) => {
            this.canvas.setPointerCapture(e.pointerId);
            setPointerFromEvent(e);
            this.pointer.down = true;
            this.pointer.justDown = true;
        });

        this.canvas.addEventListener("pointerup", (e) => {
            setPointerFromEvent(e);
            this.pointer.down = false;
            this.pointer.justUp = true;
            try { this.canvas.releasePointerCapture(e.pointerId); } catch (_) { }
        });

        window.addEventListener("resize", () => this.resize(), { passive: true });
    }

    resize() {
        this.DPR = Math.min(window.devicePixelRatio || 1, P.dprCap);
        this.W = Math.floor(window.innerWidth * this.DPR);
        this.H = Math.floor(window.innerHeight * this.DPR);

        this.canvas.width = this.W;
        this.canvas.height = this.H;

        this.sheet.width = this.W;
        this.sheet.height = this.H;

        this.mask.width = this.W;
        this.mask.height = this.H;

        // textura fixa (pode aumentar se quiser mais detalhe)
        this.tex.width = 1024;
        this.tex.height = 1024;
        this.buildTexture();

        this.ctx.imageSmoothingEnabled = true;
        this.sctx.imageSmoothingEnabled = true;
        this.mctx.imageSmoothingEnabled = true;
    }

    buildTexture() {
        const TW = this.tex.width;
        const TH = this.tex.height;
        const tctx = this.tctx;

        tctx.clearRect(0, 0, TW, TH);

        // base paper-ish
        tctx.fillStyle = "rgb(230,230,235)";
        tctx.fillRect(0, 0, TW, TH);

        // halftone dots
        const step = 10;
        for (let y = 0; y < TH; y += step) {
            for (let x = 0; x < TW; x += step) {
                const n = noise2(x * 0.02, y * 0.02);
                const r = 1.0 + n * 1.35;
                tctx.fillStyle = `rgba(0,0,0,${0.18 + n * 0.12})`;
                tctx.beginPath();
                tctx.arc(x + step * 0.5, y + step * 0.5, r, 0, Math.PI * 2);
                tctx.fill();
            }
        }

        // “ink” abstrata (mancha editorial)
        tctx.globalCompositeOperation = "multiply";
        for (let i = 0; i < 240; i++) {
            const x = TW * (0.25 + noise2(i * 0.07, 1.2) * 0.55);
            const y = TH * (0.18 + noise2(i * 0.09, 3.4) * 0.70);
            const r = 18 + noise2(i * 0.11, 8.9) * 120;
            const a = 0.10 + noise2(i * 0.13, 7.1) * 0.18;

            const grd = tctx.createRadialGradient(x, y, 0, x, y, r);
            grd.addColorStop(0, `rgba(0,0,0,${a})`);
            grd.addColorStop(1, "rgba(0,0,0,0)");
            tctx.fillStyle = grd;
            tctx.beginPath();
            tctx.arc(x, y, r, 0, Math.PI * 2);
            tctx.fill();
        }
        tctx.globalCompositeOperation = "source-over";

        // leve vinheta
        const v = tctx.createRadialGradient(TW * 0.52, TH * 0.45, TW * 0.10, TW * 0.52, TH * 0.45, TW * 0.75);
        v.addColorStop(0, "rgba(255,255,255,0)");
        v.addColorStop(1, "rgba(0,0,0,0.10)");
        tctx.fillStyle = v;
        tctx.fillRect(0, 0, TW, TH);
    }

    sheetBounds() {
        const size = Math.min(this.W, this.H) * P.sheet.scale;
        const sw = size * 1.05;
        const sh = size * 0.90;
        const cx = this.W * 0.52;
        const cy = this.H * 0.50;
        return { cx, cy, sw, sh, x0: cx - sw * 0.5, y0: cy - sh * 0.5 };
    }

    isPointOnSheet(px, py) {
        const b = this.sheetBounds();
        return px >= b.x0 && px <= b.x0 + b.sw && px <= this.W && py >= b.y0 && py <= b.y0 + b.sh;
    }

    stampTearStroke(seg) {
        const pts = seg.pts;
        if (pts.length < 2) return;

        const mctx = this.mctx;
        mctx.save();
        mctx.globalCompositeOperation = "source-over";
        mctx.lineCap = "round";
        mctx.lineJoin = "round";
        mctx.strokeStyle = "rgba(255,255,255,1)";

        for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1], b = pts[i];
            const dx = b.x - a.x, dy = b.y - a.y;
            const len = hypot(dx, dy) || 1;
            const nx = -dy / len, ny = dx / len;

            const midx = (a.x + b.x) * 0.5, midy = (a.y + b.y) * 0.5;
            const n = (noise2(midx * 0.012, midy * 0.012) - 0.5) * 2;
            const jit = n * P.tear.jitter * P.tear.roughness;

            const ax = a.x + nx * jit * 0.35;
            const ay = a.y + ny * jit * 0.35;
            const bx = b.x + nx * jit;
            const by = b.y + ny * jit;

            mctx.lineWidth = (a.w + b.w) * 0.5;
            mctx.beginPath();
            mctx.moveTo(ax, ay);
            mctx.lineTo(bx, by);
            mctx.stroke();

            // Spawn particles
            const energy = clamp(this.pointer.speed / 30, 0.15, 1.0);
            const spawns = Math.floor((a.w * 0.08 + energy * 2.2) * P.particles.spawnRate);
            for (let k = 0; k < spawns; k++) {
                this.particleSystem.spawn(
                    bx + (Math.random() - 0.5) * a.w * 0.35,
                    by + (Math.random() - 0.5) * a.w * 0.35,
                    nx, ny,
                    energy
                );
            }
        }
        mctx.restore();
    }

    addTearPoint(x, y) {
        let cur = this.tears[this.tears.length - 1];
        if (!cur) {
            cur = { pts: [], life: 1 };
            this.tears.push(cur);
        }

        const pts = cur.pts;
        const last = pts[pts.length - 1];
        if (last) {
            const d = hypot(x - last.x, y - last.y);
            if (d < P.tear.minPointDist) return;

            const dx = x - last.x;
            const dy = y - last.y;
            const len = hypot(dx, dy) || 1;
            const ndx = dx / len, ndy = dy / len;
            this.pointer.dirx = lerp(this.pointer.dirx, ndx, 1 - P.pointer.dirInertia);
            this.pointer.diry = lerp(this.pointer.diry, ndy, 1 - P.pointer.dirInertia);
        }

        const w = clamp(P.tear.baseWidth + this.pointer.speed * P.tear.speedGain, P.tear.baseWidth, P.tear.maxWidth);
        pts.push({ x, y, w });
    }

    beginTear() {
        this.tears.push({ pts: [], life: 1 });
    }

    endTear() { }

    fadeMask() {
        if (P.tear.heal <= 0) return;
        const mctx = this.mctx;
        mctx.save();
        mctx.globalCompositeOperation = "source-over";
        mctx.globalAlpha = P.tear.heal;
        mctx.fillStyle = "rgba(0,0,0,1)";
        mctx.globalCompositeOperation = "destination-out";
        mctx.fillRect(0, 0, this.W, this.H);
        mctx.restore();
    }

    drawEdges() {
        const ctx = this.ctx;
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        for (const seg of this.tears) {
            const pts = seg.pts;
            if (pts.length < 2) continue;

            for (let i = 1; i < pts.length; i++) {
                const a = pts[i - 1], b = pts[i];
                const w = (a.w + b.w) * 0.5;

                // Shadow
                ctx.save();
                ctx.globalCompositeOperation = "source-over";
                ctx.strokeStyle = P.colors.edgeDark;
                ctx.shadowColor = "rgba(0,0,0,0.95)";
                ctx.shadowBlur = P.tear.edgeShadow;
                ctx.lineWidth = w * 0.66;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
                ctx.restore();

                // Highlight
                ctx.save();
                ctx.globalAlpha = P.tear.edgeHighlight;
                ctx.strokeStyle = P.colors.edgeLight;
                ctx.lineWidth = Math.max(1, w * P.tear.edgeStroke * 0.08);
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
                ctx.restore();
            }
        }
        ctx.restore();
    }

    renderSheet(t) {
        const b = this.sheetBounds();
        const { cx, cy, sw, sh, x0, y0 } = b;
        const sctx = this.sctx;

        sctx.clearRect(0, 0, this.W, this.H);

        // Drop shadow
        sctx.save();
        sctx.shadowColor = `rgba(0,0,0,${P.sheet.dropShadowAlpha})`;
        sctx.shadowBlur = P.sheet.dropShadowBlur;
        sctx.translate(cx, cy);

        // Fake tilt
        const sx = P.sheet.tiltX, sy = P.sheet.tiltY;
        sctx.transform(1, sy, sx, 1, 0, 0);
        sctx.translate(-cx, -cy);

        // Draw slices
        const slices = P.sheet.slices;
        const TW = this.tex.width, TH = this.tex.height;

        const px = this.pointer.x, py = this.pointer.y;
        const on = this.isPointOnSheet(px, py);
        this.pointer.inside = on;

        for (let i = 0; i < slices; i++) {
            const u0 = i / slices;
            const u1 = (i + 1) / slices;

            const dx0 = x0 + u0 * sw;
            const dx1 = x0 + u1 * sw;
            const dw = dx1 - dx0;

            const xMid = (dx0 + dx1) * 0.5;
            const wave = Math.sin(t * P.sheet.waveSpeed + xMid * P.sheet.waveFreq) * P.sheet.waveAmp;
            const curve = Math.sin((u0 - 0.5) * Math.PI) * 14;

            let infl = 0;
            if (on) {
                const d = hypot(xMid - px, (y0 + sh * 0.5) - py);
                infl = clamp(1 - d / P.pointer.tensionRadius, 0, 1);
                infl = infl * infl * P.pointer.tensionStrength;
            }

            const yShift = wave + curve - infl * 46;
            const stretch = 1 + Math.sin(t * 0.7 + u0 * 4.0) * 0.03 + infl * 0.06;

            const sx0 = Math.floor(u0 * TW);
            const sxw = Math.max(1, Math.floor((u1 - u0) * TW));

            const dy = y0 + yShift;
            const dh = sh * stretch;

            sctx.drawImage(this.tex, sx0, 0, sxw, TH, dx0, dy, dw + 1, dh);
        }
        sctx.restore();

        // Clean Rect check
        sctx.save();
        sctx.globalCompositeOperation = "destination-in";
        sctx.fillStyle = "rgba(255,255,255,1)";
        sctx.fillRect(x0, y0, sw, sh);
        sctx.restore();

        // Apply mask
        sctx.save();
        sctx.globalCompositeOperation = "destination-out";
        sctx.drawImage(this.mask, 0, 0);
        sctx.restore();

        // Final draw
        this.ctx.drawImage(this.sheet, 0, 0);
    }

    update(dt, t) {
        // Pointer physics
        const dx = this.pointer.x - this.pointer.px;
        const dy = this.pointer.y - this.pointer.py;
        this.pointer.vx = dx;
        this.pointer.vy = dy;
        this.pointer.speed = hypot(dx, dy) / Math.max(1, dt) * 16;
        this.pointer.px = this.pointer.x;
        this.pointer.py = this.pointer.y;

        // Input handling
        if (this.pointer.justDown) {
            this.pointer.justDown = false;
            if (this.isPointOnSheet(this.pointer.x, this.pointer.y)) {
                this.beginTear();
                this.addTearPoint(this.pointer.x, this.pointer.y);
            }
        }

        if (this.pointer.down) {
            if (this.isPointOnSheet(this.pointer.x, this.pointer.y)) {
                this.addTearPoint(this.pointer.x, this.pointer.y);
                const seg = this.tears[this.tears.length - 1];
                if (seg && seg.pts.length >= 2) {
                    const tmp = { pts: seg.pts.slice(-2), life: 1 };
                    this.stampTearStroke(tmp);
                }
            }
        }

        if (this.pointer.justUp) {
            this.pointer.justUp = false;
            this.endTear();
        }

        this.particleSystem.update(this.W, this.H);
        this.fadeMask();
    }

    draw(t) {
        this.ctx.fillStyle = P.colors.bg;
        this.ctx.fillRect(0, 0, this.W, this.H);

        this.renderSheet(t);
        this.drawEdges();
        this.particleSystem.draw(this.ctx);
    }
}
