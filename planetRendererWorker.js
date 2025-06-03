// planetRendererWorker.js

class PerlinNoise {
    constructor(seed = Math.random()) {
      this.p = new Array(512);
      this.permutation = new Array(256);
      this.seed = seed;
      this.initPermutationTable();
    }
    initPermutationTable() {
      for (let i = 0; i < 256; i++) {
        this.permutation[i] = i;
      }
      for (let i = 0; i < 256; i++) {
        let r = Math.floor(this.random() * (i + 1));
        let tmp = this.permutation[i];
        this.permutation[i] = this.permutation[r];
        this.permutation[r] = tmp;
      }
      for (let i = 0; i < 256; i++) {
        this.p[i] = this.p[i + 256] = this.permutation[i];
      }
    }
    random() {
      let x = Math.sin(this.seed++) * 10000;
      return x - Math.floor(x);
    }
    fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    lerp(a, b, t) { return a + t * (b - a); }
    grad(hash, x, y, z) {
      hash = hash & 15;
      let u = hash < 8 ? x : y;
      let v = hash < 4 ? y : hash === 12 || hash === 14 ? x : z;
      return ((hash & 1) === 0 ? u : -u) + ((hash & 2) === 0 ? v : -v);
    }
    noise(x, y, z) {
      let floorX = Math.floor(x) & 255;
      let floorY = Math.floor(y) & 255;
      let floorZ = Math.floor(z) & 255;
      x -= Math.floor(x);
      y -= Math.floor(y);
      z -= Math.floor(z);
      let u = this.fade(x);
      let v = this.fade(y);
      let w = this.fade(z);
      let A = this.p[floorX] + floorY;
      let AA = this.p[A] + floorZ;
      let AB = this.p[A + 1] + floorZ;
      let B = this.p[floorX + 1] + floorY;
      let BA = this.p[B] + floorZ;
      let BB = this.p[B + 1] + floorZ;
      return this.lerp(
        this.lerp(
          this.lerp(this.grad(this.p[AA], x, y, z), this.grad(this.p[BA], x - 1, y, z), u),
          this.lerp(this.grad(this.p[AB], x, y - 1, z), this.grad(this.p[BB], x - 1, y - 1, z), u),
          v
        ),
        this.lerp(
          this.lerp(this.grad(this.p[AA + 1], x, y, z - 1), this.grad(this.p[BA + 1], x - 1, y, z - 1), u),
          this.lerp(this.grad(this.p[AB + 1], x, y - 1, z - 1), this.grad(this.p[BB + 1], x - 1, y - 1, z - 1), u),
          v
        ),
        w
      );
    }
     fractalNoise(x, y, z, octaves = 4, persistence = 0.5, lacunarity = 2.0) {
      let total = 0;
      let frequency = 1;
      let amplitude = 1;
      let maxValue = 0;
      for (let i = 0; i < octaves; i++) {
        total += this.noise(x * frequency, y * frequency, z * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
      }
      return maxValue === 0 ? 0 : total / maxValue;
    }
}

function quat_rotate_vector(q, v) {
    const x = v[0], y = v[1], z = v[2];
    const qw = q[0], qx = q[1], qy = q[2], qz = q[3];
    const tx = qw * x + qy * z - qz * y;
    const ty = qw * y + qz * x - qx * z;
    const tz = qw * z + qx * y - qy * x;
    const tw = -qx * x - qy * y - qz * z;
    const rx = tw * -qx + tx * qw + ty * -qz - tz * -qy;
    const ry = tw * -qy + ty * qw + tz * -qx - tx * -qz;
    const rz = tw * -qz + tz * qw + tx * -qy - ty * -qx;
    return [rx, ry, rz];
}

function hexToRgb(hex) {
    if (!hex || typeof hex !== 'string' || hex.length < 6) return { r:0, g:0, b:0};
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}

const noiseCache = new Map();

self.onmessage = function(e) {
    const { cmd, planetData, rotationQuaternion, canvasWidth, canvasHeight, senderId } = e.data;

    if (cmd === 'preloadPlanet') {
        const noiseKey = planetData.continentSeed.toString();
        if (!noiseCache.has(noiseKey)) {
            noiseCache.set(noiseKey, new PerlinNoise(planetData.continentSeed));
        }
        return;
    }

    if (cmd === 'renderPlanet') {
        const planetRadius = Math.min(canvasWidth, canvasHeight) / 2 * 0.9;
        const imageDataBuffer = new ArrayBuffer(canvasWidth * canvasHeight * 4);
        const imageData = new Uint8ClampedArray(imageDataBuffer);
        const zBuffer = new Float32Array(canvasWidth * canvasHeight);
        zBuffer.fill(Infinity);

        const waterRgb = hexToRgb(planetData.waterColor);
        const landRgb = hexToRgb(planetData.landColor);

        const noiseKey = planetData.continentSeed.toString();
        let perlin;
        if (noiseCache.has(noiseKey)) {
            perlin = noiseCache.get(noiseKey);
        } else {
            perlin = new PerlinNoise(planetData.continentSeed);
            noiseCache.set(noiseKey, perlin);
        }
        
        const invRotationQuaternion = [
            rotationQuaternion[0], 
            -rotationQuaternion[1], 
            -rotationQuaternion[2], 
            -rotationQuaternion[3]
        ];

        const planetCenter_x = canvasWidth / 2;
        const planetCenter_y = canvasHeight / 2;

        // Parameters for ocean texture noise
        const waterNoiseScale = 5.0; // Adjust for finer/coarser water texture
        const waterNoiseOctaves = 3;
        const waterNoisePersistence = 0.4;
        const waterBrightnessVariation = 0.15; // How much brightness varies (e.g., 0.1 = 10% variation)

        for (let j = 0; j < canvasHeight; j++) {
            for (let i = 0; i < canvasWidth; i++) {
                const x_canvas = i - planetCenter_x;
                const y_canvas = j - planetCenter_y;

                const dist_sq = x_canvas * x_canvas + y_canvas * y_canvas;

                if (dist_sq <= planetRadius * planetRadius) {
                    const z_sphere_view = Math.sqrt(planetRadius * planetRadius - dist_sq);
                    
                    let view_x = x_canvas / planetRadius;
                    let view_y = y_canvas / planetRadius;
                    let view_z = z_sphere_view / planetRadius;
                    
                    const view_vec_norm = Math.sqrt(view_x * view_x + view_y * view_y + view_z * view_z);
                    if (view_vec_norm === 0) continue;
                    view_x /= view_vec_norm;
                    view_y /= view_vec_norm;
                    view_z /= view_vec_norm;

                    const view_vec = [view_x, view_y, view_z]; 
                    const local_vec = quat_rotate_vector(invRotationQuaternion, view_vec);
                    
                    const noise_x = local_vec[0];
                    const noise_y = local_vec[1];
                    const noise_z = local_vec[2];

                    const baseContinentNoise = (perlin.fractalNoise(noise_x * 0.8, noise_y * 0.8, noise_z * 0.8, 3, 0.6, 2.0) + 1) / 2;
                    const mountainNoise = (perlin.fractalNoise(noise_x * 3.5, noise_y * 3.5, noise_z * 3.5, 4, 0.4, 2.2) + 1) / 2;
                    
                    let normalizedHeight01 = baseContinentNoise;
                    normalizedHeight01 = normalizedHeight01 + (mountainNoise - 0.5) * 0.4 * baseContinentNoise;
                    normalizedHeight01 = Math.max(0, Math.min(1, normalizedHeight01));

                    const currentPointHeight = planetData.minTerrainHeight + normalizedHeight01 * (planetData.maxTerrainHeight - planetData.minTerrainHeight);

                    let r, g, b;
                    if (currentPointHeight <= planetData.oceanHeightLevel) {
                        // Add ocean texture
                        const waterPattern = (perlin.fractalNoise(
                            noise_x * waterNoiseScale, 
                            noise_y * waterNoiseScale, 
                            noise_z * waterNoiseScale, // Static relative to planet surface
                            waterNoiseOctaves, 
                            waterNoisePersistence, 
                            2.0 
                        ) + 1) / 2; // Noise in [0, 1]

                        // Modulate brightness: make it brighter or darker based on pattern
                        // A range of [1 - variation, 1 + variation] might be too much if variation is large
                        // Let's aim for base brightness and modulate slightly up and down.
                        const brightnessMod = 1.0 - waterBrightnessVariation + (waterPattern * waterBrightnessVariation * 2);
                        
                        r = Math.max(0, Math.min(255, waterRgb.r * brightnessMod));
                        g = Math.max(0, Math.min(255, waterRgb.g * brightnessMod));
                        b = Math.max(0, Math.min(255, waterRgb.b * brightnessMod));

                    } else {
                        const heightAboveOcean = currentPointHeight - planetData.oceanHeightLevel;
                        const totalLandHeightRange = planetData.maxTerrainHeight - planetData.oceanHeightLevel;
                        let shadingFactor = 0.7 + (totalLandHeightRange > 0.001 ? (heightAboveOcean / totalLandHeightRange) * 0.3 : 0.15);
                        shadingFactor = Math.max(0.7, Math.min(1.0, shadingFactor)); 
                        
                        r = Math.min(255, landRgb.r * shadingFactor);
                        g = Math.min(255, landRgb.g * shadingFactor);
                        b = Math.min(255, landRgb.b * shadingFactor);
                    }

                    const bufferIndex = (j * canvasWidth + i);
                    if (z_sphere_view < zBuffer[bufferIndex]) { 
                        zBuffer[bufferIndex] = z_sphere_view;
                        const dataIndex = bufferIndex * 4;
                        imageData[dataIndex] = r;
                        imageData[dataIndex + 1] = g;
                        imageData[dataIndex + 2] = b;
                        imageData[dataIndex + 3] = 255;
                    }
                }
            }
        }
        self.postMessage({ renderedData: imageData.buffer, width: canvasWidth, height: canvasHeight, senderId: senderId }, [imageData.buffer]);
    }
};
