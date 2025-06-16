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

    function _createPlaceholderMapTexture() {
        const size = 2048; // Larger texture for a more expansive map
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');

        // 1. Base Grassland
        context.fillStyle = '#4C7F4C';
        context.fillRect(0, 0, size, size);

        // 2. Grass Detail
        for (let i = 0; i < 40000; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const radius = Math.random() * 1.5;
            context.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
            context.beginPath();
            context.arc(x, y, radius, 0, Math.PI * 2);
            context.fill();
        }

        // 3. Lake
        context.fillStyle = '#4682B4';
        context.beginPath();
        context.ellipse(size * 0.6, size * 0.35, size * 0.2, size * 0.15, Math.PI / 4, 0, Math.PI * 2);
        context.fill();

        // 4. River
        context.strokeStyle = '#4682B4';
        context.lineWidth = 25;
        context.beginPath();
        context.moveTo(-50, size * 0.8);
        context.bezierCurveTo(size * 0.3, size * 0.6, size * 0.4, size * 0.2, size * 0.5, size * 0.28);
        context.stroke();

        // 5. Trees
        for (let i = 0; i < 500; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            // Ensure trees are not in the water
            if (context.isPointInPath(x, y) || context.isPointInStroke(x, y)) continue;

            // Trunk
            context.fillStyle = '#5C3317';
            context.fillRect(x - 3, y, 6, 12);
            // Leaves
            context.fillStyle = '#006400';
            context.beginPath();
            context.arc(x, y - 10, 15, 0, Math.PI * 2);
            context.fill();
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
        // Clamp the zoom to reasonable values
        camera.zoom = Math.max(0.2, Math.min(camera.zoom, 5.0));
        camera.updateProjectionMatrix();
    }

    function _initScene(canvas, planetData, locationData) {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a1a);
        
        const aspect = canvas.offsetWidth / canvas.offsetHeight;
        const frustumSize = 800; // Larger view area
        camera = new THREE.OrthographicCamera(frustumSize * aspect / -2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / -2, 1, 1000);
        camera.position.z = 100;
        camera.zoom = 1.0; // Initial zoom
        camera.updateProjectionMatrix();

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
        renderer.setPixelRatio(window.devicePixelRatio);

        // A single large ground plane with the placeholder map
        const groundTexture = _createPlaceholderMapTexture();
        const groundMaterial = new THREE.MeshBasicMaterial({ map: groundTexture });
        const groundGeometry = new THREE.PlaneGeometry(2048, 2048);
        groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
        scene.add(groundMesh);

        playerMesh = _createCharacterMesh();
        scene.add(playerMesh);

        PlayerController.init();

        // Add zoom listener
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
