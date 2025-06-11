import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export const GalaxyRenderer = (() => {
    // --- STATE ---
    let scene, camera, renderer, controls, raycaster, mouse;
    let clickableSystemParticles, decorativeStarParticles, dustParticles, backgroundStars, nebulaParticles;
    let galacticCore;
    let skybox;
    let animationFrameId = null;
    let onSystemClickCallback = null;
    let interactiveSystemsData = [];

    // --- PARAMETERS (Adjusted for more realism) ---
    const GALAXY_RADIUS = 1500;
    const GALAXY_THICKNESS = 90; // Increased for a less skinny galaxy
    const GALAXY_CORE_RADIUS = 450;
    const NUM_ARMS = 5; // Using 5 arms for more complex structure
    const ARM_ROTATION = 4.0 * Math.PI;
    const DECORATIVE_STAR_COUNT = 50000; // Increased density
    const DUST_COUNT = 15000;
    const BACKGROUND_STAR_COUNT = 50000; // Increased density
    const NEBULA_CLUSTER_COUNT = 50;


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
    
    function _createNebulaTexture() {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        const gradient = context.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        gradient.addColorStop(0, 'rgba(255, 100, 180, 0.3)');
        gradient.addColorStop(0.4, 'rgba(200, 80, 255, 0.1)');
        gradient.addColorStop(1, 'rgba(150, 50, 200, 0)');
        context.fillStyle = gradient;
        context.fillRect(0,0,size,size);
        return new THREE.CanvasTexture(canvas);
    }

    function _createDustTexture() {
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        gradient.addColorStop(0, 'rgba(50, 30, 20, 0.6)');
        gradient.addColorStop(0.4, 'rgba(30, 15, 5, 0.2)');
        gradient.addColorStop(1, 'rgba(30, 15, 5, 0)');
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
        raycaster.params.Points.threshold = 20;

        _createGalaxy(galaxyData);
        _createDistantStars();
        _createSkybox();
        _createGalacticCore();
        
        renderer.domElement.addEventListener('click', _onCanvasClick);
        window.addEventListener('resize', _onResize);
    }
    
    function _createGalacticCore() {
        const coreTexture = _createStarTexture('rgba(255, 230, 200, 1)', 0.05);
        const spriteMaterial = new THREE.SpriteMaterial({
            map: coreTexture,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: false
        });
        galacticCore = new THREE.Sprite(spriteMaterial);
        galacticCore.scale.set(GALAXY_CORE_RADIUS * 2, GALAXY_CORE_RADIUS * 2, 1);
        scene.add(galacticCore);
    }

    function _createGalaxy(galaxyData) {
        const decorativePositions = [], decorativeColors = [], dustPositions = [], clickablePositions = [], clickableColors = [], nebulaPositions = [];
        const starTexture = _createStarTexture();
        const dustTexture = _createDustTexture();
        const nebulaTexture = _createNebulaTexture();
        
        const coreColor = new THREE.Color(0xFFE082); // Yellowish core
        const armColor = new THREE.Color(0x82B1FF);  // Bluish arms
        
        const armVariations = [];
        for (let i = 0; i < NUM_ARMS; i++) {
            armVariations.push({
                offset: (Math.random() - 0.5) * 0.5,
                rotation: ARM_ROTATION * (1 + (Math.random() - 0.5) * 0.1),
                turbulence: Math.random() * 150
            });
        }
        
        // --- 1. Generate decorative stars with color and asymmetry ---
        for (let i = 0; i < DECORATIVE_STAR_COUNT; i++) {
            const distance = Math.sqrt(Math.random()) * GALAXY_RADIUS;
            const armIndex = Math.floor(Math.random() * (NUM_ARMS - 0.001));
            const armVar = armVariations[armIndex];
            
            const armAngle = (armIndex / NUM_ARMS) * 2 * Math.PI + armVar.offset;
            const rotation = (distance / GALAXY_RADIUS) * armVar.rotation;
            const angle = armAngle + rotation;
            
            const spread = 250 * Math.pow(1 - (distance / GALAXY_RADIUS), 2);
            const randomX = _gaussianRandom() * spread;
            const randomZ = _gaussianRandom() * spread;
            
            const y_thickness = distance < GALAXY_CORE_RADIUS ? GALAXY_THICKNESS * 2.5 : GALAXY_THICKNESS;
            const randomY = _gaussianRandom() * y_thickness * (1-Math.pow(distance/GALAXY_RADIUS, 2));
            
            // Add sporadic waviness to arms
            const turbulence = Math.sin(angle * 8 + distance * 0.01) * armVar.turbulence * (distance / GALAXY_RADIUS);

            decorativePositions.push(
                Math.cos(angle) * distance + randomX,
                randomY + turbulence,
                Math.sin(angle) * distance + randomZ
            );
            
            // Set color based on distance
            const colorLerp = Math.pow(distance / GALAXY_RADIUS, 1.5);
            const starColor = new THREE.Color().lerpColors(coreColor, armColor, colorLerp);
            decorativeColors.push(starColor.r, starColor.g, starColor.b);
        }

        // --- 2. Generate Nebulae Clusters in the arms ---
        for(let i=0; i<NEBULA_CLUSTER_COUNT; i++) {
            const distance = GALAXY_CORE_RADIUS + Math.random() * (GALAXY_RADIUS - GALAXY_CORE_RADIUS);
            const armIndex = i % NUM_ARMS;
            const armAngle = (armIndex / NUM_ARMS) * 2 * Math.PI;
            const rotation = (distance / GALAXY_RADIUS) * armVariations[armIndex].rotation;
            const angle = armAngle + rotation;
            const clusterCenter = new THREE.Vector3(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
            for(let j=0; j<10; j++) {
                 nebulaPositions.push(
                    clusterCenter.x + _gaussianRandom() * 100,
                    clusterCenter.y + _gaussianRandom() * 20,
                    clusterCenter.z + _gaussianRandom() * 100
                 );
            }
        }

        // --- 3. Generate dust lanes ---
        for (let i = 0; i < DUST_COUNT; i++) {
            const distance = Math.pow(Math.random(), 0.8) * GALAXY_RADIUS;
            const armIndex = Math.floor(Math.random() * (NUM_ARMS - 0.001));
            const armAngle = (armIndex / NUM_ARMS) * 2 * Math.PI;
            const rotation = (distance / GALAXY_RADIUS) * armVariations[armIndex].rotation * 0.95;
            const angle = armAngle + rotation;
            const spread = 400 * Math.pow(1 - (distance / GALAXY_RADIUS), 2);
            dustPositions.push(
                Math.cos(angle) * distance + _gaussianRandom() * spread,
                _gaussianRandom() * (GALAXY_THICKNESS / 3) * (1 - (distance/GALAXY_RADIUS)),
                Math.sin(angle) * distance + _gaussianRandom() * spread
            );
        }

        // --- 4. Position the actual clickable systems ---
        interactiveSystemsData = galaxyData.solarSystems || [];
        interactiveSystemsData.forEach((system, i) => {
            const distance = GALAXY_CORE_RADIUS * 0.8 + Math.pow(Math.random(), 2) * (GALAXY_RADIUS - GALAXY_CORE_RADIUS * 0.8);
            const armIndex = i % NUM_ARMS;
            const armAngle = (armIndex / NUM_ARMS) * 2 * Math.PI;
            const rotation = (distance / GALAXY_RADIUS) * armVariations[armIndex].rotation;
            const angle = armAngle + rotation;
            const position = new THREE.Vector3(Math.cos(angle) * distance + _gaussianRandom() * 50, _gaussianRandom() * (GALAXY_THICKNESS / 3), Math.sin(angle) * distance + _gaussianRandom() * 50);
            system.position = position;
            clickablePositions.push(position.x, position.y, position.z);
            const colorLerp = Math.pow(distance / GALAXY_RADIUS, 1.5);
            const starColor = new THREE.Color().lerpColors(coreColor, armColor, colorLerp);
            clickableColors.push(starColor.r, starColor.g, starColor.b);
        });

        // --- 5. Create and add the particle systems to the scene ---
        const decorativeGeometry = new THREE.BufferGeometry();
        decorativeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(decorativePositions, 3));
        decorativeGeometry.setAttribute('color', new THREE.Float32BufferAttribute(decorativeColors, 3));
        const decorativeMaterial = new THREE.PointsMaterial({ size: 12, map: starTexture, vertexColors: true, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.6 });
        decorativeStarParticles = new THREE.Points(decorativeGeometry, decorativeMaterial);
        scene.add(decorativeStarParticles);
        
        const dustGeometry = new THREE.BufferGeometry();
        dustGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dustPositions, 3));
        const dustMaterial = new THREE.PointsMaterial({ size: 250, map: dustTexture, sizeAttenuation: true, depthWrite: false, blending: THREE.NormalBlending, transparent: true, opacity: 0.8 });
        dustParticles = new THREE.Points(dustGeometry, dustMaterial);
        scene.add(dustParticles);

        const nebulaGeometry = new THREE.BufferGeometry();
        nebulaGeometry.setAttribute('position', new THREE.Float32BufferAttribute(nebulaPositions, 3));
        const nebulaMaterial = new THREE.PointsMaterial({size: 500, map: nebulaTexture, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.5});
        nebulaParticles = new THREE.Points(nebulaGeometry, nebulaMaterial);
        scene.add(nebulaParticles);

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
            positions.push( (Math.random() - 0.5) * 20000, (Math.random() - 0.5) * 20000, (Math.random() - 0.5) * 20000 );
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
        const intersects = raycaster.intersectObject(clickableSystemParticles);
        if (intersects.length > 0) {
            intersects.sort((a, b) => a.distanceToRay - b.distanceToRay);
            const systemId = interactiveSystemsData?.[intersects[0]?.index]?.id;
            if (systemId) { onSystemClickCallback(systemId); }
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
        const rotationSpeed = 0.00008;
        if(skybox) skybox.rotation.y += rotationSpeed / 2;
        if(dustParticles) dustParticles.rotation.y += rotationSpeed;
        if(decorativeStarParticles) decorativeStarParticles.rotation.y += rotationSpeed;
        if(clickableSystemParticles) clickableSystemParticles.rotation.y += rotationSpeed;
        if(nebulaParticles) nebulaParticles.rotation.y += rotationSpeed;
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
        skybox = backgroundStars = decorativeStarParticles = dustParticles = clickableSystemParticles = nebulaParticles = galacticCore = null;
    }

    return {
        init: (canvas, galaxyData, callback) => {
            _dispose();
            onSystemClickCallback = callback;
            _initScene(canvas, galaxyData);
            _animate();
            setTimeout(_onResize, 100);
        },
        dispose: _dispose
    };
})();
