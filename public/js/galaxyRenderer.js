import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export const GalaxyRenderer = (() => {
    // --- STATE ---
    let scene, camera, renderer, controls, raycaster, mouse;
    let solarSystemParticles;
    let animationFrameId = null;
    let onSystemClickCallback = null;
    let solarSystemData = [];
    let starTexture;

    // --- PARAMETERS ---
    const SOLAR_SYSTEM_COUNT = 50;
    const SPAWN_RADIUS = 1000;

    // --- HELPER FUNCTIONS ---

    /**
     * Creates a reusable texture for the star sprites.
     */
    function _createStarTexture() {
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.3, 'rgba(255,255,255,0.8)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, size, size);
        return new THREE.CanvasTexture(canvas);
    }

    /**
     * Generates a specified number of solar systems at random 3D positions.
     * @param {number} count - The number of systems to generate.
     * @returns {Array<Object>} An array of system data objects.
     */
    function _generateRandomSystems(count) {
        const systems = [];
        for (let i = 0; i < count; i++) {
            // Generate a random point within a sphere
            const theta = Math.random() * 2 * Math.PI;
            const phi = Math.acos((2 * Math.random()) - 1);
            const r = Math.pow(Math.random(), 0.7) * SPAWN_RADIUS;

            systems.push({
                id: `random-ss-${i}`,
                sunType: Math.floor(Math.random() * 5),
                position: new THREE.Vector3(
                    r * Math.sin(phi) * Math.cos(theta),
                    r * Math.sin(phi) * Math.sin(theta),
                    r * Math.cos(phi)
                )
            });
        }
        return systems;
    }


    // --- CORE LOGIC ---

    function _initScene(canvas) {
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(60, canvas.offsetWidth / canvas.offsetHeight, 1, 15000);
        camera.position.set(0, SPAWN_RADIUS / 2, SPAWN_RADIUS * 1.8);

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
        renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        
        controls = new OrbitControls(camera, renderer.domElement);
        Object.assign(controls, { enableDamping: true, dampingFactor: 0.05, minDistance: 100, maxDistance: SPAWN_RADIUS * 5 });
        
        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();
        raycaster.params.Points.threshold = 10; // Increased threshold for easier clicking

        // Create shared texture
        starTexture = _createStarTexture();

        // Generate and render the random solar systems
        solarSystemData = _generateRandomSystems(SOLAR_SYSTEM_COUNT);
        _createSolarSystemParticles(solarSystemData);
        
        renderer.domElement.addEventListener('click', _onCanvasClick);
        window.addEventListener('resize', _onResize);
    }
    
    function _createSolarSystemParticles(systems) {
        const geometry = new THREE.BufferGeometry();
        const positions = [], colors = [];
        const sunVariations = [ 
            { baseColor: new THREE.Color(0x4A90E2) }, { baseColor: new THREE.Color(0xFF5722) }, 
            { baseColor: new THREE.Color(0xFFA500) }, { baseColor: new THREE.Color(0xE0E0E0) }, 
            { baseColor: new THREE.Color(0xE65100) }
        ];

        systems.forEach((system) => {
            positions.push(system.position.x, system.position.y, system.position.z);
            const sunColor = sunVariations[(system.sunType || 0) % sunVariations.length].baseColor;
            colors.push(sunColor.r, sunColor.g, sunColor.b);
        });

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        const material = new THREE.PointsMaterial({
            size: 35, // Made larger to be more visible
            map: starTexture,
            vertexColors: true,
            sizeAttenuation: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            transparent: true
        });

        solarSystemParticles = new THREE.Points(geometry, material);
        scene.add(solarSystemParticles);
    }
    
    // --- EVENT HANDLERS & LIFECYCLE ---

    function _onCanvasClick(event) {
        if (!onSystemClickCallback || !renderer) return;
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(solarSystemParticles);
        if (intersects.length > 0) {
            // Find the closest intersected point
            intersects.sort((a, b) => a.distanceToRay - b.distanceToRay);
            const systemId = solarSystemData?.[intersects[0]?.index]?.id;
            if (systemId) {
                onSystemClickCallback(systemId);
            }
        }
    }

    function _onResize() {
        if (!renderer || !camera) return;
        const canvas = renderer.domElement;
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    }

    function _animate() {
        animationFrameId = requestAnimationFrame(_animate);
        controls.update();
        renderer.render(scene, camera);
    }

    function _dispose() {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', _onResize);
        if (renderer) renderer.domElement.removeEventListener('click', _onCanvasClick);
        if (controls) controls.dispose();
        scene?.traverse(object => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) object.material.forEach(m => m.dispose());
                else object.material.dispose();
            }
        });
        starTexture?.dispose();
        renderer?.dispose();
        scene = camera = renderer = controls = animationFrameId = onSystemClickCallback = solarSystemData = null;
    }

    // --- PUBLIC API ---

    return {
        init: (canvas, galaxy, callback) => {
            _dispose(); // Clean up any previous instance
            onSystemClickCallback = callback;
            // The 'galaxy' parameter is no longer used but kept for API compatibility with uiManager.js
            _initScene(canvas);
            _animate();
        },
        dispose: _dispose
    };
})();
