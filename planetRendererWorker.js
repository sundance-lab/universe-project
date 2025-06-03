// planetRendererWorker.js

// --- Quaternion Math Utilities (Shared with script.js) ---
/**
 * Represents a quaternion as [w, x, y, z]
 */

// Identity quaternion (no rotation)
function quat_identity() {
    return [1, 0, 0, 0];
}

// Create a quaternion from an axis and an angle (radians)
function quat_from_axis_angle(axis, angle) {
    const halfAngle = angle * 0.5;
    const s = Math.sin(halfAngle);
    return [
        Math.cos(halfAngle), // w
        axis[0] * s,         // x
        axis[1] * s,         // y
        axis[2] * s          // z
    ];
}

// Multiply two quaternions: q1 * q2
function quat_multiply(q1, q2) {
    const w1 = q1[0], x1 = q1[1], y1 = q1[2], z1 = q1[3];
    const w2 = q2[0], x2 = q2[1], y2 = q2[2], z2 = q2[3];

    return [
        w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2, // w
        w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2, // x
        w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2, // y
        w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2  // z
    ];
}

// Normalize a quaternion
function quat_normalize(q) {
    let len_sq = q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3];
    if (len_sq === 0) return [1, 0, 0, 0]; // Return identity if zero length
    let len = 1 / Math.sqrt(len_sq);
    return [q[0] * len, q[1] * len, q[2] * len, q[3] * len];
}

// Rotate a 3D vector [vx, vy, vz] by a quaternion [w, x, y, z]
// This performs the operation v' = q * v_pure * q_inverse
function quat_rotate_vector(q, v) {
    const q_w = q[0];
    const q_x = q[1];
    const q_y = q[2];
    const q_z = q[3];

    const v_x = v[0];
    const v_y = v[1];
    const v_z = v[2];

    // Simplified version of q * [0,v] * q_inv
    // t = 2 * cross(q_vec, v_vec) + 2 * q_w * v_vec
    // v_rot = v_vec + cross(q_vec, t)
    const t_x = 2 * (q_w * v_x + q_y * v_z - q_z * v_y);
    const t_y = 2 * (q_w * v_y + q_z * v_x - q_x * v_z);
    const t_z = 2 * (q_w * v_z + q_x * v_y - q_y * v_x);

    const rot_x = v_x + (q_y * t_z - q_z * t_y);
    const rot_y = v_y + (q_z * t_x - q_x * t_z);
    const rot_z = v_z + (q_x * t_y - q_y * t_x);
    
    return [rot_x, rot_y, rot_z];
}


// --- End Quaternion Math Utilities ---


// PerlinNoise class (unchanged from main script)
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
    return total / maxValue;
  }
}

// hexToRgb function (unchanged from main script)
function hexToRgb(hex) {
  const bigint = parseInt(hex.slice(1), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return [r, g, b, 255];
}

// Modified to return ImageData directly, using OffscreenCanvas
function createContinentTextureInternal(waterColorHex, landColorHex, seed, textureSize = 512, octaves = 6, persistence = 0.5, scale = 1.0) {
  // OffscreenCanvas is used internally in the worker
  const canvas = new OffscreenCanvas(textureSize * 2, textureSize);
  const ctx = canvas.getContext('2d');
  const noiseGen = new PerlinNoise(seed);

  const waterRgb = hexToRgb(waterColorHex);
  const landRgb = hexToRgb(landColorHex);

  const imageData = ctx.createImageData(canvas.width, canvas.height);
  const data = imageData.data;

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const lat = (y / canvas.height) * Math.PI;
      const lon = (x / canvas.width) * 2 * Math.PI;

      const nx = Math.sin(lat) * Math.cos(lon) * scale;
      const ny = Math.cos(lat) * scale;
      const nz = Math.sin(lat) * Math.sin(lon) * scale;

      let noiseValue = noiseGen.fractalNoise(nx, ny, nz, octaves, persistence);
      noiseValue = (noiseValue + 1) / 2; // Normalize to 0-1

      const threshold = 0.5; // Arbitrary threshold for land/water
      let pixelR, pixelG, pixelB;

      if (noiseValue > threshold) {
        pixelR = landRgb[0];
        pixelG = landRgb[1];
        pixelB = landRgb[2];
      } else {
        pixelR = waterRgb[0];
        pixelG = waterRgb[1];
        pixelB = waterRgb[2];
      }

      const index = (y * canvas.width + x) * 4;
      data[index] = pixelR;
      data[index + 1] = pixelG;
      data[index + 2] = pixelB;
      data[index + 3] = 255; // Alpha
    }
  }
  return imageData; // Return ImageData directly
}

// Modified to return ImageData directly, using OffscreenCanvas
function createOutlineTextureInternal(waterColorHex, landColorHex, seed, textureSize = 512, octaves = 6, persistence = 0.5, scale = 1.0) {
  const canvas = new OffscreenCanvas(textureSize * 2, textureSize);
  const ctx = canvas.getContext('2d');
  const noiseGen = new PerlinNoise(seed);

  const waterThreshold = 0.5;
  const neighborCheckDistance = 0.01;

  const imageData = ctx.createImageData(canvas.width, canvas.height);
  const data = imageData.data;

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const lat = (y / canvas.height) * Math.PI;
      const lon = (x / canvas.width) * 2 * Math.PI;

      const nx = Math.sin(lat) * Math.cos(lon) * scale;
      const ny = Math.cos(lat) * scale;
      const nz = Math.sin(lat) * Math.sin(lon) * scale;

      let baseNoise = (noiseGen.fractalNoise(nx, ny, nz, octaves, persistence) + 1) / 2;
      let isBoundary = false;

      const checkPoints = [
        { dl: neighborCheckDistance, dlo: 0 },
        { dl: -neighborCheckDistance, dlo: 0 },
        { dl: 0, dlo: neighborCheckDistance },
        { dl: 0, dlo: -neighborCheckDistance }
      ];

      for (const { dl, dlo } of checkPoints) {
        let neighborLat = lat + dl;
        let neighborLon = lon + dlo;

        neighborLat = Math.max(0, Math.min(Math.PI, neighborLat));
        neighborLon = (neighborLon + 2 * Math.PI) % (2 * Math.PI);

        const neighborNx = Math.sin(neighborLat) * Math.cos(neighborLon) * scale;
        const neighborNy = Math.cos(neighborLat) * scale;
        const neighborNz = Math.sin(neighborLat) * Math.sin(neighborLon) * scale;

        let neighborNoise = (noiseGen.fractalNoise(neighborNx, neighborNy, neighborNz, octaves, persistence) + 1) / 2;

        const baseIsLand = baseNoise > waterThreshold;
        const neighborIsLand = neighborNoise > waterThreshold;

        if (baseIsLand !== neighborIsLand) {
          isBoundary = true;
          break;
        }
      }

      const index = (y * canvas.width + x) * 4;
      if (isBoundary) {
        data[index] = 255; // White outline
        data[index + 1] = 255;
        data[index + 2] = 255;
        data[index + 3] = 255; // Opaque
      } else {
        data[index] = 0;
        data[index + 1] = 0;
        data[index + 2] = 0;
        data[index + 3] = 0; // Transparent
      }
    }
  }
  return imageData; // Return ImageData directly
}

// Worker's internal cache for textures
let cachedContinentTexture = null;
let cachedOutlineTexture = null;
let cachedPlanetParams = { waterColor: null, landColor: null, continentSeed: null };

self.onmessage = function(e) {
  // Receive the quaternion explicitly
  const { cmd, planetData, rotationQuaternion, canvasWidth, canvasHeight, senderId } = e.data;

  if (cmd === 'renderPlanet' || cmd === 'preloadPlanet') {
    const tempCanvas = new OffscreenCanvas(canvasWidth, canvasHeight);
    const ctx = tempCanvas.getContext('2d');

    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    const radius = Math.min(canvasWidth, canvasHeight) * 0.4; // Max radius for the planet

    const currentWaterColor = planetData.waterColor;
    const currentLandColor = planetData.landColor;
    const currentContinentSeed = planetData.continentSeed;

    if (cachedContinentTexture === null ||
      cachedPlanetParams.waterColor !== currentWaterColor ||
      cachedPlanetParams.landColor !== currentLandColor ||
      cachedPlanetParams.continentSeed !== currentContinentSeed) {

      cachedContinentTexture = createContinentTextureInternal(currentWaterColor, currentLandColor, currentContinentSeed);
      cachedOutlineTexture = createOutlineTextureInternal(currentWaterColor, currentLandColor, currentContinentSeed);
      cachedPlanetParams = { waterColor: currentWaterColor, landColor: currentLandColor, continentSeed: currentContinentSeed };
    }

    const textureData = cachedContinentTexture;
    const outlineTextureData = cachedOutlineTexture;

    const textureWidth = textureData.width;
    const textureHeight = textureData.height;

    // Lighting definition (fixed relative to camera/sphere)
    const lightSourceLongitude = Math.PI / 4;
    const lightSourceLatitude = Math.PI / 8;
    // Light vector in camera space
    const lightVecX = Math.cos(lightSourceLatitude) * Math.sin(lightSourceLongitude);
    const lightVecY = Math.sin(lightSourceLatitude);
    const lightVecZ = Math.cos(lightSourceLatitude) * Math.cos(lightSourceLongitude);
    // Light vector in camera space (normalized, since it's a direction)
    const lightVectorCameraSpace = quat_normalize([0, lightVecX, lightVecY, lightVecZ]); 

    const resultImageData = ctx.createImageData(canvasWidth, canvasHeight);
    const resultData = resultImageData.data;

    for (let y = 0; y < canvasHeight; y++) {
      for (let x = 0; x < canvasWidth; x++) {
        const x_cam = (x - centerX) / radius;
        const y_cam = (y - centerY) / radius;

        if (x_cam * x_cam + y_cam * y_cam > 1) {
          const idx = (y * canvasWidth + x) * 4;
          resultData[idx] = 0;
          resultData[idx + 1] = 0;
          resultData[idx + 2] = 0;
          resultData[idx + 3] = 0; // Fully transparent
          continue;
        }

        const z_cam = Math.sqrt(1 - x_cam * x_cam - y_cam * y_cam);

        // Point on the sphere in camera space (normalized vector from origin)
        const pointInCameraSpace = [x_cam, y_cam, z_cam];
        
        // Apply the INVERSE of the planet's rotation to get coordinates in texture space (static original sphere)
        // If the planet has been rotated by Q, then to find which point on the texture corresponds to a given
        // camera-space coordinate, we need to counter-rotate the camera-space coordinate by Q_inverse.
        const inverseRotationQuaternion = quat_normalize([rotationQuaternion[0], -rotationQuaternion[1], -rotationQuaternion[2], -rotationQuaternion[3]]);
        const pointInTextureSpace = quat_rotate_vector(inverseRotationQuaternion, pointInCameraSpace);

        // Convert texture space Cartesian coordinates back to spherical for texture lookup
        const x_tex = pointInTextureSpace[0];
        const y_tex = pointInTextureSpace[1];
        const z_tex = pointInTextureSpace[2];

        // Ensure y_tex is clamped to [-1, 1] for acos precision issues, as it can occasionally go slightly out of bounds due to float precision
        let phi_tex = Math.acos(Math.max(-1, Math.min(1, y_tex)));
        let theta_tex = Math.atan2(x_tex, z_tex); // atan2(x, z) because x is horizontal, z is "depth" on texture sphere if y is up
        theta_tex = (theta_tex + 2 * Math.PI) % (2 * Math.PI); // Ensure positive angle [0, 2PI)

        let texU = theta_tex / (2 * Math.PI);
        let texV = phi_tex / Math.PI;

        let sx = Math.floor(texU * textureWidth);
        let sy = Math.floor(texV * textureHeight);

        sx = Math.max(0, Math.min(textureWidth - 1, sx));
        sy = Math.max(0, Math.min(textureHeight - 1, sy));

        // Get color from continent texture
        const textureIdx = (sy * textureWidth + sx) * 4;
        let r = textureData.data[textureIdx];
        let g = textureData.data[textureIdx + 1];
        let b = textureData.data[textureIdx + 2];
        let a = textureData.data[textureIdx + 3];

        // Apply lighting
        const ambientLight = 0.25;
        const diffuseLight = 0.75;
        
        // The normal vector at this point on the sphere in camera space is simply the point itself.
        // We use the first three components of lightVectorCameraSpace because it was treated as a pure quaternion [0, x, y, z].
        const dotProduct = pointInCameraSpace[0] * lightVectorCameraSpace[1] + 
                           pointInCameraSpace[1] * lightVectorCameraSpace[2] + 
                           pointInCameraSpace[2] * lightVectorCameraSpace[3];

        const lightIntensity = Math.max(0, dotProduct) * diffuseLight + ambientLight;

        r = Math.min(255, r * lightIntensity);
        g = Math.min(255, g * lightIntensity);
        b = Math.min(255, b * lightIntensity);

        // Get outline data
        const outlineIdx = (sy * outlineTextureData.width + sx) * 4;
        const outlineAlpha = outlineTextureData.data[outlineIdx + 3]; // Check alpha channel

        // Write to the result ImageData
        const resultPixelIndex = (y * canvasWidth + x) * 4;
        if (outlineAlpha > 0) { // If outline pixel is not transparent, make it white
          resultData[resultPixelIndex] = 255;
          resultData[resultPixelIndex + 1] = 255;
          resultData[resultPixelIndex + 2] = 255;
          resultData[resultPixelIndex + 3] = 255;
        } else { // Otherwise, use the calculated planet color
          resultData[resultPixelIndex] = r;
          resultData[resultPixelIndex + 1] = g;
          resultData[resultPixelIndex + 2] = b;
          resultData[resultPixelIndex + 3] = a;
        }
      }
    }

    if (senderId !== 'preload') {
      self.postMessage({
        renderedData: resultImageData.data,
        width: canvasWidth,
        height: canvasHeight,
        senderId: senderId
      }, [resultImageData.data.buffer]);
    }
  }
};
