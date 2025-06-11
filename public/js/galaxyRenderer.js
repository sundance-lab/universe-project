// public/js/galaxyRenderer.js
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export const GalaxyRenderer = (() => {
let scene, camera, renderer, controls, raycaster, mouse;
let galaxyGroup, solarSystemParticles;
let animationFrameId = null;
let onSystemClickCallback = null;
let solarSystemData = [];

const sunVariations = [
    { baseColor: new THREE.Color(0x4A90E2) }, // Blueish
    { baseColor: new THREE.Color(0xFF5722) }, // Red-Orange
    { baseColor: new THREE.Color(0xFFA500) }, // Orange
    { baseColor: new THREE.Color(0xE0E0E0) }, // White
    { baseColor: new THREE.Color(0xE65100) }  // Reddish
];

const GALAXY_RADIUS = 500;
const NUM_DUST_PARTICLES = 40000;
const NUM_ARM_PARTICLES = 150000;
const NUM_ARMS = 6; // Increased to 6 arms
const BULGE_PARTICLES = 25000;

function _createStarTexture() {
    const canvas = document.createElement(&#39;canvas&#39;);
    const size = 64;
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext(&#39;2d&#39;);
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, &#39;rgba(255,255,255,1)&#39;);
    gradient.addColorStop(0.2, &#39;rgba(255,255,255,0.8)&#39;);
    gradient.addColorStop(0.4, &#39;rgba(255,255,255,0.2)&#39;);
    gradient.addColorStop(1, &#39;rgba(255,255,255,0)&#39;);
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
}

function _initScene(canvas, galaxy) {
    scene = new THREE.Scene();
    const aspect = canvas.offsetWidth / canvas.offsetHeight;
    camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 10000);
    camera.position.set(0, GALAXY_RADIUS / 2, GALAXY_RADIUS * 2); // Slightly further back

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 10;
    controls.maxDistance = GALAXY_RADIUS * 10; // Increased max zoom out

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    raycaster.params.Points.threshold = 5;

    // Create Galaxy
    galaxyGroup = new THREE.Group();
    _createGalacticBulge();
    _createGalaxyArms();
    _createDustLanes();
    _createSolarSystemParticles(galaxy.solarSystems);
    scene.add(galaxyGroup);

    renderer.domElement.addEventListener(&#39;click&#39;, _onCanvasClick);
    window.addEventListener(&#39;resize&#39;, _onResize);
}

function _createGalacticBulge() {
    const positions = [];
    const colors = [];
    const color = new THREE.Color(&#39;#ffd085&#39;); // Yellowish color for older stars

    for (let i = 0; i &lt; BULGE_PARTICLES; i++) {
        const r = Math.random() * GALAXY_RADIUS * 0.25; // Slightly larger bulge
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        const x = r * Math.sin(phi) * Math.cos(theta) * 1.8;
        const y = r * Math.sin(phi) * Math.sin(theta) * 0.6;
        const z = r * Math.cos(phi) * 1.8;

        positions.push(x, y, z);
        colors.push(color.r, color.g, color.b);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(&#39;position&#39;, new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute(&#39;color&#39;, new THREE.Float32BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
        size: 2,
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
    });
    const bulge = new THREE.Points(geometry, material);
    galaxyGroup.add(bulge);
}

function _createGalaxyArms() {
    const positions = [];
    const colors = [];
    const colorInside = new THREE.Color(&#39;#ff9933&#39;);
    const colorOutside = new THREE.Color(&#39;#3399ff&#39;);

    for (let i = 0; i &lt; NUM_ARM_PARTICLES; i++) {
        const armIndex = i % NUM_ARMS;
        // Introduce more variation in starting angles
        const startAngleOffset = [0, 1, 2.1, 3.5, 4.2, 5.5][armIndex % NUM_ARMS];
        const angle = (i / (NUM_ARM_PARTICLES / NUM_ARMS)) * Math.PI * (3 + Math.random() * 1); // Vary tightness
        const armRotation = (armIndex / NUM_ARMS) * Math.PI * 2 + startAngleOffset;
        const distance = Math.pow(i / (NUM_ARM_PARTICLES / NUM_ARMS), 0.7 + Math.random() * 0.2) * GALAXY_RADIUS; // Vary length progression

        const randomX = (Math.random() - 0.5) * 120 * Math.random();
        const randomY = (Math.random() - 0.5) * 40 * (1 - (distance / GALAXY_RADIUS));
        const randomZ = (Math.random() - 0.5) * 120 * Math.random();

        const x = Math.cos(angle + armRotation) * distance + randomX;
        const y = randomY;
        const z = Math.sin(angle + armRotation) * distance + randomZ;
        positions.push(x, y, z);
        const mixedColor = colorInside.clone().lerp(colorOutside, distance / GALAXY_RADIUS);
        colors.push(mixedColor.r, mixedColor.g, mixedColor.b);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(&#39;position&#39;, new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute(&#39;color&#39;, new THREE.Float32BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
        size: 1.5,
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true
    });
    const armParticles = new THREE.Points(geometry, material);
    galaxyGroup.add(armParticles);
}

function _createDustLanes() {
    const positions = [];
    const dustGeometry = new THREE.BufferGeometry();
    for (let i = 0; i &lt; NUM_DUST_PARTICLES; i++) {
        const armIndex = i % NUM_ARMS;
        const startAngleOffset = [0.2, 1.2, 2.3, 3.7, 4.4, 5.7][armIndex % NUM_ARMS]; // Slightly offset dust
        const angle = (i / (NUM_DUST_PARTICLES / NUM_ARMS)) * Math.PI * (3 + Math.random() * 1);
        const armRotation = (armIndex / NUM_ARMS) * Math.PI * 2 + startAngleOffset;
        const distance = Math.pow(i / (NUM_DUST_PARTICLES / NUM_ARMS), 0.8 + Math.random() * 0.2) * GALAXY_RADIUS * 0.9;

        const randomX = (Math.random() - 0.5) * 140 * Math.random();
        const randomY = (Math.random() - 0.5) * 20;
        const randomZ = (Math.random() - 0.5) * 140 * Math.random();

        const x = Math.cos(angle + armRotation) * distance + randomX;
        const y = randomY;
        const z = Math.sin(angle + armRotation) * distance + randomZ;

        positions.push(x, y, z);
    }
    dustGeometry.setAttribute(&#39;position&#39;, new THREE.Float32BufferAttribute(positions, 3));
    const dustMaterial = new THREE.PointsMaterial({
        size: 12,
        color: &#39;#1a0e00&#39;, // Dark brownish color
        sizeAttenuation: true,
        depthWrite: false,
        transparent: true,
        opacity: 0.1,
    });
    const dustParticles = new THREE.Points(dustGeometry, dustMaterial);
    galaxyGroup.add(dustParticles);
}

function _createSolarSystemParticles(systems) {
    solarSystemData = systems;
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const galaxyContentDiameter = window.gameSessionData.universe.diameter || 500;
    const starTexture = _createStarTexture();

    systems.forEach((system) =&gt; {
        const scale = (GALAXY_RADIUS * 1.5) / galaxyContentDiameter;
        const x = (system.x - galaxyContentDiameter / 2) * scale;
        const z = (system.y - galaxyContentDiameter / 2) * scale;
        const y = (Math.random() - 0.5) * 10;
        positions.push(x, y, z);
        const sunColor = sunVariations[(system.sunType || 0) % sunVariations.length].baseColor;
        colors.push(sunColor.r, sunColor.g, sunColor.b);
    });

    geometry.setAttribute(&#39;position&#39;, new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute(&#39;color&#39;, new THREE.Float32BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
        size: 15,
        sizeAttenuation: true,
        depthWrite: false,
        transparent: true,
        blending: THREE.AdditiveBlending,
        map: starTexture,
        vertexColors: true
    });

    solarSystemParticles = new THREE.Points(geometry, material);
    scene.add(solarSystemParticles);
}

function _onCanvasClick(event) {
    if (!onSystemClickCallback) return;
    const canvas = renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / canvas.clientWidth) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / canvas.clientHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(solarSystemParticles);
    if (intersects.length &gt; 0) {
        onSystemClickCallback(solarSystemData?.[intersects?.[0]?.index]?.id);
    }
}

function _onResize() {
    if (!renderer) return;
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (canvas.width !== width || canvas.height !== height) {
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }
}

function _animate() {
    animationFrameId = requestAnimationFrame(_animate);
    galaxyGroup.rotation.y += 0.0002; // Slightly slower rotation
    controls.update();
    renderer.render(scene, camera);
}

function _dispose() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    window.removeEventListener(&#39;resize&#39;, _onResize);
    if (renderer) renderer.domElement.removeEventListener(&#39;click&#39;, _onCanvasClick);
    if (controls) controls.dispose();
    scene?.traverse(object =&gt; {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
            if (Array.isArray(object.material)) object.material.forEach(m =&gt; m.dispose());
            else object.material.dispose();
        }
    });
    renderer?.dispose();
    scene = null; camera = null; renderer = null; controls = null;
    animationFrameId = null; onSystemClickCallback = null;
}

return {
    init: (canvas, galaxy, callback) =&gt; {
        onSystemClickCallback = callback;
        _initScene(canvas, galaxy);
        _animate();
    },
    dispose: _dispose
};
})();
