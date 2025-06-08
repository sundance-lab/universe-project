// public/js/shaders.js

const glslRandom2to1 = `
float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}
`;

const glslSimpleValueNoise3D = `
// Depends on: glslRandom2to1
float valueNoise(vec3 p, float seed) {
  vec3 i = floor(p + seed * 0.123);
  vec3 f = fract(p + seed * 0.123);
  f = f * f * (3.0 - 2.0 * f); // Smoothstep interpolation

  // Hash the integer coordinates to get pseudo-random values at the corners of the cube
  float c000 = random(i.xy + i.z * 0.37);
  float c100 = random(i.xy + vec2(1.0, 0.0) + i.z * 0.37);
  float c010 = random(i.xy + vec2(0.0, 1.0) + i.z * 0.37);
  float c110 = random(i.xy + vec2(1.0, 1.0) + i.z * 0.37);
  float c001 = random(i.xy + (i.z + 1.0) * 0.37);
  float c101 = random(i.xy + vec2(1.0, 0.0) + (i.z + 1.0) * 0.37);
  float c011 = random(i.xy + vec2(0.0, 1.0) + (i.z + 1.0) * 0.37);
  float c111 = random(i.xy + vec2(1.0, 1.0) + (i.z + 1.0) * 0.37);

  // Trilinear interpolation
  float u00 = mix(c000, c100, f.x);
  float u01 = mix(c001, c101, f.x);
  float u10 = mix(c010, c110, f.x);
  float u11 = mix(c011, c111, f.x);
  float v0 = mix(u00, u10, f.y);
  float v1 = mix(u01, u11, f.y);
  return mix(v0, v1, f.z);
}
`;

const planetVertexShaderSource = `
uniform float uContinentSeed;
uniform float uSphereRadius;
uniform float uDisplacementAmount;
uniform float uRiverBasin;

varying vec3 vNormal;
varying float vElevation;
varying vec3 vWorldPosition;
varying float vRiverValue;

// Helper function for creating fractal noise (Fractional Brownian Motion)
float layeredNoise(vec3 p, float seed, int octaves, float persistence, float lacunarity, float scale) {
  float total = 0.0;
  float frequency = scale;
  float amplitude = 1.0;
  float maxValue = 0.0;
  for (int i = 0; i < octaves; i++) {
    total += valueNoise(p * frequency + seed * float(i) * 1.712, seed * 12.345 * float(i+1) * 0.931) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  if (maxValue == 0.0) return 0.0;
  return total / maxValue;
}

// Ridged noise is great for things like rivers or cracks.
// It inverts the noise and takes the power to create sharp valleys.
float ridgedRiverNoise(vec3 p, float seed) {
  float n = layeredNoise(p, seed, 6, 0.5, 2.0, 1.0);
  return pow(1.0 - abs(n), 4.0);
}

void main() {
  vec3 p = position;
  vec3 noiseInputPosition = (p / uSphereRadius) + (uContinentSeed * 10.0);

  // Layer 1: Base continent shape
  float continentShape = (layeredNoise(noiseInputPosition, uContinentSeed, 5, 0.5, 2.0, 1.5) + 1.0) * 0.5;
  float continentMask = smoothstep(0.49, 0.51, continentShape); // Soft edge for continent

  // Layer 2: Rivers
  float riverRaw = ridgedRiverNoise(noiseInputPosition * 0.2, uContinentSeed * 5.0);
  float riverBed = smoothstep(1.0 - uRiverBasin, 1.0, riverRaw);
  // Ensure rivers are only visible on land and not too close to the continent edge
  float riverMask = smoothstep(0.48, 0.52, continentMask) * (1.0 - smoothstep(0.75, 0.8, continentMask));
  vRiverValue = riverBed * riverMask;

  // Layer 3: Mountains and small islands
  float mountainNoise = (layeredNoise(noiseInputPosition, uContinentSeed*2.0, 6, 0.45, 2.2, 8.0) + 1.0) * 0.5;
  float islandNoise = (layeredNoise(noiseInputPosition, uContinentSeed * 3.0, 7, 0.5, 2.5, 18.0) + 1.0) * 0.5;
  float oceanMask = 1.0 - continentMask;

  // Combine layers into final elevation
  float finalElevation = continentShape
       + (mountainNoise * continentMask * 0.3) // Add mountains on top of the continent
       + (islandNoise * oceanMask * 0.1);     // Add small islands in the ocean

  // Carve rivers into the final elevation
  finalElevation -= vRiverValue * 0.04; // River depth factor

  // Center the generated noise around 0.0 to make sea level control more intuitive
  finalElevation = finalElevation - 0.5;

  vElevation = finalElevation; // Pass raw elevation to fragment shader for flexible biome mapping

  // Displace the vertex along its normal
  float displacement = vElevation * uDisplacementAmount;
  vec3 displacedPosition = p + normal * displacement;

  // Standard varyings and position calculation
  vNormal = normal;
  vWorldPosition = (modelMatrix * vec4(displacedPosition, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
}
`;

const planetFragmentShaderSource = `
uniform vec3 uLandColor;
uniform vec3 uWaterColor;
uniform float uOceanHeightLevel;
uniform float uContinentSeed;
uniform float uForestDensity;

varying vec3 vNormal;
varying float vElevation;
varying vec3 vWorldPosition;
varying float vRiverValue;

// Standard Blinn-Phong lighting model
vec3 calculateLighting(vec3 surfaceColor, vec3 normalVec, vec3 viewDir) {
  vec3 lightColor = vec3(1.0, 1.0, 0.95);
  float ambientStrength = 0.25;
  float diffuseStrength = 0.7;
  float specularStrength = 0.3;
  float shininess = 16.0;

  vec3 lightDirection = normalize(vec3(0.8, 0.6, 1.0));
  vec3 ambient = ambientStrength * lightColor;
  vec3 norm = normalize(normalVec);
  float diff = max(dot(norm, lightDirection), 0.0);
  vec3 diffuse = diffuseStrength * diff * lightColor;
  vec3 reflectDir = reflect(-lightDirection, norm);
  float spec = pow(max(dot(viewDir, reflectDir), 0.0), shininess);
  vec3 specular = specularStrength * spec * lightColor;
  return (ambient + diffuse + specular) * surfaceColor;
}

void main() {
  vec3 finalColor;

  // Define base biome colors
  vec3 waterColor = uWaterColor;
  vec3 beachColor = uLandColor * 1.1 + vec3(0.1, 0.1, 0.0); // Slightly brighter and yellower
  vec3 plainsColor = uLandColor;
  vec3 forestColor = uLandColor * 0.65;
  vec3 mountainColor = uLandColor * 0.9 + vec3(0.05); // Slightly desaturated and gray
  vec3 snowColor = vec3(0.9, 0.9, 1.0);

  // REFACTORED BIOME LOGIC:
  // This logic works regardless of where the ocean level is set.
  float landMassRange = 1.0 - uOceanHeightLevel;

  if (vElevation < uOceanHeightLevel) {
    finalColor = waterColor;
  } else {
    // Calculate landRatio: A stable 0.0-1.0 value representing elevation above the sea.
    // 0.0 = shoreline, 1.0 = highest peak.
    float landRatio = max(0.0, (vElevation - uOceanHeightLevel) / landMassRange);

    // Define biome thresholds based on the landRatio (as percentages of land height)
    const float BEACH_END = 0.02;
    const float PLAINS_END = 0.40;
    const float MOUNTAIN_START = 0.60;
    const float SNOW_START = 0.85;

    // Determine the base biome color
    if (landRatio < BEACH_END) {
        finalColor = mix(plainsColor, beachColor, smoothstep(BEACH_END, 0.0, landRatio));
    } else if (landRatio < PLAINS_END) {
        finalColor = plainsColor;
    } else if (landRatio < MOUNTAIN_START) {
        finalColor = mix(plainsColor, mountainColor, smoothstep(PLAINS_END, MOUNTAIN_START, landRatio));
    } else if (landRatio < SNOW_START) {
        finalColor = mountainColor;
    } else {
        finalColor = mix(mountainColor, snowColor, smoothstep(SNOW_START, 1.0, landRatio));
    }

    // Add forests on top of the base biome color
    // Forests should appear on plains and low mountains, but not on beaches or high snowy peaks.
    if (landRatio > BEACH_END && landRatio < SNOW_START) {
        float forestNoise = valueNoise(vWorldPosition * 25.0, uContinentSeed * 4.0);
        float forestMask = smoothstep(1.0 - uForestDensity, 1.0 - uForestDensity + 0.1, forestNoise);
        finalColor = mix(finalColor, forestColor, forestMask);
    }
  }

  // Carve rivers into the final land color
  if (vRiverValue > 0.1 && vElevation > uOceanHeightLevel) {
      finalColor = mix(finalColor, waterColor * 0.9, vRiverValue);
  }

  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
  gl_FragColor = vec4(calculateLighting(finalColor, vNormal, viewDirection), 1.0);
}
`;

export function getPlanetShaders() {
  const noiseFunctions = glslRandom2to1 + glslSimpleValueNoise3D;

  return {
    vertexShader: noiseFunctions + planetVertexShaderSource,
    fragmentShader: noiseFunctions + planetFragmentShaderSource
  };
}
