import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

class SunRenderer {
    constructor(container) {
        this.container = container;
        this.scene = new THREE.Scene();
        
        // Set the size to match the sun's intended size
        const size = 60; // Match your SUN_ICON_SIZE
        container.style.width = size + 'px';
        container.style.height = size + 'px';
        
        // Use square aspect ratio
        this.camera = new THREE.OrthographicCamera(
            -1, 1, 1, -1, 0.1, 1000
        );
        
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            alpha: true,
            preserveDrawingBuffer: true
        });
        this.renderer.setClearColor(0x000000, 0); // Transparent background
        
        this.setupRenderer();
        this.createSun();
        this.setupLighting();
        this.setupPostProcessing();
        this.animate();

        window.addEventListener('resize', () => this.resize());
    }

    setupRenderer() {
        // Set renderer size to match container
        const size = this.container.offsetWidth;
        this.renderer.setSize(size, size);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);
        this.camera.position.z = 5;
        this.camera.lookAt(0, 0, 0);
    }

    createSun() {
        const sunGeometry = new THREE.CircleGeometry(0.8, 32);
        const sunMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                color: { value: new THREE.Color(0xff8800) }, // Warmer orange
                noiseScale: { value: 3.0 }, // Reduced noise
                pulseSpeed: { value: 0.05 } // Slower pulse
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform vec3 color;
                uniform float noiseScale;
                uniform float pulseSpeed;
                varying vec2 vUv;
                
                // Simplex noise function here (keep existing noise function)
                
                void main() {
                    float noise = snoise(vec3(vUv * noiseScale, time * 0.1));
                    
                    vec3 baseColor = color;
                    vec3 hotColor = vec3(1.0, 0.9, 0.5);
                    vec3 finalColor = mix(baseColor, hotColor, noise * 0.3);
                    
                    // Softer pulse
                    float pulse = sin(time * pulseSpeed) * 0.05 + 0.95;
                    finalColor *= pulse;
                    
                    // Fade edges for a softer look
                    float dist = length(vUv - vec2(0.5));
                    float alpha = smoothstep(0.5, 0.48, dist);
                    
                    gl_FragColor = vec4(finalColor, alpha);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide
        });

        this.sun = new THREE.Mesh(sunGeometry, sunMaterial);
        this.scene.add(this.sun);

        // Simplified corona
        const coronaGeometry = new THREE.CircleGeometry(1, 32);
        const coronaMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                varying vec2 vUv;
                void main() {
                    float dist = length(vUv - vec2(0.5));
                    float alpha = smoothstep(0.5, 0.2, dist) * 0.3;
                    vec3 coronaColor = vec3(1.0, 0.6, 0.2);
                    gl_FragColor = vec4(coronaColor, alpha);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });

        this.corona = new THREE.Mesh(coronaGeometry, coronaMaterial);
        this.corona.scale.setScalar(1.2);
        this.scene.add(this.corona);
    }

    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3); // Reduced intensity
        this.scene.add(ambientLight);
    }

    setupPostProcessing() {
        this.composer = new EffectComposer(this.renderer);
        const renderPass = new RenderPass(this.scene, this.camera);
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(this.container.offsetWidth, this.container.offsetHeight),
            0.7,    // Reduced bloom intensity
            0.3,    // Reduced bloom radius
            0.9     // Increased bloom threshold
        );
        
        this.composer.addPass(renderPass);
        this.composer.addPass(bloomPass);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        const time = performance.now() * 0.001;
        
        // Much slower rotation
        this.sun.rotation.z += 0.0001;
        this.corona.rotation.z -= 0.00005;
        
        // Update uniforms
        this.sun.material.uniforms.time.value = time;
        if (this.corona.material.uniforms) {
            this.corona.material.uniforms.time.value = time;
        }
        
        this.composer.render();
    }

    resize() {
        const width = this.container.offsetWidth;
        const height = this.container.offsetHeight;
        const aspect = width / height;
        const viewSize = 2;
        
        this.camera.left = -viewSize * aspect / 2;
        this.camera.right = viewSize * aspect / 2;
        this.camera.top = viewSize / 2;
        this.camera.bottom = -viewSize / 2;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
        this.composer.setSize(width, height);
    }

    dispose() {
        this.sun.geometry.dispose();
        this.sun.material.dispose();
        this.corona.geometry.dispose();
        this.corona.material.dispose();
        this.renderer.dispose();
    }
}

export { SunRenderer };
