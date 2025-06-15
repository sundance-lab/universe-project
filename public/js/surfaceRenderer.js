// public/js/surfaceRenderer.js
import * as THREE from 'three';
import { getPlanetElevation } from './noise.js';
import { PlayerController } from './playerController.js';

export const SurfaceRenderer = (() => {
    let scene, camera, renderer;
    let playerMesh, groundMesh;
    let animationFrameId;

    function _createCharacterMesh() {
        const shape = new THREE.Shape();
        shape.moveTo(0, 10);
        shape.lineTo(-5, -5);
        shape.lineTo(5, -5);
        shape.closePath();

        const geometry = new THREE.ShapeGeometry(shape);
        const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.z = 1; // Render on top of ground
        return mesh;
    }

    function _createProceduralTexture(planetData) {
        const canvas = document.createElement('canvas');
        const size = 1024; // A single large texture
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        const imageData = context.createImageData(size, size);

        // Define biome colors
        const deepWater = new THREE.Color(planetData.waterColor).multiplyScalar(0.6);
        const water = new THREE.Color(planetData.waterColor);
        const beach = new THREE.Color(planetData.landColor).lerp(new THREE.Color(0xFFE4B5), 0.5);
        const plains = new THREE.Color(planetData.landColor);
        const forest = new THREE.Color(planetData.landColor).multiplyScalar(0.5);
        const mountain = new THREE.Color(0x8B8989);
        const snow = new THREE.Color(0xFFFAFA);

        const oceanLvl = planetData.oceanHeightLevel;
        const terrainRange = planetData.maxTerrainHeight - planetData.minTerrainHeight;
        
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const u = (x / size) * 2 - 1;
                const v = (y / size) * 2 - 1;

                if (u * u + v * v > 1) continue; 
                const posOnSphere = [u, v, Math.sqrt(1 - u*u - v*v)];
                const elevation = getPlanetElevation(posOnSphere, planetData);
                
                let biomeColor;
                if (elevation < oceanLvl - terrainRange * 0.1) biomeColor = deepWater;
                else if (elevation < oceanLvl) biomeColor = water;
                else if (elevation < oceanLvl + terrainRange * 0.05) biomeColor = beach;
                else if (elevation < oceanLvl + terrainRange * 0.4) {
                     const forestNoise = getPlanetElevation([u*5, v*5, posOnSphere[2]*5], planetData);
                     biomeColor = forestNoise > planetData.oceanHeightLevel + terrainRange * 0.2 ? forest : plains;
                }
                else if (elevation < oceanLvl + terrainRange * 0.7) biomeColor = mountain;
                else biomeColor = snow;

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
        
        const aspect = canvas.offsetWidth / canvas.offsetHeight;
        const frustumSize = 400;
        camera = new THREE.OrthographicCamera(frustumSize * aspect / -2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / -2, 1, 1000);
        camera.position.z = 100;

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
        renderer.setPixelRatio(window.devicePixelRatio);

        // A single large ground plane
        const groundTexture = _createProceduralTexture(planetData);
        const groundMaterial = new THREE.MeshBasicMaterial({ map: groundTexture });
        const groundGeometry = new THREE.PlaneGeometry(2000, 2000);
        groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
        scene.add(groundMesh);

        // Player Character
        playerMesh = _createCharacterMesh();
        scene.add(playerMesh);

        PlayerController.init();
        _animate();
    }

    function _animate() {
        animationFrameId = requestAnimationFrame(_animate);
        const deltaTime = 0.016;

        PlayerController.update(deltaTime);
        const player = PlayerController.getPlayer();

        playerMesh.position.x = player.position.x;
        playerMesh.position.y = player.position.y;
        
        const velocity = player.velocity;
        if (velocity.x * velocity.x + velocity.y * velocity.y > 0.1) {
             playerMesh.rotation.z = Math.atan2(velocity.y, velocity.x) - Math.PI / 2;
        }

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
                 if (groundMesh) {
                    scene.remove(groundMesh);
                    groundMesh.geometry.dispose();
                    groundMesh.material.map.dispose();
                    groundMesh.material.dispose();
                 }
                scene.remove(playerMesh);
                if(playerMesh.geometry) playerMesh.geometry.dispose();
                if(playerMesh.material) playerMesh.material.dispose();
            }

            if(renderer) {
                renderer.dispose();
            }
            scene = camera = renderer = groundMesh = playerMesh = null;
        }
    };
})();
