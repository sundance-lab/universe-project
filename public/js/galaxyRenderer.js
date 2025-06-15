// public/js/galaxyRenderer.js

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export const GalaxyRenderer = (() => {

    // --- STATE ---
    let scene, camera, renderer, controls, raycaster, mouse;
    let clickableSystemParticles, decorativeStarParticles, dustParticles, backgroundStars, nebulaParticles;
    let coreStarParticles, diskStarParticles, haloStarParticles;
    let skybox, galaxyGroup, sisterGalaxy, distantGalaxiesGroup;
    let animationFrameId = null;
    let onSystemClickCallback = null;
    let createdTextures = [];
    let _currentGalaxyData = null;
    let resizeObserver = null; // For robust resizing

    // --- CONFIGURATION PARAMETERS ---
    let GALAXY_CONFIG = {
        RADIUS: 1800,
        THICKNESS: 200,
        CORE_RADIUS: 200,
        NUM_ARMS: 2,
        ARM_ROTATION_MULTIPLIER: 13,
        STAR_COUNTS: {
            DECORATIVE: 100000,
            CORE: 100000,
            DISK: 1000000,
            HALO: 25000,
            BACKGROUND: 250000,
            CLICKABLE_SYSTEM_SIZE: 50,
            DECORATIVE_STAR_MAX_SIZE: 10,
            DECORATIVE_STAR_MIN_SIZE: 2,
        },
        DUST: {
            COUNT: 500,
            SIZE: 25,
            OPACITY: 0.7,
        },
        NEBULA: {
            CLUSTER_COUNT: 1500,
            PARTICLE_COUNT_PER_CLUSTER: 15,
            SIZE: 50,
            OPACITY: 0.1,
        },
        DISTANT_GALAXIES: {
            COUNT: 150,
            MIN_SCALE: 400,
            MAX_SCALE: 600,
            MIN_OPACITY: 0.1,
            MAX_OPACITY: 0.3,
            MIN_DISTANCE_MULTIPLIER: 6,
            MAX_DISTANCE_ADDITION: 6000,
        },
        SISTER_GALAXY: {
            STAR_COUNT: 80000,
            RADIUS_MULTIPLIER: 0.7,
            THICKNESS_MULTIPLIER: 0.4,
            DISPLACEMENT_MULTIPLIER: 0.5,
            PARTICLE_SIZE: 15,
            OPACITY: 0.95,
            CORE_GLOW_SCALE: 0.5,
            POSITION: { x: -5, y: -3, z: -8 },
            ROTATION: { x: Math.PI / 6, y: Math.PI / 10, z: Math.PI / 8 },
        },
        RENDERER: {
            CAMERA_FOV: 120,
            CAMERA_NEAR: 1,
            CAMERA_FAR: 40000,
            CAMERA_POSITION_MULTIPLIERS: { x: 1.2, y: 1.0, z: 1.2 },
            CONTROLS_DAMPING_FACTOR: 0.05,
            CONTROLS_MIN_DISTANCE: 100,
            CONTROLS_MAX_DISTANCE_MULTIPLIER: 4,
            RAYCASTER_THRESHOLD: 20,
            ROTATION_SPEED: 0.0001, // Slower rotation
        },
        COLORS: {
            STAR_TEXTURE_COLOR: 'rgba(224,140,62,1)',
            STAR_TEXTURE_GRADIENT_STOP: 0.2,
            CORE_GLOW_COLOR: 'rgba(212, 175, 55, 1)',
            CORE_GLOW_GRADIENT_STOP: 0.05,
            DUST_COLOR_STOP_0: 'rgba(8, 13, 78, 1)',
            DUST_COLOR_STOP_04: 'rgba(25, 19, 103, 1)',
            DUST_COLOR_STOP_1: 'rgba(30, 20, 5, 0)',
            NEBULA_COLOR_STOP_0: 'rgba(71, 74, 77, 1)',
            NEBULA_COLOR_STOP_04: 'rgba(150, 50, 255, 1)',
            NEBULA_COLOR_STOP_1: 'rgba(255, 100, 50, 0)',
            BACKGROUND_STAR_COLOR: 0x000000,
            SKYBOX_COLOR: 0x000000,
            PALETTE: [
                new THREE.Color(0xFF8C00),
                new THREE.Color(0xFFDAB9),
                new THREE.Color(0xDC143C),
                new THREE.Color(0x87CEEB),
                new THREE.Color(0xFFFFFF),
                new THREE.Color(0xFFFFCC),
                new THREE.Color(0xFFA500),
                new THREE.Color(0xADD8E6),
                new THREE.Color(0xFF6347),
                new THREE.Color(0x40E0D0)
            ],
        },
        PATH_TO_ASSETS: {
            SKYBOX_TEXTURE: 'https://cdn.jsdelivr.net/gh/jeromeetienne/threex.planets@master/images/galaxy_starfield.png',
        }
    };
    const _defaultGalaxyConfig = JSON.parse(JSON.stringify(GALAXY_CONFIG));
    GALAXY_CONFIG.COLORS.PALETTE = GALAXY_CONFIG.COLORS.PALETTE.map(c => new THREE.Color(c.r, c.g, c.b));


    // --- HELPER FUNCTIONS ---
    function _createAndCacheTexture(creationFunction) {
        const texture = creationFunction();
        // FIX: Removed 'texture.flipY = false;' which was causing WebGL errors.
        createdTextures.push(texture);
        return texture;
    }

    function _createStarTexture(color = GALAXY_CONFIG.COLORS.STAR_TEXTURE_COLOR, gradientStop = GALAXY_CONFIG.COLORS.STAR_TEXTURE_GRADIENT_STOP) {
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

    function _createClickableSystemTexture() {
        return _createAndCacheTexture(() => {
            const size = 128;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const context = canvas.getContext('2d');
            const center = size / 2;

            const gradient = context.createRadialGradient(center, center, 0, center, center, center / 1.5);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
            gradient.addColorStop(0.3, 'rgba(220, 220, 255, 0.9)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            context.fillStyle = gradient;
            context.fillRect(0, 0, size, size);

            context.beginPath();
            context.arc(center, center, center / 2.5, 0, 2 * Math.PI, false);
            context.strokeStyle = 'yellow';
            context.lineWidth = 6;
            context.stroke();

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

    function _createNebulaTexture() {
        return _createAndCacheTexture(() => {
            const size = 256;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const context = canvas.getContext('2d');
            const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
            gradient.addColorStop(0, GALAXY_CONFIG.COLORS.NEBULA_COLOR_STOP_0);
            gradient.addColorStop(0.4, GALAXY_CONFIG.COLORS.NEBULA_COLOR_STOP_04);
            gradient.addColorStop(1, GALAXY_CONFIG.COLORS.NEBULA_COLOR_STOP_1);
            context.fillStyle = gradient;
            context.fillRect(0, 0, size, size);
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
            gradient.addColorStop(0, GALAXY_CONFIG.COLORS.DUST_COLOR_STOP_0);
            gradient.addColorStop(0.4, GALAXY_CONFIG.COLORS.DUST_COLOR_STOP_04);
            gradient.addColorStop(1, GALAXY_CONFIG.COLORS.DUST_COLOR_STOP_1);
            context.fillStyle = gradient;
            context.fillRect(0, 0, size, size);
            return new THREE.CanvasTexture(canvas);
        });
    }

    async function _loadSkybox() {
        const loader = new THREE.TextureLoader();
        try {
            const texture = await loader.loadAsync(GALAXY_CONFIG.PATH_TO_ASSETS.SKYBOX_TEXTURE);
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            createdTextures.push(texture);
            const skyGeometry = new THREE.SphereGeometry(GALAXY_CONFIG.RENDERER.CAMERA_FAR / 1.2, 64, 32);
            const skyMaterial = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, color: new THREE.Color(GALAXY_CONFIG.COLORS.SKYBOX_COLOR) });
            skybox = new THREE.Mesh(skyGeometry, skyMaterial);
            scene.add(skybox);
        } catch (error) {
            console.error('Skybox texture failed to load:', error);
            scene.background = new THREE.Color(0x000000);
        }
    }

    function _gaussianRandom() {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }

    function _createParticleSystem(positions, colors, size, texture, opacity, blending, depthWrite, sizeAttenuation = true, vertexColors = true, onBeforeCompile = null) {
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

        if (vertexColors && colors.length > 0) {
            materialParams.vertexColors = true;
        }

        const material = new THREE.PointsMaterial(materialParams);

        if (onBeforeCompile) {
            material.onBeforeCompile = onBeforeCompile;
        }

        return new THREE.Points(geometry, material);
    }

    // --- CORE LOGIC ---

    function _initScene(container, galaxyData) {
        container.innerHTML = '';
        scene = new THREE.Scene();

        camera = new THREE.PerspectiveCamera(GALAXY_CONFIG.RENDERER.CAMERA_FOV, container.offsetWidth / container.offsetHeight, GALAXY_CONFIG.RENDERER.CAMERA_NEAR, GALAXY_CONFIG.RENDERER.CAMERA_FAR);
        camera.position.set(GALAXY_CONFIG.RADIUS * GALAXY_CONFIG.RENDERER.CAMERA_POSITION_MULTIPLIERS.x, GALAXY_CONFIG.RADIUS * GALAXY_CONFIG.RENDERER.CAMERA_POSITION_MULTIPLIERS.y, GALAXY_CONFIG.RADIUS * GALAXY_CONFIG.RENDERER.CAMERA_POSITION_MULTIPLIERS.z);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
        renderer.setSize(container.offsetWidth, container.offsetHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(renderer.domElement);

        controls = new OrbitControls(camera, renderer.domElement);
        Object.assign(controls, {
            enableDamping: true,
            dampingFactor: GALAXY_CONFIG.RENDERER.CONTROLS_DAMPING_FACTOR,
            minDistance: GALAXY_CONFIG.RENDERER.CONTROLS_MIN_DISTANCE,
            maxDistance: GALAXY_CONFIG.RADIUS * GALAXY_CONFIG.RENDERER.CONTROLS_MAX_DISTANCE_MULTIPLIER,
            enablePan: false,
            minPolarAngle: 0,
            maxPolarAngle: Math.PI,
            rotateSpeed: 0.5
        });

        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();
        raycaster.params.Points.threshold = GALAXY_CONFIG.RENDERER.RAYCASTER_THRESHOLD;

        _createGalaxy(galaxyData);
        _createDistantStars();
        _createDistantGalaxies();
        _createSisterGalaxy();
        _loadSkybox();

        renderer.domElement.addEventListener('click', _onCanvasClick);
    }

    function _createGalacticCoreGlow() {
        const coreTexture = _createStarTexture(GALAXY_CONFIG.COLORS.CORE_GLOW_COLOR, GALAXY_CONFIG.COLORS.CORE_GLOW_GRADIENT_STOP);
        const spriteMaterial = new THREE.SpriteMaterial({
            map: coreTexture,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: false
        });
        const glow = new THREE.Sprite(spriteMaterial);
        glow.renderOrder = 3;
        glow.scale.set(GALAXY_CONFIG.CORE_RADIUS * 3, GALAXY_CONFIG.CORE_RADIUS * 3, 1);
        return glow;
    }

    function _createDistantGalaxies() {
        distantGalaxiesGroup = new THREE.Group();
        const galaxyTexture = _createSimpleGalaxySpriteTexture();

        for (let i = 0; i < GALAXY_CONFIG.DISTANT_GALAXIES.COUNT; i++) {
            const material = new THREE.SpriteMaterial({
                map: galaxyTexture,
                blending: THREE.AdditiveBlending,
                transparent: true,
                opacity: GALAXY_CONFIG.DISTANT_GALAXIES.MIN_OPACITY + Math.random() * (GALAXY_CONFIG.DISTANT_GALAXIES.MAX_OPACITY - GALAXY_CONFIG.DISTANT_GALAXIES.MIN_OPACITY),
                color: new THREE.Color(Math.random(), Math.random(), Math.random())
            });
            const sprite = new THREE.Sprite(material);
            const distance = GALAXY_CONFIG.RADIUS * GALAXY_CONFIG.DISTANT_GALAXIES.MIN_DISTANCE_MULTIPLIER + Math.random() * GALAXY_CONFIG.DISTANT_GALAXIES.MAX_DISTANCE_ADDITION;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            sprite.position.set(distance * Math.sin(phi) * Math.cos(theta), distance * Math.sin(phi) * Math.sin(theta), distance * Math.cos(phi));
            const scale = Math.random() * (GALAXY_CONFIG.DISTANT_GALAXIES.MAX_SCALE - GALAXY_CONFIG.DISTANT_GALAXIES.MIN_SCALE) + GALAXY_CONFIG.DISTANT_GALAXIES.MIN_SCALE;
            sprite.scale.set(scale, scale, 1);
            distantGalaxiesGroup.add(sprite);
        }
        scene.add(distantGalaxiesGroup);
    }

    function _createSisterGalaxy() {
        sisterGalaxy = new THREE.Group();
        const positions = [], colors = [];
        const colorPalette = GALAXY_CONFIG.COLORS.PALETTE;

        for (let i = 0; i < GALAXY_CONFIG.SISTER_GALAXY.STAR_COUNT; i++) {
            const r = Math.random() * (GALAXY_CONFIG.RADIUS * GALAXY_CONFIG.SISTER_GALAXY.RADIUS_MULTIPLIER);
            const angle = Math.random() * Math.PI * 2;
            const y = (Math.random() - 0.5) * GALAXY_CONFIG.THICKNESS * GALAXY_CONFIG.SISTER_GALAXY.THICKNESS_MULTIPLIER;
            const pos = new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r);
            const randomVector = new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5));
            const displacementAmount = GALAXY_CONFIG.RADIUS * GALAXY_CONFIG.SISTER_GALAXY.DISPLACEMENT_MULTIPLIER;
            const displacement = randomVector.multiplyScalar(displacementAmount);
            pos.add(displacement);
            positions.push(pos.x, pos.y, pos.z);
            const starColor = colorPalette[Math.floor(Math.random() * colorPalette.length)];
            colors.push(starColor.r, starColor.g, starColor.b);
        }

        const sisterGalaxyMesh = _createParticleSystem(
            positions, colors, GALAXY_CONFIG.SISTER_GALAXY.PARTICLE_SIZE,
            _createStarTexture(), GALAXY_CONFIG.SISTER_GALAXY.OPACITY,
            THREE.AdditiveBlending, false
        );
        sisterGalaxy.add(sisterGalaxyMesh);

        const coreGlow = _createGalacticCoreGlow();
        coreGlow.scale.set(GALAXY_CONFIG.RADIUS * GALAXY_CONFIG.SISTER_GALAXY.CORE_GLOW_SCALE, GALAXY_CONFIG.RADIUS * GALAXY_CONFIG.SISTER_GALAXY.CORE_GLOW_SCALE, 1);
        sisterGalaxy.add(coreGlow);

        sisterGalaxy.position.set(GALAXY_CONFIG.RADIUS * GALAXY_CONFIG.SISTER_GALAXY.POSITION.x, GALAXY_CONFIG.RADIUS * GALAXY_CONFIG.SISTER_GALAXY.POSITION.y, GALAXY_CONFIG.RADIUS * GALAXY_CONFIG.SISTER_GALAXY.POSITION.z);
        sisterGalaxy.rotation.set(GALAXY_CONFIG.SISTER_GALAXY.ROTATION.x, GALAXY_CONFIG.SISTER_GALAXY.ROTATION.y, GALAXY_CONFIG.SISTER_GALAXY.ROTATION.z);
        scene.add(sisterGalaxy);
    }

    function _createGalaxy(galaxyData) {
        galaxyGroup = new THREE.Group();

        const corePositions = [], coreColors = [];
        const diskPositions = [], diskColors = [];
        const haloPositions = [], haloColors = [];
        const decorativePositions = [], decorativeColors = [], decorativeSizes = [];
        const dustPositions = [];
        const clickablePositions = [], clickableColors = [];
        const nebulaPositions = [];

        const dustTexture = _createDustTexture();
        const nebulaTexture = _createNebulaTexture();
        const colorPalette = GALAXY_CONFIG.COLORS.PALETTE;
        const armVariations = [];
        for (let i = 0; i < GALAXY_CONFIG.NUM_ARMS; i++) {
            armVariations.push({
                offset: (Math.random() - 0.5) * 0.5,
                rotation: GALAXY_CONFIG.ARM_ROTATION_MULTIPLIER * (1 + (Math.random() - 0.5) * 0.1)
            });
        }
        const generateStarColor = () => colorPalette[Math.floor(Math.random() * colorPalette.length)];

        for (let i = 0; i < GALAXY_CONFIG.STAR_COUNTS.HALO; i++) {
            const r = Math.pow(Math.random(), 1.5) * GALAXY_CONFIG.RADIUS * 2 + GALAXY_CONFIG.RADIUS;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            haloPositions.push(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi));
            const starColor = generateStarColor();
            haloColors.push(starColor.r, starColor.g, starColor.b);
        }

        for (let i = 0; i < GALAXY_CONFIG.STAR_COUNTS.CORE; i++) {
            const distance = Math.pow(Math.random(), 2) * GALAXY_CONFIG.CORE_RADIUS;
            const randomY = _gaussianRandom() * GALAXY_CONFIG.THICKNESS * 2.0;
            const angle = Math.random() * Math.PI * 2;
            corePositions.push(Math.cos(angle) * distance, randomY, Math.sin(angle) * distance);
            const color = generateStarColor().multiplyScalar(1.5);
            coreColors.push(color.r, color.g, color.b);
        }

        for (let i = 0; i < GALAXY_CONFIG.STAR_COUNTS.DISK; i++) {
            const distance = GALAXY_CONFIG.CORE_RADIUS + Math.sqrt(Math.random()) * (GALAXY_CONFIG.RADIUS - GALAXY_CONFIG.CORE_RADIUS);
            const randomY = _gaussianRandom() * (GALAXY_CONFIG.THICKNESS * 0.5);
            const angle = Math.random() * Math.PI * 2;
            diskPositions.push(Math.cos(angle) * distance, randomY, Math.sin(angle) * distance);
            const starColor = generateStarColor();
            diskColors.push(starColor.r, starColor.g, starColor.b);
        }

        for (let i = 0; i < GALAXY_CONFIG.STAR_COUNTS.DECORATIVE; i++) {
            const distance = Math.sqrt(Math.random()) * GALAXY_CONFIG.RADIUS;
            const armIndex = Math.floor(Math.random() * (GALAXY_CONFIG.NUM_ARMS - 0.001));
            const armVar = armVariations[armIndex];
            const armAngle = (armIndex / GALAXY_CONFIG.NUM_ARMS) * 2 * Math.PI + armVar.offset;
            const rotation = (distance / GALAXY_CONFIG.RADIUS) * armVar.rotation;
            const angle = armAngle + rotation;
            const spread = 2800 * Math.pow(1 - (distance / GALAXY_CONFIG.RADIUS), 2);
            const turbulence = Math.sin(angle * 5 + distance * 0.01) * spread * 0.25;
            const randomX = _gaussianRandom() * spread;
            const randomZ = _gaussianRandom() * spread;
            const y_thickness = distance < GALAXY_CONFIG.CORE_RADIUS ? GALAXY_CONFIG.THICKNESS * 2.5 : GALAXY_CONFIG.THICKNESS;
            const randomY = _gaussianRandom() * y_thickness * (1 - Math.pow(distance / GALAXY_CONFIG.RADIUS, 2));

            decorativePositions.push(Math.cos(angle) * distance + randomX + Math.cos(angle) * turbulence, randomY, Math.sin(angle) * distance + randomZ + Math.sin(angle) * turbulence);
            const starColor = generateStarColor();
            decorativeColors.push(starColor.r, starColor.g, starColor.b);
            const size = (1.0 - Math.pow(distance / GALAXY_CONFIG.RADIUS, 1.5)) * GALAXY_CONFIG.STAR_COUNTS.DECORATIVE_STAR_MAX_SIZE + GALAXY_CONFIG.STAR_COUNTS.DECORATIVE_STAR_MIN_SIZE;
            decorativeSizes.push(size);
        }

        for (let i = 0; i < GALAXY_CONFIG.NEBULA.CLUSTER_COUNT; i++) {
            const distance = GALAXY_CONFIG.CORE_RADIUS + Math.random() * (GALAXY_CONFIG.RADIUS - GALAXY_CONFIG.CORE_RADIUS);
            const armIndex = i % GALAXY_CONFIG.NUM_ARMS;
            const armAngle = (armIndex / GALAXY_CONFIG.NUM_ARMS) * 2 * Math.PI;
            const rotation = (distance / GALAXY_CONFIG.RADIUS) * armVariations[armIndex].rotation;
            const angle = armAngle + rotation;
            const clusterCenter = new THREE.Vector3(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
            for (let j = 0; j < GALAXY_CONFIG.NEBULA.PARTICLE_COUNT_PER_CLUSTER; j++) {
                nebulaPositions.push(clusterCenter.x + _gaussianRandom() * 100, clusterCenter.y + _gaussianRandom() * 20, clusterCenter.z + _gaussianRandom() * 100);
            }
        }

        for (let i = 0; i < GALAXY_CONFIG.DUST.COUNT; i++) {
            const distance = Math.pow(Math.random(), 0.8) * GALAXY_CONFIG.RADIUS;
            const y_thickness = GALAXY_CONFIG.THICKNESS * 0.2;
            const randomY = _gaussianRandom() * y_thickness * (1 - Math.pow(distance / GALAXY_CONFIG.RADIUS, 2));
            const armIndex = Math.floor(Math.random() * (GALAXY_CONFIG.NUM_ARMS - 0.001));
            const armAngle = (armIndex / GALAXY_CONFIG.NUM_ARMS) * 2 * Math.PI;
            const rotation = (distance / GALAXY_CONFIG.RADIUS) * armVariations[armIndex].rotation * 0.95;
            const angle = armAngle + rotation;
            const spread = 400 * Math.pow(1 - (distance / GALAXY_CONFIG.RADIUS), 2);
            dustPositions.push(Math.cos(angle) * distance + _gaussianRandom() * spread, randomY, Math.sin(angle) * distance + _gaussianRandom() * spread);
        }

        const interactiveSystemsData = galaxyData.solarSystems || [];
        interactiveSystemsData.forEach((system, i) => {
            const distance = GALAXY_CONFIG.CORE_RADIUS * 0.8 + Math.pow(Math.random(), 2) * (GALAXY_CONFIG.RADIUS - GALAXY_CONFIG.CORE_RADIUS * 0.8);
            const armIndex = i % GALAXY_CONFIG.NUM_ARMS;
            const armAngle = (armIndex / GALAXY_CONFIG.NUM_ARMS) * 2 * Math.PI;
            const rotation = (distance / GALAXY_CONFIG.RADIUS) * armVariations[armIndex].rotation;
            const angle = armAngle + rotation;
            const position = new THREE.Vector3(Math.cos(angle) * distance + _gaussianRandom() * 50, _gaussianRandom() * (GALAXY_CONFIG.THICKNESS / 3), Math.sin(angle) * distance + _gaussianRandom() * 50);

            system.position = position;
            clickablePositions.push(position.x, position.y, position.z);
            const starColor = generateStarColor();
            clickableColors.push(starColor.r, starColor.g, starColor.b);
        });

        haloStarParticles = _createParticleSystem(haloPositions, haloColors, 5, _createStarTexture(), 0.25, THREE.AdditiveBlending, false);
        coreStarParticles = _createParticleSystem(corePositions, coreColors, 5, _createStarTexture(), 0.9, THREE.AdditiveBlending, false);
        coreStarParticles.frustumCulled = false;
        diskStarParticles = _createParticleSystem(diskPositions, diskColors, 10, _createStarTexture(), 1.0, THREE.AdditiveBlending, false);

        const decorativeOnBeforeCompile = shader => {
            shader.vertexShader = 'attribute float particleSize;\n' + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace('gl_PointSize = size;', 'gl_PointSize = particleSize;');
        };
        const decorativeGeometry = new THREE.BufferGeometry();
        decorativeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(decorativePositions, 3));
        decorativeGeometry.setAttribute('color', new THREE.Float32BufferAttribute(decorativeColors, 3));
        decorativeGeometry.setAttribute('particleSize', new THREE.Float32BufferAttribute(decorativeSizes, 1));
        decorativeStarParticles = new THREE.Points(
            decorativeGeometry,
            new THREE.PointsMaterial({
                map: _createStarTexture(),
                vertexColors: true,
                sizeAttenuation: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                transparent: true,
                onBeforeCompile: decorativeOnBeforeCompile
            })
        );

        dustParticles = _createParticleSystem(dustPositions, [], GALAXY_CONFIG.DUST.SIZE, dustTexture, GALAXY_CONFIG.DUST.OPACITY, THREE.NormalBlending, false);
        dustParticles.renderOrder = 1;
        nebulaParticles = _createParticleSystem(nebulaPositions, [], GALAXY_CONFIG.NEBULA.SIZE, nebulaTexture, GALAXY_CONFIG.NEBULA.OPACITY, THREE.AdditiveBlending, false);
        clickableSystemParticles = _createParticleSystem(clickablePositions, clickableColors, GALAXY_CONFIG.STAR_COUNTS.CLICKABLE_SYSTEM_SIZE, _createClickableSystemTexture(), 0.95, THREE.AdditiveBlending, false);

        clickableSystemParticles.userData.systems = interactiveSystemsData;

        galaxyGroup.add(haloStarParticles, coreStarParticles, diskStarParticles, decorativeStarParticles, dustParticles, nebulaParticles, clickableSystemParticles, _createGalacticCoreGlow());
        galaxyGroup.rotation.set(0, 0, Math.PI / 12);
        scene.add(galaxyGroup);
    }

    function _createDistantStars() {
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const backgroundStarFieldSize = 40000;
        for (let i = 0; i < GALAXY_CONFIG.STAR_COUNTS.BACKGROUND; i++) {
            positions.push(
                (Math.random() - 0.5) * backgroundStarFieldSize,
                (Math.random() - 0.5) * backgroundStarFieldSize,
                (Math.random() - 0.5) * backgroundStarFieldSize
            );
        }
        backgroundStars = _createParticleSystem(positions, [], 15, _createStarTexture(), 0.5, THREE.AdditiveBlending, false, true, false);
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
            const intersection = intersects[0];

            const systemsData = intersection.object.userData.systems;
            const clickedSystem = systemsData?.[intersection.index];

            if (clickedSystem?.id) {
                onSystemClickCallback(clickedSystem.id);
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
        const rotationSpeed = GALAXY_CONFIG.RENDERER.ROTATION_SPEED;
        if (skybox) skybox.rotation.y += rotationSpeed / 2;
        if (galaxyGroup) galaxyGroup.rotation.y += rotationSpeed;
        if (sisterGalaxy) sisterGalaxy.rotation.y += rotationSpeed * 0.5;
        renderer.render(scene, camera);
    }

    function _deepMerge(target, source) {
        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
                    if (!target[key] || typeof target[key] !== 'object') {
                        target[key] = {};
                    }
                    _deepMerge(target[key], source[key]);
                } else {
                    target[key] = source[key];
                }
            }
        }
        return target;
    }

 function _dispose() {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        
        if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
        }
        
        if (renderer) renderer.domElement.removeEventListener('click', _onCanvasClick);

        if (controls) controls.dispose();

        for (const texture of createdTextures) {
            if (texture) texture.dispose();
        }
        createdTextures = [];

        if (scene) {
            scene.traverse(object => {
                if (object.isMesh || object.isPoints || object.isLine || object.isSprite) {
                    if (object.geometry) object.geometry.dispose();
                    if (object.material) {
                        if (Array.isArray(object.material)) {
                            object.material.forEach(m => { if (m) m.dispose(); });
                        } else {
                            if (object.material) object.material.dispose();
                        }
                    }
                }
            });

            if (distantGalaxiesGroup) scene.remove(distantGalaxiesGroup);
            if (sisterGalaxy) scene.remove(sisterGalaxy);
            if (galaxyGroup) scene.remove(galaxyGroup);
            if (skybox) scene.remove(skybox);
            if (backgroundStars) scene.remove(backgroundStars);
        }

        if (renderer) {
            
            renderer.dispose();
            if (renderer.domElement && renderer.domElement.parentNode) {
                 renderer.domElement.parentNode.removeChild(renderer.domElement);
            }
        }

        scene = camera = renderer = controls = animationFrameId = onSystemClickCallback = null;
        skybox = backgroundStars = decorativeStarParticles = dustParticles = clickableSystemParticles = nebulaParticles = coreStarParticles = diskStarParticles = haloStarParticles = distantGalaxiesGroup = galaxyGroup = sisterGalaxy = null;
    }

    return {
        init: (container, galaxyData, callback) => {
            _dispose();
            onSystemClickCallback = callback;
            _currentGalaxyData = galaxyData;
            
            resizeObserver = new ResizeObserver(() => {
                _onResize();
            });
            if (container) {
                resizeObserver.observe(container);
            }
            
            _initScene(container, galaxyData);
            _animate();
        },
        dispose: _dispose,
        resetConfig: () => {
            GALAXY_CONFIG = JSON.parse(JSON.stringify(_defaultGalaxyConfig));
            GALAXY_CONFIG.COLORS.PALETTE = GALAXY_CONFIG.COLORS.PALETTE.map(c => new THREE.Color(c.r, c.g, c.b));
        },
        updateConfig: (newConfig) => {
            _deepMerge(GALAXY_CONFIG, newConfig);
            if (scene && _currentGalaxyData) {
                const currentContainer = renderer ? renderer.domElement.parentNode : document.getElementById('galaxy-canvas-container');
                _dispose();
                if (currentContainer) {
                    _initScene(currentContainer, _currentGalaxyData);
                    _animate();
                } else {
                    console.warn("GalaxyRenderer: Attempted to update config without an active canvas container.");
                }
            }
        },
        getCurrentConfig: () => _deepMerge({}, GALAXY_CONFIG)
    };
})();
