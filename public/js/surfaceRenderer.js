// public/js/surfaceRenderer.js
import * as THREE from 'three';
import { getPlanetElevation } from './noise.js';
import { PlayerController } from './playerController.js';

export const SurfaceRenderer = (() => {
    let scene, camera, renderer;
    let playerMesh;
    let animationFrameId;
    let currentPlanetData;

    // Tile system state
    const TILE_SIZE = 512;
    const TILE_RESOLUTION = 256; // Texture resolution for each tile
    const VIEW_DISTANCE = 2; // in tiles from center
    const activeTiles = new Map();

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

    function _createTileTexture(tileX, tileY, planetData) {
        const canvas = document.createElement('canvas');
        canvas.width = TILE_RESOLUTION;
        canvas.height = TILE_RESOLUTION;
        const context = canvas.getContext('2d');
        const imageData = context.createImageData(TILE_RESOLUTION, TILE_RESOLUTION);

        // Define biome colors
        const deepWater = new THREE.Color(planetData.waterColor).multiplyScalar(0.6);
        const water = new THREE.Color(planetData.waterColor);
        const beach = new THREE.Color(planetData.landColor).lerp(new THREE.Color(0xFFE4B5), 0.5); // Sandy color
        const plains = new THREE.Color(planetData.landColor);
        const forest = new THREE.Color(planetData.landColor).multiplyScalar(0.5);
        const mountain = new THREE.Color(0x8B8989); // Grayish rock
        const snow = new THREE.Color(0xFFFAFA);

        const oceanLvl = planetData.oceanHeightLevel;
        const terrainRange = planetData.maxTerrainHeight - planetData.minTerrainHeight;

        for (let y = 0; y < TILE_RESOLUTION; y++) {
            for (let x = 0; x < TILE_RESOLUTION; x++) {
                
                // Calculate world position for this pixel to pass to noise function
                const u = ((tileX + x / TILE_RESOLUTION) / 10.0) * 2 - 1;
                const v = ((tileY + y / TILE_RESOLUTION) / 10.0) * 2 - 1;
                if (u * u + v * v > 1) continue; // Sample noise in a circular pattern
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

                const index = (y * TILE_RESOLUTION + x) * 4;
                imageData.data[index] = biomeColor.r * 255;
                imageData.data[index + 1] = biomeColor.g * 255;
                imageData.data[index + 2] = biomeColor.b * 255;
                imageData.data[index + 3] = 255;
            }
        }
        context.putImageData(imageData, 0, 0);
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    function _updateTiles() {
        const player = PlayerController.getPlayer();
        const currentTileX = Math.floor(player.position.x / TILE_SIZE);
        const currentTileY = Math.floor(player.position.y / TILE_SIZE);

        const requiredTiles = new Set();
        for (let x = currentTileX - VIEW_DISTANCE; x <= currentTileX + VIEW_DISTANCE; x++) {
            for (let y = currentTileY - VIEW_DISTANCE; y <= currentTileY + VIEW_DISTANCE; y++) {
                const tileKey = `${x},${y}`;
                requiredTiles.add(tileKey);

                if (!activeTiles.has(tileKey)) {
                    // Add new tile
                    const texture = _createTileTexture(x, y, currentPlanetData);
                    const material = new THREE.MeshBasicMaterial({ map: texture });
                    const geometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
                    const tileMesh = new THREE.Mesh(geometry, material);
                    tileMesh.position.set(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, 0);
                    scene.add(tileMesh);
                    activeTiles.set(tileKey, tileMesh);
                }
            }
        }

        // Remove old tiles
        for (const [tileKey, tileMesh] of activeTiles.entries()) {
            if (!requiredTiles.has(tileKey)) {
                scene.remove(tileMesh);
                tileMesh.geometry.dispose();
                tileMesh.material.map.dispose();
                tileMesh.material.dispose();
                activeTiles.delete(tileKey);
            }
        }
    }

    function _initScene(canvas, planetData) {
        currentPlanetData = planetData;
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a1a);
        
        const aspect = canvas.offsetWidth / canvas.offsetHeight;
        const frustumSize = 400;
        camera = new THREE.OrthographicCamera(frustumSize * aspect / -2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / -2, 1, 1000);
        camera.position.z = 100;

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        
        // Player Character
        playerMesh = _createCharacterMesh();
        scene.add(playerMesh);

        PlayerController.init();
        _updateTiles(); // Initial tile load
        _animate();
    }

    function _animate() {
        animationFrameId = requestAnimationFrame(_animate);
        const deltaTime = 0.016; // Simple fixed delta time

        PlayerController.update(deltaTime);
        const player = PlayerController.getPlayer();

        playerMesh.position.x = player.position.x;
        playerMesh.position.y = player.position.y;
        
        // Rotate player to face velocity
        const velocity = player.velocity;
        if (velocity.x * velocity.x + velocity.y * velocity.y > 0.1) {
             playerMesh.rotation.z = Math.atan2(velocity.y, velocity.x) - Math.PI / 2;
        }

        camera.position.x = player.position.x;
        camera.position.y = player.position.y;

        _updateTiles();

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
            
            for (const [tileKey, tileMesh] of activeTiles.entries()) {
                 scene.remove(tileMesh);
                 if (tileMesh.geometry) tileMesh.geometry.dispose();
                 if (tileMesh.material) {
                     if (tileMesh.material.map) tileMesh.material.map.dispose();
                     tileMesh.material.dispose();
                 }
            }
            activeTiles.clear();

            if (scene) {
                scene.remove(playerMesh);
                if(playerMesh.geometry) playerMesh.geometry.dispose();
                if(playerMesh.material) playerMesh.material.dispose();
            }

            if(renderer) {
                renderer.dispose();
            }
            scene = camera = renderer = null;
        }
    };
})();
