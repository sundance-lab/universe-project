// public/js/shaders.js

// --- Reusable GLSL Noise Functions ---

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

const glslLayeredNoise = `
// Depends on: valueNoise
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
`;

const glslRidgedRiverNoise = `
// Depends on: layeredNoise
float ridgedRiverNoise(vec3 p, float seed) {
 float n = layeredNoise(p, seed, 6, 0.5, 2.0, 1.0);
 return pow(1.0 - abs(n), 3.0); 
}
`;

const noiseFunctions = glslRandom2to1 + glslSimpleValueNoise3D + glslLayeredNoise + glslRidgedRiverNoise;

export function getPlanetShaders() {
    const vertexShader = `
        #include <common>
        #include <logdepthbuf_pars_vertex>

        uniform float uContinentSeed;
        uniform float uSphereRadius;
        uniform float uDisplacementAmount;
        uniform float uRiverBasin;
        uniform int uPlanetType;

        varying vec3 vNormal;
        varying float vElevation;
        varying vec3 vWorldPosition;
        varying float vRiverValue;

        ${noiseFunctions}

        void main() {
            vec3 p = position;
            vec3 noiseInputPosition = (p / uSphereRadius) + (uContinentSeed * 10.0);

            float mountainPersistence = 0.45;
            float mountainLacunarity = 2.2;
            float mountainScale = 8.0;
            if (uPlanetType == 2) { // Icy Planet
                mountainPersistence = 0.3;
                mountainLacunarity = 2.0;
                mountainScale = 4.0;
            } else if (uPlanetType == 1) { // Volcanic Planet
                mountainPersistence = 0.55;
                mountainLacunarity = 2.5;
                mountainScale = 12.0;
            }

            float continentShape = (layeredNoise(noiseInputPosition, uContinentSeed, 5, 0.5, 2.0, 1.5) + 1.0) * 0.5;
            float continentMask = smoothstep(0.49, 0.51, continentShape);
            float riverRaw = ridgedRiverNoise(noiseInputPosition * 0.2, uContinentSeed * 5.0);
            float riverBed = smoothstep(1.0 - uRiverBasin, 1.0, riverRaw);
            float riverMask = smoothstep(0.50, 0.55, continentShape);
            vRiverValue = riverBed * riverMask;
            float mountainNoise = (layeredNoise(noiseInputPosition, uContinentSeed*2.0, 6, mountainPersistence, mountainLacunarity, mountainScale) + 1.0) * 0.5;
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

            #include <logdepthbuf_vertex>
        }
    `;

    const fragmentShader = `
        #include <logdepthbuf_pars_fragment>

        uniform vec3 uLandColor;
        uniform vec3 uWaterColor;
        uniform float uOceanHeightLevel;
        uniform float uContinentSeed;
        uniform float uForestDensity;
        uniform int uPlanetType;
        uniform vec3 uLightDirection;

        varying vec3 vNormal;
        varying float vElevation;
        varying vec3 vWorldPosition;
        varying float vRiverValue;

        ${noiseFunctions}

        vec3 calculateLighting(vec3 surfaceColor, vec3 normalVec, vec3 viewDir) {
            vec3 lightColor = vec3(1.0, 1.0, 0.95);
            float ambientStrength = 0.25;
            float diffuseStrength = 0.7;
            float specularStrength = 0.3;
            float shininess = 16.0;
            vec3 lightDirection = normalize(uLightDirection);

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
            float landMassRange = 1.0 - uOceanHeightLevel;
            float landRatio = max(0.0, (vElevation - uOceanHeightLevel) / landMassRange);

            if (uPlanetType == 1) { // Volcanic
                vec3 lavaColor = vec3(1.0, 0.3, 0.0);
                vec3 rockColor = vec3(0.1, 0.1, 0.15);
                vec3 ashColor = vec3(0.3, 0.3, 0.3);
                
                if (vElevation < uOceanHeightLevel) {
                    finalColor = mix(rockColor * 0.8, lavaColor, smoothstep(uOceanHeightLevel - 0.1, uOceanHeightLevel, vElevation));
                } else {
                    if (landRatio < 0.6) {
                        finalColor = mix(rockColor, ashColor, landRatio / 0.6);
                    } else {
                        finalColor = mix(ashColor, rockColor * 1.5, (landRatio - 0.6) / 0.4);
                    }
                }
                if (vRiverValue > 0.1) {
                    finalColor = mix(finalColor, lavaColor, vRiverValue * 2.0);
                }
            } else if (uPlanetType == 2) { // Icy
                vec3 iceColor = vec3(0.9, 0.95, 1.0);
                vec3 deepIceColor = vec3(0.4, 0.6, 1.0);
                vec3 snowColor = vec3(1.0, 1.0, 1.0);

                if (vElevation < uOceanHeightLevel) {
                    finalColor = deepIceColor;
                } else {
                    finalColor = mix(iceColor, snowColor, landRatio);
                }
                if (vRiverValue > 0.1) {
                    finalColor = mix(finalColor, deepIceColor * 0.9, vRiverValue);
                }
            } else if (uPlanetType == 3) { // Desert
                vec3 sandColor = vec3(0.85, 0.7, 0.45);
                vec3 rockColor = vec3(0.5, 0.3, 0.2);
                vec3 dryPlainsColor = vec3(0.6, 0.5, 0.3);

                if (vElevation < uOceanHeightLevel) { // Oases / Canyons
                    finalColor = rockColor * 0.8;
                } else {
                    if (landRatio < 0.5) {
                        finalColor = mix(dryPlainsColor, sandColor, landRatio / 0.5);
                    } else {
                        finalColor = mix(sandColor, rockColor, (landRatio - 0.5) / 0.5);
                    }
                }
                if (vRiverValue > 0.1) {
                    vec3 canyonColor = rockColor * 0.5;
                    finalColor = mix(finalColor, canyonColor, vRiverValue);
                }
            } else { // Terran (Default)
                vec3 waterColor = uWaterColor;
                vec3 beachColor = uLandColor * 1.1 + vec3(0.1, 0.1, 0.0);
                vec3 plainsColor = uLandColor;
                vec3 forestColor = uLandColor * 0.65;
                vec3 mountainColor = uLandColor * 0.9 + vec3(0.05);
                vec3 snowColor = vec3(0.9, 0.9, 1.0);

                if (vElevation < uOceanHeightLevel) {
                    finalColor = waterColor;
                } else {
                    const float BEACH_END = 0.02;
                    const float PLAINS_END = 0.40;
                    const float MOUNTAIN_START = 0.60;
                    const float SNOW_START = 0.85;

                    if (landRatio < BEACH_END) finalColor = mix(plainsColor, beachColor, smoothstep(BEACH_END, 0.0, landRatio));
                    else if (landRatio < PLAINS_END) finalColor = plainsColor;
                    else if (landRatio < MOUNTAIN_START) finalColor = mix(plainsColor, mountainColor, smoothstep(PLAINS_END, MOUNTAIN_START, landRatio));
                    else if (landRatio < SNOW_START) finalColor = mountainColor;
                    else finalColor = mix(mountainColor, snowColor, smoothstep(SNOW_START, 1.0, landRatio));
                    
                    if (landRatio > BEACH_END && landRatio < SNOW_START) {
                        float forestNoise = valueNoise(vWorldPosition * 25.0, uContinentSeed * 4.0);
                        float forestMask = smoothstep(1.0 - uForestDensity, 1.0 - uForestDensity + 0.1, forestNoise);
                        finalColor = mix(finalColor, forestColor, forestMask);
                    }
                    
                    if (vRiverValue > 0.1) {
                        finalColor = mix(finalColor, waterColor * 0.9, vRiverValue);
                    }
                }
            }
            
            vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
            gl_FragColor = vec4(calculateLighting(finalColor, vNormal, viewDirection), 1.0);

            #include <logdepthbuf_fragment>
        }
    `;

    return { vertexShader, fragmentShader };
}

export function getHexPlanetShaders() {
 const hexVertexShader = `
    #include <common>
    #include <logdepthbuf_pars_vertex>
    attribute vec3 barycentric;

    uniform float uContinentSeed;
    uniform float uSphereRadius;
    uniform float uDisplacementAmount;
    uniform float uRiverBasin;
    uniform float uMountainStrength;
    uniform float uIslandStrength;
    uniform int uPlanetType;

    varying vec3 vBarycentric;
    varying vec3 vNormal;
    varying float vElevation;
    varying vec3 vWorldPosition;
    varying float vRiverValue;

    ${noiseFunctions}

    void main() {
        vBarycentric = barycentric;
		vec3 p_normalized = normalize(position);
		vec3 noiseInputPosition = p_normalized + (uContinentSeed * 10.0);

        float mountainPersistence = 0.45;
        float mountainLacunarity = 2.2;
        float mountainScale = 14.0;
        if (uPlanetType == 2) { mountainPersistence = 0.3; mountainLacunarity = 2.0; mountainScale = 4.0; } 
        else if (uPlanetType == 1) { mountainPersistence = 0.55; mountainLacunarity = 2.5; mountainScale = 12.0; }

		float continentShape = (layeredNoise(noiseInputPosition, uContinentSeed, 6, 0.5, 2.0, 1.5) + 1.0) * 0.5;
		float mountainNoise_01 = (layeredNoise(noiseInputPosition, uContinentSeed * 2.0, 7, mountainPersistence, mountainLacunarity, mountainScale) + 1.0) * 0.5;
		float islandNoise_01 = (layeredNoise(noiseInputPosition, uContinentSeed * 3.0, 8, 0.5, 2.5, 18.0) + 1.0) * 0.5;
		
		float continentMask = smoothstep(0.49, 0.51, continentShape);
		float oceanMask = 1.0 - continentMask;

		float finalElevation = continentShape;
		finalElevation += (mountainNoise_01 - 0.5) * continentMask * 0.6 * uMountainStrength;
		finalElevation += (islandNoise_01 - 0.5) * oceanMask * 0.2 * uIslandStrength;

		float riverRaw = ridgedRiverNoise(noiseInputPosition * 0.2, uContinentSeed * 5.0);
		float riverBed = smoothstep(1.0 - uRiverBasin, 1.0, riverRaw);
		float riverMask = smoothstep(0.50, 0.55, continentShape);
		vRiverValue = riverBed * riverMask;
		finalElevation -= vRiverValue * 0.08;
		finalElevation = finalElevation - 0.5;

		vElevation = finalElevation;
		float displacement = vElevation * uDisplacementAmount;
		vec3 displacedPosition = position + p_normalized * displacement;

		vNormal = p_normalized;
		vWorldPosition = (modelMatrix * vec4(displacedPosition, 1.0)).xyz;
		gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
        #include <logdepthbuf_vertex>
  }
 `;

 const hexFragmentShader = `
    #include <logdepthbuf_pars_fragment>

    uniform vec3 uLandColor;
    uniform vec3 uWaterColor;
    uniform float uOceanHeightLevel;
    uniform float uContinentSeed;
    uniform float uForestDensity;
    uniform float uSphereRadius;
    uniform bool uShowStrokes; 
    uniform int uPlanetType;

    varying vec3 vNormal;
    varying float vElevation;
    varying vec3 vWorldPosition;
    varying float vRiverValue;
    varying vec3 vBarycentric;

    ${noiseFunctions}

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
        float landMassRange = 1.0 - uOceanHeightLevel;
        float landRatio = max(0.0, (vElevation - uOceanHeightLevel) / landMassRange);

        if (uPlanetType == 1) { // Volcanic
            vec3 lavaColor = vec3(1.0, 0.3, 0.0);
            vec3 rockColor = vec3(0.1, 0.1, 0.15);
            vec3 ashColor = vec3(0.3, 0.3, 0.3);
            if (vElevation < uOceanHeightLevel) biomeColor = mix(rockColor*0.8, lavaColor, smoothstep(uOceanHeightLevel-0.1, uOceanHeightLevel, vElevation));
            else {
                if (landRatio < 0.6) biomeColor = mix(rockColor, ashColor, landRatio / 0.6);
                else biomeColor = mix(ashColor, rockColor*1.5, (landRatio - 0.6)/0.4);
            }
            if (vRiverValue > 0.1) biomeColor = mix(biomeColor, lavaColor, vRiverValue * 2.0);
        } else if (uPlanetType == 2) { // Icy
            vec3 iceColor = vec3(0.9, 0.95, 1.0);
            vec3 deepIceColor = vec3(0.4, 0.6, 1.0);
            vec3 snowColor = vec3(1.0, 1.0, 1.0);
            if (vElevation < uOceanHeightLevel) biomeColor = deepIceColor;
            else biomeColor = mix(iceColor, snowColor, landRatio);
            if (vRiverValue > 0.1) biomeColor = mix(biomeColor, deepIceColor * 0.9, vRiverValue);
        } else if (uPlanetType == 3) { // Desert
            vec3 sandColor = vec3(0.85, 0.7, 0.45);
            vec3 rockColor = vec3(0.5, 0.3, 0.2);
            vec3 dryPlainsColor = vec3(0.6, 0.5, 0.3);
            if (vElevation < uOceanHeightLevel) biomeColor = rockColor * 0.8;
            else {
                if (landRatio < 0.5) biomeColor = mix(dryPlainsColor, sandColor, landRatio / 0.5);
                else biomeColor = mix(sandColor, rockColor, (landRatio-0.5)/0.5);
            }
            if (vRiverValue > 0.1) {
                vec3 canyonColor = rockColor * 0.5;
                biomeColor = mix(biomeColor, canyonColor, vRiverValue);
            }
        } else { // Terran
            vec3 waterColor = uWaterColor;
            vec3 beachColor = uLandColor * 1.1 + vec3(0.1, 0.1, 0.0);
            vec3 plainsColor = uLandColor;
            vec3 forestColor = uLandColor * 0.65;
            vec3 mountainColor = uLandColor * 0.9 + vec3(0.05);
            vec3 snowColor = vec3(0.9, 0.9, 1.0);
            if (vElevation < uOceanHeightLevel) biomeColor = waterColor;
            else {
                const float BEACH_END = 0.02; const float PLAINS_END = 0.40;
                const float MOUNTAIN_START = 0.60; const float SNOW_START = 0.85;
                if (landRatio < BEACH_END) biomeColor = mix(plainsColor, beachColor, smoothstep(BEACH_END, 0.0, landRatio));
                else if (landRatio < PLAINS_END) biomeColor = plainsColor;
                else if (landRatio < MOUNTAIN_START) biomeColor = mix(plainsColor, mountainColor, smoothstep(PLAINS_END, MOUNTAIN_START, landRatio));
                else if (landRatio < SNOW_START) biomeColor = mountainColor;
                else biomeColor = mix(mountainColor, snowColor, smoothstep(SNOW_START, 1.0, landRatio));

                if (landRatio > BEACH_END && landRatio < SNOW_START) {
                    float forestNoise = valueNoise((vWorldPosition / uSphereRadius) * 25.0, uContinentSeed * 4.0);
                    float forestMask = smoothstep(1.0 - uForestDensity, 1.0 - uForestDensity + 0.1, forestNoise);
                    biomeColor = mix(biomeColor, forestColor, forestMask);
                }
                if (vRiverValue > 0.1) biomeColor = mix(biomeColor, waterColor * 0.9, vRiverValue);
            }
        }

        vec3 finalColor;
        if (uShowStrokes) {
            float wire = getWireframe(0.005);
            vec3 strokeColor = vec3(1.0, 1.0, 1.0);
            finalColor = mix(strokeColor, biomeColor, wire);
        } else {
            finalColor = biomeColor;
        }
        
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        gl_FragColor = vec4(calculateLighting(finalColor, vNormal, viewDirection), 1.0);

        #include <logdepthbuf_fragment>
    }
 `;

 return {
  vertexShader,
  fragmentShader
 };
}
