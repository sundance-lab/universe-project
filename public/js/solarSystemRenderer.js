// public/js/solarSystemRenderer.js

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { getPlanetShaders } from './shaders.js';

// --- Sun Creation Logic (Integrated from sunRenderer.js) ---
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

export const SolarSystemRenderer = (() => {
    let scene, camera, renderer, controls;
    let sunLOD, sunLight, skybox;
    let planetMeshes = [];
    let orbitLines = [];
    let currentSystemData = null;
    let animationFrameId = null;
    let lastAnimateTime = null;
    let raycaster, mouse;
    let boundWheelHandler = null;

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
            uniforms: {
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
            },
            vertexShader,
            fragmentShader,
            lights: true // <-- FIX: This tells Three.js to include lighting and camera uniforms
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData = { ...planetData };
        return mesh;
    }

    function _cleanup() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        
        if (renderer?.domElement && boundWheelHandler) {
            renderer.domElement.removeEventListener('wheel', boundWheelHandler);
            boundWheelHandler = null;
        }

        if (renderer?.domElement) {
            renderer.domElement.removeEventListener('click', _onPlanetClick);
        }

        if(controls) {
            controls.dispose();
            controls = null;
        }

        if (sunLOD) {
            sunLOD.traverse(object => {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(material => material.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            });
            scene.remove(sunLOD);
            sunLOD = null;
        }


        planetMeshes.forEach(mesh => {
            mesh.geometry.dispose();
            mesh.material.dispose();
            scene.remove(mesh);
        });
        planetMeshes = [];

        orbitLines.forEach(line => {
            line.geometry.dispose();
            line.material.dispose();
            scene.remove(line);
        });
        orbitLines = [];
        
        skybox = null;
        lastAnimateTime = null;

        if (renderer) {
            renderer.dispose();
            renderer.domElement.remove();
            renderer = null;
        }

        scene = null;
        camera = null;
        currentSystemData = null;
    }

    function _setupScene(container) {
        _cleanup();

        scene = new THREE.Scene();
        const width = container.offsetWidth;
        const height = container.offsetHeight;
        const aspect = width / height;

        camera = new THREE.PerspectiveCamera(60, aspect, 100, 600000);
        camera.position.set(0, 40000, 20000);
        camera.lookAt(0, 0, 0);

        const textureLoader = new THREE.TextureLoader();
        textureLoader.load('https://cdn.jsdelivr.net/gh/jeromeetienne/threex.planets@master/images/galaxy_starfield.png', (texture) => {
            const skySphere = new THREE.SphereGeometry(500000, 60, 40);
            const skyMaterial = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.BackSide
            });
            skybox = new THREE.Mesh(skySphere, skyMaterial);
            scene.add(skybox);
        }, undefined, (err) => {
            console.error("Failed to load skybox texture:", err);
            scene.background = new THREE.Color(0x000000);
        });

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(width, height);
        container.appendChild(renderer.domElement);

        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.screenSpacePanning = true;
        controls.minDistance = 50;
        controls.maxDistance = 450000;
        controls.enablePan = true;
        
        controls.rotateSpeed = 0.4;

        controls.mouseButtons = {
            LEFT: THREE.MOUSE.PAN,
            MIDDLE: THREE.MOUSE.PAN,
            RIGHT: THREE.MOUSE.ROTATE
        }
        
        controls.enableZoom = false;

        boundWheelHandler = (event) => {
            event.preventDefault();
        
            const linearZoomAmount = 1000;
        
            let zoomFactor = 0;
            if (event.deltaY < 0) {
                zoomFactor = -linearZoomAmount;
            } else {
                zoomFactor = linearZoomAmount;
            }
        
            const camToTarget = new THREE.Vector3().subVectors(controls.target, camera.position);
            
            const newDist = THREE.MathUtils.clamp(
                camToTarget.length() + zoomFactor,
                controls.minDistance,
                controls.maxDistance
            );
        
            camera.position.copy(controls.target).addScaledVector(camToTarget.normalize(), -newDist);
        
            controls.update();
        };

        renderer.domElement.addEventListener('wheel', boundWheelHandler, { passive: false });

        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();
        renderer.domElement.addEventListener('click', _onPlanetClick, false);


        sunLight = new THREE.PointLight(0xffffff, 2.5, 550000);
        scene.add(sunLight);
        scene.add(new THREE.AmbientLight(0xffffff, 0.1));
    }

    function _onPlanetClick(event) {
        event.preventDefault();
        if (!renderer || !camera || planetMeshes.length === 0) return;

        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        const intersects = raycaster.intersectObjects(planetMeshes);

        if (intersects.length > 0) {
            const clickedPlanetData = intersects[0].object.userData;
            
            // This is the robust fix for the back button.
            // It captures the ID at the moment of the click, preventing any issues.
            const systemId = currentSystemData.id;
            const onBackCallback = () => {
                window.switchToSolarSystemView(systemId);
            };

            if (window.switchToHexPlanetView) {
                window.switchToHexPlanetView(clickedPlanetData, onBackCallback);
            }
        }
    }

    function _animate(now) {
        if (!renderer) return; // Exit if disposed
        animationFrameId = requestAnimationFrame(_animate);

        // This block is the fix for the orbiting planets.
        // It consolidates all animation logic into the renderer.
        if (lastAnimateTime === null) lastAnimateTime = now;
        const deltaTime = (now - lastAnimateTime) / 1000;
        lastAnimateTime = now;

        if (currentSystemData?.planets) {
            currentSystemData.planets.forEach(planet => {
                planet.currentOrbitalAngle += planet.orbitalSpeed * 0.1 * deltaTime;
                planet.currentAxialAngle += planet.axialSpeed * 2 * deltaTime;
            });
        }

        if(controls) controls.update();
        
        if (skybox) {
            skybox.rotation.y += 0.00002;
        }

        if (sunLOD) {
            sunLOD.rotation.y += 0.0001;
            sunLOD.update(camera);
            sunLOD.levels.forEach(level => {
                if (level.object.material.uniforms) {
                    level.object.material.uniforms.time.value = now * 0.0003;
                }
            });
        }

        if (currentSystemData && currentSystemData.planets) {
            currentSystemData.planets.forEach((planet, index) => {
                const mesh = planetMeshes[index];
                if (mesh) {
                    mesh.rotation.y = planet.currentAxialAngle;
                    const x = planet.orbitalRadius * Math.cos(planet.currentOrbitalAngle);
                    const z = planet.orbitalRadius * Math.sin(planet.currentOrbitalAngle);
                    mesh.position.set(x, 0, z);
                    mesh.material.uniforms.uLightDirection.value.copy(mesh.position).negate().normalize();
                }
            });
        }

        renderer.render(scene, camera);
    }

    return {
        init: (solarSystemData) => {
            const container = document.getElementById('solar-system-content');
            if (!container) {
                console.error("SolarSystemRenderer: Container #solar-system-content not found.");
                return;
            }
            container.innerHTML = '';

            _setupScene(container);

            currentSystemData = solarSystemData;

            sunLOD = _createSun(solarSystemData.sun);
            scene.add(sunLOD);

            solarSystemData.planets.forEach(planet => {
                const planetMesh = _createPlanetMesh(planet);
                planetMeshes.push(planetMesh);
                scene.add(planetMesh);

                const orbitGeometry = new THREE.BufferGeometry().setFromPoints(
                    new THREE.Path().absarc(0, 0, planet.orbitalRadius, 0, Math.PI * 2, false).getPoints(256)
                );
                const orbitMaterial = new THREE.LineBasicMaterial({ color: 0x444444 });
                const orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
                orbitLine.rotation.x = Math.PI / 2;
                orbitLines.push(orbitLine);
                scene.add(orbitLine);
            });

            lastAnimateTime = performance.now();
            _animate(lastAnimateTime);
        },

        dispose: () => {
            _cleanup();
        }
    };
})();
