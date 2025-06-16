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
        scene.fog = new THREE.Fog(0x87CEEB, 100, 1500); // Add fog for depth perception
        scene.background = new THREE.Color(0x87CEEB);

        camera = new THREE.PerspectiveCamera(75, canvas.offsetWidth / canvas.offsetHeight, 0.1, 5000);
        
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // --- Lighting ---
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
        sunLight.position.set(300, 400, 200);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 10;
        sunLight.shadow.camera.far = 1000;
        sunLight.shadow.camera.left = -1000;
        sunLight.shadow.camera.right = 1000;
        sunLight.shadow.camera.top = 1000;
        sunLight.shadow.camera.bottom = -1000;
        scene.add(sunLight);
        scene.add(sunLight.target);

        // --- 3D Terrain ---
        const terrainGeometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
        terrainGeometry.rotateX(-Math.PI / 2); // Lay plane flat on XZ

        const { vertexShader, fragmentShader } = getTerrainShaders();
        const terrainMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0.0 },
                uElevationMultiplier: { value: 200.0 },
                uSunDirection: { value: sunLight.position.clone().normalize() }
            },
            vertexShader,
            fragmentShader
        });
        
        terrainMesh = new THREE.Mesh(terrainGeometry, terrainMaterial);
        terrainMesh.receiveShadow = true;
        scene.add(terrainMesh);

        // --- Player Character ---
        const playerGeometry = new THREE.CapsuleGeometry(2, 4);
        const playerMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00, roughness: 0.4 });
        playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
        playerMesh.castShadow = true;
        playerMesh.position.set(0, 50, 0); // Start high and drop to ground
        scene.add(playerMesh);
        
        // --- Final Setup ---
        raycaster = new THREE.Raycaster();
        PlayerController.init();
        _animate();
    }

    function _updatePlayer(deltaTime) {
        const move = PlayerController.getPlayer().velocity;
        const speed = PlayerController.getPlayer().speed;

        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        
        const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), forward);

        const moveDirection = new THREE.Vector3();
        moveDirection.add(forward.multiplyScalar(move.y * speed * deltaTime));
        moveDirection.add(right.multiplyScalar(move.x * speed * deltaTime));

        playerMesh.position.add(moveDirection);
        
        // --- Ground Snapping with Raycaster ---
        raycaster.set(playerMesh.position, new THREE.Vector3(0, -1, 0));
        const intersects = raycaster.intersectObject(terrainMesh);

        if (intersects.length > 0) {
            const groundY = intersects[0].point.y;
            playerMesh.position.y = groundY + 4.0; // Capsule height offset
        }

        // Make player face movement direction
        if (moveDirection.lengthSq() > 0.001) {
            const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), moveDirection);
            playerMesh.quaternion.slerp(targetQuaternion, 0.1);
        }
    }

    function _updateCamera() {
        // Third-person chase camera
        const offset = new THREE.Vector3(0, 10, 20);
        offset.applyQuaternion(playerMesh.quaternion);
        offset.add(playerMesh.position);
        
        camera.position.lerp(offset, 0.1);
        camera.lookAt(playerMesh.position.clone().add(new THREE.Vector3(0, 3, 0)));

        // Update sun to follow player for consistent shadows
        sunLight.position.set(playerMesh.position.x + 300, playerMesh.position.y + 400, playerMesh.position.z + 200);
        sunLight.target.position.copy(playerMesh.position);
    }

    function _animate() {
        animationFrameId = requestAnimationFrame(_animate);
        const deltaTime = 0.016;

        PlayerController.update(deltaTime);
        _updatePlayer(deltaTime);
        _updateCamera();

        // Animate shader time for potential water effects etc.
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
