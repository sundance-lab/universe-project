import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export const GalaxyRenderer = (() => {
    // --- STATE ---
    let scene, camera, renderer, controls, raycaster, mouse;
    let clickableSystemParticles, decorativeStarParticles, dustParticles, backgroundStars;
    let skybox;
    let animationFrameId = null;
    let onSystemClickCallback = null;
    let interactiveSystemsData = [];

    // --- PARAMETERS ---
    const GALAXY_RADIUS = 1500;
    const GALAXY_THICKNESS = 80;
    const GALAXY_CORE_RADIUS = 400;
    const NUM_ARMS = 4;
    const ARM_ROTATION = 3.5 * Math.PI;
    const DECORATIVE_STAR_COUNT = 40000;
    const DUST_COUNT = 10000;
    const BACKGROUND_STAR_COUNT = 15000;

    // --- HELPER FUNCTIONS ---

    function _createStarTexture(color = 'rgba(255,255,255,1)', gradientStop = 0.2) {
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        gradient.addColorStop(0, color);
        gradient.addColorStop(gradientStop, 'rgba(255,220,200,0.8)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, size, size);
        return new THREE.CanvasTexture(canvas);
    }
    
    function _createDustTexture() {
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        gradient.addColorStop(0, 'rgba(60, 40, 30, 0.4)');
        gradient.addColorStop(0.3, 'rgba(40, 20, 10, 0.1)');
        gradient.addColorStop(1, 'rgba(40, 20, 10, 0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, size, size);
        return new THREE.CanvasTexture(canvas);
    }

    function _createSkybox() {
        const loader = new THREE.TextureLoader();
        loader.load('https://cdn.jsdelivr.net/gh/jeromeetienne/threex.planets@master/images/galaxy_starfield.png', (texture) => {
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            const skyGeometry = new THREE.SphereGeometry(15000, 64, 32);
            const skyMaterial = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, color: 0x8899bb });
            skybox = new THREE.Mesh(skyGeometry, skyMaterial);
            scene.add(skybox);
        }, undefined, (error) => console.error('Skybox texture failed to load:', error));
    }
    
    // Gaussian random function for more natural distribution
    function _gaussianRandom() {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }

    // --- CORE LOGIC ---

    function _initScene(canvas, galaxyData) {
        scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x000000, 0.00025);
        
        camera = new THREE.PerspectiveCamera(60, canvas.offsetWidth / canvas.offsetHeight, 1, 20000);
        camera.position.set(GALAXY_RADIUS, GALAXY_RADIUS * 0.8, GALAXY_RADIUS);

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
        renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        
        controls = new OrbitControls(camera, renderer.domElement);
        Object.assign(controls, { enableDamping: true, dampingFactor: 0.04, minDistance: 100, maxDistance: GALAXY_RADIUS * 4, enablePan: false });
        
        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();
        
        // This threshold only applies to clickable systems
        raycaster.params.Points.threshold = 20;

        _createGalaxy(galaxyData);
        _createDistantStars();
        _createSkybox();
        
        renderer.domElement.addEventListener('click', _onCanvasClick);
        window.addEventListener('resize', _onResize);
    }

    function _createGalaxy(galaxyData) {
        const decorativePositions = [], dustPositions = [], clickablePositions = [], clickableColors = [];
        const starTexture = _createStarTexture();
        const dustTexture = _createDustTexture();
        
        // --- 1. Generate the main body of the galaxy with non-clickable stars ---
        for (let i = 0; i < DECORATIVE_STAR_COUNT; i++) {
            const distance = Math.sqrt(Math.random()) * GALAXY_RADIUS;
            const armIndex = Math.floor(Math.random() * (NUM_ARMS - 0.001));
            const armAngle = (armIndex / NUM_ARMS) * 2 * Math.PI;
            const rotation = (distance / GALAXY_RADIUS) * ARM_ROTATION;
            const angle = armAngle + rotation;

            // More stars in the arms, less in between
            const spread = 250 * Math.pow(1 - (distance / GALAXY_RADIUS), 2);
            const randomX = _gaussianRandom() * spread;
            const randomZ = _gaussianRandom() * spread;
            
            // Define thickness, making the core thicker
            const y_thickness = distance < GALAXY_CORE_RADIUS ? GALAXY_THICKNESS * 2.5 : GALAXY_THICKNESS;
            const randomY = _gaussianRandom() * y_thickness * (1-Math.pow(distance/GALAXY_RADIUS, 2));

            decorativePositions.push(
                Math.cos(angle) * distance + randomX,
                randomY,
                Math.sin(angle) * distance + randomZ
            );
        }

        // --- 2. Generate dust lanes with similar logic ---
        for (let i = 0; i < DUST_COUNT; i++) {
            const distance = Math.pow(Math.random(), 0.8) * GALAXY_RADIUS;
            const armIndex = Math.floor(Math.random() * (NUM_ARMS - 0.001));
            const armAngle = (armIndex / NUM_ARMS) * 2 * Math.PI;
            const rotation = (distance / GALAXY_RADIUS) * ARM_ROTATION * 0.95; // Slightly offset
            const angle = armAngle + rotation;
            const spread = 400 * Math.pow(1 - (distance / GALAXY_RADIUS), 2);

            dustPositions.push(
                Math.cos(angle) * distance + _gaussianRandom() * spread,
                _gaussianRandom() * (GALAXY_THICKNESS / 2) * (1 - (distance/GALAXY_RADIUS)),
                Math.sin(angle) * distance + _gaussianRandom() * spread
            );
        }

        // --- 3. Position the actual clickable systems within the galaxy structure ---
        interactiveSystemsData = galaxyData.solarSystems || [];
        const sunVariations = [ 
            { baseColor: new THREE.Color(0x6BB5FF) }, { baseColor: new THREE.Color(0xFF8C66) }, 
            { baseColor: new THREE.Color(0xFFD073) }, { baseColor: new THREE.Color(0xF0F0F0) }, 
            { baseColor: new THREE.Color(0xFF9A55) }
        ];

        interactiveSystemsData.forEach((system, i) => {
            // Place systems preferentially in the arms
            const distance = GALAXY_CORE_RADIUS * 0.8 + Math.pow(Math.random(), 2) * (GALAXY_RADIUS - GALAXY_CORE_RADIUS * 0.8);
            const armIndex = i % NUM_ARMS;
            const armAngle = (armIndex / NUM_ARMS) * 2 * Math.PI;
            const rotation = (distance / GALAXY_RADIUS) * ARM_ROTATION;
            const angle = armAngle + rotation;

            const position = new THREE.Vector3(
                Math.cos(angle) * distance + _gaussianRandom() * 50,
                _gaussianRandom() * (GALAXY_THICKNESS / 3),
                Math.sin(angle) * distance + _gaussianRandom() * 50
            );
            
            system.position = position;
            clickablePositions.push(position.x, position.y, position.z);
            
            const sunColor = sunVariations[(system.sunType || 0) % sunVariations.length].baseColor;
            clickableColors.push(sunColor.r, sunColor.g, sunColor.b);
        });

        // --- 4. Create and add the particle systems to the scene ---
        const decorativeGeometry = new THREE.BufferGeometry();
        decorativeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(decorativePositions, 3));
        const decorativeMaterial = new THREE.PointsMaterial({ size: 12, map: starTexture, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.5 });
        decorativeStarParticles = new THREE.Points(decorativeGeometry, decorativeMaterial);
        scene.add(decorativeStarParticles);
        
        const dustGeometry = new THREE.BufferGeometry();
        dustGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dustPositions, 3));
        const dustMaterial = new THREE.PointsMaterial({ size: 250, map: dustTexture, sizeAttenuation: true, depthWrite: false, blending: THREE.NormalBlending, transparent: true, opacity: 0.8 });
        dustParticles = new THREE.Points(dustGeometry, dustMaterial);
        scene.add(dustParticles);

        const clickableGeometry = new THREE.BufferGeometry();
        clickableGeometry.setAttribute('position', new THREE.Float32BufferAttribute(clickablePositions, 3));
        clickableGeometry.setAttribute('color', new THREE.Float32BufferAttribute(clickableColors, 3));
        const clickableMaterial = new THREE.PointsMaterial({ size: 50, map: starTexture, vertexColors: true, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.95 });
        clickableSystemParticles = new THREE.Points(clickableGeometry, clickableMaterial);
        scene.add(clickableSystemParticles);
    }
    
    function _createDistantStars() {
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        for (let i = 0; i < BACKGROUND_STAR_COUNT; i++) {
            positions.push(
                (Math.random() - 0.5) * 20000,
                (Math.random() - 0.5) * 20000,
                (Math.random() - 0.5) * 20000
            );
        }
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({ size: 8, color: 0xffffff, sizeAttenuation: true, depthWrite: false, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending });
        backgroundStars = new THREE.Points(geometry, material);
        scene.add(backgroundStars);
    }
    
    // --- EVENT HANDLERS & LIFECYCLE ---

    function _onCanvasClick(event) {
        if (!onSystemClickCallback || !renderer || !clickableSystemParticles) return;
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        
        // IMPORTANT: Only check for intersections with the clickable systems
        const intersects = raycaster.intersectObject(clickableSystemParticles);
        
        if (intersects.length > 0) {
            intersects.sort((a, b) => a.distanceToRay - b.distanceToRay);
            const systemId = interactiveSystemsData?.[intersects[0]?.index]?.id;
            if (systemId) {
                onSystemClickCallback(systemId);
            }
        }
    }

    function _onResize() {
        if (!renderer || !camera) return;
        const canvas = renderer.domElement;
        if (canvas.clientWidth > 0 && canvas.clientHeight > 0) {
             camera.aspect = canvas.clientWidth / canvas.clientHeight;
             camera.updateProjectionMatrix();
             renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
        }
    }

    function _animate() {
        animationFrameId = requestAnimationFrame(_animate);
        controls.update();
        if(skybox) skybox.rotation.y += 0.00005;
        if(dustParticles) dustParticles.rotation.y += 0.0001;
        if(decorativeStarParticles) decorativeStarParticles.rotation.y += 0.0001;
        if(clickableSystemParticles) clickableSystemParticles.rotation.y += 0.0001;
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
                if(object.material.map) object.material.map.dispose();
                object.material.dispose();
            }
        });
        renderer?.dispose();
        scene = camera = renderer = controls = animationFrameId = onSystemClickCallback = null;
        interactiveSystemsData = [];
        skybox = backgroundStars = decorativeStarParticles = dustParticles = clickableSystemParticles = null;
    }

    // --- PUBLIC API ---

    return {
        init: (canvas, galaxyData, callback) => {
            _dispose(); // Clean up any previous instance
            onSystemClickCallback = callback;
            _initScene(canvas, galaxyData);
            _animate();
            setTimeout(_onResize, 100);
        },
        dispose: _dispose
    };
})();
