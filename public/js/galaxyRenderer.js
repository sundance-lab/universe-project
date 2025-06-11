import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export const GalaxyRenderer = (() => {
    // --- STATE ---
    let scene, camera, renderer, controls, raycaster, mouse;
    let clickableSystemParticles, decorativeStarParticles, dustParticles, backgroundStars, nebulaParticles, distantGalaxies, coreStarParticles, diskStarParticles, haloStarParticles;
    let skybox, galaxyGroup, sisterGalaxy;
    let animationFrameId = null;
    let onSystemClickCallback = null;
    let interactiveSystemsData = [];
    let createdTextures = [];

    // --- PARAMETERS ---
    const GALAXY_RADIUS = 1500;
    const GALAXY_THICKNESS = 100;
    const GALAXY_CORE_RADIUS = 200;
    const NUM_ARMS = 5;
    const ARM_ROTATION = 4 * Math.PI;
    const DECORATIVE_STAR_COUNT = 50000;  // Reverted
    const CORE_STAR_COUNT = 20000;       // Reverted
    const DISK_STAR_COUNT = 120000;      // Kept high to fill space
    const HALO_STAR_COUNT = 300000;      // Massively Increased for outer stars
    const DUST_COUNT = 10000;
    const BACKGROUND_STAR_COUNT = 250000;
    const NEBULA_CLUSTER_COUNT = 50;
    const DISTANT_GALAXY_COUNT = 150;


    // --- HELPER FUNCTIONS ---

    function _createAndCacheTexture(creationFunction) {
        const texture = creationFunction();
        createdTextures.push(texture);
        return texture;
    }

    function _createStarTexture(color = 'rgba(255,255,255,1)', gradientStop = 0.2) {
        return _createAndCacheTexture(() => {
            const size = 128;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const context = canvas.getContext('2d');
            const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
            gradient.addColorStop(0, color);
            gradient.addColorStop(gradientStop, 'rgba(200, 200, 255,0.8)');
            gradient.addColorStop(1, 'rgba(255,255,255,0)');
            context.fillStyle = gradient;
            context.fillRect(0, 0, size, size);
            return new THREE.CanvasTexture(canvas);
        });
    }
    
    function _createNebulaTexture() {
        return _createAndCacheTexture(() => {
            const size = 256;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const context = canvas.getContext('2d');
            const gradient = context.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
            gradient.addColorStop(0, 'rgba(255, 100, 100, 0.3)');
            gradient.addColorStop(0.4, 'rgba(200, 80, 80, 0.1)');
            gradient.addColorStop(1, 'rgba(150, 50, 50, 0)');
            context.fillStyle = gradient;
            context.fillRect(0,0,size,size);
            return new THREE.CanvasTexture(canvas);
        });
    }

    function _createDustTexture() {
        return _createAndCacheTexture(() => {
            const size = 128;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const context = canvas.getContext('2d');
            const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
            gradient.addColorStop(0, 'rgba(120, 80, 220, 0.5)');
            gradient.addColorStop(0.4, 'rgba(80, 40, 180, 0.2)');
            gradient.addColorStop(1, 'rgba(50, 20, 120, 0)');
            context.fillStyle = gradient;
            context.fillRect(0, 0, size, size);
            return new THREE.CanvasTexture(canvas);
        });
    }

    function _createSkybox() {
        const loader = new THREE.TextureLoader();
        loader.load('https://cdn.jsdelivr.net/gh/jeromeetienne/threex.planets@master/images/galaxy_starfield.png', (texture) => {
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            createdTextures.push(texture);
            const skyGeometry = new THREE.SphereGeometry(25000, 64, 32);
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
        
        camera = new THREE.PerspectiveCamera(60, canvas.offsetWidth / canvas.offsetHeight, 1, 30000);
        camera.position.set(GALAXY_RADIUS, GALAXY_RADIUS * 0.8, GALAXY_RADIUS);

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
        renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        
        controls = new OrbitControls(camera, renderer.domElement);
        Object.assign(controls, { enableDamping: true, dampingFactor: 0.04, minDistance: 100, maxDistance: GALAXY_RADIUS * 4, enablePan: false, minPolarAngle: 0, maxPolarAngle: Math.PI });
        
        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();
        raycaster.params.Points.threshold = 20;

        _createGalaxy(galaxyData);
        _createDistantStars();
        _createDistantGalaxies();
        _createSisterGalaxy();
        _createSkybox();
        
        renderer.domElement.addEventListener('click', _onCanvasClick);
        window.addEventListener('resize', _onResize);
    }
    
    function _createGalacticCoreGlow() {
        const coreTexture = _createStarTexture('rgba(255, 200, 150, 1)', 0.05);
        const spriteMaterial = new THREE.SpriteMaterial({
            map: coreTexture,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: false
        });
        const glow = new THREE.Sprite(spriteMaterial);
        glow.renderOrder = 3;
        glow.scale.set(GALAXY_CORE_RADIUS * 3, GALAXY_CORE_RADIUS * 3, 1);
        return glow;
    }
    
    function _createDistantGalaxies() {
        distantGalaxies = new THREE.Group();
        const loader = new THREE.TextureLoader();
        const galaxyTexture = loader.load('https://cdn.jsdelivr.net/gh/Sean-Bradley/Three.js-TypeScript-Boilerplate@master/src/assets/images/galaxy.png', 
            (texture) => createdTextures.push(texture)
        );
        for (let i = 0; i < DISTANT_GALAXY_COUNT; i++) {
            const material = new THREE.SpriteMaterial({ map: galaxyTexture, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.1 + Math.random() * 0.3, color: new THREE.Color(Math.random(), Math.random(), Math.random()) });
            const sprite = new THREE.Sprite(material);
            const distance = GALAXY_RADIUS * 6 + Math.random() * 6000;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            sprite.position.set( distance * Math.sin(phi) * Math.cos(theta), distance * Math.sin(phi) * Math.sin(theta), distance * Math.cos(phi) );
            const scale = Math.random() * 600 + 400;
            sprite.scale.set(scale, scale, 1);
            distantGalaxies.add(sprite);
        }
        scene.add(distantGalaxies);
    }
    
    function _createSisterGalaxy() {
        sisterGalaxy = new THREE.Group();
        const positions = [], colors = [];
        const STAR_COUNT = 80000;
        const RADIUS = GALAXY_RADIUS * 0.8;
        
        const colorPalette = [
            new THREE.Color(0xFF8C00), new THREE.Color(0xFF8C00), new THREE.Color(0xFF8C00),
            new THREE.Color(0xFFDAB9), new THREE.Color(0xDC143C), new THREE.Color(0x87CEEB)
        ];

        for (let i = 0; i < STAR_COUNT; i++) {
            // Generate a point in a disk
            const r = Math.random() * RADIUS;
            const angle = Math.random() * Math.PI * 2;
            const y = (Math.random() - 0.5) * GALAXY_THICKNESS * 0.4;
            
            const pos = new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r);
            
            // Add significant noise/displacement for irregularity
            const displacement = new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).multiplyScalar(RADIUS * 0.6);
            pos.add(displacement);

            positions.push(pos.x, pos.y, pos.z);
            const starColor = colorPalette[Math.floor(Math.random() * colorPalette.length)];
            colors.push(starColor.r, starColor.g, starColor.b);
        }
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        const material = new THREE.PointsMaterial({ size: 15, vertexColors: true, map: _createStarTexture(), blending: THREE.AdditiveBlending, transparent: true, opacity: 0.95, depthWrite: false });
        
        const mesh = new THREE.Points(geometry, material);
        sisterGalaxy.add(mesh);
        
        const coreGlow = _createGalacticCoreGlow();
        coreGlow.scale.set(GALAXY_RADIUS * 0.6, GALAXY_RADIUS * 0.6, 1);
        sisterGalaxy.add(coreGlow);
        
        sisterGalaxy.position.set(-GALAXY_RADIUS * 4, -GALAXY_RADIUS * 2, -GALAXY_RADIUS * 6);
        sisterGalaxy.rotation.set(Math.PI / 5, Math.PI / 9, Math.PI / 7);
        scene.add(sisterGalaxy);
    }

    function _createGalaxy(galaxyData) {
        galaxyGroup = new THREE.Group();
        
        const corePositions = [], coreColors = [], diskPositions = [], diskColors = [], haloPositions = [], haloColors = [], decorativePositions = [], decorativeColors = [], decorativeSizes = [], dustPositions = [], clickablePositions = [], clickableColors = [], nebulaPositions = [];
        const starTexture = _createStarTexture();
        const dustTexture = _createDustTexture();
        const nebulaTexture = _createNebulaTexture();
        
        const colorPalette = [
            new THREE.Color(0xFF8C00), new THREE.Color(0xFF8C00), new THREE.Color(0xFF8C00),
            new THREE.Color(0xFFDAB9), new THREE.Color(0xDC143C), new THREE.Color(0x87CEEB)
        ];
        
        const armVariations = [];
        for (let i = 0; i < NUM_ARMS; i++) {
            armVariations.push({ offset: (Math.random() - 0.5) * 0.5, rotation: ARM_ROTATION * (1 + (Math.random() - 0.5) * 0.1) });
        }
        
        const generateStarColor = () => colorPalette[Math.floor(Math.random() * colorPalette.length)];
        
        for (let i = 0; i < HALO_STAR_COUNT; i++) {
            const r = Math.pow(Math.random(), 1.5) * GALAXY_RADIUS * 2 + GALAXY_RADIUS;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            haloPositions.push( r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi) );
            const starColor = generateStarColor();
            haloColors.push(starColor.r, starColor.g, starColor.b);
        }

        for (let i = 0; i < CORE_STAR_COUNT; i++) {
            const distance = Math.pow(Math.random(), 2) * GALAXY_CORE_RADIUS;
            const randomY = _gaussianRandom() * GALAXY_THICKNESS * 2.0;
            const angle = Math.random() * Math.PI * 2;
            corePositions.push( Math.cos(angle) * distance, randomY, Math.sin(angle) * distance );
            const color = generateStarColor().multiplyScalar(1.5);
            coreColors.push(color.r, color.g, color.b);
        }
        
        for (let i = 0; i < DISK_STAR_COUNT; i++) {
             const distance = GALAXY_CORE_RADIUS + Math.sqrt(Math.random()) * (GALAXY_RADIUS - GALAXY_CORE_RADIUS);
             const randomY = _gaussianRandom() * (GALAXY_THICKNESS * 0.5);
             const angle = Math.random() * Math.PI * 2;
             diskPositions.push(Math.cos(angle) * distance, randomY, Math.sin(angle) * distance);
             const starColor = generateStarColor();
             diskColors.push(starColor.r, starColor.g, starColor.b);
        }

        for (let i = 0; i < DECORATIVE_STAR_COUNT; i++) {
            const distance = Math.sqrt(Math.random()) * GALAXY_RADIUS;
            const armIndex = Math.floor(Math.random() * (NUM_ARMS - 0.001));
            const armVar = armVariations[armIndex];
            const armAngle = (armIndex / NUM_ARMS) * 2 * Math.PI + armVar.offset;
            const rotation = (distance / GALAXY_RADIUS) * armVar.rotation;
            const angle = armAngle + rotation;
            const spread = 2200 * Math.pow(1 - (distance / GALAXY_RADIUS), 2);
            const turbulence = Math.sin(angle * 5 + distance * 0.01) * spread * 0.2;
            const randomX = _gaussianRandom() * spread;
            const randomZ = _gaussianRandom() * spread;
            const y_thickness = distance < GALAXY_CORE_RADIUS ? GALAXY_THICKNESS * 2.5 : GALAXY_THICKNESS;
            const randomY = _gaussianRandom() * y_thickness * (1-Math.pow(distance/GALAXY_RADIUS, 2));

            decorativePositions.push( Math.cos(angle) * distance + randomX + Math.cos(angle) * turbulence, randomY, Math.sin(angle) * distance + randomZ + Math.sin(angle) * turbulence );
            const starColor = generateStarColor();
            decorativeColors.push(starColor.r, starColor.g, starColor.b);
            const size = (1.0 - Math.pow(distance / GALAXY_RADIUS, 1.5)) * 15 + 5;
            decorativeSizes.push(size);
        }

        for(let i=0; i<NEBULA_CLUSTER_COUNT; i++) {
            const distance = GALAXY_CORE_RADIUS + Math.random() * (GALAXY_RADIUS - GALAXY_CORE_RADIUS);
            const armIndex = i % NUM_ARMS;
            const armAngle = (armIndex / NUM_ARMS) * 2 * Math.PI;
            const rotation = (distance / GALAXY_RADIUS) * armVariations[armIndex].rotation;
            const angle = armAngle + rotation;
            const clusterCenter = new THREE.Vector3(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
            for(let j=0; j<10; j++) {
                 nebulaPositions.push( clusterCenter.x + _gaussianRandom() * 100, clusterCenter.y + _gaussianRandom() * 20, clusterCenter.z + _gaussianRandom() * 100 );
            }
        }
        for (let i = 0; i < DUST_COUNT; i++) {
            const distance = Math.pow(Math.random(), 0.8) * GALAXY_RADIUS;
            const y_thickness = GALAXY_THICKNESS * 0.2; // Made dust much thinner
            const randomY = _gaussianRandom() * y_thickness * (1-Math.pow(distance/GALAXY_RADIUS, 2));
            const armIndex = Math.floor(Math.random() * (NUM_ARMS - 0.001));
            const armAngle = (armIndex / NUM_ARMS) * 2 * Math.PI;
            const rotation = (distance / GALAXY_RADIUS) * armVariations[armIndex].rotation * 0.95;
            const angle = armAngle + rotation;
            const spread = 400 * Math.pow(1 - (distance / GALAXY_RADIUS), 2);
            dustPositions.push( Math.cos(angle) * distance + _gaussianRandom() * spread, randomY, Math.sin(angle) * distance + _gaussianRandom() * spread );
        }
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
            const starColor = generateStarColor();
            clickableColors.push(starColor.r, starColor.g, starColor.b);
        });

        // --- Create and add particle systems ---
        const haloGeometry = new THREE.BufferGeometry();
        haloGeometry.setAttribute('position', new THREE.Float32BufferAttribute(haloPositions, 3));
        haloGeometry.setAttribute('color', new THREE.Float32BufferAttribute(haloColors, 3));
        const haloMaterial = new THREE.PointsMaterial({ size: 5, map: starTexture, vertexColors: true, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.25 });
        haloStarParticles = new THREE.Points(haloGeometry, haloMaterial);

        const coreGeometry = new THREE.BufferGeometry();
        coreGeometry.setAttribute('position', new THREE.Float32BufferAttribute(corePositions, 3));
        coreGeometry.setAttribute('color', new THREE.Float32BufferAttribute(coreColors, 3));
        const coreMaterial = new THREE.PointsMaterial({ size: 5, map: starTexture, vertexColors: true, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.9 });
        coreStarParticles = new THREE.Points(coreGeometry, coreMaterial);
        coreStarParticles.frustumCulled = false;
        
        const diskGeometry = new THREE.BufferGeometry();
        diskGeometry.setAttribute('position', new THREE.Float32BufferAttribute(diskPositions, 3));
        diskGeometry.setAttribute('color', new THREE.Float32BufferAttribute(diskColors, 3));
        const diskMaterial = new THREE.PointsMaterial({ size: 8, map: starTexture, vertexColors: true, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true, opacity: 1.0 }); // Made opaque
        diskStarParticles = new THREE.Points(diskGeometry, diskMaterial);

        const decorativeGeometry = new THREE.BufferGeometry();
        decorativeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(decorativePositions, 3));
        decorativeGeometry.setAttribute('color', new THREE.Float32BufferAttribute(decorativeColors, 3));
        decorativeGeometry.setAttribute('particleSize', new THREE.Float32BufferAttribute(decorativeSizes, 1));
        const decorativeMaterial = new THREE.PointsMaterial({ map: starTexture, vertexColors: true, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true });
        decorativeMaterial.onBeforeCompile = shader => { shader.vertexShader = 'attribute float particleSize;\n' + shader.vertexShader; shader.vertexShader = shader.vertexShader.replace( 'gl_PointSize = size;', 'gl_PointSize = particleSize;' ); };
        decorativeStarParticles = new THREE.Points(decorativeGeometry, decorativeMaterial);
        
        const dustGeometry = new THREE.BufferGeometry();
        dustGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dustPositions, 3));
        const dustMaterial = new THREE.PointsMaterial({ size: 150, map: dustTexture, sizeAttenuation: true, depthWrite: false, blending: THREE.NormalBlending, transparent: true, opacity: 0.6 });
        dustParticles = new THREE.Points(dustGeometry, dustMaterial);
        dustParticles.renderOrder = 1;

        const nebulaGeometry = new THREE.BufferGeometry();
        nebulaGeometry.setAttribute('position', new THREE.Float32BufferAttribute(nebulaPositions, 3));
        const nebulaMaterial = new THREE.PointsMaterial({size: 300, map: nebulaTexture, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.35});
        nebulaParticles = new THREE.Points(nebulaGeometry, nebulaMaterial);

        const clickableGeometry = new THREE.BufferGeometry();
        clickableGeometry.setAttribute('position', new THREE.Float32BufferAttribute(clickablePositions, 3));
        clickableGeometry.setAttribute('color', new THREE.Float32BufferAttribute(clickableColors, 3));
        const clickableMaterial = new THREE.PointsMaterial({ size: 50, map: starTexture, vertexColors: true, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.95 });
        clickableSystemParticles = new THREE.Points(clickableGeometry, clickableMaterial);
        
        galaxyGroup.add(haloStarParticles, coreStarParticles, diskStarParticles, decorativeStarParticles, dustParticles, nebulaParticles, clickableSystemParticles, _createGalacticCoreGlow());
        galaxyGroup.rotation.set(0, 0, Math.PI / 12);
        scene.add(galaxyGroup);
    }
    
    function _createDistantStars() {
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        for (let i = 0; i < BACKGROUND_STAR_COUNT; i++) {
            positions.push( (Math.random() - 0.5) * 40000, (Math.random() - 0.5) * 40000, (Math.random() - 0.5) * 40000 );
        }
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({ size: 15, color: 0xffffff, map: _createStarTexture(), sizeAttenuation: true, depthWrite: false, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending });
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
        if(galaxyGroup) galaxyGroup.rotation.y += rotationSpeed;
        if(sisterGalaxy) sisterGalaxy.rotation.y += rotationSpeed * 0.5;
        renderer.render(scene, camera);
    }

    function _dispose() {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', _onResize);
        if (renderer) renderer.domElement.removeEventListener('click', _onCanvasClick);
        if (controls) controls.dispose();
        
        for(const texture of createdTextures) {
            texture.dispose();
        }
        createdTextures = [];

        scene?.traverse(object => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                object.material.dispose();
            }
        });

        distantGalaxies?.children.forEach(child => distantGalaxies.remove(child));
        scene?.remove(distantGalaxies);
        scene?.remove(sisterGalaxy);
        scene?.remove(galaxyGroup);
        renderer?.dispose();
        scene = camera = renderer = controls = animationFrameId = onSystemClickCallback = null;
        interactiveSystemsData = [];
        skybox = backgroundStars = decorativeStarParticles = dustParticles = clickableSystemParticles = nebulaParticles = coreStarParticles = diskStarParticles = haloStarParticles = distantGalaxies = galaxyGroup = sisterGalaxy = null;
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
