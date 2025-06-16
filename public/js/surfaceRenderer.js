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
        mesh.position.z = 1; // Render on top of ground
        return mesh;
    }

    // Helper function to draw a more detailed and varied tree
    function _drawTree(context, x, y) {
        const trunkWidth = 4 + Math.random() * 4;
        const trunkHeight = 15 + Math.random() * 10;
        const trunkColor = `rgb(${80 + Math.random()*20}, ${40 + Math.random()*10}, ${20 + Math.random()*5})`;

        // Shadow
        context.fillStyle = 'rgba(0, 0, 0, 0.15)';
        context.beginPath();
        context.ellipse(x, y + trunkHeight * 0.7, trunkWidth * 2.5, trunkWidth * 1.5, 0, 0, Math.PI * 2);
        context.fill();
        
        // Trunk
        context.fillStyle = trunkColor;
        context.fillRect(x - trunkWidth / 2, y, trunkWidth, trunkHeight);

        // Leaves (Canopy)
        const canopySize = 15 + Math.random() * 10;
        const numClusters = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < numClusters; i++) {
            const leafColor = `rgba(${Math.random()*20}, ${100 + Math.random()*50}, ${Math.random()*20}, ${0.7 + Math.random() * 0.2})`;
            context.fillStyle = leafColor;
            context.beginPath();
            context.arc(
                x + (Math.random() - 0.5) * canopySize * 0.8, 
                y - (trunkHeight * 0.2) + (Math.random() - 0.5) * canopySize * 0.6, 
                canopySize * (0.6 + Math.random() * 0.4), 
                0, 
                Math.PI * 2
            );
            context.fill();
        }
    }

    function _createPlaceholderMapTexture() {
        const size = 2048;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');

        // 1. Base Grassland with Gradient
        const grassGradient = context.createLinearGradient(0, 0, 0, size);
        grassGradient.addColorStop(0, '#6B8E23'); // Lighter green
        grassGradient.addColorStop(1, '#556B2F'); // Darker green
        context.fillStyle = grassGradient;
        context.fillRect(0, 0, size, size);

        // 2. Detailed Grass Texture
        for (let i = 0; i < 75000; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const len = 2 + Math.random() * 3;
            const angle = (Math.random() - 0.5) * 0.5;
            context.strokeStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
            context.beginPath();
            context.moveTo(x, y);
            context.lineTo(x + Math.sin(angle) * len, y + Math.cos(angle) * len);
            context.stroke();
        }

        // 3. Lake with texture
        const lakePath = new Path2D();
        lakePath.ellipse(size * 0.6, size * 0.35, size * 0.2, size * 0.15, Math.PI / 4, 0, Math.PI * 2);
        context.fillStyle = '#4682B4';
        context.fill(lakePath);
        for (let i = 0; i < 2000; i++) {
            const x = size * (0.4 + Math.random() * 0.4);
            const y = size * (0.2 + Math.random() * 0.3);
            if (context.isPointInPath(lakePath, x, y)) {
                context.fillStyle = `rgba(220, 235, 255, ${Math.random() * 0.1})`;
                context.beginPath();
                context.arc(x, y, Math.random() * 20, 0, Math.PI * 2);
                context.fill();
            }
        }
        
        // 4. River with texture
        const riverPath = new Path2D();
        riverPath.moveTo(-50, size * 0.8);
        riverPath.bezierCurveTo(size * 0.3, size * 0.6, size * 0.4, size * 0.2, size * 0.55, size * 0.28);
        context.strokeStyle = '#4682B4';
        context.lineWidth = 35;
        context.stroke(riverPath);
        context.lineWidth = 1.5;
        context.strokeStyle = 'rgba(200, 220, 255, 0.5)';
        context.stroke(riverPath);


        // 5. Trees
        for (let i = 0; i < 800; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            // Ensure trees are not in the water
            if (context.isPointInPath(lakePath, x, y) || context.isPointInStroke(riverPath, x, y)) continue;
            _drawTree(context, x, y);
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
