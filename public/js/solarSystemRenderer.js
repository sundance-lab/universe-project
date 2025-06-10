import * as THREE from 'three';
import { getPlanetShaders } from './shaders.js';

// MODULE STATE
let scene, camera, renderer, sunLOD, corona;
let planetMeshes = new Map();
let containerElement;

// SUN CONFIG (Adapted from sunRenderer.js)
const sunLODLevels = {
    ULTRA_CLOSE: { distance: 150, segments: 512 },
    CLOSE: { distance: 300, segments: 256 },
    MEDIUM: { distance: 600, segments: 128 },
    FAR: { distance: 1200, segments: 64 }
};
const sunVariations = [
    { baseColor: new THREE.Color(0x4A90E2), glowColor: new THREE.Color(0x64B5F6), coronaColor: new THREE.Color(0x90CAF9) },
    { baseColor: new THREE.Color(0xFF5722), glowColor: new THREE.Color(0xFF7043), coronaColor: new THREE.Color(0xFFAB91) },
    { baseColor: new THREE.Color(0xFFA500), glowColor: new THREE.Color(0xFFDF00), coronaColor: new THREE.Color(0xFFA726) },
    { baseColor: new THREE.Color(0xE0E0E0), glowColor: new THREE.Color(0x82B1FF), coronaColor: new THREE.Color(0xBBDEFB) },
    { baseColor: new THREE.Color(0xE65100), glowColor: new THREE.Color(0xFFD740), coronaColor: new THREE.Color(0xFFC107) }
];

// SUN CREATION
function _createSun(sunSize, sunTypeIndex) {
    const variation = sunVariations[sunTypeIndex];
    const newSunLOD = new THREE.LOD();

    Object.values(sunLODLevels).forEach(level => {
        const geometry = new THREE.SphereGeometry(sunSize, level.segments, level.segments);
        const material = new THREE.MeshBasicMaterial({ color: variation.baseColor });
        const sunMesh = new THREE.Mesh(geometry, material);
        newSunLOD.addLevel(sunMesh, level.distance);
    });

    const coronaGeometry = new THREE.PlaneGeometry(sunSize * 20, sunSize * 20);
    const coronaMaterial = new THREE.MeshBasicMaterial({
        color: variation.coronaColor,
        map: new THREE.TextureLoader().load('https://threejs.org/examples/textures/sprites/circle.png'), // Simple texture for glow
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.5,
        depthWrite: false
    });
    const newCorona = new THREE.Mesh(coronaGeometry, coronaMaterial);
    return { sunLOD: newSunLOD, corona: newCorona };
}

// PLANET CREATION
function _createPlanet(planetData) {
    const { vertexShader, fragmentShader } = getPlanetShaders();
    const geometry = new THREE.SphereGeometry(planetData.size, 64, 32);

    const terrainRange = Math.max(0.1, planetData.maxTerrainHeight - planetData.minTerrainHeight);
    const normalizedOceanLevel = (planetData.oceanHeightLevel - planetData.minTerrainHeight) / terrainRange;
    const displacementAmount = terrainRange * 0.1; // Visual scale factor

    const material = new THREE.ShaderMaterial({
        uniforms: {
            uLandColor: { value: new THREE.Color(planetData.landColor) },
            uWaterColor: { value: new THREE.Color(planetData.waterColor) },
            uOceanHeightLevel: { value: normalizedOceanLevel - 0.5 },
            uContinentSeed: { value: planetData.continentSeed },
            uRiverBasin: { value: planetData.riverBasin },
            uForestDensity: { value: planetData.forestDensity },
            uSphereRadius: { value: planetData.size },
            uDisplacementAmount: { value: displacementAmount },
            uTime: { value: 0.0 }
        },
        vertexShader,
        fragmentShader
    });

    return new THREE.Mesh(geometry, material);
}

// PUBLIC API
export function init(container, solarSystemData, sunSize) {
    containerElement = container;
    scene = new THREE.Scene();

    const aspect = container.offsetWidth / container.offsetHeight;
    const frustumSize = 2 * (window.SOLAR_SYSTEM_EXPLORABLE_RADIUS || 2000);
    camera = new THREE.OrthographicCamera(frustumSize * aspect / -2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / -2, 1, 20000);
    camera.position.z = 500;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.offsetWidth, container.offsetHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const sunObjects = _createSun(sunSize, Math.floor(Math.random() * sunVariations.length));
    sunLOD = sunObjects.sunLOD;
    corona = sunObjects.corona;
    scene.add(sunLOD);
    scene.add(corona);

    planetMeshes.clear();
    solarSystemData.planets.forEach(planet => {
        const planetMesh = _createPlanet(planet);
        planet.mesh = planetMesh; // Attach mesh to data object
        planetMeshes.set(planet.id, planetMesh);
        scene.add(planetMesh);
    });

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
}

export function update(time, solarSystemData) {
    if (!renderer || !scene || !camera || !solarSystemData) return;

    sunLOD.rotation.y += 0.001;
    corona.quaternion.copy(camera.quaternion);

    solarSystemData.planets.forEach(planet => {
        const mesh = planetMeshes.get(planet.id);
        if (mesh) {
            const xOrbit = planet.distance * Math.cos(planet.currentOrbitalAngle);
            const yOrbit = planet.distance * Math.sin(planet.currentOrbitalAngle);
            mesh.position.set(xOrbit, yOrbit, 0);
            mesh.rotation.z = planet.currentAxialAngle;
            if (mesh.material.uniforms.uTime) {
                mesh.material.uniforms.uTime.value = time * 0.01;
            }
        }
    });
    renderer.render(scene, camera);
}

export function handlePanAndZoom(panX, panY, zoom) {
    if (!camera) return;
    camera.position.x = -panX;
    camera.position.y = panY;
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
}

export function handleResize() {
    if (!renderer || !camera || !containerElement) return;
    const width = containerElement.offsetWidth;
    const height = containerElement.offsetHeight;
    const aspect = width / height;
    
    camera.left = camera.bottom * aspect;
    camera.right = camera.top * aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

export function dispose() {
    if (!scene) return;
    cancelAnimationFrame(window.animationFrameId);
    scene.traverse(object => {
        if (object.isMesh) {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(m => m.dispose());
                } else {
                    object.material.dispose();
                }
            }
        }
    });
    renderer.dispose();
    planetMeshes.clear();
    scene = null;
    camera = null;
    renderer = null;
}
