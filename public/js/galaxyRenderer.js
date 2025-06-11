// public/js/galaxyRenderer.js
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export const GalaxyRenderer = (() => {
    let scene, camera, renderer, controls, raycaster, mouse;
    let galaxyGroup, solarSystemParticles, dustParticles;
    let animationFrameId = null;
    let onSystemClickCallback = null;
    let solarSystemData = [];

    const GALAXY_RADIUS = 500;
    const NUM_DUST_PARTICLES = 50000;
    const NUM_ARM_PARTICLES = 100000;
    const NUM_ARMS = 4;

    function _initScene(canvas, galaxy) {
        // Scene setup
        scene = new THREE.Scene();
        const aspect = canvas.offsetWidth / canvas.offsetHeight;
        camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 5000);
        camera.position.set(0, GALAXY_RADIUS / 2, GALAXY_RADIUS);

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
        renderer.setPixelRatio(window.devicePixelRatio);

        // Controls
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.screenSpacePanning = false;
        controls.minDistance = 10;
        controls.maxDistance = GALAXY_RADIUS * 3;
        controls.target.set(0, 0, 0);

        // Raycasting
        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();
        raycaster.params.Points.threshold = 5; // Adjust threshold for easier clicking

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
        scene.add(ambientLight);
        const pointLight = new THREE.PointLight(0xffffff, 0.8, 0);
        pointLight.position.set(0, 0, 0);
        scene.add(pointLight);

        // Create Galaxy
        galaxyGroup = new THREE.Group();
        _createGalaxyArms();
        _createDust();
        _createSolarSystemParticles(galaxy.solarSystems);
        scene.add(galaxyGroup);

        // Event Listeners
        renderer.domElement.addEventListener('click', _onCanvasClick);
        window.addEventListener('resize', _onResize);
    }

    function _createGalaxyArms() {
        const positions = [];
        const colors = [];
        const colorInside = new THREE.Color('#ff9933');
        const colorOutside = new THREE.Color('#3399ff');

        for (let i = 0; i < NUM_ARM_PARTICLES; i++) {
            const armIndex = i % NUM_ARMS;
            const angle = (i / (NUM_ARM_PARTICLES / NUM_ARMS)) * Math.PI * 4;
            const armRotation = (armIndex / NUM_ARMS) * Math.PI * 2;
            const distance = Math.pow(i / (NUM_ARM_PARTICLES / NUM_ARMS), 0.8) * GALAXY_RADIUS;

            const randomX = (Math.random() - 0.5) * 80 * Math.random();
            const randomY = (Math.random() - 0.5) * 20 * (1- (distance/GALAXY_RADIUS));
            const randomZ = (Math.random() - 0.5) * 80 * Math.random();
            
            const x = Math.cos(angle + armRotation) * distance + randomX;
            const y = randomY;
            const z = Math.sin(angle + armRotation) * distance + randomZ;
            
            positions.push(x, y, z);

            const mixedColor = colorInside.clone().lerp(colorOutside, distance / GALAXY_RADIUS);
            colors.push(mixedColor.r, mixedColor.g, mixedColor.b);
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

    function _createDust() {
        const positions = [];
        const dustGeometry = new THREE.BufferGeometry();
        for (let i = 0; i < NUM_DUST_PARTICLES; i++) {
            positions.push(
                (Math.random() - 0.5) * GALAXY_RADIUS * 2.5,
                (Math.random() - 0.5) * 50,
                (Math.random() - 0.5) * GALAXY_RADIUS * 2.5
            );
        }
        dustGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const dustMaterial = new THREE.PointsMaterial({
            size: 1,
            color: '#ffffff',
            sizeAttenuation: true,
            depthWrite: false,
            transparent: true,
            opacity: 0.05,
            blending: THREE.AdditiveBlending
        });
        dustParticles = new THREE.Points(dustGeometry, dustMaterial);
        galaxyGroup.add(dustParticles);
    }

    function _createSolarSystemParticles(systems) {
        solarSystemData = systems; // Store for raycasting
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const galaxyContentDiameter = window.gameSessionData.universe.diameter || 500;

        systems.forEach((system, i) => {
            // Map 2D positions to 3D, scaling down to fit galaxy radius
            const scale = (GALAXY_RADIUS * 1.5) / galaxyContentDiameter;
            const x = (system.x - galaxyContentDiameter / 2) * scale;
            const z = (system.y - galaxyContentDiameter / 2) * scale;
            const y = (Math.random() - 0.5) * 10;
            positions.push(x, y, z);
        });

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({
            size: 15,
            color: '#ffd700',
            sizeAttenuation: true,
            depthWrite: true,
            transparent: true,
            opacity: 0.9
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
            const intersect = intersects[0];
            const systemIndex = intersect.index;
            const clickedSystem = solarSystemData[systemIndex];
            if (clickedSystem) {
                onSystemClickCallback(clickedSystem.id);
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
        galaxyGroup.rotation.y += 0.0005;
        controls.update();
        renderer.render(scene, camera);
    }

    function _dispose() {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', _onResize);
        if(renderer) renderer.domElement.removeEventListener('click', _onCanvasClick);
        if(controls) controls.dispose();
        
        scene?.traverse(object => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if(Array.isArray(object.material)) object.material.forEach(m => m.dispose());
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
