import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export const GalaxyRenderer = (() => {
    // --- STATE ---
    let scene, camera, renderer, controls, raycaster, mouse;
    let clickableSystemParticles, decorativeStarParticles, dustParticles, backgroundStars, nebulaParticles;
    let coreStarParticles, diskStarParticles, haloStarParticles;
    let skybox, galaxyGroup, sisterGalaxy, distantGalaxiesGroup; // Renamed to distantGalaxiesGroup for clarity
    let animationFrameId = null;
    let onSystemClickCallback = null;
    let interactiveSystemsData = [];
    let createdTextures = [];

    // --- CONFIGURATION PARAMETERS ---
    const GALAXY_CONFIG = {
        RADIUS: 1800, // Slightly increased for a grander scale
        THICKNESS: 100,
        CORE_RADIUS: 250, // Slightly larger core
        NUM_ARMS: 5,
        ARM_ROTATION_MULTIPLIER: 4.2 * Math.PI, // Slightly tighter arms
        STAR_COUNTS: {
            DECORATIVE: 70000, // More decorative stars for richer arms
            CORE: 25000,
            DISK: 500000, // Massively increased to guarantee no black space
            HALO: 300000,
            BACKGROUND: 250000,
            CLICKABLE_SYSTEM_SIZE: 50, // Size for interactive system particles
            DECORATIVE_STAR_MAX_SIZE: 15,
            DECORATIVE_STAR_MIN_SIZE: 5,
        },
        DUST: {
            COUNT: 15000, // More dust particles
            SIZE: 150,
            OPACITY: 0.7, // Slightly more opaque
        },
        NEBULA: {
            CLUSTER_COUNT: 60, // More nebula clusters
            PARTICLE_COUNT_PER_CLUSTER: 12, // More particles per cluster
            SIZE: 350, // Larger nebulae
            OPACITY: 0.4, // Slightly more opaque
        },
        DISTANT_GALAXIES: {
            COUNT: 150,
            MIN_SCALE: 400,
            MAX_SCALE: 600,
            MIN_OPACITY: 0.1,
            MAX_OPACITY: 0.3,
            MIN_DISTANCE_MULTIPLIER: 6, // Multiplier for GALAXY_RADIUS
            MAX_DISTANCE_ADDITION: 6000,
        },
        SISTER_GALAXY: {
            STAR_COUNT: 80000,
            RADIUS_MULTIPLIER: 0.7, // Slightly smaller
            THICKNESS_MULTIPLIER: 0.4,
            DISPLACEMENT_MULTIPLIER: 0.5, // Less displacement
            PARTICLE_SIZE: 15,
            OPACITY: 0.95,
            CORE_GLOW_SCALE: 0.5,
            POSITION: { x: -5, y: -3, z: -8 }, // Moved further away
            ROTATION: { x: Math.PI / 6, y: Math.PI / 10, z: Math.PI / 8 },
        },
        RENDERER: {
            CAMERA_FOV: 60,
            CAMERA_NEAR: 1,
            CAMERA_FAR: 40000, // Increased far clipping plane
            CAMERA_POSITION_MULTIPLIERS: { x: 1.2, y: 1.0, z: 1.2 }, // Slightly different starting position
            CONTROLS_DAMPING_FACTOR: 0.05, // Slightly higher damping for fluidity
            CONTROLS_MIN_DISTANCE: 100,
            CONTROLS_MAX_DISTANCE_MULTIPLIER: 4, // Multiplier for GALAXY_RADIUS
            RAYCASTER_THRESHOLD: 20,
            ROTATION_SPEED: 0.0001, // Slightly faster overall rotation
        },
        COLORS: {
            STAR_TEXTURE_COLOR: 'rgba(255,255,255,1)',
            STAR_TEXTURE_GRADIENT_STOP: 0.2,
            CORE_GLOW_COLOR: 'rgba(255, 200, 150, 1)',
            CORE_GLOW_GRADIENT_STOP: 0.05,
            // Realistic dust colors (darker, brownish-red)
            DUST_COLOR_STOP_0: 'rgba(80, 50, 20, 0.5)',
            DUST_COLOR_STOP_04: 'rgba(60, 40, 10, 0.2)',
            DUST_COLOR_STOP_1: 'rgba(30, 20, 5, 0)',
            // Vibrant nebula colors (blue, purple, orange)
            NEBULA_COLOR_STOP_0: 'rgba(50, 150, 255, 0.3)', // Blue
            NEBULA_COLOR_STOP_04: 'rgba(150, 50, 255, 0.1)', // Purple
            NEBULA_COLOR_STOP_1: 'rgba(255, 100, 50, 0)', // Orange
            BACKGROUND_STAR_COLOR: 0xffffff,
            SKYBOX_COLOR: 0x8899bb,
            // Expanded star color palette for more variety
            PALETTE: [
                new THREE.Color(0xFF8C00), // Darker orange
                new THREE.Color(0xFFDAB9), // Peach
                new THREE.Color(0xDC143C), // Crimson red
                new THREE.Color(0x87CEEB), // Sky blue
                new THREE.Color(0xFFFFFF), // White
                new THREE.Color(0xFFFFCC), // Pale yellow
                new THREE.Color(0xFFA500), // Orange
                new THREE.Color(0xADD8E6), // Light blue
                new THREE.Color(0xFF6347), // Tomato red
                new THREE.Color(0x40E0D0)  // Turquoise
            ],
        },
        PATH_TO_ASSETS: {
            SKYBOX_TEXTURE: 'https://cdn.jsdelivr.net/gh/jeromeetienne/threex.planets@master/images/galaxy_starfield.png',
            DISTANT_GALAXY_TEXTURE: 'https://cdn.jsdelivr.net/gh/Sean-Bradley/Three.js-TypeScript-Boilerplate@master/src/assets/images/galaxy.png',
        }
    };

    // --- HELPER FUNCTIONS ---

    function _createAndCacheTexture(creationFunction) {
        const texture = creationFunction();
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
            const skyGeometry = new THREE.SphereGeometry(GALAXY_CONFIG.RENDERER.CAMERA_FAR / 1.2, 64, 32); // Scaled relative to far clip
            const skyMaterial = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, color: GALAXY_CONFIG.COLORS.SKYBOX_COLOR });
            skybox = new THREE.Mesh(skyGeometry, skyMaterial);
            scene.add(skybox);
        } catch (error) {
            console.error('Skybox texture failed to load:', error);
            // Fallback: set a black background
            scene.background = new THREE.Color(0x000000);
        }
    }

    // Gaussian random for better distribution in certain areas
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
            transparent: true, // Always true if opacity is less than 1 or blending is not NormalBlending
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

    function _initScene(canvas, galaxyData) {
        scene = new THREE.Scene();

        camera = new THREE.PerspectiveCamera(GALAXY_CONFIG.RENDERER.CAMERA_FOV, canvas.offsetWidth / canvas.offsetHeight, GALAXY_CONFIG.RENDERER.CAMERA_NEAR, GALAXY_CONFIG.RENDERER.CAMERA_FAR);
        camera.position.set(GALAXY_CONFIG.RADIUS * GALAXY_CONFIG.RENDERER.CAMERA_POSITION_MULTIPLIERS.x, GALAXY_CONFIG.RADIUS * GALAXY_CONFIG.RENDERER.CAMERA_POSITION_MULTIPLIERS.y, GALAXY_CONFIG.RADIUS * GALAXY_CONFIG.RENDERER.CAMERA_POSITION_MULTIPLIERS.z);

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
        renderer.setSize(canvas.offsetWidth, canvas.offsetHeight, false); // false for updateStyle
        renderer.setPixelRatio(window.devicePixelRatio);

        controls = new OrbitControls(camera, renderer.domElement);
        Object.assign(controls, {
            enableDamping: true,
            dampingFactor: GALAXY_CONFIG.RENDERER.CONTROLS_DAMPING_FACTOR,
            minDistance: GALAXY_CONFIG.RENDERER.CONTROLS_MIN_DISTANCE,
            maxDistance: GALAXY_CONFIG.RADIUS * GALAXY_CONFIG.RENDERER.CONTROLS_MAX_DISTANCE_MULTIPLIER,
            enablePan: false,
            minPolarAngle: 0,
            maxPolarAngle: Math.PI
        });

        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();
        raycaster.params.Points.threshold = GALAXY_CONFIG.RENDERER.RAYCASTER_THRESHOLD;

        _createGalaxy(galaxyData);
        _createDistantStars();
        _createDistantGalaxies();
        _createSisterGalaxy();
        _loadSkybox(); // Load skybox asynchronously

        renderer.domElement.addEventListener('click', _onCanvasClick);
        window.addEventListener('resize', _onResize);
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

    async function _createDistantGalaxies() {
        distantGalaxiesGroup = new THREE.Group();
        const loader = new THREE.TextureLoader();
        try {
            const galaxyTexture = await loader.loadAsync(GALAXY_CONFIG.PATH_TO_ASSETS.DISTANT_GALAXY_TEXTURE);
            createdTextures.push(galaxyTexture);
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
        } catch (error) {
            console.error('Distant galaxy texture failed to load:', error);
        }
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

            const displacement = new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).multiplyScalar(GALAXY_CONFIG.RADIUS * GALAXY_CONFIG.SISTER_GALAXY.DISPLACEMENT_MULTIPLIER);
            pos.add(displacement);

            positions.push(pos.x, pos.y, pos.z);
            const starColor = colorPalette[Math.floor(Math.random() * colorPalette.length)];
            colors.push(starColor.r, starColor.g, starColor.b);
        }

        const sisterGalaxyMesh = _createParticleSystem(
            positions,
            colors,
            GALAXY_CONFIG.SISTER_GALAXY.PARTICLE_SIZE,
            _createStarTexture(),
            GALAXY_CONFIG.SISTER_GALAXY.OPACITY,
            THREE.AdditiveBlending,
            false // depthWrite
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

        const starTexture = _createStarTexture();
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

        // Halo stars
        for (let i = 0; i < GALAXY_CONFIG.STAR_COUNTS.HALO; i++) {
            const r = Math.pow(Math.random(), 1.5) * GALAXY_CONFIG.RADIUS * 2 + GALAXY_CONFIG.RADIUS;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            haloPositions.push(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi));
            const starColor = generateStarColor();
            haloColors.push(starColor.r, starColor.g, starColor.b);
        }

        // Core stars
        for (let i = 0; i < GALAXY_CONFIG.STAR_COUNTS.CORE; i++) {
            const distance = Math.pow(Math.random(), 2) * GALAXY_CONFIG.CORE_RADIUS;
            const randomY = _gaussianRandom() * GALAXY_CONFIG.THICKNESS * 2.0;
            const angle = Math.random() * Math.PI * 2;
            corePositions.push(Math.cos(angle) * distance, randomY, Math.sin(angle) * distance);
            const color = generateStarColor().multiplyScalar(1.5);
            coreColors.push(color.r, color.g, color.b);
        }

        // Disk stars
        for (let i = 0; i < GALAXY_CONFIG.STAR_COUNTS.DISK; i++) {
            const distance = GALAXY_CONFIG.CORE_RADIUS + Math.sqrt(Math.random()) * (GALAXY_CONFIG.RADIUS - GALAXY_CONFIG.CORE_RADIUS);
            const randomY = _gaussianRandom() * (GALAXY_CONFIG.THICKNESS * 0.5);
            const angle = Math.random() * Math.PI * 2;
            diskPositions.push(Math.cos(angle) * distance, randomY, Math.sin(angle) * distance);
            const starColor = generateStarColor();
            diskColors.push(starColor.r, starColor.g, starColor.b);
        }

        // Decorative stars (spiral arms)
        for (let i = 0; i < GALAXY_CONFIG.STAR_COUNTS.DECORATIVE; i++) {
            const distance = Math.sqrt(Math.random()) * GALAXY_CONFIG.RADIUS;
            const armIndex = Math.floor(Math.random() * (GALAXY_CONFIG.NUM_ARMS - 0.001));
            const armVar = armVariations[armIndex];
            const armAngle = (armIndex / GALAXY_CONFIG.NUM_ARMS) * 2 * Math.PI + armVar.offset;
            const rotation = (distance / GALAXY_CONFIG.RADIUS) * armVar.rotation;
            const angle = armAngle + rotation;
            const spread = 2800 * Math.pow(1 - (distance / GALAXY_CONFIG.RADIUS), 2); // Further widened arms
            const turbulence = Math.sin(angle * 5 + distance * 0.01) * spread * 0.25; // Increased turbulence
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

        // Nebula clusters
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

        // Dust particles
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

        // Clickable solar systems
        interactiveSystemsData = galaxyData.solarSystems || [];
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

        // --- Create and add particle systems ---
        haloStarParticles = _createParticleSystem(
            haloPositions,
            haloColors,
            5, // size
            starTexture,
            0.25, // opacity
            THREE.AdditiveBlending,
            false // depthWrite
        );

        coreStarParticles = _createParticleSystem(
            corePositions,
            coreColors,
            5, // size
            starTexture,
            0.9, // opacity
            THREE.AdditiveBlending,
            false // depthWrite
        );
        coreStarParticles.frustumCulled = false;

        diskStarParticles = _createParticleSystem(
            diskPositions,
            diskColors,
            10, // size
            starTexture,
            1.0, // opacity
            THREE.AdditiveBlending,
            false // depthWrite
        );

        // Custom onBeforeCompile for decorative stars to use 'particleSize' attribute
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
                map: starTexture,
                vertexColors: true,
                sizeAttenuation: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                transparent: true,
                onBeforeCompile: decorativeOnBeforeCompile
            })
        );


        dustParticles = _createParticleSystem(
            dustPositions,
            [], // no colors
            GALAXY_CONFIG.DUST.SIZE,
            dustTexture,
            GALAXY_CONFIG.DUST.OPACITY,
            THREE.NormalBlending,
            false // depthWrite
        );
        dustParticles.renderOrder = 1;

        nebulaParticles = _createParticleSystem(
            nebulaPositions,
            [], // no colors
            GALAXY_CONFIG.NEBULA.SIZE,
            nebulaTexture,
            GALAXY_CONFIG.NEBULA.OPACITY,
            THREE.AdditiveBlending,
            false // depthWrite
        );

        clickableSystemParticles = _createParticleSystem(
            clickablePositions,
            clickableColors,
            GALAXY_CONFIG.STAR_COUNTS.CLICKABLE_SYSTEM_SIZE,
            starTexture,
            0.95, // opacity
            THREE.AdditiveBlending,
            false // depthWrite
        );

        galaxyGroup.add(haloStarParticles, coreStarParticles, diskStarParticles, decorativeStarParticles, dustParticles, nebulaParticles, clickableSystemParticles, _createGalacticCoreGlow());
        galaxyGroup.rotation.set(0, 0, Math.PI / 12);
        scene.add(galaxyGroup);
    }

    function _createDistantStars() {
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        // Define a reasonable boundary for background stars
        const backgroundStarFieldSize = 40000;
        for (let i = 0; i < GALAXY_CONFIG.STAR_COUNTS.BACKGROUND; i++) {
            positions.push(
                (Math.random() - 0.5) * backgroundStarFieldSize,
                (Math.random() - 0.5) * backgroundStarFieldSize,
                (Math.random() - 0.5) * backgroundStarFieldSize
            );
        }
        backgroundStars = _createParticleSystem(
            positions,
            [], // no colors
            15, // size
            _createStarTexture(),
            0.5, // opacity
            THREE.AdditiveBlending,
            false, // depthWrite
            true, // sizeAttenuation
            false // vertexColors
        );
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
            // Sort by distance to ray to pick the closest visible point, not just closest to camera
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
            renderer.setSize(canvas.clientWidth, canvas.clientHeight, false); // false for updateStyle
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

    function _dispose() {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);

        // Remove all event listeners
        window.removeEventListener('resize', _onResize);
        if (renderer) renderer.domElement.removeEventListener('click', _onCanvasClick);

        if (controls) controls.dispose();

        // Dispose of all created textures
        for (const texture of createdTextures) {
            if (texture) texture.dispose();
        }
        createdTextures = [];

        // Dispose of all scene objects (geometries and materials)
        if (scene) {
            scene.traverse(object => {
                if (object.isMesh || object.isPoints || object.isLine) {
                    if (object.geometry) object.geometry.dispose();
                    if (object.material) {
                        // Dispose of materials array or single material
                        if (Array.isArray(object.material)) {
                            object.material.forEach(m => { if (m) m.dispose(); });
                        } else {
                            if (object.material) object.material.dispose();
                        }
                    }
                }
            });

            // Remove top-level groups and meshes from scene
            scene.remove(distantGalaxiesGroup);
            scene.remove(sisterGalaxy);
            scene.remove(galaxyGroup);
            scene.remove(skybox);
            scene.remove(backgroundStars);
        }

        if (renderer) renderer.dispose();

        // Reset all module state variables
        scene = camera = renderer = controls = animationFrameId = onSystemClickCallback = null;
        interactiveSystemsData = [];
        skybox = backgroundStars = decorativeStarParticles = dustParticles = clickableSystemParticles = nebulaParticles = coreStarParticles = diskStarParticles = haloStarParticles = distantGalaxiesGroup = galaxyGroup = sisterGalaxy = null;
    }

    return {
        init: (canvas, galaxyData, callback) => {
            _dispose(); // Ensure a clean slate before re-initializing
            onSystemClickCallback = callback;
            _initScene(canvas, galaxyData);
            _animate();
            setTimeout(_onResize, 100); // Trigger a resize event to ensure correct initial sizing
        },
        dispose: _dispose
    };
})();
