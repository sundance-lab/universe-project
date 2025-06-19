const glslRandom2to1 = `
float random(vec2 st) {
 return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}
`;

const glslSimpleValueNoise3D = `
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

const glslLayeredNoise = `
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
float ridgedRiverNoise(vec3 p, float seed) {
 float n = layeredNoise(p, seed, 6, 0.5, 2.0, 1.0);
 return pow(1.0 - abs(n), 3.0); 
}
`;

const noiseFunctions = glslRandom2to1 + glslSimpleValueNoise3D + glslLayeredNoise + glslRidgedRiverNoise;

const glslLightingFunction = `
vec3 calculateLighting(vec3 surfaceColor, vec3 normalVec, vec3 viewDir, vec3 lightDir) {
    vec3 lightColor = vec3(1.0, 1.0, 0.95);
    float ambientStrength = 0.25;
    float diffuseStrength = 0.7;
    float specularStrength = 0.3;
    float shininess = 16.0;

    vec3 ambient = ambientStrength * lightColor;
    vec3 norm = normalize(normalVec);
    float diff = max(dot(norm, lightDir), 0.0);
    vec3 diffuse = diffuseStrength * diff * lightColor;
    vec3 reflectDir = reflect(-lightDir, norm);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), shininess);
    vec3 specular = specularStrength * spec * lightColor;
    return (ambient + diffuse + specular) * surfaceColor;
}
`;

const glslBiomeColorLogic = `
vec3 getBiomeColor(float elevation, float oceanHeightLevel, int planetType, vec3 landColor, vec3 waterColor, float riverValue, float forestDensity, float continentSeed, vec3 worldPosition) {
    vec3 finalColor;
    float landMassRange = 1.0 - oceanHeightLevel;
    float landRatio = max(0.0, (elevation - oceanHeightLevel) / landMassRange);

    if (planetType == 1) { // Volcanic
        vec3 lavaColor = vec3(1.0, 0.3, 0.0);
        vec3 rockColor = vec3(0.1, 0.1, 0.15);
        vec3 ashColor = vec3(0.3, 0.3, 0.3);
        
        if (elevation < oceanHeightLevel) {
            finalColor = mix(rockColor * 0.8, lavaColor, smoothstep(oceanHeightLevel - 0.1, oceanHeightLevel, elevation));
        } else {
            if (landRatio < 0.6) {
                finalColor = mix(rockColor, ashColor, landRatio / 0.6);
            } else {
                finalColor = mix(ashColor, rockColor * 1.5, (landRatio - 0.6) / 0.4);
            }
        }
        if (riverValue > 0.1) {
            finalColor = mix(finalColor, lavaColor, riverValue * 2.0);
        }
    } else if (planetType == 2) { // Icy
        vec3 iceColor = vec3(0.9, 0.95, 1.0);
        vec3 deepIceColor = vec3(0.4, 0.6, 1.0);
        vec3 snowColor = vec3(1.0, 1.0, 1.0);

        if (elevation < oceanHeightLevel) {
            finalColor = deepIceColor;
        } else {
            finalColor = mix(iceColor, snowColor, landRatio);
        }
        if (riverValue > 0.1) {
            finalColor = mix(finalColor, deepIceColor * 0.9, riverValue);
        }
    } else if (planetType == 3) { // Desert
        vec3 sandColor = vec3(0.85, 0.7, 0.45);
        vec3 rockColor = vec3(0.5, 0.3, 0.2);
        vec3 dryPlainsColor = vec3(0.6, 0.5, 0.3);

        if (elevation < oceanHeightLevel) {
            finalColor = rockColor * 0.8;
        } else {
            if (landRatio < 0.5) {
                finalColor = mix(dryPlainsColor, sandColor, landRatio / 0.5);
            } else {
                finalColor = mix(sandColor, rockColor, (landRatio - 0.5) / 0.5);
            }
        }
        if (riverValue > 0.1) {
            vec3 canyonColor = rockColor * 0.5;
            finalColor = mix(finalColor, canyonColor, riverValue);
        }
    } else { // Terran (Default)
        vec3 beachColor = landColor * 1.1 + vec3(0.1, 0.1, 0.0);
        vec3 plainsColor = landColor;
        vec3 forestColor = landColor * 0.65;
        vec3 mountainColor = landColor * 0.9 + vec3(0.05);
        vec3 snowColor = vec3(0.9, 0.9, 1.0);

        if (elevation < oceanHeightLevel) {
            finalColor = waterColor;
        } else {
            const float BEACH_END = 0.02; const float PLAINS_END = 0.40;
            const float MOUNTAIN_START = 0.60; const float SNOW_START = 0.85;
            if (landRatio < BEACH_END) finalColor = mix(plainsColor, beachColor, smoothstep(BEACH_END, 0.0, landRatio));
            else if (landRatio < PLAINS_END) finalColor = plainsColor;
            else if (landRatio < MOUNTAIN_START) finalColor = mix(plainsColor, mountainColor, smoothstep(PLAINS_END, MOUNTAIN_START, landRatio));
            else if (landRatio < SNOW_START) finalColor = mountainColor;
            else finalColor = mix(mountainColor, snowColor, smoothstep(SNOW_START, 1.0, landRatio));
            
            if (landRatio > BEACH_END && landRatio < SNOW_START) {
                float forestNoise = valueNoise(worldPosition * 25.0, continentSeed * 4.0);
                float forestMask = smoothstep(1.0 - forestDensity, 1.0 - forestDensity + 0.1, forestNoise);
                finalColor = mix(finalColor, forestColor, forestMask);
            }
            
            if (riverValue > 0.1) {
                finalColor = mix(finalColor, waterColor * 0.9, riverValue);
            }
        }
    }
    return finalColor;
}
`;

export function getTerrainShaders() {
    const vertexShader = `
        uniform float uTime;
        uniform float uElevationMultiplier;

        varying vec2 vUv;
        varying float vElevation;
        varying vec3 vNormal;

        ${noiseFunctions}

        float getElevation(vec2 pos) {
            float baseElevation = layeredNoise(vec3(pos * 0.001, 0.0), 1.0, 8, 0.5, 2.0, 1.0);
            float mountainNoise = layeredNoise(vec3(pos * 0.005, 0.0), 2.0, 6, 0.6, 2.5, 1.0);
            float detailNoise = layeredNoise(vec3(pos * 0.05, 0.0), 3.0, 4, 0.4, 2.0, 1.0);
            
            float finalElevation = baseElevation * 0.7 + pow(mountainNoise, 2.0) * 0.25 + detailNoise * 0.05;
            return finalElevation * uElevationMultiplier;
        }

        void main() {
            vUv = uv;
            vec3 pos = position;
            float elevation = getElevation(pos.xz);
            pos.y = elevation;
            vElevation = elevation;

            float offset = 1.0;
            float elev_x = getElevation(pos.xz + vec2(offset, 0.0));
            float elev_z = getElevation(pos.xz + vec2(0.0, offset));
            
            vec3 tangent = normalize(vec3(offset, elev_x - elevation, 0.0));
            vec3 bitangent = normalize(vec3(0.0, elev_z - elevation, offset));
            vNormal = normalize(cross(bitangent, tangent));
            
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `;

    const fragmentShader = `
        uniform vec3 uSunDirection;
        uniform float uElevationMultiplier;

        varying vec2 vUv;
        varying float vElevation;
        varying vec3 vNormal;
        
        ${glslRandom2to1}

        void main() {
            vec3 norm = normalize(vNormal);
            float light = clamp(dot(norm, uSunDirection), 0.0, 1.0);
            
            vec3 biomeColor;
            float waterLevel = uElevationMultiplier * 0.2;
            float beachLevel = waterLevel + 5.0;
            float grassLevel = uElevationMultiplier * 0.6;
            float rockLevel = uElevationMultiplier * 0.8;

            if (vElevation < waterLevel) {
                float foamLine = smoothstep(waterLevel - 2.0, waterLevel, vElevation);
                vec3 waterColor = mix(vec3(0.1, 0.2, 0.5), vec3(0.2, 0.4, 0.7), 1.0 - foamLine);
                biomeColor = mix(waterColor, vec3(1.0, 1.0, 1.0), foamLine * 0.5);
            } else if (vElevation < beachLevel) {
                biomeColor = vec3(0.76, 0.7, 0.5);
            } else if (vElevation < grassLevel) {
                float noise1 = random(vUv * 800.0);
                float noise2 = random(vUv * 200.0);
                vec3 grassColor1 = vec3(0.2, 0.5, 0.15);
                vec3 grassColor2 = vec3(0.35, 0.7, 0.2);
                biomeColor = mix(grassColor1, grassColor2, noise1 * 0.7 + noise2 * 0.3);
            } else if (vElevation < rockLevel) {
                float rockNoise = random(vUv * 150.0);
                biomeColor = mix(vec3(0.4), vec3(0.55), rockNoise);
            } else {
                biomeColor = vec3(1.0, 1.0, 1.0);
            }
            
            vec3 finalColor = biomeColor * (light * 0.7 + 0.3);
            finalColor = mix(finalColor * 0.8 + vec3(0.0, 0.0, 0.1), finalColor, light);

            gl_FragColor = vec4(finalColor, 1.0);
        }
    `;
    return { vertexShader, fragmentShader };
}


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
            vec3 p_normalized = normalize(position);
            vec3 noiseInputPosition = p_normalized + (uContinentSeed * 10.0);

            float mountainPersistence = 0.45;
            float mountainLacunarity = 2.2;
            float mountainScale = 8.0;
            if (uPlanetType == 2) { mountainPersistence = 0.3; mountainLacunarity = 2.0; mountainScale = 4.0; } 
            else if (uPlanetType == 1) { mountainPersistence = 0.55; mountainLacunarity = 2.5; mountainScale = 12.0; }

            float continentShape = (layeredNoise(noiseInputPosition, uContinentSeed, 5, 0.5, 2.0, 1.5) + 1.0) * 0.5;
            float continentMask = smoothstep(0.49, 0.51, continentShape);
            float riverRaw = ridgedRiverNoise(noiseInputPosition * 0.2, uContinentSeed * 5.0);
            float riverBed = smoothstep(1.0 - uRiverBasin, 1.0, riverRaw);
            float riverMask = smoothstep(0.50, 0.55, continentShape);
            vRiverValue = riverBed * riverMask;
            float mountainNoise = (layeredNoise(noiseInputPosition, uContinentSeed*2.0, 6, mountainPersistence, mountainLacunarity, mountainScale) + 1.0) * 0.5;
            float islandNoise = (layeredNoise(noiseInputPosition, uContinentSeed * 3.0, 7, 0.5, 2.5, 18.0) + 1.0) * 0.5;
            float oceanMask = 1.0 - continentMask;
            float finalElevation = continentShape + (mountainNoise * continentMask * 0.3) + (islandNoise * oceanMask * 0.1);
            finalElevation -= vRiverValue * 0.08;
            finalElevation = finalElevation - 0.5;

            vElevation = finalElevation;
            float displacement = vElevation * uDisplacementAmount;
            vec3 displacedPosition = position + p_normalized * displacement;
            
            vNormal = normalize(normalMatrix * p_normalized);
            
            vec4 worldPos = modelMatrix * vec4(displacedPosition, 1.0);
            vWorldPosition = worldPos.xyz;
            
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
        uniform vec3 cameraPosition;

        varying vec3 vNormal;
        varying float vElevation;
        varying vec3 vWorldPosition;
        varying float vRiverValue;

        ${noiseFunctions}
        ${glslLightingFunction}
        ${glslBiomeColorLogic}

        void main() {
            vec3 biomeColor = getBiomeColor(vElevation, uOceanHeightLevel, uPlanetType, uLandColor, uWaterColor, vRiverValue, uForestDensity, uContinentSeed, vWorldPosition);
            
            vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
            vec3 lightDirection = normalize(uLightDirection);
            
            gl_FragColor = vec4(calculateLighting(biomeColor, vNormal, viewDirection, lightDirection), 1.0);

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
        float mountainScale = 8.0;
        if (uPlanetType == 2) { mountainPersistence = 0.3; mountainLacunarity = 2.0; mountainScale = 4.0; } 
        else if (uPlanetType == 1) { mountainPersistence = 0.55; mountainLacunarity = 2.5; mountainScale = 12.0; }

		float continentShape = (layeredNoise(noiseInputPosition, uContinentSeed, 5, 0.5, 2.0, 1.5) + 1.0) * 0.5;
		float continentMask = smoothstep(0.49, 0.51, continentShape);

		float riverRaw = ridgedRiverNoise(noiseInputPosition * 0.2, uContinentSeed * 5.0);
		float riverBed = smoothstep(1.0 - uRiverBasin, 1.0, riverRaw);
		float riverMask = smoothstep(0.50, 0.55, continentShape);
		vRiverValue = riverBed * riverMask;
        
        float mountainNoise = (layeredNoise(noiseInputPosition, uContinentSeed*2.0, 6, mountainPersistence, mountainLacunarity, mountainScale) + 1.0) * 0.5;
        float islandNoise = (layeredNoise(noiseInputPosition, uContinentSeed * 3.0, 7, 0.5, 2.5, 18.0) + 1.0) * 0.5;
		float oceanMask = 1.0 - continentMask;

		float finalElevation = continentShape + (mountainNoise * continentMask * 0.3) + (islandNoise * oceanMask * 0.1);
		finalElevation -= vRiverValue * 0.08;
		finalElevation = finalElevation - 0.5;

		vElevation = finalElevation;
		float displacement = vElevation * uDisplacementAmount;
		vec3 displacedPosition = position + p_normalized * displacement;

		vNormal = normalize(normalMatrix * p_normalized);
		vec4 worldPos = modelMatrix * vec4(displacedPosition, 1.0);
        vWorldPosition = worldPos.xyz;
        
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
    uniform bool uShowStrokes; 
    uniform int uPlanetType;
    uniform vec3 uLightDirection;
    uniform vec3 cameraPosition;

    varying vec3 vNormal;
    varying float vElevation;
    varying vec3 vWorldPosition;
    varying float vRiverValue;
    varying vec3 vBarycentric;

    ${noiseFunctions}
    ${glslLightingFunction}
    ${glslBiomeColorLogic}

    float getWireframe(float width) {
        float minBary = min(vBarycentric.x, min(vBarycentric.y, vBarycentric.z));
        return smoothstep(width - 0.005, width + 0.005, minBary);
    }

    void main() {
        vec3 biomeColor = getBiomeColor(vElevation, uOceanHeightLevel, uPlanetType, uLandColor, uWaterColor, vRiverValue, uForestDensity, uContinentSeed, vWorldPosition);
        
        vec3 finalColor;
        if (uShowStrokes) {
            float wire = getWireframe(0.005);
            vec3 strokeColor = vec3(1.0, 1.0, 1.0);
            finalColor = mix(strokeColor, biomeColor, wire);
        } else {
            finalColor = biomeColor;
        }
        
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        vec3 lightDirection = normalize(uLightDirection);
        
        gl_FragColor = vec4(calculateLighting(finalColor, vNormal, viewDirection, lightDirection), 1.0);

        #include <logdepthbuf_fragment>
    }
 `;

 return {
  vertexShader: hexVertexShader,
  fragmentShader: hexFragmentShader
 };
}
