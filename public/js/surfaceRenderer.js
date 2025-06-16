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

    function _createThemedTacticalMap(planetData, locationData) {
        const size = 2048; // High-resolution texture for detail
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        const imageData = context.createImageData(size, size);

        const oceanLvl = planetData.oceanHeightLevel;
        const terrainRange = planetData.maxTerrainHeight - planetData.minTerrainHeight;
        const centerPhi = locationData.phi;
        const centerTheta = locationData.theta;
        const mapScale = 0.01;

        // --- Thematic Palettes and Feature Functions ---
        let landPainter, waterPainter, featurePainter;
        
        switch (planetData.planetType) {
            case 1: // Volcanic
                landPainter = (elevation) => {
                    const heat = 1 - ((elevation - oceanLvl) / terrainRange); // 1 = hotter, 0 = cooler
                    const r = 50 + heat * 150;
                    const g = 20 + heat * 50;
                    const b = 20;
                    return { r, g, b, a: 255 };
                };
                waterPainter = () => ({ r: 255, g: 100, b: 20, a: 255 }); // Lava
                featurePainter = (ctx, x, y) => {
                    ctx.font = 'bold 14px monospace';
                    ctx.fillStyle = 'rgba(255, 150, 50, 0.9)';
                    ctx.save();
                    ctx.translate(x, y);
                    ctx.rotate(Math.PI / 4);
                    ctx.fillText('X', 0, 0);
                    ctx.restore();
                };
                break;
            
            case 2: // Icy
                 landPainter = (elevation) => {
                    const brightness = 200 + ((elevation - oceanLvl) / terrainRange) * 55;
                    const contourInterval = terrainRange * 0.04;
                    if (elevation % contourInterval < terrainRange * 0.005) {
                        return { r: 150, g: 220, b: 255, a: 255 }; // Contour line
                    }
                    return { r: brightness, g: brightness, b: 255, a: 255 };
                };
                waterPainter = () => ({ r: 10, g: 20, b: 80, a: 255 }); // Deep ice
                featurePainter = (ctx, x, y) => { // Crystalline fractures
                    ctx.strokeStyle = `rgba(200, 220, 255, ${0.2 + Math.random() * 0.2})`;
                    ctx.lineWidth = Math.random() * 2;
                    ctx.beginPath();
                    ctx.moveTo(x + (Math.random()-0.5)*10, y + (Math.random()-0.5)*10);
                    ctx.lineTo(x + (Math.random()-0.5)*20, y + (Math.random()-0.5)*20);
                    ctx.stroke();
                };
                break;

            case 3: // Desert
                landPainter = (elevation) => {
                    const baseColor = new THREE.Color(planetData.landColor);
                    const brightness = 0.8 + ((elevation - oceanLvl) / terrainRange) * 0.4;
                    const noise = Math.random() * 0.1 - 0.05; // stippling effect for sand
                    return { r: (baseColor.r + noise) * brightness * 255, g: (baseColor.g + noise) * brightness * 255, b: (baseColor.b + noise) * brightness * 255, a: 255};
                };
                waterPainter = () => ({ r: 60, g: 40, b: 30, a: 255 }); // Dry basin
                featurePainter = (ctx, x, y) => { // Mineral deposits
                    ctx.font = 'bold 12px monospace';
                    ctx.fillStyle = `rgba(200, 200, 230, ${0.7 + Math.random() * 0.2})`;
                    ctx.fillText('⬢', x, y);
                };
                break;

            case 0: // Terran (Default)
            default:
                landPainter = (elevation) => {
                    const baseColor = new THREE.Color(planetData.landColor);
                    const brightness = 0.8 + ((elevation - oceanLvl) / terrainRange) * 0.2;
                    const contourInterval = terrainRange * 0.05;
                    if (elevation % contourInterval < terrainRange * 0.005) {
                        return { r: 100, g: 255, b: 120, a: 255 };
                    }
                    return { r: baseColor.r * brightness * 255, g: baseColor.g * brightness * 255, b: baseColor.b * brightness * 255, a: 255 };
                };
                waterPainter = (elevation) => {
                    const baseColor = new THREE.Color(planetData.waterColor);
                    const brightness = 0.5 + ((elevation - (oceanLvl-terrainRange*0.1)) / (terrainRange*0.1)) * 0.5;
                    if (elevation > oceanLvl - terrainRange * 0.01) { // Coastline
                        return { r: 100, g: 200, b: 255, a: 255};
                    }
                    return { r: baseColor.r * brightness * 255, g: baseColor.g * brightness * 255, b: baseColor.b * brightness * 255, a: 255 };
                };
                featurePainter = (ctx, x, y) => { // Biosignatures
                    ctx.font = 'bold 12px monospace';
                    ctx.fillStyle = `rgba(50, 255, 100, ${0.5 + Math.random() * 0.4})`;
                    ctx.fillText('+', x, y);
                };
                break;
        }

        // --- PIXEL-BY-PIXEL TERRAIN GENERATION ---
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const dx = (x / size - 0.5) * mapScale;
                const dy = (y / size - 0.5) * mapScale;
                const phi = centerPhi + dy;
                const theta = centerTheta + dx;

                const posOnSphere = [ Math.sin(phi) * Math.cos(theta), Math.sin(phi) * Math.sin(theta), Math.cos(phi) ];
                const elevation = getPlanetElevation(posOnSphere, planetData);

                const index = (y * size + x) * 4;
                const pixelColor = elevation < oceanLvl ? waterPainter(elevation) : landPainter(elevation);
                
                imageData.data[index] = pixelColor.r;
                imageData.data[index + 1] = pixelColor.g;
                imageData.data[index + 2] = pixelColor.b;
                imageData.data[index + 3] = pixelColor.a;
            }
        }
        context.putImageData(imageData, 0, 0);

        // --- FEATURE & GRID OVERLAYS ---
        const featureCount = planetData.planetType === 0 ? 3000 * (planetData.forestDensity || 0.5) : 1200;
        for (let i = 0; i < featureCount; i++) {
             const x = Math.random() * size;
             const y = Math.random() * size;
             const dx = (x / size - 0.5) * mapScale;
             const dy = (y / size - 0.5) * mapScale;
             const phi = centerPhi + dy;
             const theta = centerTheta + dx;
             const posOnSphere = [ Math.sin(phi) * Math.cos(theta), Math.sin(phi) * Math.sin(theta), Math.cos(phi) ];
             if (getPlanetElevation(posOnSphere, planetData) > oceanLvl) {
                 featurePainter(context, x, y);
             }
        }

        context.strokeStyle = 'rgba(128, 128, 128, 0.15)';
        context.lineWidth = 1;
        for (let i = 0; i < size; i += 48) {
            context.beginPath(); context.moveTo(i, 0); context.lineTo(i, size); context.stroke();
            context.beginPath(); context.moveTo(0, i); context.lineTo(size, i); context.stroke();
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

        const groundTexture = _createThemedTacticalMap(planetData, locationData);
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
