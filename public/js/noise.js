// public/js/noise.js

// This file contains JavaScript versions of the GLSL noise functions
// from shaders.js, allowing us to calculate terrain elevation on the CPU.

function random(st) {
    const x = Math.sin(st[0] * 12.9898 + st[1] * 78.233) * 43758.5453123;
    return x - Math.floor(x);
}

function valueNoise(p, seed) {
    const i = p.map(val => Math.floor(val + seed * 0.123));
    let f = p.map(val => (val + seed * 0.123) - Math.floor(val + seed * 0.123));
    f = f.map(val => val * val * (3.0 - 2.0 * val)); // Smoothstep

    const c000 = random([i[0], i[1]]        .map(v => v + i[2] * 0.37));
    const c100 = random([i[0] + 1, i[1]]    .map(v => v + i[2] * 0.37));
    const c010 = random([i[0], i[1] + 1]    .map(v => v + i[2] * 0.37));
    const c110 = random([i[0] + 1, i[1] + 1].map(v => v + i[2] * 0.37));

    const c001 = random([i[0], i[1]]        .map(v => v + (i[2] + 1) * 0.37));
    const c101 = random([i[0] + 1, i[1]]    .map(v => v + (i[2] + 1) * 0.37));
    const c011 = random([i[0], i[1] + 1]    .map(v => v + (i[2] + 1) * 0.37));
    const c111 = random([i[0] + 1, i[1] + 1].map(v => v + (i[2] + 1) * 0.37));

    const mix = (a, b, t) => a * (1 - t) + b * t;
    
    const u00 = mix(c000, c100, f[0]);
    const u01 = mix(c001, c101, f[0]);
    const u10 = mix(c010, c110, f[0]);
    const u11 = mix(c011, c111, f[0]);

    const v0 = mix(u00, u10, f[1]);
    const v1 = mix(u01, u11, f[1]);

    return mix(v0, v1, f[2]);
}

function layeredNoise(p, seed, octaves, persistence, lacunarity, scale) {
    let total = 0.0;
    let frequency = scale;
    let amplitude = 1.0;
    let maxValue = 0.0;

    for (let i = 0; i < octaves; i++) {
        total += valueNoise(p.map(val => val * frequency + seed * (i * 1.712)), seed * 12.345 * (i + 1) * 0.931) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
    }
    return maxValue === 0.0 ? 0.0 : total / maxValue;
}

export function getPlanetElevation(position, planetData) {
    const { continentSeed, minTerrainHeight, maxTerrainHeight } = planetData;
    const p_normalized = position; 
    const noiseInputPosition = p_normalized.map((val, i) => val + (continentSeed * 10.0));

    const continentShape = (layeredNoise(noiseInputPosition, continentSeed, 5, 0.5, 2.0, 1.5) + 1.0) * 0.5;
    const continentMask = continentShape > 0.5 ? 1.0 : 0.0;
    
    const mountainNoise = (layeredNoise(noiseInputPosition, continentSeed * 2.0, 6, 0.45, 2.2, 8.0) + 1.0) * 0.5;
    const islandNoise = (layeredNoise(noiseInputPosition, continentSeed * 3.0, 7, 0.5, 2.5, 18.0) + 1.0) * 0.5;

    const oceanMask = 1.0 - continentMask;

    let finalElevation = continentShape 
        + (mountainNoise * continentMask * 0.3) 
        + (islandNoise * oceanMask * 0.1);

    finalElevation = finalElevation - 0.5; // Center around 0

    const terrainRange = maxTerrainHeight - minTerrainHeight;
    return finalElevation * terrainRange + minTerrainHeight;
}
