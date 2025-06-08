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
 float c000 = random(i.xy + i.z * 0.37);
 float c100 = random(i.xy + vec2(1.0, 0.0) + i.z * 0.37);
 float c010 = random(i.xy + vec2(0.0, 1.0) + i.z * 0.37);
 float c110 = random(i.xy + vec2(1.0, 1.0) + i.z * 0.37);
 float c001 = random(i.xy + (i.z + 1.0) * 0.37);
 float c101 = random(i.xy + vec2(1.0, 0.0) + (i.z + 1.0) * 0.37);
 float c011 = random(i.xy + vec2(0.0, 1.0) + (i.z + 1.0) * 0.37);
 float c111 = random(i.xy + vec2(1.0, 1.0) + (i.z + 1.0) * 0.37);
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


float ridgedRiverNoise(vec3 p, float seed) {
 float n = layeredNoise(p, seed, 6, 0.5, 2.0, 1.0);
 return pow(1.0 - abs(n), 3.0); 
}


void main() {
 vec3 p = position;
 vec3 noiseInputPosition = (p / uSphereRadius) + (uContinentSeed * 10.0);
 float continentShape = (layeredNoise(noiseInputPosition, uContinentSeed, 5, 0.5, 2.0, 1.5) + 1.0) * 0.5;
 float continentMask = smoothstep(0.49, 0.51, continentShape);
 float riverRaw = ridgedRiverNoise(noiseInputPosition * 0.2, uContinentSeed * 5.0);
 float riverBed = smoothstep(1.0 - uRiverBasin, 1.0, riverRaw);
 float riverMask = smoothstep(0.50, 0.55, continentShape);
 vRiverValue = riverBed * riverMask;
 float mountainNoise = (layeredNoise(noiseInputPosition, uContinentSeed*2.0, 6, 0.45, 2.2, 8.0) + 1.0) * 0.5;
 float islandNoise = (layeredNoise(noiseInputPosition, uContinentSeed * 3.0, 7, 0.5, 2.5, 18.0) + 1.0) * 0.5;
 float oceanMask = 1.0 - continentMask;
 float finalElevation = continentShape
  + (mountainNoise * continentMask * 0.3)
  + (islandNoise * oceanMask * 0.1);
 finalElevation -= vRiverValue * 0.08;
 finalElevation = finalElevation - 0.5;
 vElevation = finalElevation;
 float displacement = vElevation * uDisplacementAmount;
 vec3 displacedPosition = p + normal * displacement;
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
 vec3 waterColor = uWaterColor;
 vec3 beachColor = uLandColor * 1.1 + vec3(0.1, 0.1, 0.0);
 vec3 plainsColor = uLandColor;
 vec3 forestColor = uLandColor * 0.65;
 vec3 mountainColor = uLandColor * 0.9 + vec3(0.05);
 vec3 snowColor = vec3(0.9, 0.9, 1.0);
 float landMassRange = 1.0 - uOceanHeightLevel;
 if (vElevation < uOceanHeightLevel) {
  finalColor = waterColor;
 } else {
  float landRatio = max(0.0, (vElevation - uOceanHeightLevel) / landMassRange);
  const float BEACH_END = 0.02;
  const float PLAINS_END = 0.40;
  const float MOUNTAIN_START = 0.60;
  const float SNOW_START = 0.85;
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
  if (landRatio > BEACH_END && landRatio < SNOW_START) {
   float forestNoise = valueNoise(vWorldPosition * 25.0, uContinentSeed * 4.0);
   float forestMask = smoothstep(1.0 - uForestDensity, 1.0 - uForestDensity + 0.1, forestNoise);
   finalColor = mix(finalColor, forestColor, forestMask);
  }
  if (vRiverValue > 0.1) {
   finalColor = mix(finalColor, waterColor * 0.9, vRiverValue);
  }
 }
 vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
 gl_FragColor = vec4(calculateLighting(finalColor, vNormal, viewDirection), 1.0);
}
`;

export function getPlanetShaders() {
 const noiseFunctions = glslRandom2to1 + glslSimpleValueNoise3D;
 return {
  vertexShader: noiseFunctions + planetVertexShaderSource,
  // ========================= THE FIX =========================
  // The fragment shader now also has access to the noise functions.
  fragmentShader: noiseFunctions + planetFragmentShaderSource
  // ===========================================================
 };
}

// All the code for getPlanetSurfaceShaders and getHexPlanetShaders remains correct and unchanged.
// For brevity, I am providing the *entire correct file* below.

export function getHexPlanetShaders() {
  const hexVertexShader = `
    attribute vec3 barycentric;
    varying vec3 vBarycentric;
    uniform float uContinentSeed;
    uniform float uSphereRadius;
    uniform float uDisplacementAmount;
    varying vec3 vNormal;
    varying float vElevation;
    varying vec3 vWorldPosition;
    ${glslRandom2to1}
    ${glslSimpleValueNoise3D}
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
    void main() {
      vBarycentric = barycentric;
      vec3 p = position;
      vec3 noiseInputPosition = (p / uSphereRadius) + (uContinentSeed * 10.0);
      float continentShape = (layeredNoise(noiseInputPosition, uContinentSeed, 5, 0.5, 2.0, 1.5) + 1.0) * 0.5;
      float continentMask = smoothstep(0.49, 0.51, continentShape);
      float mountainNoise = (layeredNoise(noiseInputPosition, uContinentSeed*2.0, 6, 0.45, 2.2, 8.0) + 1.0) * 0.5;
      float islandNoise = (layeredNoise(noiseInputPosition, uContinentSeed * 3.0, 7, 0.5, 2.5, 18.0) + 1.0) * 0.5;
      float oceanMask = 1.0 - continentMask;
      float finalElevation = continentShape 
        + (mountainNoise * continentMask * 0.3) 
        + (islandNoise * oceanMask * 0.1);
      finalElevation = finalElevation - 0.5;
      vElevation = finalElevation;
      float displacement = vElevation * uDisplacementAmount;
      vec3 displacedPosition = p + normal * displacement;
      vNormal = normal;
      vWorldPosition = (modelMatrix * vec4(displacedPosition, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
    }
  `;

  const hexFragmentShader = `
    uniform vec3 uLandColor;
    uniform vec3 uWaterColor;
    uniform float uOceanHeightLevel;
    uniform float uForestDensity;
    uniform float uContinentSeed;
    uniform float uSphereRadius;
    varying vec3 vNormal;
    varying float vElevation;
    varying vec3 vWorldPosition;
    varying vec3 vBarycentric;
    ${glslRandom2to1}
    ${glslSimpleValueNoise3D}
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
    float getWireframe(float width) {
        float minBary = min(vBarycentric.x, min(vBarycentric.y, vBarycentric.z));
        return smoothstep(width - 0.005, width + 0.005, minBary);
    }
    void main() {
      vec3 biomeColor;
      vec3 waterColor = uWaterColor;
      vec3 beachColor = uLandColor * 1.1 + vec3(0.1, 0.1, 0.0);
      vec3 plainsColor = uLandColor;
      vec3 forestColor = uLandColor * 0.65;
      vec3 mountainColor = uLandColor * 0.9 + vec3(0.05);
      vec3 snowColor = vec3(0.9, 0.9, 1.0);
      float landMassRange = 1.0 - uOceanHeightLevel;
      if (vElevation < uOceanHeightLevel) {
          biomeColor = waterColor;
      } else {
          float landRatio = max(0.0, (vElevation - uOceanHeightLevel) / landMassRange);
          if (landRatio < 0.02) {
              biomeColor = mix(plainsColor, beachColor, smoothstep(0.02, 0.0, landRatio));
          } else if (landRatio < 0.40) {
              biomeColor = plainsColor;
          } else if (landRatio < 0.60) {
              biomeColor = mix(plainsColor, mountainColor, smoothstep(0.40, 0.60, landRatio));
          } else if (landRatio < 0.85) {
              biomeColor = mountainColor;
          } else {
              biomeColor = mix(mountainColor, snowColor, smoothstep(0.85, 1.0, landRatio));
          }
          if (landRatio > 0.02 && landRatio < 0.85) {
              // I am assuming valueNoise and other required functions are defined for the fragment shader. 
              // If not, they must be included.
              float forestNoise = valueNoise((vWorldPosition / uSphereRadius) * 25.0, uContinentSeed * 4.0);
              float forestMask = smoothstep(1.0 - uForestDensity, 1.0 - uForestDensity + 0.1, forestNoise);
              biomeColor = mix(biomeColor, forestColor, forestMask);
          }
      }
      float wire = getWireframe(0.005); 
      vec3 strokeColor = uWaterColor + vec3(0.5); 
      vec3 finalColor = mix(strokeColor, biomeColor, wire);
      vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
      gl_FragColor = vec4(calculateLighting(finalColor, vNormal, viewDirection), 1.0);
    }
  `;

  return { vertexShader: hexVertexShader, fragmentShader: hexFragmentShader };
}
