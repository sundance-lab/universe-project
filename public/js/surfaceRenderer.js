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
        scene.fog = new THREE.Fog(0x87CEEB, 100, 1500);
        scene.background = new THREE.Color(0x87CEEB);

        // --- Camera: Orthographic for a true top-down view ---
        const aspect = canvas.offsetWidth / canvas.offsetHeight;
        const frustumSize = 150;
        camera = new THREE.OrthographicCamera(frustumSize * aspect / -2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / -2, 1, 2000);
        camera.position.set(0, 500, 0); 
        camera.lookAt(0, 0, 0);

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
        });
        
        terrainMesh = new THREE.Mesh(terrainGeometry, terrainMaterial);
        terrainMesh.receiveShadow = true;
        scene.add(terrainMesh);

        // --- Player Character ---
        const playerGeometry = new THREE.CapsuleGeometry(4, 8, 4, 16);
        const playerMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00, roughness: 0.4, metalness: 0.1 });
        playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
        playerMesh.castShadow = true;
        playerMesh.position.set(0, 250, 0);
        scene.add(playerMesh);
        
        // --- Final Setup ---
        raycaster = new THREE.Raycaster();
        PlayerController.init();

        raycaster.set(playerMesh.position, new THREE.Vector3(0, -1, 0));
        const intersects = raycaster.intersectObject(terrainMesh);
        if (intersects.length > 0) {
            playerMesh.position.y = intersects[0].point.y + 6.0;
        }

        _animate();
    }
    
    function _updatePlayer(deltaTime) {
        const playerState = PlayerController.getPlayer();
        const move = playerState.velocity;
        
        playerMesh.position.x += move.x * deltaTime;
        playerMesh.position.z += move.y * deltaTime;
        
        const rayOrigin = new THREE.Vector3(playerMesh.position.x, 500, playerMesh.position.z);
        raycaster.set(rayOrigin, new THREE.Vector3(0, -1, 0));
        const intersects = raycaster.intersectObject(terrainMesh);

        if (intersects.length > 0) {
            const groundY = intersects[0].point.y;
            playerMesh.position.y = THREE.MathUtils.lerp(playerMesh.position.y, groundY + 6.0, 0.5);
        }

        if (move.x * move.x + move.y * move.y > 0.01) {
            const angle = Math.atan2(move.x, move.y);
            playerMesh.rotation.y = angle;
        }
    }

    function _updateCamera() {
        camera.position.x = playerMesh.position.x;
        camera.position.z = playerMesh.position.z;
        camera.lookAt(playerMesh.position);
        
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
            // FIX: Update the sun direction uniform in every frame for correct dynamic lighting
            terrainMesh.material.uniforms.uSunDirection.value.copy(sunLight.position).normalize();
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
