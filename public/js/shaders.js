// public/js/shaders.js

export const glslRandom2to1 = `
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}
`;

export const glslSimpleValueNoise3D = `
${glslRandom2to1}

float valueNoise(vec3 p, float seed) {
    vec3 i = floor(p + seed * 0.123);
    vec3 f = fract(p + seed * 0.123);
    f = f * f * (3.0 - 2.0 * f);

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

export const planetVertexShader = `
uniform float uTime;
uniform float uContinentSeed;
uniform float uSphereRadius;
uniform float uDisplacementAmount;
uniform float uRiverBasin;

varying vec3 vNormal;
varying float vElevation;
varying float vContinentMask;
varying vec3 vWorldPosition;
varying float vRiverValue;

// Placeholder for noise functions
$

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
    return pow(1.0 - abs(n), 4.0);
}

void main() {
    vec3 p = position;
    vec3 noiseInputPosition = (p / uSphereRadius) + (uContinentSeed * 10.0);

    float smoothContinentShape = (layeredNoise(noiseInputPosition, uContinentSeed, 5, 0.5, 2.0, 1.5) + 1.0) * 0.5;
    vContinentMask = smoothstep(0.49, 0.51, smoothContinentShape);

    float riverRaw = ridgedRiverNoise(noiseInputPosition * 0.2, uContinentSeed * 5.0);
    float riverBed = smoothstep(1.0 - uRiverBasin, 1.0, riverRaw);
    float riverMask = smoothstep(0.48, 0.52, vContinentMask) * (1.0 - smoothstep(0.75, 0.8, vContinentMask));
    vRiverValue = riverBed * riverMask;

    float mountainNoise = (layeredNoise(noiseInputPosition, uContinentSeed*2.0, 6, 0.45, 2.2, 8.0) + 1.0) * 0.5;
    float islandNoise = (layeredNoise(noiseInputPosition, uContinentSeed * 3.0, 7, 0.5, 2.5, 18.0) + 1.0) * 0.5;
    float oceanMask = 1.0 - vContinentMask;

    float finalElevation = smoothContinentShape 
             + (mountainNoise * vContinentMask * 0.3) 
             + (islandNoise * oceanMask * 0.1);
    finalElevation -= vRiverValue * 0.04;
    
    vElevation = clamp(finalElevation, 0.0, 1.0);
    
    float displacement = vElevation * uDisplacementAmount;
    vec3 displacedPosition = p + normal * displacement;

    vNormal = normal;
    vWorldPosition = (modelMatrix * vec4(displacedPosition, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
}
`;

export const planetFragmentShader = `
uniform vec3 uLandColor;
uniform vec3 uWaterColor;
uniform float uOceanHeightLevel;
uniform float uContinentSeed;
uniform float uForestDensity;

varying vec3 vNormal;
varying float vElevation;
varying vec3 vWorldPosition;
varying float vRiverValue;

// Placeholder for noise functions
$

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
    vec3 beachColor = uLandColor * 0.9;
    vec3 plainsColor = uLandColor;
    vec3 forestColor = uLandColor * 0.65;
    vec3 mountainColor = uLandColor * 1.2;
    vec3 snowColor = uLandColor * 1.5 + vec3(0.3);

    float seaLevel = uOceanHeightLevel;
    float beachLevel = seaLevel + 0.005;
    float forestLine = beachLevel + 0.3;
    float mountainLine = seaLevel + 0.45;
    float snowLine = seaLevel + 0.60;

    if (vElevation < seaLevel) {
        finalColor = waterColor;
    } else if (vElevation < beachLevel) {
        finalColor = mix(waterColor, beachColor, smoothstep(seaLevel, beachLevel, vElevation));
    } else if (vElevation < forestLine) {
        finalColor = mix(beachColor, plainsColor, smoothstep(beachLevel, forestLine, vElevation));
    } else if (vElevation < mountainLine) {
        finalColor = mix(plainsColor, mountainColor, smoothstep(forestLine, mountainLine, vElevation));
    } else {
        finalColor = mix(mountainColor, snowColor, smoothstep(mountainLine, snowLine, vElevation));
    }

    if (vElevation > beachLevel && vElevation < mountainLine) {
        float forestNoise = valueNoise(vWorldPosition * 25.0, uContinentSeed * 4.0);
        float forestMask = smoothstep(1.0 - uForestDensity, 1.0, forestNoise);
        finalColor = mix(finalColor, forestColor, forestMask);
    }

    if (vRiverValue > 0.1 && vElevation > seaLevel) {
        finalColor = mix(finalColor, waterColor * 0.9, vRiverValue);
    }

    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    gl_FragColor = vec4(calculateLighting(finalColor, vNormal, viewDirection), 1.0);
}
`;
