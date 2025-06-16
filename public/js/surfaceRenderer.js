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

    function _createProceduralTexture(planetData, locationData) {
        const canvas = document.createElement('canvas');
        const size = 1024;
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        const imageData = context.createImageData(size, size);

        const deepWater = new THREE.Color(planetData.waterColor).multiplyScalar(0.6);
        const water = new THREE.Color(planetData.waterColor);
        const beach = new THREE.Color(planetData.landColor).lerp(new THREE.Color(0xFFE4B5), 0.5);
        const plains = new THREE.Color(planetData.landColor);
        const forest = new THREE.Color(planetData.landColor).multiplyScalar(0.5);
        const mountain = new THREE.Color(0x8B8989);
        const snow = new THREE.Color(0xFFFAFA);

        const oceanLvl = planetData.oceanHeightLevel;
        const terrainRange = planetData.maxTerrainHeight - planetData.minTerrainHeight;
        
        // Center the 2D map on the landing site's spherical coordinates
        const centerPhi = locationData.phi;
        const centerTheta = locationData.theta;
        const mapScale = 0.01; // How "zoomed in" the 2D map is. Smaller is more zoomed in.

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                // Map the 2D canvas pixel to a point on a sphere around the landing site
                const dx = (x / size - 0.5) * mapScale;
                const dy = (y / size - 0.5) * mapScale;
                
                const phi = centerPhi + dy;
                const theta = centerTheta + dx;

                // Convert spherical coordinates back to a 3D vector for noise sampling
                const posOnSphere = [
                    Math.sin(phi) * Math.cos(theta),
                    Math.sin(phi) * Math.sin(theta),
                    Math.cos(phi)
                ];

                const elevation = getPlanetElevation(posOnSphere, planetData);
                
                let biomeColor;
                if (elevation < oceanLvl - terrainRange * 0.1) biomeColor = deepWater;
                else if (elevation < oceanLvl) biomeColor = water;
                else if (elevation < oceanLvl + terrainRange * 0.05) biomeColor = beach;
                else if (elevation < oceanLvl + terrainRange * 0.4) {
                     const forestNoise = getPlanetElevation([posOnSphere[0]*5, posOnSphere[1]*5, posOnSphere[2]*5], planetData);
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

    // FIX: Accept locationData to initialize with a centered map
    function _initScene(canvas, planetData, locationData) {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a1a);
        
        const aspect = canvas.offsetWidth / canvas.offsetHeight;
        const frustumSize = 400;
        camera = new THREE.OrthographicCamera(frustumSize * aspect / -2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / -2, 1, 1000);
        camera.position.z = 100;

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
        renderer.setPixelRatio(window.devicePixelRatio);

        // A single large ground plane with a texture representing the local area
        const groundTexture = _createProceduralTexture(planetData, locationData);
        const groundMaterial = new THREE.MeshBasicMaterial({ map: groundTexture });
        const groundGeometry = new THREE.PlaneGeometry(2000, 2000); // The plane is large to explore on
        groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
        scene.add(groundMesh);

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
        init: (canvas, planetData, locationData) => {
            if (!canvas || !planetData || !locationData) {
                console.error("SurfaceRenderer: Canvas, planetData, or locationData not provided.");
                return;
            }
            _initScene(canvas, planetData, locationData);
        },
        dispose: () => {
            if(animationFrameId) cancelAnimationFrame(animationFrameId);
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
