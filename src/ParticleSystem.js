import { Config } from './config.js';
import { clamp } from './utils.js';

export class ParticleSystem {
    constructor() {
        this.particles = new Array(Config.particles.max);
        this.count = 0;
    }

    spawn(x, y, nx, ny, energy) {
        if (this.count >= Config.particles.max) return;
        const i = this.count++;
        const life = (Config.particles.lifeMin + Math.random() * (Config.particles.lifeMax - Config.particles.lifeMin));
        const sp = Config.particles.speed * (0.6 + Math.random() * 1.2) * energy;

        this.particles[i] = {
            x, y,
            vx: (nx * (0.6 + Math.random() * 0.9) + (Math.random() - 0.5) * 0.45) * sp,
            vy: (ny * (0.6 + Math.random() * 0.9) + (Math.random() - 0.5) * 0.45) * sp,
            r: Config.particles.sizeMin + Math.random() * (Config.particles.sizeMax - Config.particles.sizeMin),
            life,
            maxLife: life
        };
    }

    update(width, height) {
        let w = 0;
        for (let i = 0; i < this.count; i++) {
            const p = this.particles[i];
            p.vx *= Config.particles.drag;
            p.vy = p.vy * Config.particles.drag + Config.particles.gravity;
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 1;

            if (p.life > 0 && p.x > -40 && p.y > -40 && p.x < width + 40 && p.y < height + 40) {
                this.particles[w++] = p;
            }
        }
        this.count = w;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = Config.colors.dust;
        for (let i = 0; i < this.count; i++) {
            const p = this.particles[i];
            const t = p.life / p.maxLife;
            ctx.globalAlpha = clamp(t, 0, 1);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}
