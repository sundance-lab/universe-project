import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { getPlanetShaders, getHexPlanetShaders } from './shaders.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { addBarycentricCoordinates } from './utils.js';

const LOD_LEVELS = {
    ULTRA_CLOSE: { distance: 150, segments: 1024, noiseDetail: 12.0, textureDetail: 12.0 },
    CLOSE: { distance: 300, segments: 512, noiseDetail: 4.0, textureDetail: 4.0 },
    MEDIUM: { distance: 600, segments: 256, noiseDetail: 2.0, textureDetail: 2.0 },
    FAR: { distance: 1200, segments: 128, noiseDetail: 1.0, textureDetail: 1.0 }
};
const sizeTiers = {
    dwarf:      { size: 15 * 100, detailMultiplier: 1.5 },
    normal:     { size: 30 * 100, detailMultiplier: 1.3 },
    giant:      { size: 60 * 100, detailMultiplier: 1.1 },
    supergiant: { size: 120 * 100, detailMultiplier: 1.0 },
    hypergiant: { size: 240 * 100, detailMultiplier: 0.9 }
};
const sunVariations = [
    { baseColor: new THREE.Color(0x4A90E2), hotColor: new THREE.Color(0xFFFFFF), coolColor: new THREE.Color(0x2979FF), glowColor: new THREE.Color(0x64B5F6), coronaColor: new THREE.Color(0x90CAF9), midColor: new THREE.Color(0x82B1FF), peakColor: new THREE.Color(0xE3F2FD), valleyColor: new THREE.Color(0x1565C0), turbulence: 1.2, fireSpeed: 0.35, pulseSpeed: 0.006, sizeCategory: 'normal', terrainScale: 2.0, fireIntensity: 1.8 },
    { baseColor: new THREE.Color(0xFF5722), hotColor: new THREE.Color(0xFF8A65), coolColor: new THREE.Color(0xBF360C), glowColor: new THREE.Color(0xFF7043), coronaColor: new THREE.Color(0xFFAB91), midColor: new THREE.Color(0xFF7043), peakColor: new THREE.Color(0xFFCCBC), valleyColor: new THREE.Color(0x8D1F06), turbulence: 1.0, fireSpeed: 0.25, pulseSpeed: 0.003, sizeCategory: 'giant', terrainScale: 1.8, fireIntensity: 1.6 },
    { baseColor: new THREE.Color(0xFFA500), hotColor: new THREE.Color(0xFFF7E6), coolColor: new THREE.Color(0xFF4500), glowColor: new THREE.Color(0xFFDF00), coronaColor: new THREE.Color(0xFFA726), midColor: new THREE.Color(0xFFB74D), peakColor: new THREE.Color(0xFFE0B2), valleyColor: new THREE.Color(0xE65100), turbulence: 1.1, fireSpeed: 0.3, pulseSpeed: 0.004, sizeCategory: 'normal', terrainScale: 2.2, fireIntensity: 1.7 },
    { baseColor: new THREE.Color(0xE0E0E0), hotColor: new THREE.Color(0xFFFFFF), coolColor: new THREE.Color(0x9E9E9E), glowColor: new THREE.Color(0x82B1FF), coronaColor: new THREE.Color(0xBBDEFB), midColor: new THREE.Color(0xF5F5F5), peakColor: new THREE.Color(0xFFFFFF), valleyColor: new THREE.Color(0x757575), turbulence: 1.5, fireSpeed: 0.5, pulseSpeed: 0.01, sizeCategory: 'dwarf', terrainScale: 3.0, fireIntensity: 2.5 },
    { baseColor: new THREE.Color(0xE65100), hotColor: new THREE.Color(0xFFAB40), coolColor: new THREE.Color(0xBF360C), glowColor: new THREE.Color(0xFFD740), coronaColor: new THREE.Color(0xFFC107), midColor: new THREE.Color(0xFF9800), peakColor: new THREE.Color(0xFFE0B2), valleyColor: new THREE.Color(0xBF360C), turbulence: 1.15, fireSpeed: 0.28, pulseSpeed: 0.002, sizeCategory: 'hypergiant', terrainScale: 1.5, fireIntensity: 1.9 }
];

function _createSunMaterial(variation, finalSize, lodLevel) {
    return new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, color: { value: variation.baseColor }, hotColor: { value: variation.hotColor }, coolColor: { value: variation.coolColor }, midColor: { value: variation.midColor }, peakColor: { value: variation.peakColor }, valleyColor: { value: variation.valleyColor }, glowColor: { value: variation.glowColor }, pulseSpeed: { value: variation.pulseSpeed }, turbulence: { value: variation.turbulence }, fireSpeed: { value: variation.fireSpeed }, colorIntensity: { value: 2.0 }, flowScale: { value: 2.0 }, flowSpeed: { value: 0.3 }, sunSize: { value: finalSize }, terrainScale: { value: variation.terrainScale }, fireIntensity: { value: variation.fireIntensity }, detailLevel: { value: lodLevel.noiseDetail }, textureDetail: { value: lodLevel.textureDetail }, cameraDistance: { value: 0.0 }, detailScaling: { value: 2.0 }, minDetailLevel: { value: 0.5 }, },
        vertexShader: `varying vec2 vUv; varying vec3 vNormal; varying vec3 vViewPosition; varying vec3 vWorldPosition; uniform float detailLevel; varying float vDetailLevel; void main() { vUv = uv; vNormal = normalize(normalMatrix * normal); vec4 worldPosition = modelMatrix * vec4(position, 1.0); vWorldPosition = worldPosition.xyz; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); vViewPosition = -mvPosition.xyz; vDetailLevel = detailLevel; gl_Position = projectionMatrix * mvPosition; }`,
        fragmentShader: `precision highp float; uniform float time; uniform vec3 color, hotColor, coolColor, midColor, peakColor, valleyColor, glowColor; uniform float pulseSpeed, turbulence, fireSpeed, colorIntensity; uniform float flowScale, flowSpeed, sunSize, terrainScale, fireIntensity; uniform float detailLevel, textureDetail, minDetailLevel, detailScaling, cameraDistance; varying vec2 vUv; varying vec3 vNormal; varying vec3 vViewPosition; varying vec3 vWorldPosition; varying float vDetailLevel; vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);} vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;} float snoise(vec3 v){ const vec2 C = vec2(1.0/6.0, 1.0/3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0); vec3 i  = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx); vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g; vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy); vec3 x1 = x0 - i1 + C.xxx; vec3 x2 = x0 - i2 + C.yyy; vec3 x3 = x0 - D.yyy; i = mod(i, 289.0); vec4 p = permute(permute(permute( i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0)); float n_ = 0.142857142857; vec3 ns = n_ * D.wyz - D.xzx; vec4 j = p - 49.0 * floor(p * ns.z * ns.z); vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_); vec4 x = x_ *ns.x + ns.yyyy; vec4 y = y_ *ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y); vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw); vec4 s0 = floor(b0)*2.0 + 1.0; vec4 s1 = floor(b1)*2.0 + 1.0; vec4 sh = -step(h, vec4(0.0)); vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww; vec3 p0 = vec3(a0.xy,h.x); vec3 p1 = vec3(a0.zw,h.y); vec3 p2 = vec3(a1.xy,h.z); vec3 p3 = vec3(a1.zw,h.w); vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3))); p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w; vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0); m = m * m; return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3))); } float getDetailLevel() { float dist = length(vViewPosition); return max(minDetailLevel, vDetailLevel * (1.0 + detailScaling / (dist + 1.0))); } float terrainNoise(vec3 p) { float detail = getDetailLevel(); float elevation = 0.0; float frequency = 1.0; float amplitude = 1.0; float maxAmplitude = 0.0; int iterations = int(min(12.0, 8.0 * detail)); for(int i = 0; i < iterations; i++) { vec3 noisePos = p * frequency * terrainScale; float noiseVal = snoise(noisePos); elevation += amplitude * noiseVal; maxAmplitude += amplitude; amplitude *= 0.65; frequency *= 2.4; } return elevation / maxAmplitude; } float fireNoise(vec3 p) { float detail = getDetailLevel(); float noise = 0.0; float amplitude = 1.0; float frequency = 1.0; vec3 flow = vec3(sin(p.y * 0.5 + time * flowSpeed), cos(p.x * 0.5 + time * flowSpeed), 0.0); int iterations = int(min(8.0, 4.0 * detail)); for(int i = 0; i < iterations; i++) { p += flow * amplitude * turbulence; vec3 noisePos = p * frequency + time * fireSpeed; noise += amplitude * snoise(noisePos); frequency *= 2.0; amplitude *= 0.5; } return noise * fireIntensity; } void main() { vec3 viewDir = normalize(vViewPosition); vec3 normal = normalize(vNormal); float terrain = terrainNoise(vWorldPosition * 0.02); float fireEffect = fireNoise(vWorldPosition * 0.03); float flowPattern = fireNoise(vec3(vUv * flowScale, time * fireSpeed)); vec3 terrainColor; if(terrain > 0.6) terrainColor = mix(peakColor, hotColor, (terrain - 0.6) / 0.4); else if(terrain > 0.4) terrainColor = mix(midColor, peakColor, (terrain - 0.4) / 0.2); else if(terrain > 0.2) terrainColor = mix(color, midColor, (terrain - 0.2) / 0.2); else terrainColor = mix(valleyColor, color, terrain / 0.2); vec3 fireColor = mix(coolColor, hotColor, fireEffect); vec3 finalColor = mix(terrainColor, fireColor, flowPattern * 0.5); float edgeFactor = pow(1.0 - abs(dot(normal, viewDir)), 3.0); finalColor += glowColor * edgeFactor * 0.7 * (1.0 + flowPattern * 0.4); finalColor *= colorIntensity; float pulse = sin(time * pulseSpeed + flowPattern) * 0.02 + 0.98; finalColor *= pulse; gl_FragColor = vec4(finalColor, 1.0); }`,
        side: THREE.FrontSide, blending: THREE.AdditiveBlending, transparent: false, depthWrite: true,
    });
}

let createdTextures = [];
function _createAndCacheTexture(creationFunction) {
    const texture = creationFunction();
    texture.flipY = false;
    createdTextures.push(texture);
    return texture;
}

function _createStarTexture() {
    return _createAndCacheTexture(() => {
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.2, 'rgba(200, 200, 255, 0.8)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, size, size);
        return new THREE.CanvasTexture(canvas);
    });
}

function _createSimpleGalaxySpriteTexture() {
    return _createAndCacheTexture(() => {
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.2, 'rgba(100, 100, 255, 0.8)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, size, size);
        return new THREE.CanvasTexture(canvas);
    });
}


export const SolarSystemRenderer = (() => {
    let scene, camera, renderer, controls;
    let sunLOD, sunLight, backgroundStars, distantGalaxiesGroup;
    let planetLODs = [], planetLabels = [];
    let orbitLines = [];
    let orbitLineMaterials = [];
    let landingSiteIcons = [];
    let currentSystemData = null;
    let animationFrameId = null;
    let simulationStartTime = 0, lastUpdateTime = 0;
    let raycaster, mouse;
    let boundWheelHandler = null;
    let boundResizeHandler = null, boundRightClickHandler = null, boundSpawnClickHandler = null;
    let focusAnimation = null;
    let unfocusAnimation = null;
    let preFocusState = null;
    let initialCameraState = null;
    let followedPlanetLOD = null;
    let sunRadius = 0;

    let playerShip = null;
    let shipTargetSignifier = null;
    let shipState = {
        velocity: new THREE.Vector3(),
        maxSpeed: 7500,
        maxForce: 50,
        target: null,
        pathfinding: {
            obstacles: []
        }
    };
    let isSpawningMode = false;

    const moduleState = {
        orbitSpeedMultiplier: 1.0,
        landingIconSizeMultiplier: 0.25
    };

    const SPHERE_BASE_RADIUS = 0.8;
    const DISPLACEMENT_SCALING_FACTOR = 0.005;
    const DEFAULT_MIN_DISTANCE = 50;

    function _createLandingSiteTexture() {
        return _createAndCacheTexture(() => {
            const size = 64;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const context = canvas.getContext('2d');
            const center = size / 2;
    
            context.beginPath();
            context.arc(center, center, center - 2, 0, 2 * Math.PI, false);
            context.strokeStyle = 'rgba(0, 255, 128, 1)';
            context.lineWidth = 4;
            context.stroke();
    
            context.beginPath();
            context.arc(center, center, center / 2.5, 0, 2 * Math.PI, false);
            context.fillStyle = 'rgba(0, 255, 128, 0.5)';
            context.fill();
    
            return new THREE.CanvasTexture(canvas);
        });
    }

    function _createLandingSiteIcons(planetLOD) {
        const planetData = planetLOD.userData;
        if (!planetData.landingLocations) return;
    
        const textureLoader = new THREE.TextureLoader();
        const iconTextureMap = {
            'City': textureLoader.load('/assets/icons/city.png'),
            'Mine': textureLoader.load('/assets/icons/mine.png'),
            'Default': _createLandingSiteTexture()
        };
        Object.values(iconTextureMap).forEach(tex => createdTextures.push(tex));

        planetData.landingLocations.forEach(location => {
            
            let iconTexture = iconTextureMap[location.type] || iconTextureMap['Default'];
            
            const material = new THREE.SpriteMaterial({
                map: iconTexture,
                color: 0x00ff80,
                transparent: true,
                opacity: 0,
                depthTest: true,
                sizeAttenuation: true 
            });
    
            const sprite = new THREE.Sprite(material);
            sprite.renderOrder = 1;
            sprite.userData = { ...location, planetId: planetData.id };
            sprite.visible = false; 
            landingSiteIcons.push(sprite);
            scene.add(sprite);
        });
    }

    function _updateLandingSiteIcons(deltaTime) {
        if (!followedPlanetLOD) {
            landingSiteIcons.forEach(icon => { icon.visible = false; });
            return;
        }
    
        const planetPos = followedPlanetLOD.getWorldPosition(new THREE.Vector3());
        const planetRadius = followedPlanetLOD.userData.size;
    
        landingSiteIcons.forEach(icon => {
            if (icon.userData.planetId === followedPlanetLOD.userData.id) {
                const positionOnSphere = new THREE.Vector3().setFromSphericalCoords(
                    planetRadius * 1.01, 
                    icon.userData.phi,
                    icon.userData.theta
                );
    
                positionOnSphere.applyQuaternion(followedPlanetLOD.quaternion);
                icon.position.copy(positionOnSphere).add(planetPos);
    
                icon.visible = true;
                icon.material.opacity = 1.0;
                
                const scale = planetRadius * moduleState.landingIconSizeMultiplier;
                icon.scale.set(scale, scale, 1.0);
    
            } else {
                icon.visible = false;
            }
        });
    }

    function _createSun(sunData) {
        const variation = sunVariations[sunData.type % sunVariations.length];
        const baseSize = sizeTiers[variation.sizeCategory].size;
        const detailMultiplier = sizeTiers[variation.sizeCategory].detailMultiplier;
        const sizeVariation = 0.5 + Math.random() * 1.5;
        const finalSize = baseSize * sizeVariation;
        sunRadius = finalSize;
        const lod = new THREE.LOD();
        Object.values(LOD_LEVELS).forEach(level => {
            const adjustedSegments = Math.floor(level.segments * detailMultiplier);
            const geometry = new THREE.SphereGeometry(1, adjustedSegments, adjustedSegments);
            const material = _createSunMaterial(variation, finalSize, level);
            const sunMesh = new THREE.Mesh(geometry, material);
            sunMesh.scale.setScalar(finalSize);
            lod.addLevel(sunMesh, level.distance);
        });
        lod.position.set(0, 0, 0);
        
        shipState.pathfinding.obstacles.push({
            object: lod,
            position: lod.position,
            radius: finalSize * 1.2
        });

        return lod;
    }

    function _createPlanetLabel(planetData) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const fontSize = 128;
        context.font = `Bold ${fontSize}px "Segoe UI", Arial, sans-serif`;
        const textMetrics = context.measureText(planetData.name);
        const textWidth = textMetrics.width;
        
        canvas.width = textWidth + 20;
        canvas.height = fontSize * 1.2;
        
        context.font = `Bold ${fontSize}px "Segoe UI", Arial, sans-serif`;
        context.fillStyle = 'rgba(255, 255, 255, 0.85)';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(planetData.name, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 0,
            depthTest: false 
        });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(canvas.width * 12, canvas.height * 12, 1.0);
        sprite.userData.planetId = planetData.id;
        return sprite;
    }

    function _createPlayerShip() {
        if (playerShip) scene.remove(playerShip);

        const shipGeometry = new THREE.ConeGeometry(150, 450, 8);
        shipGeometry.rotateX(Math.PI / 2); 
        const shipMaterial = new THREE.MeshStandardMaterial({
            color: 0xeeeeff,
            emissive: 0x55eeff,
            emissiveIntensity: 3,
            metalness: 0.8,
            roughness: 0.2,
            side: THREE.DoubleSide
        });
        const ship = new THREE.Mesh(shipGeometry, shipMaterial);
        ship.add(new THREE.PointLight(0x55eeff, 5, 4000));
        return ship;
    }

    function _createPlanetLOD(planetData) {
        const { vertexShader, fragmentShader } = getPlanetShaders();
        const pMin = planetData.minTerrainHeight ?? 0.0;
        const pMax = planetData.maxTerrainHeight ?? (pMin + 10.0);
        const pOcean = planetData.oceanHeightLevel ?? (pMin + (pMax - pMin) * 0.3);
        const terrainRange = Math.max(0.1, pMax - pMin);
        const normalizedOceanLevel = terrainRange > 0 ? (pOcean - pMin) / terrainRange : 0.5;
        const displacementAmount = terrainRange * DISPLACEMENT_SCALING_FACTOR * 40;

        const material = new THREE.ShaderMaterial({
            uniforms: THREE.UniformsUtils.merge([
                THREE.UniformsLib.common,
                {
                    uLandColor: { value: new THREE.Color(planetData.landColor || '#556B2F') },
                    uWaterColor: { value: new THREE.Color(planetData.waterColor || '#1E90FF') },
                    uOceanHeightLevel: { value: normalizedOceanLevel - 0.5 },
                    uContinentSeed: { value: planetData.continentSeed ?? Math.random() },
                    uRiverBasin: { value: planetData.riverBasin ?? 0.05 },
                    uForestDensity: { value: planetData.forestDensity ?? 0.5 },
                    uSphereRadius: { value: SPHERE_BASE_RADIUS },
                    uDisplacementAmount: { value: displacementAmount },
                    uTime: { value: 0.0 },
                    uPlanetType: { value: planetData.planetType || 0 },
                    uLightDirection: { value: new THREE.Vector3(0.8, 0.6, 1.0) }
                }
            ]),
            vertexShader,
            fragmentShader
        });

        const lod = new THREE.LOD();
        lod.userData = { ...planetData, lastPosition: new THREE.Vector3(), lastWorldPosition: new THREE.Vector3() };
        lod.userData.initialOrbitalAngle = planetData.currentOrbitalAngle;
        lod.userData.initialAxialAngle = planetData.currentAxialAngle;

        const levels = [
            { distance: 0, subdivision: 32 },
            { distance: planetData.size * 20, subdivision: 16 },
            { distance: planetData.size * 40, subdivision: 8 },
        ];

        levels.forEach(level => {
            const geometry = new THREE.SphereGeometry(planetData.size, level.subdivision, level.subdivision);
            const mesh = new THREE.Mesh(geometry, material);
            lod.addLevel(mesh, level.distance);
        });
        
        shipState.pathfinding.obstacles.push({
            object: lod,
            position: lod.position,
            radius: planetData.size * 1.5
        });

        return lod;
    }
    
    function _createHexPlanetMeshLOD(planetData) {
        const lod = new THREE.LOD();
        
        const { vertexShader, fragmentShader } = getHexPlanetShaders();
        const hexPlanetMaterial = new THREE.ShaderMaterial({
             uniforms: THREE.UniformsUtils.merge([
                THREE.UniformsLib.common,
                {
                    uWaterColor: { value: new THREE.Color(planetData.waterColor) },
                    uLandColor: { value: new THREE.Color(planetData.landColor) },
                    uContinentSeed: { value: planetData.continentSeed },
                    uRiverBasin: { value: planetData.riverBasin },
                    uForestDensity: { value: planetData.forestDensity },
                    uTime: { value: 0.0 },
                    uSphereRadius: { value: SPHERE_BASE_RADIUS },
                    uDisplacementAmount: { value: 0.0 },
                    uShowStrokes: { value: false },
                    uOceanHeightLevel: { value: 0.0 },
                    uMountainStrength: { value: 1.0 },
                    uIslandStrength: { value: 1.0 },
                    uPlanetType: { value: planetData.planetType || 0 },
                    uLightDirection: { value: new THREE.Vector3(0.8, 0.6, 1.0) }
                }
            ]),
            vertexShader,
            fragmentShader
        });

        const terrainRange = Math.max(0.1, planetData.maxTerrainHeight - planetData.minTerrainHeight);
        const normalizedOceanLevel = (planetData.oceanHeightLevel - planetData.minTerrainHeight) / terrainRange;
        hexPlanetMaterial.uniforms.uOceanHeightLevel.value = normalizedOceanLevel - 0.5;
        hexPlanetMaterial.uniforms.uDisplacementAmount.value = terrainRange * DISPLACEMENT_SCALING_FACTOR;
        
        const numLevels = 16;
        const maxSubdivision = 512;

        for (let i = 0; i < numLevels; i++) {
            const subdivision = Math.max(2, Math.floor(maxSubdivision / Math.pow(1.8, i)));
            const distance = i === 0 ? 0 : planetData.size * 1.5 * Math.pow(1.6, i - 1);
            
            const geometry = new THREE.IcosahedronGeometry(planetData.size, subdivision);
            addBarycentricCoordinates(geometry);
            
            // PERFORMANCE FIX: Use the same material instance for all LOD levels.
            const mesh = new THREE.Mesh(geometry, hexPlanetMaterial);
            lod.addLevel(mesh, distance);
        }
        
        return lod;
    }

    function _createDistantStars() {
        const starCount = 60000;
        const starFieldSize = 900000;
        const positions = [];
        const colors = [];
        const sizes = [];
        const colorPalette = [
            new THREE.Color(0x8ab8ff),
            new THREE.Color(0xfff078),
            new THREE.Color(0xea94ff),
            new THREE.Color(0xffa95e),
            new THREE.Color(0x7fffd4),
            new THREE.Color(0xffffff)
        ];

        for (let i = 0; i < starCount; i++) {
            positions.push(
                (Math.random() - 0.5) * starFieldSize,
                (Math.random() - 0.5) * starFieldSize,
                (Math.random() - 0.5) * starFieldSize
            );
            const starColor = colorPalette[Math.floor(Math.random() * colorPalette.length)];
            colors.push(starColor.r, starColor.g, starColor.b);
            sizes.push(15 + Math.random() * 85);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setAttribute('particleSize', new THREE.Float32BufferAttribute(sizes, 1));

        const onBeforeCompile = shader => {
            shader.vertexShader = 'attribute float particleSize;\n' + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace('gl_PointSize = size;', 'gl_PointSize = particleSize;');
        };

        const material = new THREE.PointsMaterial({
            map: _createStarTexture(),
            vertexColors: true,
            sizeAttenuation: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            transparent: true,
            opacity: 0.85,
            onBeforeCompile: onBeforeCompile
        });

        backgroundStars = new THREE.Points(geometry, material);
        scene.add(backgroundStars);
    }

    function _createDistantGalaxies() {
        distantGalaxiesGroup = new THREE.Group();
        const galaxyTexture = _createSimpleGalaxySpriteTexture();
        const config = {
            COUNT: 150, MIN_SCALE: 800, MAX_SCALE: 1500,
            MIN_OPACITY: 0.3, MAX_OPACITY: 0.6,
        };

        for (let i = 0; i < config.COUNT; i++) {
            const material = new THREE.SpriteMaterial({
                map: galaxyTexture,
                blending: THREE.AdditiveBlending,
                transparent: true,
                opacity: config.MIN_OPACITY + Math.random() * (config.MAX_OPACITY - config.MIN_OPACITY),
                color: new THREE.Color(Math.random(), Math.random(), Math.random())
            });
            const sprite = new THREE.Sprite(material);
            const distance = 250000 + Math.random() * 200000;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            sprite.position.set(distance * Math.sin(phi) * Math.cos(theta), distance * Math.sin(phi) * Math.sin(theta), distance * Math.cos(phi));
            const scale = Math.random() * (config.MAX_SCALE - config.MIN_SCALE) + config.MIN_SCALE;
            sprite.scale.set(scale, scale, 1);
            distantGalaxiesGroup.add(sprite);
        }
        scene.add(distantGalaxiesGroup);
    }

    function _onResize() {
        if (!renderer) return;
        const container = renderer.domElement.parentElement;
        if (!container) return;
        const width = container.offsetWidth;
        const height = container.offsetHeight;
        if (camera) {
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        }
        if (renderer) {
            renderer.setSize(width, height);
        }
        orbitLineMaterials.forEach(material => {
            material.resolution.set(width, height);
        });
    }
    
    function _cleanup() {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        
        if (renderer?.domElement) {
            renderer.domElement.removeEventListener('wheel', boundWheelHandler);
            renderer.domElement.removeEventListener('click', boundSpawnClickHandler);
            renderer.domElement.removeEventListener('contextmenu', boundRightClickHandler);
        }
        if (boundResizeHandler) window.removeEventListener('resize', boundResizeHandler);

        if(controls) {
            controls.dispose();
        }
        if (sunLOD) {
            sunLOD.traverse(object => {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
                    else object.material.dispose();
                }
            });
            scene.remove(sunLOD);
        }
        if (backgroundStars) {
            if (backgroundStars.geometry) backgroundStars.geometry.dispose();
            if (backgroundStars.material) backgroundStars.material.dispose();
            scene.remove(backgroundStars);
        }
        if (distantGalaxiesGroup) {
            distantGalaxiesGroup.traverse(object => {
                 if (object.isSprite) {
                    if (object.material) object.material.dispose();
                }
            });
            scene.remove(distantGalaxiesGroup);
        }
        planetLODs.forEach(lod => {
            if (lod.userData.hexMeshLOD) {
                lod.userData.hexMeshLOD.traverse(object => {
                    if (object.isMesh) {
                        object.geometry.dispose();
                        if(object.material) object.material.dispose();
                    }
                });
                scene.remove(lod.userData.hexMeshLOD);
            }
            lod.traverse(object => {
                if(object.isMesh) {
                    if(object.geometry) object.geometry.dispose();
                    if(object.material) object.material.dispose();
                }
            });
            scene.remove(lod);
        });
        planetLabels.forEach(label => {
            if (label.material.map) label.material.map.dispose();
            if (label.material) label.material.dispose();
            scene.remove(label);
        });
        orbitLines.forEach(line => {
            if (line.geometry) line.geometry.dispose();
            if (line.material) line.material.dispose();
            scene.remove(line);
        });
        landingSiteIcons.forEach(icon => {
            if (icon.material.map) icon.material.map.dispose();
            if (icon.material) icon.material.dispose();
            scene.remove(icon);
        });
        landingSiteIcons = [];
        if (playerShip) {
            if(playerShip.geometry) playerShip.geometry.dispose();
            if(playerShip.material) playerShip.material.dispose();
            scene.remove(playerShip);
        }
        if (shipTargetSignifier) {
            if(shipTargetSignifier.geometry) shipTargetSignifier.geometry.dispose();
            if(shipTargetSignifier.material) shipTargetSignifier.material.dispose();
            scene.remove(shipTargetSignifier);
        }

        if (renderer) {
            renderer.dispose();
            renderer.domElement.remove();
        }
        for (const texture of createdTextures) {
            if (texture) texture.dispose();
        }
        createdTextures = [];

        animationFrameId = null; boundWheelHandler = null; controls = null; sunLOD = null;
        planetLODs = []; orbitLines = []; orbitLineMaterials = []; backgroundStars = null;
        renderer = null; scene = null; camera = null; currentSystemData = null; distantGalaxiesGroup = null;
        planetLabels = []; playerShip = null; shipTargetSignifier = null; isSpawningMode = false;
        shipState.pathfinding.obstacles = [];
    }

    function _onSpawnClick(event) {
        if (!isSpawningMode) return;

        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersectionPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, intersectionPoint);

        if (intersectionPoint) {
            if (!playerShip) {
                playerShip = _createPlayerShip();
                scene.add(playerShip);
            }
            playerShip.position.copy(intersectionPoint);
            shipState.target = null;
            shipState.velocity.set(0, 0, 0);
        }

        isSpawningMode = false;
        renderer.domElement.style.cursor = 'default';
    }

    function _onMovementRightClick(event) {
        event.preventDefault();
        
        if (playerShip) {
            const rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);

            const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const targetPosition = new THREE.Vector3();
            raycaster.ray.intersectPlane(plane, targetPosition);

            if (targetPosition) {
                shipState.target = targetPosition;

                if (!shipTargetSignifier) {
                    const ringGeometry = new THREE.RingGeometry(300, 400, 32);
                    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffaa, side: THREE.DoubleSide, transparent: true });
                    shipTargetSignifier = new THREE.Mesh(ringGeometry, ringMaterial);
                    shipTargetSignifier.rotation.x = -Math.PI / 2;
                    scene.add(shipTargetSignifier);
                }
                shipTargetSignifier.position.copy(targetPosition);
                shipTargetSignifier.visible = true;
            }
        }
    }

    function _setupScene(container, solarSystemData) {
        _cleanup();
        scene = new THREE.Scene();
        const aspect = container.offsetWidth / container.offsetHeight;
        camera = new THREE.PerspectiveCamera(25, aspect, 1, 1000000);

        const sunVariation = sunVariations[solarSystemData.sun.type % sunVariations.length];
        if (sunVariation.sizeCategory === 'hypergiant') {
            camera.position.set(0, 200000, 60000);
        } else {
            camera.position.set(0, 140000, 40000);
        }
        camera.lookAt(0, 0, 0);
        
        initialCameraState = {
            position: camera.position.clone(),
            target: new THREE.Vector3(0, 0, 0)
        };
        
        scene.background = new THREE.Color(0x000000);
        _createDistantStars();
        _createDistantGalaxies();

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, logarithmicDepthBuffer: false });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(container.offsetWidth, container.offsetHeight);
        container.appendChild(renderer.domElement);
        
        controls = new OrbitControls(camera, renderer.domElement);
        Object.assign(controls, {
            enabled: true,
            enableDamping: true,
            dampingFactor: 0.05,
            screenSpacePanning: true,
            minDistance: DEFAULT_MIN_DISTANCE,
            maxDistance: 600000,
            enableZoom: false,
        });

        boundWheelHandler = (event) => {
            event.preventDefault();
            const camToTarget = new THREE.Vector3().subVectors(controls.target, camera.position);
            const dist = camToTarget.length();
            const zoomScale = 0.1;
            const proportionalZoomAmount = dist * zoomScale;
            let zoomFactor = event.deltaY < 0 ? -proportionalZoomAmount : proportionalZoomAmount;
            const newDist = THREE.MathUtils.clamp(dist + zoomFactor, controls.minDistance, controls.maxDistance);
            if (newDist !== dist) {
                camera.position.copy(controls.target).addScaledVector(camToTarget.normalize(), -newDist);
            }
        };
        renderer.domElement.addEventListener('wheel', boundWheelHandler, { passive: false });
        
        boundResizeHandler = _onResize;
        window.addEventListener('resize', boundResizeHandler);
        boundSpawnClickHandler = _onSpawnClick;
        renderer.domElement.addEventListener('click', boundSpawnClickHandler);
        boundRightClickHandler = _onMovementRightClick;
        renderer.domElement.addEventListener('contextmenu', boundRightClickHandler);


        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();
        sunLight = new THREE.PointLight(0xffffff, 1.8, 550000);
        scene.add(sunLight);
        scene.add(new THREE.AmbientLight(0xffffff, 0.1));
    }

    function _createOrbitLine(planet) {
        const a = planet.semiMajorAxis ?? 10000; 
        const e_raw = planet.orbitalEccentricity ?? 0.1;

        const e = Math.min(e_raw, 0.999);
        const b = a * Math.sqrt(1 - e * e);
        const focusOffset = a * e;

        const curve = new THREE.EllipseCurve(
            -focusOffset, 0,
            a, b,
            0, 2 * Math.PI,
            false,
            0
        );

        const points2D = curve.getPoints(256);
        const points3D = points2D.map(p => new THREE.Vector3(p.x, p.y, 0));

        const q_argP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), planet.argumentOfPeriapsis ?? 0);
        const q_inc = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), planet.orbitalInclination ?? 0);
        const q_LAN = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), planet.longitudeOfAscendingNode ?? 0);
        const finalQuaternion = new THREE.Quaternion().multiply(q_LAN).multiply(q_inc).multiply(q_argP);

        points3D.forEach(p => p.applyQuaternion(finalQuaternion));

        const positions = [];
        points3D.forEach(p => positions.push(p.x, p.y, p.z));

        const lineGeometry = new LineGeometry();
        lineGeometry.setPositions(positions);

        const lineMaterial = new LineMaterial({
            color: 0x888888,
            linewidth: 2,
            resolution: new THREE.Vector2(renderer.domElement.offsetWidth, renderer.domElement.offsetHeight),
            dashed: false,
            transparent: true,
            opacity: 0.2
        });
        orbitLineMaterials.push(lineMaterial);

        const orbitLine = new Line2(lineGeometry, lineMaterial);
        return orbitLine;
    }
    
    function _calculateAvoidanceForce() {
        const avoidanceForce = new THREE.Vector3();
        if (!playerShip) return avoidanceForce;

        const ahead = playerShip.position.clone().add(shipState.velocity.clone().normalize().multiplyScalar(10000));

        for (const obstacle of shipState.pathfinding.obstacles) {
            const distance = ahead.distanceTo(obstacle.position);
            if (distance <= obstacle.radius) {
                let force = ahead.clone().sub(obstacle.position);
                force.normalize().multiplyScalar(1 - distance / obstacle.radius);
                avoidanceForce.add(force);
            }
        }
        return avoidanceForce;
    }


    function _updatePlayerShip(deltaTime) {
        if (!playerShip) return;

        let steeringForce = new THREE.Vector3();

        if (shipState.target) {
            const distanceToTarget = playerShip.position.distanceTo(shipState.target);

            if (distanceToTarget > 150) {
                const desiredVelocity = new THREE.Vector3().subVectors(shipState.target, playerShip.position);
                desiredVelocity.normalize().multiplyScalar(shipState.maxSpeed);
                const seekForce = new THREE.Vector3().subVectors(desiredVelocity, shipState.velocity);
                steeringForce.add(seekForce);

                const avoidanceForce = _calculateAvoidanceForce();
                steeringForce.add(avoidanceForce.multiplyScalar(100));

                const brakingDistance = (shipState.velocity.lengthSq()) / (2 * (shipState.maxForce * 0.8));
                if (distanceToTarget < brakingDistance) {
                    const brakingForce = desiredVelocity.normalize().multiplyScalar(-shipState.maxSpeed * (1 - distanceToTarget / brakingDistance));
                     steeringForce.add(brakingForce);
                }
            } else {
                shipState.target = null;
                if(shipTargetSignifier) shipTargetSignifier.visible = false;
            }
        }

        if(!shipState.target) {
            shipState.velocity.multiplyScalar(0.95);
        }

        steeringForce.clampLength(0, shipState.maxForce);
        shipState.velocity.add(steeringForce.multiplyScalar(deltaTime));
        shipState.velocity.clampLength(0, shipState.maxSpeed);
        playerShip.position.add(shipState.velocity.clone().multiplyScalar(deltaTime));
        
        if (shipState.velocity.lengthSq() > 10) {
            const targetQuaternion = new THREE.Quaternion();
            const direction = shipState.velocity.clone().normalize();
            
            const up = new THREE.Vector3(0, 1, 0); 
            
            const matrix = new THREE.Matrix4().lookAt(playerShip.position, playerShip.position.clone().add(direction), up);
            targetQuaternion.setFromRotationMatrix(matrix);
            
            playerShip.quaternion.slerp(targetQuaternion, deltaTime * 5.0);
        }
    }


    function _animate(now) {
        if (!renderer) return;
        animationFrameId = requestAnimationFrame(_animate);

        const deltaTime = lastUpdateTime > 0 ? (now - lastUpdateTime) / 1000 : 0.016;
        lastUpdateTime = now;

        const totalElapsedTime = (now - simulationStartTime) / 1000;

        planetLODs.forEach(lod => {
            const planet = lod.userData;
            const orbitalAngularVelocity = (planet.orbitalSpeed ?? 0.1) * 0.1 * moduleState.orbitSpeedMultiplier;
            const angle = ((planet.currentOrbitalAngle ?? 0) + orbitalAngularVelocity * totalElapsedTime) % (2 * Math.PI);
            
            const a = planet.semiMajorAxis ?? 10000;
            const e = Math.min(planet.orbitalEccentricity ?? 0.1, 0.999);
            const b = a * Math.sqrt(1.0 - e * e);
            const focusOffset = a * e;

            const x_orbital = a * Math.cos(angle) - focusOffset;
            const y_orbital = b * Math.sin(angle);

            const pos_orbital_plane = new THREE.Vector3(x_orbital, y_orbital, 0);

            const q_argP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), planet.argumentOfPeriapsis ?? 0);
            const q_inc = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), planet.orbitalInclination ?? 0);
            const q_LAN = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), planet.longitudeOfAscendingNode ?? 0);
            const finalQuaternion = new THREE.Quaternion().multiply(q_LAN).multiply(q_inc).multiply(q_argP);
            
            lod.position.copy(pos_orbital_plane).applyQuaternion(finalQuaternion);

            const axialAngularVelocity = (planet.axialSpeed ?? 0.01) * 2;
            const newAxialAngle = (planet.initialAxialAngle ?? 0) + (axialAngularVelocity * totalElapsedTime);
            lod.rotation.y = newAxialAngle;
            
            if(lod.userData.hexMeshLOD) {
                lod.userData.hexMeshLOD.position.copy(lod.position);
                lod.userData.hexMeshLOD.rotation.copy(lod.rotation);
            }
        });

        if (unfocusAnimation) {
            const elapsedTime = performance.now() - unfocusAnimation.startTime;
            const progress = Math.min(elapsedTime / unfocusAnimation.duration, 1.0);
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            camera.position.lerpVectors(unfocusAnimation.startPosition, unfocusAnimation.endPosition, easedProgress);
            controls.target.lerpVectors(unfocusAnimation.startTarget, unfocusAnimation.endTarget, easedProgress);
            if (progress >= 1.0) {
                unfocusAnimation = null;
                preFocusState = null;
                controls.enabled = true;
                unfocus(true);
            }
        } else if (focusAnimation) {
            const elapsedTime = performance.now() - focusAnimation.startTime;
            const progress = Math.min(elapsedTime / focusAnimation.duration, 1.0);
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            const planetPos = focusAnimation.targetPlanetLOD.getWorldPosition(new THREE.Vector3());
            const desiredCamPos = planetPos.clone().add(focusAnimation.cameraOffset);
            camera.position.lerpVectors(focusAnimation.startPosition, desiredCamPos, easedProgress);
            controls.target.lerpVectors(focusAnimation.startTarget, planetPos, easedProgress);
            
            const dist = camera.position.distanceTo(planetPos);
            const swapDist = focusAnimation.targetPlanetLOD.userData.size * 10;
            if(dist < swapDist && !focusAnimation.swapped) {
                focusAnimation.targetPlanetLOD.visible = false;
                if(focusAnimation.targetPlanetLOD.userData.hexMeshLOD) {
                    focusAnimation.targetPlanetLOD.userData.hexMeshLOD.visible = true;
                }
                focusAnimation.swapped = true;
            }

            if (progress >= 1.0) {
                followedPlanetLOD = focusAnimation.targetPlanetLOD;
                controls.target.copy(followedPlanetLOD.getWorldPosition(new THREE.Vector3()));
                focusAnimation = null;
                controls.enabled = true;
                controls.enablePan = false;
                controls.minPolarAngle = 0;
                controls.maxPolarAngle = Math.PI;
                controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
                controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
                controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
            }
        } else if (followedPlanetLOD) {
            const newPlanetWorldPos = followedPlanetLOD.getWorldPosition(new THREE.Vector3());
            const delta = new THREE.Vector3().subVectors(newPlanetWorldPos, controls.target);
            camera.position.add(delta);
            controls.target.copy(newPlanetWorldPos);
        }

        controls.update();

        const zoomDistance = camera.position.distanceTo(controls.target);
        
        const labelFadeStart = 80000;
        const labelFadeEnd = 50000;
        let labelBaseOpacity = (followedPlanetLOD) ? 0 : THREE.MathUtils.smoothstep(zoomDistance, labelFadeEnd, labelFadeStart);

        planetLabels.forEach(label => {
            const planetLOD = planetLODs.find(p => p.userData.id === label.userData.planetId);
            if (planetLOD) {
                const yOffset = planetLOD.userData.size * 2.0;
                label.position.copy(planetLOD.position).y += yOffset;
                label.material.opacity = labelBaseOpacity;
            }
        });

        const maxOrbitOpacity = 0.2;
        const orbitFadeStart = 120000;
        const orbitFadeEnd = 30000;
        const fadeAmount = THREE.MathUtils.smoothstep(zoomDistance, orbitFadeEnd, orbitFadeStart);
        const orbitOpacity = fadeAmount * maxOrbitOpacity;
        orbitLineMaterials.forEach(material => {
            material.opacity = orbitOpacity;
        });

        _updateLandingSiteIcons(deltaTime);
        _updatePlayerShip(deltaTime);

        if (backgroundStars) backgroundStars.position.copy(camera.position);
        if (distantGalaxiesGroup) distantGalaxiesGroup.rotation.y += 0.00005;
        
        const sunPosition = new THREE.Vector3(0, 0, 0);
        const distanceToSun = camera.position.distanceTo(sunPosition);
        if (!followedPlanetLOD && sunRadius > 0 && distanceToSun < sunRadius * 1.1) {
            const direction = camera.position.clone().normalize();
            camera.position.copy(direction.multiplyScalar(sunRadius * 1.1));
        }

        if (distantGalaxiesGroup) distantGalaxiesGroup.rotation.y += 0.00005;
        if (sunLOD) {
            sunLOD.rotation.y += 0.0001;
            sunLOD.update(camera);
            sunLOD.levels.forEach(level => {
                if (level.object.material.uniforms) level.object.material.uniforms.time.value = now * 0.0003;
            });
        }
        renderer.render(scene, camera);
    }
    
    function setOrbitSpeed(multiplier) {
        moduleState.orbitSpeedMultiplier = Number(multiplier);
    }
    
    function setShipSpeed(speed) {
        if(shipState) shipState.maxSpeed = speed;
    }

    function setOrbitLinesVisible(visible) {
        orbitLines.forEach(line => {
            line.visible = visible;
        });
    }

    function setLandingIconSize(multiplier) {
        moduleState.landingIconSizeMultiplier = Number(multiplier);
    }

    function unfocus(fromAnimation = false) {
        if (focusAnimation) {
            focusAnimation = null;
        }

        if (!fromAnimation && (followedPlanetLOD || preFocusState)) {
            unfocusAnimation = {
                startTime: performance.now(),
                duration: 1200,
                startPosition: camera.position.clone(),
                startTarget: controls.target.clone(),
                endPosition: preFocusState ? preFocusState.position : initialCameraState.position,
                endTarget: preFocusState ? preFocusState.target : initialCameraState.target
            };
            controls.enabled = false;
        } else {
            controls.minDistance = DEFAULT_MIN_DISTANCE;
            controls.enablePan = true;
            controls.minPolarAngle = 0.1;
            controls.maxPolarAngle = Math.PI / 2 - 0.1;
            controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
            controls.mouseButtons.MIDDLE = THREE.MOUSE.ROTATE;
            controls.mouseButtons.RIGHT = -1;
        }

        planetLODs.forEach(lod => {
            lod.visible = true;
            if (lod.userData.hexMeshLOD) {
                lod.userData.hexMeshLOD.visible = false;
            }
        });

        if (followedPlanetLOD) {
            followedPlanetLOD = null;
        }
    }

    function focusOnPlanet(planetId) {
        const targetPlanetLOD = planetLODs.find(p => p.userData.id === planetId);
        if (!targetPlanetLOD) return;
    
        if (unfocusAnimation) unfocusAnimation = null;

        if(!preFocusState) {
            preFocusState = {
                position: camera.position.clone(),
                target: controls.target.clone()
            };
        }
        
        const radius = targetPlanetLOD.userData.size;
        controls.minDistance = radius * 1.2;
    
        focusAnimation = {
            targetPlanetLOD: targetPlanetLOD,
            startTime: performance.now(),
            duration: 1600,
            startPosition: camera.position.clone(),
            startTarget: controls.target.clone(),
            cameraOffset: new THREE.Vector3(0, radius * 1.5, radius * 3.5),
            swapped: false
        };
        controls.enabled = false;
    }

    function getFollowedPlanetId() {
        return followedPlanetLOD ? followedPlanetLOD.userData.id : null;
    }

    return {
        init: (solarSystemData, initialDevSettings) => {
            const container = document.getElementById('solar-system-content');
            if (!container) return console.error("SolarSystemRenderer: Container #solar-system-content not found.");
            container.innerHTML = '';
            _setupScene(container, solarSystemData);
            currentSystemData = solarSystemData;

            simulationStartTime = performance.now();
            lastUpdateTime = simulationStartTime;

            sunLOD = _createSun(solarSystemData.sun);
            scene.add(sunLOD);
            
            solarSystemData.planets.forEach(planet => {
                const planetLOD = _createPlanetLOD(planet);
                planetLODs.push(planetLOD);
                scene.add(planetLOD);

                const hexLOD = _createHexPlanetMeshLOD(planet);
                hexLOD.visible = false;
                planetLOD.userData.hexMeshLOD = hexLOD;
                scene.add(hexLOD);
                
                const label = _createPlanetLabel(planet);
                planetLabels.push(label);
                scene.add(label);

                const orbitLine = _createOrbitLine(planet);
                orbitLines.push(orbitLine);
                scene.add(orbitLine);

                _createLandingSiteIcons(planetLOD);
            });

            if(initialDevSettings) {
                setOrbitLinesVisible(initialDevSettings.orbitLinesVisible);
                setOrbitSpeed(initialDevSettings.orbitSpeed);
                setShipSpeed(initialDevSettings.shipSpeed);
                setLandingIconSize(initialDevSettings.landingIconSize);
            }

            unfocus(true);
            _animate(simulationStartTime);
        },
        enterSpawningMode: () => {
            isSpawningMode = true;
            if (renderer) renderer.domElement.style.cursor = 'crosshair';
        },
        dispose: () => _cleanup(),
        setOrbitLinesVisible,
        setOrbitSpeed,
        setShipSpeed,
        setLandingIconSize,
        focusOnPlanet,
        unfocus,
        getFollowedPlanetId,
        getPlanetMeshes: () => planetLODs,
        getRaycaster: () => raycaster,
        getMouse: () => mouse,
        getCamera: () => camera,
        getLandingSiteIcons: () => landingSiteIcons,
    };
})();
