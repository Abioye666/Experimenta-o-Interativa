export const Config = {
    dprCap: 2.0,
    sheet: {
        // tamanho relativo da folha
        scale: 0.78,
        // warping por slices (qualidade vs performance)
        slices: 140,
        // curvatura "respiração"
        waveAmp: 34,
        waveFreq: 0.018,
        waveSpeed: 0.85,
        // inclinação / perspectiva fake
        tiltX: 0.18,
        tiltY: -0.10,
        // sombra externa
        dropShadowBlur: 26,
        dropShadowAlpha: 0.38,
    },
    tear: {
        baseWidth: 16,
        speedGain: 0.12,
        maxWidth: 62,
        roughness: 0.9,         // irregularidade da borda
        jitter: 10,             // jitter perpendicular (pixels)
        minPointDist: 3.2,      // distância mínima entre pontos do rasgo
        heal: 0.010,            // 0 = permanente; >0 = "cura" por frame (fade da máscara)
        edgeShadow: 26,         // sombra interna no corte
        edgeHighlight: 0.55,    // filete claro
        edgeStroke: 1.25,
    },
    pointer: {
        tensionRadius: 120,
        tensionStrength: 0.55,  // deformação local (hover/drag)
        dirInertia: 0.25,       // quanto o rasgo “prefere” manter direção
    },
    particles: {
        max: 1800,
        spawnRate: 0.55,     // multiplicador por evento de rasgo
        drag: 0.985,
        gravity: 0.02,
        lifeMin: 22,
        lifeMax: 60,
        sizeMin: 0.6,
        sizeMax: 2.2,
        speed: 1.35,
    },
    colors: {
        bg: "#000000",
        edgeDark: "rgba(0,0,0,0.85)",
        edgeLight: "rgba(255,255,255,0.72)",
        dust: "rgba(255,255,255,0.52)"
    }
};
