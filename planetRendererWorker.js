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
  let currentSeedState = this.seed;
  const seededRandom = () => {
   currentSeedState = (currentSeedState * 1664525 + 1013904223) % 4294967296;
   return currentSeedState / 4294967296;
  };
  for (let i = 255; i > 0; i--) { 
   let r = Math.floor(seededRandom() * (i + 1));
   let tmp = this.permutation[i];
   this.permutation[i] = this.permutation[r];
   this.permutation[r] = tmp;
  }
  for (let i = 0; i < 256; i++) {
   this.p[i] = this.p[i + 256] = this.permutation[i];
  }
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
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  let u = this.fade(x); let v = this.fade(y); let w = this.fade(z);
  let A = this.p[floorX] + floorY, AA = this.p[A] + floorZ, AB = this.p[A + 1] + floorZ;
  let B = this.p[floorX + 1] + floorY, BA = this.p[B] + floorZ, BB = this.p[B + 1] + floorZ;
  return this.lerp(
   this.lerp(
    this.lerp(this.grad(this.p[AA], x, y, z), this.grad(this.p[BA], x - 1, y, z), u),
    this.lerp(this.grad(this.p[AB], x, y - 1, z), this.grad(this.p[BB], x - 1, y - 1, z), u), v),
   this.lerp(
    this.lerp(this.grad(this.p[AA + 1], x, y, z - 1), this.grad(this.p[BA + 1], x - 1, y, z - 1), u),
    this.lerp(this.grad(this.p[AB + 1], x, y - 1, z - 1), this.grad(this.p[BB + 1], x - 1, y - 1, z - 1), u), v), w);
 }
 fractalNoise(x, y, z, octaves = 4, persistence = 0.5, lacunarity = 2.0) {
  let total = 0; let frequency = 1; let amplitude = 1; let maxValue = 0;
  for (let i = 0; i < octaves; i++) {
   total += this.noise(x * frequency, y * frequency, z * frequency) * amplitude;
   maxValue += amplitude; amplitude *= persistence; frequency *= lacunarity;
  }
  return maxValue === 0 ? 0 : total / maxValue;
 }
}

function quat_rotate_vector(q, v) {
  // Added const for variable declarations
  const x = v[0], y = v[1], z = v[2];
  const qw = q[0], qx = q[1], qy = q[2], qz = q[3];
  const tx = qw * x + qy * z - qz * y;
  const ty = qw * y + qz * x - qx * z;
  const tz = qw * z + qx * y - qy * x;
  const tw = -qx * x - qy * y - qz * z;
  const rx = tx * qw - tw * qx - ty * qz + tz * qy;
  const ry = ty * qw - tw * qy - tz * qx + tx * qz;
  const rz = tz * qw - tw * qz - tx * qy + ty * qx;
  return [rx, ry, rz];
}

function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string' || hex.length < 7 || hex[0] !== '#') {
    return { r: 0, g: 0, b: 0 };
  }
  // Added const for variable declarations
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return { r: 0, g: 0, b: 0 };
  }
  return { r, g, b };
}

const noiseCache = new Map(); // Added const

self.onmessage = function(e) {
  // Added const for destructuring
  const { cmd, planetData, rotationQuaternion, canvasWidth, canvasHeight, senderId, planetRadiusOverride } = e.data;

  if (cmd === 'preloadPlanet') {
    const noiseKey = planetData.continentSeed.toString(); // Added const
    if (!noiseCache.has(noiseKey)) {
      noiseCache.set(noiseKey, new PerlinNoise(planetData.continentSeed));
    }
    return;
  }

  if (cmd === 'renderPlanet') {
    if (!planetData || !rotationQuaternion || !canvasWidth || !canvasHeight) {
      console.error("Worker: Incomplete data for renderPlanet command", e.data);
      // Consider sending an error message back if main thread expects a response
      self.postMessage({ error: "Incomplete data for renderPlanet", senderId: senderId });
      return;
    }

    const planetRadius = planetRadiusOverride || Math.min(canvasWidth, canvasHeight) / 2 * 0.9;
    if (planetRadius <= 0) {
      console.error("Worker: Planet radius is zero or negative. Aborting.");
      const emptyImageDataBuffer = new ArrayBuffer(canvasWidth * canvasHeight * 4);
      self.postMessage({ 
          renderedData: emptyImageDataBuffer, 
          width: canvasWidth, 
          height: canvasHeight, 
          senderId: senderId,
          error: "Invalid planet radius"
      }, [emptyImageDataBuffer]);
      return;
    }

    const imageDataBuffer = new ArrayBuffer(canvasWidth * canvasHeight * 4);
    const imageDataArray = new Uint8ClampedArray(imageDataBuffer);
    const zBuffer = new Float32Array(canvasWidth * canvasHeight);
    zBuffer.fill(Infinity); // Standard Z-buffer initialization: smaller values are closer implicitly

    const waterRgb = hexToRgb(planetData.waterColor);
    const landColorRgb = hexToRgb(planetData.landColor);

    const noiseKey = planetData.continentSeed.toString();
    let perlin;
    if (noiseCache.has(noiseKey)) { 
      perlin = noiseCache.get(noiseKey); 
    } else { 
      perlin = new PerlinNoise(planetData.continentSeed); 
      noiseCache.set(noiseKey, perlin); 
    }

    const invRotationQuaternion = [rotationQuaternion[0], -rotationQuaternion[1], -rotationQuaternion[2], -rotationQuaternion[3]];
    const planetCenter_x = canvasWidth / 2;
    const planetCenter_y = canvasHeight / 2;

    const waterNoiseScale = 5.0, waterNoiseOctaves = 3, waterNoisePersistence = 0.4, waterBrightnessVariation = 0.15;

    for (let j = 0; j < canvasHeight; j++) {
      for (let i = 0; i < canvasWidth; i++) {
        const x_canvas = i - planetCenter_x;
        const y_canvas = j - planetCenter_y;
        const dist_sq = x_canvas * x_canvas + y_canvas * y_canvas;

        if (dist_sq <= planetRadius * planetRadius) {
          const z_sphere_view = Math.sqrt(planetRadius * planetRadius - dist_sq); // "Bulge" amount
          
          // Normalize point on sphere for noise sampling
          // temp_vec_norm will be planetRadius
          // const temp_vec_norm = Math.sqrt(x_canvas*x_canvas + y_canvas*y_canvas + z_sphere_view*z_sphere_view);
          // The division by planetRadius is more direct here:
          const temp_vec = [x_canvas / planetRadius, y_canvas / planetRadius, z_sphere_view / planetRadius];
          
          const local_vec = quat_rotate_vector(invRotationQuaternion, temp_vec);
          const noise_x = local_vec[0], noise_y = local_vec[1], noise_z = local_vec[2];

          const baseContinentNoise01 = (perlin.fractalNoise(noise_x * 0.8, noise_y * 0.8, noise_z * 0.8, 3, 0.6, 2.0) + 1) / 2;
          const mountainDetailNoise01 = (perlin.fractalNoise(noise_x * 3.5, noise_y * 3.5, noise_z * 3.5, 4, 0.4, 2.2) + 1) / 2;

          let normalizedHeight01 = baseContinentNoise01;
          normalizedHeight01 = normalizedHeight01 + (mountainDetailNoise01 - 0.5) * 0.4 * baseContinentNoise01;
          normalizedHeight01 = Math.max(0, Math.min(1, normalizedHeight01));

          const currentPointHeight = planetData.minTerrainHeight + normalizedHeight01 * (planetData.maxTerrainHeight - planetData.minTerrainHeight);

          let r, g, b; // These will be populated by the coloring logic below
          if (currentPointHeight <= planetData.oceanHeightLevel) { // WATER
            const waterPattern01 = (perlin.fractalNoise(noise_x * waterNoiseScale, noise_y * waterNoiseScale, noise_z * waterNoiseScale, waterNoiseOctaves, waterNoisePersistence, 2.0) + 1) / 2;
            const brightnessMod = 1.0 - waterBrightnessVariation + (waterPattern01 * waterBrightnessVariation * 2.0);
            r = Math.max(0, Math.min(255, waterRgb.r * brightnessMod));
            g = Math.max(0, Math.min(255, waterRgb.g * brightnessMod));
            b = Math.max(0, Math.min(255, waterRgb.b * brightnessMod));
          } else { // LAND
            const fullTerrainRange = planetData.maxTerrainHeight - planetData.minTerrainHeight;
            let generalLightingFactor = 0.65; 
            if (fullTerrainRange > 0.001) {
              generalLightingFactor += ((currentPointHeight - planetData.minTerrainHeight) / fullTerrainRange) * 0.35;
            }
            generalLightingFactor = Math.max(0.6, Math.min(1.0, generalLightingFactor));

            const mountainTextureStrength = 0.3;
            let mountainColorFactor = 1.0 + (mountainDetailNoise01 - 0.5) * 2.0 * mountainTextureStrength; 
            mountainColorFactor = Math.max(1.0 - mountainTextureStrength, Math.min(1.0 + mountainTextureStrength, mountainColorFactor));

            r = Math.max(0, Math.min(255, landColorRgb.r * mountainColorFactor * generalLightingFactor));
            g = Math.max(0, Math.min(255, landColorRgb.g * mountainColorFactor * generalLightingFactor));
            b = Math.max(0, Math.min(255, landColorRgb.b * mountainColorFactor * generalLightingFactor));
          }

          // *** CORRECTED Z-BUFFER LOGIC HERE ***
          // depth: 0 at center (closest), planetRadius at edge (furthest visible front)
          const depth = planetRadius - z_sphere_view; 

          const bufferIndex = (j * canvasWidth + i);
          if (depth < zBuffer[bufferIndex]) { // If current pixel's depth is less than (closer than) stored depth
            zBuffer[bufferIndex] = depth;      // Update zBuffer with new closer depth
            const dataIndex = bufferIndex * 4;
            imageDataArray[dataIndex] = r;
            imageDataArray[dataIndex + 1] = g;
            imageDataArray[dataIndex + 2] = b;
            imageDataArray[dataIndex + 3] = 255; // Alpha
          }
        } else {
            // Optional: Fill background pixels with transparent if canvas is not pre-cleared
            // const dataIndex = (j * canvasWidth + i) * 4;
            // imageDataArray[dataIndex + 3] = 0; // Alpha 0 for transparent
        }
      }
    }
    self.postMessage({
      renderedData: imageDataArray.buffer,
      width: canvasWidth,
      height: canvasHeight,
      senderId: senderId
    }, [imageDataArray.buffer]);
  }
};
