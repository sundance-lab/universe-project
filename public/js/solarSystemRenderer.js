/*
File: sundance-lab/universe-project/universe-project-b044ce4d52b6181af39f9a6378ca10b19a7c04d4/public/js/solarSystemRenderer.js
*/

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { getPlanetShaders } from './shaders.js';

// --- Sun Creation Logic ---
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


// --- Background Helpers (Copied from Galaxy Renderer for consistency) ---
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
    let planetMeshes = [];
    let orbitLines = [];
    let currentSystemData = null;
    let animationFrameId = null;
    let lastAnimateTime = null;
    let raycaster, mouse;
    let boundWheelHandler = null;
    let cameraAnimation = null;
    let focusedPlanetMesh = null;

    const moduleState = {
        orbitSpeedMultiplier: 1.0
    };

    const SPHERE_BASE_RADIUS = 0.8;
    const DISPLACEMENT_SCALING_FACTOR = 0.005;

    function _createSun(sunData) {
        const variation = sunVariations[sunData.type % sunVariations.length];
        const baseSize = sizeTiers[variation.sizeCategory].size;
        const detailMultiplier = sizeTiers[variation.sizeCategory].detailMultiplier;
        const sizeVariation = 0.5 + Math.random() * 1.5;
        const finalSize = baseSize * sizeVariation;
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
        return lod;
    }

    function _createPlanetMesh(planetData) {
        const { vertexShader, fragmentShader } = getPlanetShaders();
        const geometry = new THREE.SphereGeometry(planetData.size, 32, 32);
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
            fragmentShader,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData = { ...planetData, lastPosition: new THREE.Vector3(), lastWorldPosition: new THREE.Vector3() };
        return mesh;
    }

    function _createParticleSystem(positions, colors, size, texture, opacity, blending, depthWrite, sizeAttenuation = true, vertexColors = true) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        if (vertexColors && colors.length > 0) {
            geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        }

        const materialParams = {
            size: size,
            map: texture,
            sizeAttenuation: sizeAttenuation,
            depthWrite: depthWrite,
            blending: blending,
            transparent: true,
            opacity: opacity,
        };
        if (vertexColors && colors.length > 0) materialParams.vertexColors = true;
        const material = new THREE.PointsMaterial(materialParams);
        return new THREE.Points(geometry, material);
    }

    function _createDistantStars() {
        const starCount = 60000;
        const starFieldSize = 900000;
        const positions = [];
        const colors = [];
        const sizes = [];
        const colorPalette = [
            new THREE.Color(0xFF8C00), new THREE.Color(0xFFDAB9),
            new THREE.Color(0x87CEEB), new THREE.Color(0xFFFFFF)
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
            MIN_OPACITY: 0.2, MAX_OPACITY: 0.5,
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
    
    function _cleanup() {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        if (renderer?.domElement && boundWheelHandler) renderer.domElement.removeEventListener('wheel', boundWheelHandler);
        if(controls) {
            controls.removeEventListener('start', onControlsStart);
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
        planetMeshes.forEach(mesh => {
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
            scene.remove(mesh);
        });
        orbitLines.forEach(line => {
            if (line.geometry) line.geometry.dispose();
            if (line.material) line.material.dispose();
            scene.remove(line);
        });
        if (renderer) {
            renderer.dispose();
            renderer.domElement.remove();
        }
        for (const texture of createdTextures) {
            if (texture) texture.dispose();
        }
        createdTextures = [];

        animationFrameId = null; boundWheelHandler = null; controls = null; sunLOD = null;
        planetMeshes = []; orbitLines = []; backgroundStars = null; lastAnimateTime = null;
        renderer = null; scene = null; camera = null; currentSystemData = null; distantGalaxiesGroup = null;
    }

    function onControlsStart() {
        if (cameraAnimation) return;

        if (focusedPlanetMesh) {
            controls.autoRotate = false;
        }
    }

    function _setupScene(container) {
        _cleanup();
        scene = new THREE.Scene();
        const aspect = container.offsetWidth / container.offsetHeight;
        camera = new THREE.PerspectiveCamera(60, aspect, 1, 1000000);
        camera.position.set(0, 40000, 20000);
        camera.lookAt(0, 0, 0);
        
        scene.background = new THREE.Color(0x000000);
        _createDistantStars();
        _createDistantGalaxies();

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(container.offsetWidth, container.offsetHeight);
        container.appendChild(renderer.domElement);
        controls = new OrbitControls(camera, renderer.domElement);
        Object.assign(controls, {
            enabled: true,
            enableDamping: true, dampingFactor: 0.05, screenSpacePanning: true,
            minDistance: 50, maxDistance: 450000, enablePan: true, rotateSpeed: 0.4,
            mouseButtons: { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN },
            enableZoom: false,
            autoRotate: false,
            autoRotateSpeed: 0.5
        });

        controls.addEventListener('start', onControlsStart);

        boundWheelHandler = (event) => {
            event.preventDefault();

            if (!cameraAnimation && focusedPlanetMesh) {
                controls.autoRotate = false;
            }

            const linearZoomAmount = 1000; 
            let zoomFactor = event.deltaY < 0 ? -linearZoomAmount : linearZoomAmount;

            const camToTarget = new THREE.Vector3().subVectors(controls.target, camera.position);
            const dist = camToTarget.length();
            const newDist = THREE.MathUtils.clamp(dist + zoomFactor, controls.minDistance, controls.maxDistance);
            
            camera.position.copy(controls.target).addScaledVector(camToTarget.normalize(), -newDist);
        };
        renderer.domElement.addEventListener('wheel', boundWheelHandler, { passive: false });
        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();
        sunLight = new THREE.PointLight(0xffffff, 1.8, 550000);
        scene.add(sunLight);
        scene.add(new THREE.AmbientLight(0xffffff, 0.1));
    }

    function _animate(now) {
        if (!renderer) return;
        animationFrameId = requestAnimationFrame(_animate);
        if (lastAnimateTime === null) lastAnimateTime = now;
        const deltaTime = (now - lastAnimateTime) / 1000;
        lastAnimateTime = now;

        planetMeshes.forEach(mesh => {
            const planet = mesh.userData;
            mesh.getWorldPosition(planet.lastWorldPosition);
            
            planet.lastPosition.copy(mesh.position);
            planet.currentOrbitalAngle += planet.orbitalSpeed * 0.1 * deltaTime * moduleState.orbitSpeedMultiplier;
            planet.currentAxialAngle += planet.axialSpeed * 2 * deltaTime;
            
            mesh.rotation.y = planet.currentAxialAngle;
            const x = planet.orbitalRadius * Math.cos(planet.currentOrbitalAngle);
            const z = planet.orbitalRadius * Math.sin(planet.currentOrbitalAngle); 
            mesh.position.set(x, 0, z);
            mesh.material.uniforms.uLightDirection.value.copy(mesh.position).negate().normalize();
        });
        
        controls.enableDamping = true;

        if (cameraAnimation) {
            const distanceToTarget = camera.position.distanceTo(cameraAnimation.targetPosition);
            const speed = 0.04;

            if (focusedPlanetMesh) {
                const currentPlanetWorldPosition = new THREE.Vector3();
                focusedPlanetMesh.getWorldPosition(currentPlanetWorldPosition);
                cameraAnimation.targetLookAt.copy(currentPlanetWorldPosition);
            }

            camera.position.lerp(cameraAnimation.targetPosition, speed);
            controls.target.lerp(cameraAnimation.targetLookAt, speed);
            
            if (distanceToTarget < 1) {
                camera.position.copy(cameraAnimation.targetPosition);
                controls.target.copy(cameraAnimation.targetLookAt);
                cameraAnimation = null;
                controls.enabled = true;
                if (!focusedPlanetMesh) {
                    controls.minDistance = 50; 
                }
            }
        } else if (focusedPlanetMesh) {
            const newPlanetPosition = new THREE.Vector3();
            focusedPlanetMesh.getWorldPosition(newPlanetPosition);
            const oldPlanetPosition = focusedPlanetMesh.userData.lastWorldPosition;

            const delta = new THREE.Vector3().subVectors(newPlanetPosition, oldPlanetPosition);
            
            camera.position.add(delta);
            controls.target.add(delta);
        }
        
        controls.update();
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
    
// in public/js/solarSystemRenderer.js

// In public/js/solarSystemRenderer.js

function focusOnPlanet(planetId) {
    controls.saveState();
    controls.enabled = false;

    focusedPlanetMesh = planetMeshes.find(p => p.userData.id === planetId);

    if (!focusedPlanetMesh) {
        console.warn(`focusOnPlanet: Planet with ID ${planetId} not found.`);
        return false;
    }
    
    const planetWorldPosition = new THREE.Vector3();
    focusedPlanetMesh.getWorldPosition(planetWorldPosition);
    
    // Set the new min zoom distance for the controls
    controls.minDistance = focusedPlanetMesh.userData.size * 1.2;
    controls.enablePan = false;

    // --- NEW, MORE RELIABLE LOGIC ---
    // 1. Define the distance we want to be from the planet (max zoom).
    const desiredDistance = controls.minDistance;

    // 2. Define a standard direction for the camera's offset (e.g., slightly above and behind).
    const offsetDirection = new THREE.Vector3(0, 0.4, 1).normalize();

    // 3. Create the final offset vector by scaling our direction by the desired distance.
    const offset = offsetDirection.multiplyScalar(desiredDistance);

    // 4. Calculate the camera's target position by adding the offset to the planet's position.
    const targetPosition = planetWorldPosition.clone().add(offset);
    // --- END OF NEW LOGIC ---

    // This check to see if the sun is in the way is still useful.
    const direction = new THREE.Vector3().subVectors(planetWorldPosition, camera.position).normalize();
    raycaster.set(camera.position, direction);
    const intersects = raycaster.intersectObjects(sunLOD.children);
    
    if (intersects.length > 0 && intersects[0].distance < camera.position.distanceTo(planetWorldPosition)) {
        targetPosition.y += 20000;
    }
    
    // The look-at target is always the center of the planet
    cameraAnimation = { targetPosition: targetPosition, targetLookAt: planetWorldPosition.clone() };
    controls.autoRotate = false;

    return true;
}
    function unfocusPlanet() {
        if (!focusedPlanetMesh && !cameraAnimation) return;
        controls.enabled = false;

        const savedPosition = controls.position0.clone();
        const savedTarget = controls.target0.clone();
        
        focusedPlanetMesh = null;
        controls.autoRotate = false;
        controls.enablePan = true;
        
        cameraAnimation = {
            targetPosition: savedPosition,
            targetLookAt: savedTarget,
        };
    }
    
    function setOrbitSpeed(multiplier) {
        moduleState.orbitSpeedMultiplier = Number(multiplier);
    }

    function setOrbitLinesVisible(visible) {
        orbitLines.forEach(line => {
            line.visible = visible;
        });
    }

    return {
        init: (solarSystemData, initialDevSettings) => {
            const container = document.getElementById('solar-system-content');
            if (!container) return console.error("SolarSystemRenderer: Container #solar-system-content not found.");
            container.innerHTML = '';
            _setupScene(container);
            currentSystemData = solarSystemData;

            sunLOD = _createSun(solarSystemData.sun);
            scene.add(sunLOD);
            
            // Set sun mesh and its light to be initially off to prevent flash
            sunLOD.visible = false;
            if (sunLight) sunLight.intensity = 0.0;

            solarSystemData.planets.forEach(planet => {
                const planetMesh = _createPlanetMesh(planet);
                planetMeshes.push(planetMesh);
                scene.add(planetMesh);
                const orbitGeometry = new THREE.BufferGeometry().setFromPoints(new THREE.Path().absarc(0, 0, planet.orbitalRadius, 0, Math.PI * 2, false).getPoints(256));
                const orbitMaterial = new THREE.LineBasicMaterial({ color: 0x444444 });
                const orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
                orbitLine.rotation.x = Math.PI / 2;
                orbitLines.push(orbitLine);
                scene.add(orbitLine);
            });

            if(initialDevSettings) {
                setOrbitLinesVisible(initialDevSettings.orbitLinesVisible);
                setOrbitSpeed(initialDevSettings.orbitSpeed);
            }

            lastAnimateTime = performance.now();
            _animate(lastAnimateTime);
            
            // After a brief delay, make the sun and its light visible.
            setTimeout(() => {
                if (sunLOD) sunLOD.visible = true;
                if (sunLight) sunLight.intensity = 1.8;
            }, 50);
        },
        dispose: () => _cleanup(),
        focusOnPlanet,
        unfocusPlanet,
        setOrbitLinesVisible,
        setOrbitSpeed,
        getPlanetMeshes: () => planetMeshes,
        getRaycaster: () => raycaster,
        getMouse: () => mouse,
        getCamera: () => camera,
    };
})();
