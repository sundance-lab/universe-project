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

        uniform bool uIsGasGiant;
        uniform float uContinentSeed;
        uniform float uSphereRadius;
        uniform float uDisplacementAmount;
        uniform float uVolcanicActivity;

        varying vec3 vNormal;
        varying float vElevation;
        varying vec3 vWorldPosition;
        varying float vLavaNoise;
        varying vec3 vPosition;

        ${noiseFunctions}

        void main() {
            vec3 p = position;
            vPosition = position;
            vec3 p_normalized = normalize(p);
            
            if (!uIsGasGiant) {
                vec3 noiseInputPosition = (p / uSphereRadius) + (uContinentSeed * 10.0);
                float mountainPersistence = 0.45;
                float mountainLacunarity = 2.2;
                float mountainScale = 8.0;
                float continentShape = (layeredNoise(noiseInputPosition, uContinentSeed, 5, 0.5, 2.0, 1.5) + 1.0) * 0.5;
                float continentMask = smoothstep(0.49, 0.51, continentShape);
                float mountainNoise = (layeredNoise(noiseInputPosition, uContinentSeed*2.0, 6, mountainPersistence, mountainLacunarity, mountainScale) + 1.0) * 0.5;
                float islandNoise = (layeredNoise(noiseInputPosition, uContinentSeed * 3.0, 7, 0.5, 2.5, 18.0) + 1.0) * 0.5;
                float oceanMask = 1.0 - continentMask;
                float finalElevation = continentShape + (mountainNoise * continentMask * 0.3) + (islandNoise * oceanMask * 0.1);
                
                vLavaNoise = 0.0;
                if (uVolcanicActivity > 0.0) {
                    vLavaNoise = layeredNoise(noiseInputPosition * 2.0, uContinentSeed * 7.0, 5, 0.5, 2.0, 1.0);
                    float lavaHeight = smoothstep(1.0 - uVolcanicActivity, 1.0, vLavaNoise);
                    finalElevation += lavaHeight * uVolcanicActivity * 0.1;
                }
                finalElevation = finalElevation - 0.5;
                vElevation = finalElevation;
                float displacement = vElevation * uDisplacementAmount;
                vec3 displacedPosition = p + p_normalized * displacement;
                
                vNormal = p_normalized;

                vWorldPosition = (modelMatrix * vec4(displacedPosition, 1.0)).xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
            } else {
                vNormal = p_normalized;
                vWorldPosition = (modelMatrix * vec4(p, 1.0)).xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
            }

            #include <logdepthbuf_vertex>
        }
    `;

    const fragmentShader = `
        #include <logdepthbuf_pars_fragment>
        
        // Uniforms
        uniform bool uIsGasGiant;
        uniform vec3 uLandColor, uWaterColor, uGgBandColor1, uGgBandColor2, uGgPoleColor;
        uniform float uOceanHeightLevel, uContinentSeed, uForestDensity, uTime, uSnowCapLevel, uVolcanicActivity;
        uniform float uGgPoleSize, uGgAtmosphereStyle, uGgTurbulence, uGgStormIntensity;

        // Varyings
        varying vec3 vNormal, vWorldPosition, vPosition;
        varying float vElevation, vLavaNoise;

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

        void main() {
            vec3 finalColor;
            vec3 normalizedPos = normalize(vPosition);

            if (uIsGasGiant) {
                float flowSpeed = uTime * 0.05;
                vec2 flowMap = vec2(layeredNoise(normalizedPos*0.8+flowSpeed, 300.0, 4, 0.5, 2.0, 1.0)-0.5, layeredNoise(normalizedPos*0.8+flowSpeed+10.0, 301.0, 4, 0.5, 2.0, 1.0)-0.5);
                vec3 flowDistortion = vec3(flowMap*2.0, layeredNoise(normalizedPos*0.5-flowSpeed, 305.0, 4, 0.5, 2.0, 1.0)-0.5);
                float turbulence = 1.0 + uGgTurbulence * 15.0;
                vec3 baseCoords = normalizedPos * vec3(1.0, 8.0, 1.0) + flowDistortion * 0.15 * turbulence;
                float bandPattern = (layeredNoise(baseCoords, 302.0, 5, 0.4, 2.5, 1.0)+1.0)*0.5;
                float swirlPattern = layeredNoise(normalizedPos*8.0 + flowDistortion*0.5*turbulence, 303.0, 6, 0.4, 2.8, 1.0);
                float pattern = mix(bandPattern, swirlPattern, uGgAtmosphereStyle*uGgAtmosphereStyle);
                vec3 atmosphereColor = mix(uGgBandColor1, uGgBandColor2, pattern);
                if(uGgStormIntensity > 0.0){float stormNoise=layeredNoise(normalizedPos*12.0+flowDistortion*1.2*turbulence, 304.0, 5, 0.6, 2.5, 1.0);float stormMask=smoothstep(0.55, 0.75, stormNoise);vec3 stormColor=mix(uGgBandColor1,uGgBandColor2,1.0-pattern)*1.3;atmosphereColor=mix(atmosphereColor,stormColor,stormMask*uGgStormIntensity);}
                float poleFactor = 1.0 - pow(1.0 - abs(normalizedPos.y), 2.5 - pow(1.0 - uGgPoleSize, 0.5) * 2.4);
                finalColor = mix(atmosphereColor, uGgPoleColor, smoothstep(0.3, 0.9, poleFactor));

            } else {
                float landMassRange = 1.0 - uOceanHeightLevel;
                float landRatio = max(0.0, (vElevation - uOceanHeightLevel) / landMassRange);
                if(vElevation < uOceanHeightLevel){float largeSwellNoise=layeredNoise(normalizedPos*1.5+uTime*0.05,98.0,4,0.6,2.0,1.0);float smallWaveNoise=layeredNoise(normalizedPos*12.0-uTime*0.2,99.0,5,0.5,2.5,1.0);vec3 deepWater=uWaterColor*0.6;vec3 shallowWater=uWaterColor;finalColor=mix(deepWater,shallowWater,largeSwellNoise);float foamThreshold=0.65;float foamBlend=smoothstep(foamThreshold,foamThreshold+0.1,smallWaveNoise);finalColor=mix(finalColor,vec3(1.0),foamBlend*0.4);}
                else {const float BEACH_END=0.02,PLAINS_END=0.40,MOUNTAIN_START=0.60,SNOW_START=0.85;vec3 beachColor=uLandColor*1.1+vec3(0.1,0.1,0.0),plainsColor=uLandColor,forestColor=uLandColor*0.65,deepForestColor=forestColor*0.8,mountainColor=uLandColor*0.9+vec3(0.05),snowColor=vec3(0.9,0.9,1.0);if(landRatio<BEACH_END)finalColor=mix(plainsColor,beachColor,smoothstep(BEACH_END,0.0,landRatio));else if(landRatio<PLAINS_END)finalColor=plainsColor;else if(landRatio<MOUNTAIN_START)finalColor=mix(plainsColor,mountainColor,smoothstep(PLAINS_END,MOUNTAIN_START,landRatio));else if(landRatio<SNOW_START)finalColor=mountainColor;else finalColor=mix(mountainColor,snowColor,smoothstep(SNOW_START,1.0,landRatio));if(landRatio>BEACH_END&&landRatio<SNOW_START){float forestShapeNoise=layeredNoise(normalizedPos*2.0,uContinentSeed*4.0,4,0.5,2.5,1.0);float forestEdgeMask=smoothstep(0.4,0.6,forestShapeNoise);float forestDensityNoise=valueNoise(normalizedPos*25.0,uContinentSeed*5.0);float forestDensityMask=smoothstep(1.0-uForestDensity,1.0,forestDensityNoise);float finalForestMask=forestEdgeMask*forestDensityMask;float forestColorVariation=valueNoise(normalizedPos*50.0,uContinentSeed*6.0);vec3 mixedForestColor=mix(forestColor,deepForestColor,forestColorVariation);finalColor=mix(finalColor,mixedForestColor,finalForestMask);}}
                if(uVolcanicActivity>0.0){vec3 rockColor=vec3(0.08,0.05,0.05);vec3 lavaColor=vec3(1.0,0.15,0.0);float lavaThreshold=1.0-uVolcanicActivity;float lavaMix=smoothstep(lavaThreshold-0.1,lavaThreshold,vLavaNoise);float slowGlow=layeredNoise(normalizedPos*20.0+uTime*0.1,102.0,4,0.5,2.0,1.0);vec3 glowingLava=lavaColor*(0.6+0.4*slowGlow);finalColor=mix(finalColor,rockColor,lavaMix);finalColor=mix(finalColor,glowingLava,lavaMix*smoothstep(0.5,0.55,vLavaNoise));}
                if(uSnowCapLevel>0.0){float latitude=abs(normalizedPos.y);float iceEdgeNoise=layeredNoise(normalizedPos*5.0,103.0,5,0.5,2.5,1.0)*0.25;float snowStart=1.0-pow(uSnowCapLevel,3.0);float snowFactor=smoothstep(snowStart-iceEdgeNoise,snowStart+0.05-iceEdgeNoise,latitude);finalColor=mix(finalColor,vec3(0.9,0.9,1.0),snowFactor);}
            }
            
            vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
            gl_FragColor = vec4(calculateLighting(finalColor, vNormal, viewDirection), 1.0);

            #include <logdepthbuf_fragment>
        }
    `;

    return { vertexShader, fragmentShader };
}

export function getHexPlanetShaders() {
    const vertexShader = `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        attribute vec3 barycentric; 

        uniform bool uIsGasGiant;
        uniform float uContinentSeed;
        uniform float uSphereRadius;
        uniform float uDisplacementAmount;
        uniform float uVolcanicActivity;

        varying vec3 vBarycentric; 
        varying vec3 vNormal;
        varying float vElevation;
        varying vec3 vWorldPosition;
        varying float vLavaNoise;
        varying vec3 vPosition;

        ${noiseFunctions}

        void main() {
            vBarycentric = barycentric; 
            vec3 p = position;
            vPosition = position;
            vec3 p_normalized = normalize(p);
            
            if (!uIsGasGiant) {
                vec3 noiseInputPosition = (p / uSphereRadius) + (uContinentSeed * 10.0);
                float mountainPersistence = 0.45;
                float mountainLacunarity = 2.2;
                float mountainScale = 8.0;
                float continentShape = (layeredNoise(noiseInputPosition, uContinentSeed, 5, 0.5, 2.0, 1.5) + 1.0) * 0.5;
                float continentMask = smoothstep(0.49, 0.51, continentShape);
                float mountainNoise = (layeredNoise(noiseInputPosition, uContinentSeed*2.0, 6, mountainPersistence, mountainLacunarity, mountainScale) + 1.0) * 0.5;
                float islandNoise = (layeredNoise(noiseInputPosition, uContinentSeed * 3.0, 7, 0.5, 2.5, 18.0) + 1.0) * 0.5;
                float oceanMask = 1.0 - continentMask;
                float finalElevation = continentShape + (mountainNoise * continentMask * 0.3) + (islandNoise * oceanMask * 0.1);
                
                vLavaNoise = 0.0;
                if (uVolcanicActivity > 0.0) {
                    vLavaNoise = layeredNoise(noiseInputPosition * 2.0, uContinentSeed * 7.0, 5, 0.5, 2.0, 1.0);
                    float lavaHeight = smoothstep(1.0 - uVolcanicActivity, 1.0, vLavaNoise);
                    finalElevation += lavaHeight * uVolcanicActivity * 0.1;
                }
                finalElevation = finalElevation - 0.5;
                vElevation = finalElevation;
                float displacement = vElevation * uDisplacementAmount;
                vec3 displacedPosition = p + p_normalized * displacement;
                
                vNormal = p_normalized;

                vWorldPosition = (modelMatrix * vec4(displacedPosition, 1.0)).xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
            } else {
                vNormal = p_normalized;
                vWorldPosition = (modelMatrix * vec4(p, 1.0)).xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
            }

            #include <logdepthbuf_vertex>
        }
    `;
    const fragmentShader = `
        #include <logdepthbuf_pars_fragment>
        
        uniform bool uIsGasGiant;
        uniform vec3 uLandColor, uWaterColor, uGgBandColor1, uGgBandColor2, uGgPoleColor;
        uniform float uOceanHeightLevel, uContinentSeed, uForestDensity, uTime, uSnowCapLevel, uVolcanicActivity;
        uniform float uGgPoleSize, uGgAtmosphereStyle, uGgTurbulence, uGgStormIntensity;
        uniform bool uShowStrokes; 

        varying vec3 vNormal, vWorldPosition, vPosition, vBarycentric;
        varying float vElevation, vLavaNoise;

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

        float getWireframe(float width) { float minBary = min(vBarycentric.x, min(vBarycentric.y, vBarycentric.z)); return smoothstep(width - 0.005, width + 0.005, minBary); }

        void main() {
            vec3 finalColor;
            vec3 normalizedPos = normalize(vPosition);

            if (uIsGasGiant) {
                float flowSpeed = uTime * 0.05;
                vec2 flowMap = vec2(layeredNoise(normalizedPos*0.8+flowSpeed, 300.0, 4, 0.5, 2.0, 1.0)-0.5, layeredNoise(normalizedPos*0.8+flowSpeed+10.0, 301.0, 4, 0.5, 2.0, 1.0)-0.5);
                vec3 flowDistortion = vec3(flowMap*2.0, layeredNoise(normalizedPos*0.5-flowSpeed, 305.0, 4, 0.5, 2.0, 1.0)-0.5);
                float turbulence = 1.0 + uGgTurbulence * 15.0;
                vec3 baseCoords = normalizedPos * vec3(1.0, 8.0, 1.0) + flowDistortion * 0.15 * turbulence;
                float bandPattern = (layeredNoise(baseCoords, 302.0, 5, 0.4, 2.5, 1.0)+1.0)*0.5;
                float swirlPattern = layeredNoise(normalizedPos*8.0 + flowDistortion*0.5*turbulence, 303.0, 6, 0.4, 2.8, 1.0);
                float pattern = mix(bandPattern, swirlPattern, uGgAtmosphereStyle*uGgAtmosphereStyle);
                vec3 atmosphereColor = mix(uGgBandColor1, uGgBandColor2, pattern);
                if(uGgStormIntensity > 0.0){float stormNoise=layeredNoise(normalizedPos*12.0+flowDistortion*1.2*turbulence, 304.0, 5, 0.6, 2.5, 1.0);float stormMask=smoothstep(0.55, 0.75, stormNoise);vec3 stormColor=mix(uGgBandColor1,uGgBandColor2,1.0-pattern)*1.3;atmosphereColor=mix(atmosphereColor,stormColor,stormMask*uGgStormIntensity);}
                float poleFactor = 1.0 - pow(1.0 - abs(normalizedPos.y), 2.5 - pow(1.0 - uGgPoleSize, 0.5) * 2.4);
                finalColor = mix(atmosphereColor, uGgPoleColor, smoothstep(0.3, 0.9, poleFactor));
            } else {
                float landMassRange = 1.0 - uOceanHeightLevel;
                float landRatio = max(0.0, (vElevation - uOceanHeightLevel) / landMassRange);
                if(vElevation < uOceanHeightLevel){float largeSwellNoise=layeredNoise(normalizedPos*1.5+uTime*0.05,98.0,4,0.6,2.0,1.0);float smallWaveNoise=layeredNoise(normalizedPos*12.0-uTime*0.2,99.0,5,0.5,2.5,1.0);vec3 deepWater=uWaterColor*0.6;vec3 shallowWater=uWaterColor;finalColor=mix(deepWater,shallowWater,largeSwellNoise);float foamThreshold=0.65;float foamBlend=smoothstep(foamThreshold,foamThreshold+0.1,smallWaveNoise);finalColor=mix(finalColor,vec3(1.0),foamBlend*0.4);}
                else {const float BEACH_END=0.02,PLAINS_END=0.40,MOUNTAIN_START=0.60,SNOW_START=0.85;vec3 beachColor=uLandColor*1.1+vec3(0.1,0.1,0.0),plainsColor=uLandColor,forestColor=uLandColor*0.65,deepForestColor=forestColor*0.8,mountainColor=uLandColor*0.9+vec3(0.05),snowColor=vec3(0.9,0.9,1.0);if(landRatio<BEACH_END)finalColor=mix(plainsColor,beachColor,smoothstep(BEACH_END,0.0,landRatio));else if(landRatio<PLAINS_END)finalColor=plainsColor;else if(landRatio<MOUNTAIN_START)finalColor=mix(plainsColor,mountainColor,smoothstep(PLAINS_END,MOUNTAIN_START,landRatio));else if(landRatio<SNOW_START)finalColor=mountainColor;else finalColor=mix(mountainColor,snowColor,smoothstep(SNOW_START,1.0,landRatio));if(landRatio>BEACH_END&&landRatio<SNOW_START){float forestShapeNoise=layeredNoise(normalizedPos*2.0,uContinentSeed*4.0,4,0.5,2.5,1.0);float forestEdgeMask=smoothstep(0.4,0.6,forestShapeNoise);float forestDensityNoise=valueNoise(normalizedPos*25.0,uContinentSeed*5.0);float forestDensityMask=smoothstep(1.0-uForestDensity,1.0,forestDensityNoise);float finalForestMask=forestEdgeMask*forestDensityMask;float forestColorVariation=valueNoise(normalizedPos*50.0,uContinentSeed*6.0);vec3 mixedForestColor=mix(forestColor,deepForestColor,forestColorVariation);finalColor=mix(finalColor,mixedForestColor,finalForestMask);}}
                if(uVolcanicActivity>0.0){vec3 rockColor=vec3(0.08,0.05,0.05);vec3 lavaColor=vec3(1.0,0.15,0.0);float lavaThreshold=1.0-uVolcanicActivity;float lavaMix=smoothstep(lavaThreshold-0.1,lavaThreshold,vLavaNoise);float slowGlow=layeredNoise(normalizedPos*20.0+uTime*0.1,102.0,4,0.5,2.0,1.0);vec3 glowingLava=lavaColor*(0.6+0.4*slowGlow);finalColor=mix(finalColor,rockColor,lavaMix);finalColor=mix(finalColor,glowingLava,lavaMix*smoothstep(0.5,0.55,vLavaNoise));}
                if(uSnowCapLevel>0.0){float latitude=abs(normalizedPos.y);float iceEdgeNoise=layeredNoise(normalizedPos*5.0,103.0,5,0.5,2.5,1.0)*0.25;float snowStart=1.0-pow(uSnowCapLevel,3.0);float snowFactor=smoothstep(snowStart-iceEdgeNoise,snowStart+0.05-iceEdgeNoise,latitude);finalColor=mix(finalColor,vec3(0.9,0.9,1.0),snowFactor);}
            }

            if (uShowStrokes) { vec3 wireColor = vec3(0.1); finalColor = mix(finalColor, wireColor, 1.0 - getWireframe(0.01)); }
            
            vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
            gl_FragColor = vec4(calculateLighting(finalColor, vNormal, viewDirection), 1.0);

            #include <logdepthbuf_fragment>
        }
    `;
    return { vertexShader: vertexShader, fragmentShader: fragmentShader };
}
