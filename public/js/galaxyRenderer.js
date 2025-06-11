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

    const GALAXY_RADIUS = 600;
    const NUM_DUST_PARTICLES = 50000;
    const NUM_ARM_PARTICLES = 200000;
    const NUM_ARMS = 6;
    const BULGE_PARTICLES = 30000;

    const armProfiles = [
        { angleOffset: 0.0, tightness: 7.0, length: 1.00 },
        { angleOffset: 1.2, tightness: 8.0, length: 0.95 },
        { angleOffset: 2.3, tightness: 7.5, length: 1.05 },
        { angleOffset: 3.8, tightness: 7.0, length: 0.90 },
        { angleOffset: 4.8, tightness: 8.5, length: 1.00 },
        { angleOffset: 5.9, tightness: 7.2, length: 0.98 },
    ];


    function _createStarTexture() {
        const canvas = document.createElement('canvas');
        const size = 64;
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
        gradient.addColorStop(0.4, 'rgba(255,255,255,0.2)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, size, size);
        return new THREE.CanvasTexture(canvas);
    }

    function _initScene(canvas, galaxy) {
        scene = new THREE.Scene();
        const aspect = canvas.offsetWidth / canvas.offsetHeight;
        camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 10000);
        camera.position.set(0, GALAXY_RADIUS * 1.5, GALAXY_RADIUS * 1.5);

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
        renderer.setPixelRatio(window.devicePixelRatio);

        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.screenSpacePanning = false;
        controls.minDistance = 10;
        controls.maxDistance = GALAXY_RADIUS * 10;

        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();
        raycaster.params.Points.threshold = 5;

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
        scene.add(ambientLight);

        galaxyGroup = new THREE.Group();
        _createGalacticBulge();
        _createGalaxyArms();
        _createDustLanes();
        _createSolarSystemParticles(galaxy.solarSystems);
        scene.add(galaxyGroup);

        renderer.domElement.addEventListener('click', _onCanvasClick);
        window.addEventListener('resize', _onResize);
    }

    function _createGalacticBulge() {
        const positions = [];
        const colors = [];
        const color = new THREE.Color('#ffccaa');

        for (let i = 0; i < BULGE_PARTICLES; i++) {
            const r = Math.pow(Math.random(), 2) * GALAXY_RADIUS * 0.3;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const x = r * Math.sin(phi) * Math.cos(theta) * 1.5;
            const y = r * Math.sin(phi) * Math.sin(theta) * 0.5;
            const z = r * Math.cos(phi) * 1.5;
            positions.push(x, y, z);
            colors.push(color.r, color.g, color.b);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        const material = new THREE.PointsMaterial({
            size: 3,
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
        const colorInside = new THREE.Color('#fffacd');
        const colorOutside = new THREE.Color('#add8e6');
        const particlesPerArm = Math.floor(NUM_ARM_PARTICLES / NUM_ARMS);

        // ** BUG FIX: Loop through each arm independently to create spirals instead of rings **
        for (let armIndex = 0; armIndex < NUM_ARMS; armIndex++) {
            const arm = armProfiles[armIndex];

            for (let i = 0; i < particlesPerArm; i++) {
                // Calculate progress within the current arm
                const progress = (i / particlesPerArm) * arm.length;
                const angle = progress * Math.PI * arm.tightness;
                const armRotation = arm.angleOffset;
                const distance = Math.pow(progress, 0.8) * GALAXY_RADIUS;

                const randomX = (Math.random() - 0.5) * 15;
                const randomY = (Math.random() - 0.5) * 15;
                const randomZ = (Math.random() - 0.5) * 15;

                const x = Math.cos(angle + armRotation) * distance + randomX;
                const y = randomY;
                const z = Math.sin(angle + armRotation) * distance + randomZ;

                positions.push(x, y, z);
                const normalizedDistance = distance / GALAXY_RADIUS;
                const mixedColor = colorInside.clone().lerp(colorOutside, normalizedDistance);
                colors.push(mixedColor.r, mixedColor.g, mixedColor.b);
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
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
        const particlesPerLane = Math.floor(NUM_DUST_PARTICLES / NUM_ARMS);

        // ** BUG FIX: Loop through each lane independently **
        for (let armIndex = 0; armIndex < NUM_ARMS; armIndex++) {
            const arm = armProfiles[armIndex];
            const armRotation = arm.angleOffset + 0.15; // Offset dust from star arm

            for (let i = 0; i < particlesPerLane; i++) {
                const progress = (i / particlesPerLane) * arm.length;
                const angle = progress * Math.PI * arm.tightness;
                const distance = Math.pow(progress, 0.8) * GALAXY_RADIUS;

                const randomX = (Math.random() - 0.5) * 25;
                const randomY = (Math.random() - 0.5) * 20;
                const randomZ = (Math.random() - 0.5) * 25;

                const x = Math.cos(angle + armRotation) * distance + randomX;
                const y = randomY;
                const z = Math.sin(angle + armRotation) * distance + randomZ;

                positions.push(x, y, z);
            }
        }

        dustGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const dustMaterial = new THREE.PointsMaterial({
            size: 40,
            color: '#000000',
            sizeAttenuation: true,
            depthWrite: false,
            transparent: true,
            opacity: 0.45,
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

        systems.forEach((system) => {
            const scale = (GALAXY_RADIUS * 1.5) / galaxyContentDiameter;
            const x = (system.x - galaxyContentDiameter / 2) * scale;
            const z = (system.y - galaxyContentDiameter / 2) * scale;
            const y = (Math.random() - 0.5) * 10;
            positions.push(x, y, z);
            const sunColor = sunVariations[(system.sunType || 0) % sunVariations.length].baseColor;
            colors.push(sunColor.r, sunColor.g, sunColor.b);
        });

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
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
        if (intersects.length > 0) {
            const systemId = solarSystemData?.[intersects[0]?.index]?.id;
            if (systemId) {
                onSystemClickCallback(systemId);
            }
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
        galaxyGroup.rotation.y += 0.0001;
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
        renderer?.dispose();
        scene = null; camera = null; renderer = null; controls = null;
        animationFrameId = null; onSystemClickCallback = null;
    }

    return {
        init: (canvas, galaxy, callback) => {
            onSystemClickCallback = callback;
            _initScene(canvas, galaxy);
            _animate();
        },
        dispose: _dispose
    };
})();
