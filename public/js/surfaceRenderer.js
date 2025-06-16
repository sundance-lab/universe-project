// public/js/surfaceRenderer.js
import * as THREE from 'three';
import { PlayerController } from './playerController.js';
import { getTerrainShaders } from './shaders.js';

export const SurfaceRenderer = (() => {
    let scene, camera, renderer;
    let playerMesh, terrainMesh, sunLight;
    let animationFrameId;
    let raycaster;
    const TERRAIN_SIZE = 4000;
    const TERRAIN_SEGMENTS = 256;

    function _initScene(canvas, planetData, locationData) {
        // --- Basic Scene Setup ---
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a2a3a);

        // --- Camera: Switched back to Orthographic for a true top-down view ---
        const aspect = canvas.offsetWidth / canvas.offsetHeight;
        const frustumSize = 150; // How "zoomed-in" the view is
        camera = new THREE.OrthographicCamera(frustumSize * aspect / -2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / -2, 1, 2000);
        camera.position.set(0, 500, 0); // Position directly above
        camera.lookAt(0, 0, 0); // Look straight down

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // --- Lighting ---
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
        sunLight.position.set(300, 400, 200);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        // Adjust shadow camera for orthographic view
        sunLight.shadow.camera = new THREE.OrthographicCamera(-100, 100, 100, -100, 100, 800);
        scene.add(sunLight);
        scene.add(sunLight.target);

        // --- 3D Terrain ---
        const terrainGeometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
        terrainGeometry.rotateX(-Math.PI / 2);

        const { vertexShader, fragmentShader } = getTerrainShaders();
        const terrainMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0.0 },
                uElevationMultiplier: { value: 200.0 },
                uSunDirection: { value: sunLight.position.clone().normalize() }
            },
            vertexShader,
            fragmentShader,
            side: THREE.DoubleSide // Important for seeing the mesh from below if camera glitches
        });
        
        terrainMesh = new THREE.Mesh(terrainGeometry, terrainMaterial);
        terrainMesh.receiveShadow = true;
        scene.add(terrainMesh);

        // --- Player Character ---
        const playerGeometry = new THREE.CapsuleGeometry(2, 4);
        const playerMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00, roughness: 0.4 });
        playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
        playerMesh.castShadow = true;
        playerMesh.position.set(0, 250, 0); // Set high temporarily
        scene.add(playerMesh);
        
        // --- Final Setup ---
        raycaster = new THREE.Raycaster();
        PlayerController.init();

        // --- FIX: Ensure capsule spawns on the ground ---
        // Perform an initial raycast to place the character correctly on the first frame.
        raycaster.set(playerMesh.position, new THREE.Vector3(0, -1, 0));
        const intersects = raycaster.intersectObject(terrainMesh);
        if (intersects.length > 0) {
            playerMesh.position.y = intersects[0].point.y + 3.0; // Capsule height offset
        }

        _animate();
    }
    
    function _updatePlayer(deltaTime) {
        const playerState = PlayerController.getPlayer();
        const move = playerState.velocity;
        
        // Use velocity directly for X and Z movement in a top-down view
        playerMesh.position.x += move.x * deltaTime;
        playerMesh.position.z += move.y * deltaTime; // Map controller's Y to world's Z
        
        // --- Ground Snapping with Raycaster ---
        const rayOrigin = new THREE.Vector3(playerMesh.position.x, 500, playerMesh.position.z);
        raycaster.set(rayOrigin, new THREE.Vector3(0, -1, 0));
        const intersects = raycaster.intersectObject(terrainMesh);

        if (intersects.length > 0) {
            const groundY = intersects[0].point.y;
            // Use a slight lerp for smooth height transitions
            playerMesh.position.y = THREE.MathUtils.lerp(playerMesh.position.y, groundY + 3.0, 0.5);
        }

        // Make player face movement direction
        if (move.x * move.x + move.y * move.y > 0.01) {
            const angle = Math.atan2(move.x, move.y);
            playerMesh.rotation.y = angle;
        }
    }

    function _updateCamera() {
        // Camera follows the player on the XZ plane
        camera.position.x = playerMesh.position.x;
        camera.position.z = playerMesh.position.z;
        
        // Update sun to follow player for consistent shadows
        sunLight.position.set(playerMesh.position.x + 100, playerMesh.position.y + 300, playerMesh.position.z + 100);
        sunLight.target.position.copy(playerMesh.position);
    }

    function _animate() {
        animationFrameId = requestAnimationFrame(_animate);
        const deltaTime = 0.016;

        PlayerController.update(deltaTime);
        _updatePlayer(deltaTime);
        _updateCamera();

        if (terrainMesh) {
            terrainMesh.material.uniforms.uTime.value += deltaTime;
        }

        renderer.render(scene, camera);
    }

    return {
        init: (canvas, planetData, locationData) => {
            _initScene(canvas, planetData, locationData);
        },
        dispose: () => {
            if(animationFrameId) cancelAnimationFrame(animationFrameId);
            PlayerController.dispose();
            
            if (scene) {
                scene.traverse(object => {
                    if (object.geometry) object.geometry.dispose();
                    if (object.material) {
                         if (Array.isArray(object.material)) {
                            object.material.forEach(m => {
                                if (m.map) m.map.dispose();
                                m.dispose();
                            });
                         } else {
                            if (object.material.map) object.material.map.dispose();
                            object.material.dispose();
                         }
                    }
                });
            }

            if(renderer) renderer.dispose();
            scene = camera = renderer = playerMesh = terrainMesh = sunLight = null;
        }
    };
})();
