// public/js/surfaceViewController.js

import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

export const SurfaceViewController = (() => {
    let scene, camera, renderer, controls;
    let drone, terrainMesh;
    let animationId = null;
    let onBackCallback = null;
    let keys = {}; // To track keyboard state

    // --- Core Lifecycle Functions ---

    function activate(planetData, onBack) {
        onBackCallback = onBack;
        const canvas = document.getElementById('surface-canvas');
        if (!canvas) {
            console.error("SurfaceViewController: Canvas not found!");
            return;
        }

        cleanup(); // Ensure a clean slate

        // 1. Setup Scene, Camera, and Renderer
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a2a3a); // A generic sky color
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true });

        camera = new THREE.PerspectiveCamera(75, canvas.offsetWidth / canvas.offsetHeight, 0.1, 2000);
        camera.position.set(0, 50, 0); // Position directly above
        camera.lookAt(0, 0, 0);

        // 2. Add Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(100, 100, 50);
        scene.add(directionalLight);

        // 3. Create Game Objects
        drone = _createDrone();
        scene.add(drone);

        terrainMesh = _createTerrain(planetData);
        scene.add(terrainMesh);

        // 4. Setup Controls
        _setupControls();

        // 5. Initial Resize and Start Animation
        onResize(); // Call once to set initial size
        window.addEventListener('resize', onResize);
        _animate();
    }

    function cleanup() {
        if (animationId) cancelAnimationFrame(animationId);
        window.removeEventListener('resize', onResize);
        document.removeEventListener('keydown', _handleKeyDown);
        document.removeEventListener('keyup', _handleKeyUp);

        if (renderer) renderer.dispose();
        // You can add more specific cleanup for geometries, materials, etc. if needed
        
        scene = camera = renderer = drone = terrainMesh = animationId = onBackCallback = null;
        keys = {};
    }

    function _animate() {
        animationId = requestAnimationFrame(_animate);

        _updateDronePosition();

        // Make the camera follow the drone
        if (drone && camera) {
            camera.position.x = drone.position.x;
            camera.position.z = drone.position.z + 25; // Keep camera slightly behind
            camera.lookAt(drone.position);
        }

        renderer.render(scene, camera);
    }

    // --- Object Creation ---

    function _createDrone() {
        const geometry = new THREE.CylinderGeometry(1, 1.5, 3, 8);
        const material = new THREE.MeshStandardMaterial({ color: 0xeeeeff, metalness: 0.8, roughness: 0.4 });
        const newDrone = new THREE.Mesh(geometry, material);
        newDrone.position.y = 5; // Start slightly above ground
        newDrone.rotation.x = Math.PI / 2;
        return newDrone;
    }

    function _createTerrain(planetData) {
        const noise2D = createNoise2D(new Math.seedrandom(planetData.continentSeed.toString()));
        
        const size = 1000; // Size of the playable terrain area
        const segments = 100;
        const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
        
        const positionAttribute = geometry.attributes.position;
        for (let i = 0; i < positionAttribute.count; i++) {
            const x = positionAttribute.getX(i);
            const y = positionAttribute.getY(i); // This is the 'z' in world coordinates

            // Use noise to calculate height, using planet data for variation
            const noiseScale = 0.05;
            const heightMultiplier = (planetData.maxTerrainHeight - planetData.minTerrainHeight) * 3;
            
            let elevation = 0;
            let amplitude = 1;
            let frequency = 1;
            for(let j=0; j < 4; j++){ // 4 octaves of noise
                elevation += noise2D(x * frequency * noiseScale, y * frequency * noiseScale) * amplitude;
                amplitude *= 0.5;
                frequency *= 2;
            }

            positionAttribute.setZ(i, elevation * heightMultiplier);
        }
        
        geometry.computeVertexNormals(); // Recalculate normals for correct lighting

        const terrainMaterial = new THREE.MeshStandardMaterial({ 
            color: new THREE.Color(planetData.landColor || '#556B2F'),
            wireframe: false
        });

        const mesh = new THREE.Mesh(geometry, terrainMaterial);
        mesh.rotation.x = -Math.PI / 2; // Rotate the plane to be the ground
        return mesh;
    }

    // --- Controls and Updates ---

    function _setupControls() {
        document.addEventListener('keydown', _handleKeyDown);
        document.addEventListener('keyup', _handleKeyUp);
    }

    function _handleKeyDown(event) { keys[event.code] = true; }
    function _handleKeyUp(event) { keys[event.code] = false; }

    function _updateDronePosition() {
        if (!drone) return;
        const speed = 1.5;
        if (keys['KeyW']) drone.position.z -= speed;
        if (keys['KeyS']) drone.position.z += speed;
        if (keys['KeyA']) drone.position.x -= speed;
        if (keys['KeyD']) drone.position.x += speed;

        // Terrain Following Logic
        const raycaster = new THREE.Raycaster(drone.position, new THREE.Vector3(0, -1, 0));
        const intersects = raycaster.intersectObject(terrainMesh);

        if (intersects.length > 0) {
            const groundHeight = intersects[0].point.y;
            drone.position.y = groundHeight + 2.0; // Keep drone slightly above ground
        }
    }
    
    function onResize() {
        if (!renderer || !camera) return;
        const canvas = renderer.domElement;
        const parent = canvas.parentElement;
        if (parent.clientWidth > 0 && parent.clientHeight > 0) {
            camera.aspect = parent.clientWidth / parent.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(parent.clientWidth, parent.clientHeight);
        }
    }


    return {
        activate,
        cleanup,
        getScene: () => scene // Expose scene if needed for debugging
    };
})();
