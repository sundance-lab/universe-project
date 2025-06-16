// public/js/surfaceRenderer.js
import * as THREE from 'three';
import { getPlanetElevation } from './noise.js';
import { PlayerController } from './playerController.js';

export const SurfaceRenderer = (() => {
    let scene, camera, renderer;
    let playerMesh, groundMesh;
    let animationFrameId;
    let boundOnMouseWheel;

    function _createCharacterMesh() {
        const shape = new THREE.Shape();
        shape.moveTo(0, 10);
        shape.lineTo(-5, -5);
        shape.lineTo(5, -5);
        shape.closePath();

        const geometry = new THREE.ShapeGeometry(shape);
        const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.z = 1;
        return mesh;
    }

    // Draws a semi-realistic rock or boulder
    function _drawRock(context, x, y, size) {
        context.fillStyle = `rgb(${100 + Math.random()*20}, ${100 + Math.random()*20}, ${105 + Math.random()*20})`;
        context.beginPath();
        context.moveTo(x + Math.random() * size - size/2, y + Math.random() * size - size/2);
        for (let i = 0; i < 5; i++) {
            context.lineTo(x + Math.random() * size - size/2, y + Math.random() * size - size/2);
        }
        context.closePath();
        context.fill();
    }

    // Uses the tree drawing logic from the previous step
    function _drawTree(context, x, y) {
        const trunkWidth = 4 + Math.random() * 4;
        const trunkHeight = 15 + Math.random() * 10;
        context.fillStyle = '#5C3317';
        context.fillRect(x - trunkWidth / 2, y, trunkWidth, trunkHeight);
        const canopySize = 15 + Math.random() * 10;
        for (let i = 0; i < 3 + Math.floor(Math.random()*3); i++) {
            context.fillStyle = `rgba(0, ${100 + Math.random()*50}, 0, ${0.7 + Math.random() * 0.2})`;
            context.beginPath();
            context.arc(x + (Math.random() - 0.5) * canopySize, y - (trunkHeight * 0.2) + (Math.random() - 0.5) * canopySize, canopySize * (0.6 + Math.random() * 0.4), 0, Math.PI * 2);
            context.fill();
        }
    }

    function _createDetailedMapTexture(planetData, locationData) {
        const size = 4096; // 1. Increased map size
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');

        // 2. Create a circular clipping region
        context.beginPath();
        context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        context.clip();

        // --- 3. Add more generic detail ---
        
        // Base dirt layer
        context.fillStyle = '#6B4F3D';
        context.fillRect(0, 0, size, size);

        // Procedural generation setup
        const oceanLvl = planetData.oceanHeightLevel;
        const terrainRange = planetData.maxTerrainHeight - planetData.minTerrainHeight;
        const centerPhi = locationData.phi;
        const centerTheta = locationData.theta;
        const mapScale = 0.02; // Zoom out to see more features

        // Pre-calculate elevation map for performance
        const elevationMap = new Float32Array(size * size);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const dx = (x / size - 0.5) * mapScale;
                const dy = (y / size - 0.5) * mapScale;
                const phi = centerPhi + dy;
                const theta = centerTheta + dx;
                const posOnSphere = [ Math.sin(phi) * Math.cos(theta), Math.sin(phi) * Math.sin(theta), Math.cos(phi) ];
                elevationMap[y * size + x] = getPlanetElevation(posOnSphere, planetData);
            }
        }

        // Draw terrain based on elevation
        const imageData = context.getImageData(0, 0, size, size);
        const data = imageData.data;
        for (let i = 0; i < elevationMap.length; i++) {
            const elevation = elevationMap[i];
            const idx = i * 4;

            if (elevation < oceanLvl) { // Ocean
                data[idx] = 30; data[idx+1] = 80; data[idx+2] = 160;
            } else if (elevation < oceanLvl + terrainRange * 0.03) { // Beach
                data[idx] = 210; data[idx+1] = 180; data[idx+2] = 140;
            } else if (elevation < oceanLvl + terrainRange * 0.6) { // Grassland
                const grassNoise = Math.random();
                data[idx] = 80 + grassNoise*20; data[idx+1] = 140 + grassNoise*30; data[idx+2] = 70 + grassNoise*20;
            } else if (elevation < oceanLvl + terrainRange * 0.8) { // Mountains
                const rockNoise = Math.random();
                data[idx] = 130 + rockNoise*20; data[idx+1] = 130 + rockNoise*20; data[idx+2] = 135 + rockNoise*20;
            } else { // Snow caps
                data[idx] = 240; data[idx+1] = 240; data[idx+2] = 250;
            }
        }
        context.putImageData(imageData, 0, 0);

        // Draw rivers
        // (This is a simplified algorithm for visuals, not true hydrological erosion)
        context.strokeStyle = 'rgba(40, 90, 170, 0.8)';
        context.lineWidth = 3 + Math.random() * 5;
        for(let i=0; i < 15; i++) {
             context.beginPath();
             context.moveTo(Math.random()*size, 0);
             context.bezierCurveTo(Math.random()*size, size*0.3, Math.random()*size, size*0.6, Math.random()*size, size);
             context.stroke();
        }

        // Draw features like trees and rocks
        for (let i = 0; i < 5000; i++) {
             const x = Math.floor(Math.random() * size);
             const y = Math.floor(Math.random() * size);
             const elevation = elevationMap[y * size + x];

             if (elevation > oceanLvl + terrainRange * 0.05 && elevation < oceanLvl + terrainRange * 0.5) {
                 if(Math.random() > 0.5) _drawTree(context, x, y);
             } else if (elevation > oceanLvl + terrainRange * 0.5 && elevation < oceanLvl + terrainRange * 0.8) {
                 if(Math.random() > 0.9) _drawRock(context, x, y, 5 + Math.random() * 10);
             }
        }


        return new THREE.CanvasTexture(canvas);
    }

    function _onMouseWheel(event) {
        event.preventDefault();
        const zoomAmount = 0.1;
        if (event.deltaY < 0) {
            camera.zoom += zoomAmount;
        } else {
            camera.zoom -= zoomAmount;
        }
        camera.zoom = Math.max(0.2, Math.min(camera.zoom, 5.0));
        camera.updateProjectionMatrix();
    }

    function _initScene(canvas, planetData, locationData) {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000); // Black background for the circular map
        
        const aspect = canvas.offsetWidth / canvas.offsetHeight;
        const frustumSize = 800; 
        camera = new THREE.OrthographicCamera(frustumSize * aspect / -2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / -2, 1, 1000);
        camera.position.z = 100;
        camera.zoom = 1.0; 
        camera.updateProjectionMatrix();

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
        renderer.setPixelRatio(window.devicePixelRatio);

        const groundTexture = _createDetailedMapTexture(planetData, locationData);
        const groundMaterial = new THREE.MeshBasicMaterial({ map: groundTexture });
        const groundGeometry = new THREE.PlaneGeometry(4096, 4096); // Match new map size
        groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
        scene.add(groundMesh);

        playerMesh = _createCharacterMesh();
        scene.add(playerMesh);

        PlayerController.init();

        boundOnMouseWheel = _onMouseWheel.bind(this);
        renderer.domElement.addEventListener('wheel', boundOnMouseWheel, { passive: false });

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
            
            if (renderer && boundOnMouseWheel) {
                renderer.domElement.removeEventListener('wheel', boundOnMouseWheel);
            }
            
            if (scene) {
                 if (groundMesh) {
                    scene.remove(groundMesh);
                    if(groundMesh.material.map) groundMesh.material.map.dispose();
                    groundMesh.material.dispose();
                    groundMesh.geometry.dispose();
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
