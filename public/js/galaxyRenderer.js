import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export const GalaxyRenderer = (() => {
    // --- STATE ---
    let scene, camera, renderer, controls, raycaster, mouse;
    let solarSystemParticles, backgroundStars;
    let skybox;
    let animationFrameId = null;
    let onSystemClickCallback = null;
    let solarSystemData = []; // This will now store the actual system data
    let starTexture;

    // --- PARAMETERS ---
    const GALAXY_RADIUS = 1200;
    const GALAXY_THICKNESS = 50;
    const NUM_ARMS = 4;
    const ARM_ROTATION = 2.5 * Math.PI; // How much the arms twist
    const BACKGROUND_STAR_COUNT = 15000;


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
        gradient.addColorStop(0.2, 'rgba(255,255,255,0.9)');
        gradient.addColorStop(0.6, 'rgba(200,200,255,0.4)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, size, size);
        return new THREE.CanvasTexture(canvas);
    }
    
    /**
     * Creates a 3D starfield background.
     */
    function _createSkybox() {
        const loader = new THREE.TextureLoader();
        // A seamless, high-quality starfield texture
        loader.load('https://cdn.jsdelivr.net/gh/jeromeetienne/threex.planets@master/images/galaxy_starfield.png', (texture) => {
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            const skyGeometry = new THREE.SphereGeometry(15000, 64, 32);
            const skyMaterial = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.BackSide,
                color: 0x8899bb // Tint the skybox slightly for atmosphere
            });
            skybox = new THREE.Mesh(skyGeometry, skyMaterial);
            scene.add(skybox);
        });
    }

    /**
     * Generates a spiral galaxy structure and assigns positions to the solar systems.
     * @param {Array<Object>} systems - The array of solar system data from the game state.
     * @returns {Array<Object>} The same array with a `position` Vector3 added to each system.
     */
    function _generateGalaxyStructure(systems) {
        const CORE_DENSITY_FALLOFF = 4;
        const systemsWithPositions = [];

        systems.forEach((system, i) => {
            // Determine position
            const distance = Math.pow(Math.random(), 1.5) * GALAXY_RADIUS; // Weighted towards the center
            const armIndex = Math.floor(Math.random() * (NUM_ARMS - 0.001));
            const armAngle = (armIndex / NUM_ARMS) * 2 * Math.PI;

            const pointSqueeze = Math.pow(distance / GALAXY_RADIUS, 0.8);
            const rotation = pointSqueeze * ARM_ROTATION;
            
            const angle = armAngle + rotation;

            const randomX = (Math.random() - 0.5) * 200 * (1 - pointSqueeze);
            const randomZ = (Math.random() - 0.5) * 200 * (1 - pointSqueeze);

            // Position with a dense core
            const coreDensity = Math.exp(-Math.pow(distance / (GALAXY_RADIUS / CORE_DENSITY_FALLOFF), 2));

            system.position = new THREE.Vector3(
                Math.cos(angle) * distance + randomX,
                (Math.random() - 0.5) * GALAXY_THICKNESS * (1 - coreDensity) * (1-pointSqueeze), // Thinner at the edges
                Math.sin(angle) * distance + randomZ
            );
            
            systemsWithPositions.push(system);
        });

        return systemsWithPositions;
    }


    // --- CORE LOGIC ---

    function _initScene(canvas, galaxyData) {
        scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x000000, 0.00035); // Add a subtle fog for depth
        
        camera = new THREE.PerspectiveCamera(60, canvas.offsetWidth / canvas.offsetHeight, 1, 20000);
        camera.position.set(GALAXY_RADIUS * 0.8, GALAXY_RADIUS * 0.7, GALAXY_RADIUS * 0.8);

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
        renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        
        controls = new OrbitControls(camera, renderer.domElement);
        Object.assign(controls, { 
            enableDamping: true, 
            dampingFactor: 0.04, // Smoother movement
            minDistance: 100, 
            maxDistance: GALAXY_RADIUS * 3,
            enablePan: false // Keep focus on the galaxy center
        });
        
        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();
        raycaster.params.Points.threshold = 15; // Increased threshold for easier clicking

        // Create shared texture
        starTexture = _createStarTexture();

        // Generate and render the solar systems in a spiral
        solarSystemData = _generateGalaxyStructure(galaxyData.solarSystems || []);
        _createSolarSystemParticles(solarSystemData);
        
        _createDistantStars();
        _createSkybox();
        
        renderer.domElement.addEventListener('click', _onCanvasClick);
        window.addEventListener('resize', _onResize);
    }
    
    function _createDistantStars() {
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        for (let i = 0; i < BACKGROUND_STAR_COUNT; i++) {
            const u = Math.random();
            const v = Math.random();
            const theta = 2 * Math.PI * u;
            const phi = Math.acos(2 * v - 1);
            const r = GALAXY_RADIUS * 2 + Math.random() * 8000;
            positions.push(
                r * Math.sin(phi) * Math.cos(theta),
                r * Math.sin(phi) * Math.sin(theta),
                r * Math.cos(phi)
            );
        }
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({
            size: 5,
            color: 0xffffff,
            sizeAttenuation: true,
            depthWrite: false,
            transparent: true,
            opacity: 0.4,
            blending: THREE.AdditiveBlending,
        });
        backgroundStars = new THREE.Points(geometry, material);
        scene.add(backgroundStars);
    }
    
    function _createSolarSystemParticles(systems) {
        const geometry = new THREE.BufferGeometry();
        const positions = [], colors = [];
        const sunVariations = [ 
            { baseColor: new THREE.Color(0x6BB5FF) }, { baseColor: new THREE.Color(0xFF8C66) }, 
            { baseColor: new THREE.Color(0xFFD073) }, { baseColor: new THREE.Color(0xF0F0F0) }, 
            { baseColor: new THREE.Color(0xFF9A55) }
        ];

        systems.forEach((system) => {
            positions.push(system.position.x, system.position.y, system.position.z);
            const sunColor = sunVariations[(system.sunType || 0) % sunVariations.length].baseColor;
            colors.push(sunColor.r, sunColor.g, sunColor.b);
        });

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        const material = new THREE.PointsMaterial({
            size: 45, // Made larger to be more visible as primary objects
            map: starTexture,
            vertexColors: true,
            sizeAttenuation: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            transparent: true,
            opacity: 0.9
        });

        solarSystemParticles = new THREE.Points(geometry, material);
        scene.add(solarSystemParticles);
    }
    
    // --- EVENT HANDLERS & LIFECYCLE ---

    function _onCanvasClick(event) {
        if (!onSystemClickCallback || !renderer || !solarSystemParticles) return;
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
        // Check if canvas has a valid size
        if (canvas.clientWidth > 0 && canvas.clientHeight > 0) {
             camera.aspect = canvas.clientWidth / canvas.clientHeight;
             camera.updateProjectionMatrix();
             renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
        }
    }

    function _animate() {
        animationFrameId = requestAnimationFrame(_animate);
        controls.update();
        if(skybox) skybox.rotation.y += 0.00005; // Gentle rotation of the background
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
        scene = camera = renderer = controls = animationFrameId = onSystemClickCallback = null;
        solarSystemData = [];
        skybox = null;
        backgroundStars = null;
        solarSystemParticles = null;
    }

    // --- PUBLIC API ---

    return {
        init: (canvas, galaxyData, callback) => {
            _dispose(); // Clean up any previous instance
            onSystemClickCallback = callback;
            _initScene(canvas, galaxyData);
            _animate();
            // Force a resize check shortly after init to handle layout shifts
            setTimeout(_onResize, 100);
        },
        dispose: _dispose
    };
})();
