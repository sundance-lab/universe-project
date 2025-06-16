// public/js/surfaceRenderer.js
import * as THREE from 'three';
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

    // --- SPRITE AND TILE GENERATION ---
    // This section simulates creating detailed image sprites that you would normally load from a file.

    function _createGrassTile(size, seed) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        
        const baseColor = seed > 0.6 ? '#5a7e3a' : '#6B8E23';
        const gradient = context.createLinearGradient(0, 0, 0, size);
        gradient.addColorStop(0, baseColor);
        gradient.addColorStop(1, seed > 0.3 ? '#4a6b2d' : '#556B2F');
        context.fillStyle = gradient;
        context.fillRect(0, 0, size, size);

        for (let i = 0; i < 15; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const len = 3 + Math.random() * 4;
            const angle = (Math.random() - 0.5) * 0.5;
            context.strokeStyle = `rgba(${100 + Math.random()*50}, ${150 + Math.random()*50}, ${80 + Math.random()*50}, 0.6)`;
            context.lineWidth = 0.5;
            context.beginPath();
            context.moveTo(x, y);
            context.lineTo(x + Math.sin(angle) * len, y + Math.cos(angle) * len);
            context.stroke();
        }
        return canvas;
    }

    function _createWaterTile(size, seed) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');

        const baseColor = '#4682B4';
        const rippleColor = 'rgba(173, 216, 230, 0.5)';
        context.fillStyle = baseColor;
        context.fillRect(0, 0, size, size);

        for (let i = 0; i < 5; i++) {
            context.strokeStyle = rippleColor;
            context.lineWidth = 1 + Math.random();
            context.beginPath();
            const startAngle = Math.random() * Math.PI * 2;
            const endAngle = startAngle + Math.PI * 0.5;
            context.arc(Math.random() * size, Math.random() * size, Math.random() * (size/4), startAngle, endAngle);
            context.stroke();
        }
        return canvas;
    }

    function _createTreeSprite(seed) {
        const canvas = document.createElement('canvas');
        const size = 64;
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        const x = size / 2;
        const y = size / 2 + 10;

        const trunkWidth = 4 + seed * 4;
        const trunkHeight = 15 + seed * 10;
        const trunkColor = `rgb(${80 + seed*20}, ${40 + seed*10}, ${20 + seed*5})`;
        
        context.fillStyle = 'rgba(0, 0, 0, 0.15)';
        context.beginPath();
        context.ellipse(x, y + trunkHeight * 0.3, trunkWidth * 2.5, trunkWidth * 1.5, 0, 0, Math.PI * 2);
        context.fill();
        
        context.fillStyle = trunkColor;
        context.fillRect(x - trunkWidth / 2, y, trunkWidth, -trunkHeight);

        const canopySize = 15 + seed * 10;
        const numClusters = 3 + Math.floor(seed * 3);
        for (let i = 0; i < numClusters; i++) {
            const leafColor = `rgba(${seed*20}, ${100 + seed*50}, ${seed*20}, ${0.7 + seed * 0.2})`;
            context.fillStyle = leafColor;
            context.beginPath();
            context.arc(
                x + (Math.random() - 0.5) * canopySize * 0.8, 
                y - (trunkHeight * 0.8) + (Math.random() - 0.5) * canopySize * 0.6, 
                canopySize * (0.6 + Math.random() * 0.4), 
                0, Math.PI * 2);
            context.fill();
        }
        return canvas;
    }

    function _createPlaceholderMapTexture() {
        const mapSize = 2048;
        const tileSize = 64;
        const canvas = document.createElement('canvas');
        canvas.width = mapSize;
        canvas.height = mapSize;
        const context = canvas.getContext('2d');

        // Pre-render a few tile variations
        const grassTiles = [
            _createGrassTile(tileSize, 0.2), 
            _createGrassTile(tileSize, 0.5), 
            _createGrassTile(tileSize, 0.8)
        ];
        const waterTile = _createWaterTile(tileSize);
        const treeSprites = [
            _createTreeSprite(Math.random()),
            _createTreeSprite(Math.random()),
            _createTreeSprite(Math.random())
        ];

        // Define landscape features
        const lakePath = new Path2D();
        lakePath.ellipse(mapSize * 0.6, mapSize * 0.35, mapSize * 0.2, mapSize * 0.15, Math.PI / 4, 0, Math.PI * 2);
        
        // Paint the tiles
        for (let y = 0; y < mapSize; y += tileSize) {
            for (let x = 0; x < mapSize; x += tileSize) {
                const isLake = context.isPointInPath(lakePath, x + tileSize/2, y + tileSize/2);
                const tileToDraw = isLake ? waterTile : grassTiles[Math.floor(Math.random() * grassTiles.length)];
                context.drawImage(tileToDraw, x, y);
            }
        }
        
        // Place larger features like trees
        for (let i = 0; i < 800; i++) {
            const x = Math.random() * mapSize;
            const y = Math.random() * mapSize;
            if (!context.isPointInPath(lakePath, x, y)) {
                 context.drawImage(treeSprites[Math.floor(Math.random() * treeSprites.length)], x - 32, y - 50);
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
        scene.background = new THREE.Color(0x1a1a1a);
        
        const aspect = canvas.offsetWidth / canvas.offsetHeight;
        const frustumSize = 800;
        camera = new THREE.OrthographicCamera(frustumSize * aspect / -2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / -2, 1, 1000);
        camera.position.z = 100;
        camera.zoom = 1.0; 
        camera.updateProjectionMatrix();

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
        renderer.setPixelRatio(window.devicePixelRatio);

        const groundTexture = _createPlaceholderMapTexture();
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
