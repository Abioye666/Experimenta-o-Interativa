import { TearSurface } from './TearSurface.js';

const canvas = document.getElementById("c");
const simulation = new TearSurface(canvas);

let lastTime = performance.now();

function tick(now) {
    const dt = Math.min(33, now - lastTime);
    lastTime = now;
    const t = now * 0.001;

    simulation.update(dt, t);
    simulation.draw(t);

    requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
