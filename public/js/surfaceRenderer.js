// public/js/surfaceRenderer.js
import * as THREE from 'three';
import { getPlanetElevation } from './noise.js';
import { PlayerController } from './playerController.js';

export const SurfaceRenderer = (() => {
    let scene, camera, renderer;
    let groundMesh, playerMesh;
    let animationFrameId;

    function _createProceduralTexture(planetData) {
        const canvas = document.createElement('canvas');
        const size = 512; // Texture resolution
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        const imageData = context.createImageData(size, size);

        const water = new THREE.Color(planetData.waterColor);
        const land = new THREE.Color(planetData.landColor);

        for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
                // Map canvas coords to a position on a sphere for noise sampling
                const u = (x / size) * 2 - 1;
                const v = (y / size) * 2 - 1;
                if (u * u + v * v > 1) continue; // Outside the circle

                const posOnSphere = [u, v, Math.sqrt(1 - u*u - v*v)];
                const elevation = getPlanetElevation(posOnSphere, planetData);
                
                let biomeColor;
                if (elevation > planetData.oceanHeightLevel) {
                    biomeColor = land;
                } else {
                    biomeColor = water;
                }

                const index = (y * size + x) * 4;
                imageData.data[index] = biomeColor.r * 255;
                imageData.data[index + 1] = biomeColor.g * 255;
                imageData.data[index + 2] = biomeColor.b * 255;
                imageData.data[index + 3] = 255;
            }
        }
        context.putImageData(imageData, 0, 0);
        return new THREE.CanvasTexture(canvas);
    }

    function _initScene(canvas, planetData) {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a1a);
        
        // Orthographic Camera for top-down view
        const aspect = canvas.offsetWidth / canvas.offsetHeight;
        const frustumSize = 100;
        camera = new THREE.OrthographicCamera(frustumSize * aspect / -2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / -2, 1, 1000);
        camera.position.z = 100;

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
        renderer.setPixelRatio(window.devicePixelRatio);

        // Ground
        const groundTexture = _createProceduralTexture(planetData);
        const groundMaterial = new THREE.MeshBasicMaterial({ map: groundTexture });
        const groundGeometry = new THREE.PlaneGeometry(2000, 2000);
        groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
        scene.add(groundMesh);

        // Player
        const playerGeometry = new THREE.CircleGeometry(2, 32);
        const playerMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
        playerMesh.position.z = 1; // Render on top of ground
        scene.add(playerMesh);

        PlayerController.init();
        _animate();
    }

    function _animate(now) {
        animationFrameId = requestAnimationFrame(_animate);
        const deltaTime = 0.016; // Simple fixed delta time

        PlayerController.update(deltaTime);
        const player = PlayerController.getPlayer();

        playerMesh.position.x = player.position.x;
        playerMesh.position.y = player.position.y;

        // Camera follows player
        camera.position.x = player.position.x;
        camera.position.y = player.position.y;

        renderer.render(scene, camera);
    }

    return {
        init: (canvas, planetData) => {
            if (!canvas || !planetData) {
                console.error("SurfaceRenderer: Canvas or planetData not provided.");
                return;
            }
            _initScene(canvas, planetData);
        },
        dispose: () => {
            cancelAnimationFrame(animationFrameId);
            PlayerController.dispose();
            if (scene) {
                scene.traverse(object => {
                    if (object.geometry) object.geometry.dispose();
                    if (object.material) {
                         if (object.material.map) object.material.map.dispose();
                         object.material.dispose();
                    }
                });
            }
            if(renderer) {
                renderer.dispose();
            }
            scene = camera = renderer = null;
        }
    };
})();
