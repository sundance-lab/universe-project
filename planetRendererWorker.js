// planetRendererWorker.js
class PerlinNoise {
 constructor(seed = Math.random()) {
  this.p = new Array(512);
  this.permutation = new Array(256);
  this.seed = seed; // Store the original seed
  this.initPermutationTable();
 }

initPermutationTable() {
  for (let i = 0; i < 256; i++) {
   this.permutation[i] = i;
  }

// Fisher-Yates shuffle using a seeded random number generator
  let currentSeedState = this.seed;
  const seededRandom = () => {
    // Simple LCG for seeded random - can be replaced with a more robust one if needed
    currentSeedState = (currentSeedState * 1664525 + 1013904223) % 4294967296;
    return currentSeedState / 4294967296;
  };

for (let i = 255; i > 0; i--) { // Iterate downwards for Fisher-Yates
   let r = Math.floor(seededRandom() * (i + 1));
   let tmp = this.permutation[i];
   this.permutation[i] = this.permutation[r];
   this.permutation[r] = tmp;
  }

for (let i = 0; i < 256; i++) {
   this.p[i] = this.p[i + 256] = this.permutation[i];
  }
 }

// This random() is not used by the primary noise generation, only potentially by initPermutationTable if not using seeded shuffle.
 // random() { 
 //  let x = Math.sin(this.seed++) * 10000; // this.seed here is the original seed, which isn't ideal for repeated calls
 //  return x - Math.floor(x);
 // }

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
 // Simplified calculation for q * v * q_conjugate
 // qv
 const tx = qw * x + qy * z - qz * y;
 const ty = qw * y + qz * x - qx * z;
 const tz = qw * z + qx * y - qy * x;
 const tw = -qx * x - qy * y - qz * z; // Scalar part of qv

// (q*v) * q_conjugate. q_conjugate = [qw, -qx, -qy, -qz]
 const rx = tx * qw - tw * qx - ty * qz + tz * qy;
 const ry = ty * qw - tw * qy - tz * qx + tx * qz;
 const rz = tz * qw - tw * qz - tx * qy + ty * qx;
 return [rx, ry, rz];
}

function hexToRgb(hex) {
 if (!hex || typeof hex !== 'string' || hex.length < 6 || hex[0] !== '#') {
   console.warn("Invalid hex color format:", hex, "Using default black.");
   return { r: 0, g: 0, b: 0 };
 }
 const r = parseInt(hex.slice(1, 3), 16);
 const g = parseInt(hex.slice(3, 5), 16);
 const b = parseInt(hex.slice(5, 7), 16);
 if (isNaN(r) || isNaN(g) || isNaN(b)) {
   console.warn("Failed to parse hex color:", hex, "Using default black.");
   return { r: 0, g: 0, b: 0 };
 }
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
  if (!planetData || !rotationQuaternion || !canvasWidth || !canvasHeight) {
    console.error("Worker: Incomplete data for renderPlanet command", e.data);
    return;
  }
  const planetRadius = Math.min(canvasWidth, canvasHeight) / 2 * 0.9;
  const imageDataBuffer = new ArrayBuffer(canvasWidth * canvasHeight * 4);
  const imageDataArray = new Uint8ClampedArray(imageDataBuffer); // Use 'imageDataArray' to avoid conflict
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
   
  const waterNoiseScale = 5.0;
  const waterNoiseOctaves = 3;
  const waterNoisePersistence = 0.4;
  const waterBrightnessVariation = 0.15;

for (let j = 0; j < canvasHeight; j++) {
   for (let i = 0; i < canvasWidth; i++) {
    const x_canvas = i - planetCenter_x;
    const y_canvas = j - planetCenter_y;
    const dist_sq = x_canvas * x_canvas + y_canvas * y_canvas;

if (dist_sq <= planetRadius * planetRadius) {
     const z_sphere_view = Math.sqrt(planetRadius * planetRadius - dist_sq);
      
     // Normalize canvas coordinates to sphere surface vector in view space
     let view_x = x_canvas / planetRadius;
     let view_y = y_canvas / planetRadius;
     let view_z = z_sphere_view / planetRadius; // This is the depth component on the sphere
      
     // Ensure vector is normalized (though it should be close for points on radius sphere)
     // This step is not strictly necessary if x_canvas/y_canvas/z_sphere_view are relative to planetRadius,
     // as their combined length should be 1. But if planetRadius is just for screen scaling, then normalize.
     // Let's reconstruct so it's definitely from a unit sphere for rotation.
     const ray_x_norm = x_canvas;
     const ray_y_norm = y_canvas;
     const ray_z_norm = z_sphere_view; // This is in view space, looking along Z
      
     const temp_vec = [ray_x_norm / planetRadius, ray_y_norm / planetRadius, ray_z_norm / planetRadius];
     // The vector [temp_vec[0], temp_vec[1], temp_vec[2]] is a point on the surface of a unit sphere in view space, pointing from origin.
     // We want to rotate this point.

const local_vec = quat_rotate_vector(invRotationQuaternion, temp_vec);
      
     const noise_x = local_vec[0];
     const noise_y = local_vec[1];
     const noise_z = local_vec[2];

const baseContinentNoise = (perlin.fractalNoise(noise_x * 0.8, noise_y * 0.8, noise_z * 0.8, 3, 0.6, 2.0) + 1) / 2;
     const mountainNoise = (perlin.fractalNoise(noise_x * 3.5, noise_y * 3.5, noise_z * 3.5, 4, 0.4, 2.2) + 1) / 2;
      
     let normalizedHeight01 = baseContinentNoise;
     normalizedHeight01 = normalizedHeight01 + (mountainNoise - 0.5) * 0.4 * baseContinentNoise; // Add mountain details
     normalizedHeight01 = Math.max(0, Math.min(1, normalizedHeight01)); // Clamp

const currentPointHeight = planetData.minTerrainHeight + normalizedHeight01 * (planetData.maxTerrainHeight - planetData.minTerrainHeight);

let r, g, b;
     if (currentPointHeight <= planetData.oceanHeightLevel) {
      const waterPattern = (perlin.fractalNoise(
       noise_x * waterNoiseScale, noise_y * waterNoiseScale, noise_z * waterNoiseScale,
       waterNoiseOctaves, waterNoisePersistence, 2.0
      ) + 1) / 2;
      const brightnessMod = 1.0 - waterBrightnessVariation + (waterPattern * waterBrightnessVariation * 2);
      r = Math.max(0, Math.min(255, waterRgb.r * brightnessMod));
      g = Math.max(0, Math.min(255, waterRgb.g * brightnessMod));
      b = Math.max(0, Math.min(255, waterRgb.b * brightnessMod));
     } else {
      const heightAboveOcean = currentPointHeight - planetData.oceanHeightLevel;
      const totalLandHeightRange = planetData.maxTerrainHeight - planetData.oceanHeightLevel;
      // Shading: higher points are brighter (lighter shade of land color)
      let shadingFactor = 0.7 + (totalLandHeightRange > 0.001 ? (heightAboveOcean / totalLandHeightRange) * 0.3 : 0.15);
      shadingFactor = Math.max(0.7, Math.min(1.0, shadingFactor)); // Clamp shading
      r = Math.min(255, landRgb.r * shadingFactor);
      g = Math.min(255, landRgb.g * shadingFactor);
      b = Math.min(255, landRgb.b * shadingFactor);
     }

const bufferIndex = (j * canvasWidth + i);
     if (z_sphere_view < zBuffer[bufferIndex]) { // Use z_sphere_view for z-buffering
      zBuffer[bufferIndex] = z_sphere_view;
      const dataIndex = bufferIndex * 4;
      imageDataArray[dataIndex] = r;
      imageDataArray[dataIndex + 1] = g;
      imageDataArray[dataIndex + 2] = b;
      imageDataArray[dataIndex + 3] = 255; // Alpha
     }
    }
   }
  }
  self.postMessage({
   renderedData: imageDataArray.buffer, // Send ArrayBuffer
   width: canvasWidth,
   height: canvasHeight,
   senderId: senderId
  }, [imageDataArray.buffer]); // Transfer ArrayBuffer
 }
};
