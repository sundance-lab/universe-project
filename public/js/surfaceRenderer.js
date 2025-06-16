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

    function _createTacticalMapTexture(planetData, locationData) {
        const size = 1024;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        const imageData = context.createImageData(size, size);

        const oceanLvl = planetData.oceanHeightLevel;
        const terrainRange = planetData.maxTerrainHeight - planetData.minTerrainHeight;
        const contourInterval = terrainRange * 0.05; // Draw a line every 5% of elevation change

        const centerPhi = locationData.phi;
        const centerTheta = locationData.theta;
        const mapScale = 0.01; 

        // Colors
        const waterColor = { r: 5, g: 5, b: 20, a: 255 };
        const contourColor = { r: 0, g: 255, b: 80, a: 255 };
        
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const dx = (x / size - 0.5) * mapScale;
                const dy = (y / size - 0.5) * mapScale;
                const phi = centerPhi + dy;
                const theta = centerTheta + dx;

                const posOnSphere = [ Math.sin(phi) * Math.cos(theta), Math.sin(phi) * Math.sin(theta), Math.cos(phi) ];
                const elevation = getPlanetElevation(posOnSphere, planetData);

                const index = (y * size + x) * 4;
                let pixelColor;

                if (elevation < oceanLvl) {
                    pixelColor = waterColor;
                } else {
                    // Check if we are on a contour line
                    if (elevation % contourInterval < terrainRange * 0.005) {
                         pixelColor = contourColor;
                    } else {
                        // Base land color is grayscale based on elevation
                        const brightness = 50 + Math.floor(100 * (elevation - oceanLvl) / (terrainRange));
                        pixelColor = { r: brightness, g: brightness + 20, b: brightness, a: 255 };
                    }
                }
                
                imageData.data[index] = pixelColor.r;
                imageData.data[index + 1] = pixelColor.g;
                imageData.data[index + 2] = pixelColor.b;
                imageData.data[index + 3] = pixelColor.a;
            }
        }
        context.putImageData(imageData, 0, 0);

        // Draw "biosignature" icons for trees
        context.font = 'bold 12px monospace';
        context.fillStyle = 'rgba(50, 255, 100, 0.8)';
        for (let i = 0; i < 800; i++) {
             const x = Math.random() * size;
             const y = Math.random() * size;
             const dx = (x / size - 0.5) * mapScale;
             const dy = (y / size - 0.5) * mapScale;
             const phi = centerPhi + dy;
             const theta = centerTheta + dx;
             const posOnSphere = [ Math.sin(phi) * Math.cos(theta), Math.sin(phi) * Math.sin(theta), Math.cos(phi) ];
             const elevation = getPlanetElevation(posOnSphere, planetData);
             if (elevation > oceanLvl) {
                 context.fillText('+', x, y);
             }
        }

        // Draw grid overlay
        context.strokeStyle = 'rgba(0, 255, 80, 0.1)';
        context.lineWidth = 1;
        for (let i = 0; i < size; i += 64) {
            context.beginPath();
            context.moveTo(i, 0);
            context.lineTo(i, size);
            context.stroke();
            context.beginPath();
            context.moveTo(0, i);
            context.lineTo(size, i);
            context.stroke();
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
        scene.background = new THREE.Color(0x000000);
        
        const aspect = canvas.offsetWidth / canvas.offsetHeight;
        const frustumSize = 800; 
        camera = new THREE.OrthographicCamera(frustumSize * aspect / -2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / -2, 1, 1000);
        camera.position.z = 100;
        camera.zoom = 1.0; 
        camera.updateProjectionMatrix();

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
        renderer.setPixelRatio(window.devicePixelRatio);

        const groundTexture = _createTacticalMapTexture(planetData, locationData);
        const groundMaterial = new THREE.MeshBasicMaterial({ map: groundTexture });
        const groundGeometry = new THREE.PlaneGeometry(2048, 2048);
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
                    groundMesh.geometry.dispose();
                    if(groundMesh.material.map) groundMesh.material.map.dispose();
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
