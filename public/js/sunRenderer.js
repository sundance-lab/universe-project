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
        
        // Increase the camera bounds to prevent clipping
        this.camera = new THREE.OrthographicCamera(
            -1.2, 1.2, 1.2, -1.2, 0.1, 1000  // Changed from -1,1,1,-1 to give more space
        );
        
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            alpha: true,
            preserveDrawingBuffer: true
        });
        this.renderer.setClearColor(0x000000, 0);
        
        this.setupRenderer();
        this.createSun();
        this.setupLighting();
        this.setupPostProcessing();
        this.animate();

        window.addEventListener('resize', () => this.resize());
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
                
                //	Simplex 3D Noise 
                //	by Ian McEwan, Ashima Arts
                vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
                vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

                float snoise(vec3 v){ 
                    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
                    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

                    vec3 i  = floor(v + dot(v, C.yyy) );
                    vec3 x0 =   v - i + dot(i, C.xxx) ;

                    vec3 g = step(x0.yzx, x0.xyz);
                    vec3 l = 1.0 - g;
                    vec3 i1 = min( g.xyz, l.zxy );
                    vec3 i2 = max( g.xyz, l.zxy );

                    vec3 x1 = x0 - i1 + C.xxx;
                    vec3 x2 = x0 - i2 + C.yyy;
                    vec3 x3 = x0 - D.yyy;

                    i = mod(i, 289.0 );
                    vec4 p = permute( permute( permute( 
                                i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                            + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
                            + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

                    float n_ = 0.142857142857;
                    vec3  ns = n_ * D.wyz - D.xzx;

                    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

                    vec4 x_ = floor(j * ns.z);
                    vec4 y_ = floor(j - 7.0 * x_ );

                    vec4 x = x_ *ns.x + ns.yyyy;
                    vec4 y = y_ *ns.x + ns.yyyy;
                    vec4 h = 1.0 - abs(x) - abs(y);

                    vec4 b0 = vec4( x.xy, y.xy );
                    vec4 b1 = vec4( x.zw, y.zw );

                    vec4 s0 = floor(b0)*2.0 + 1.0;
                    vec4 s1 = floor(b1)*2.0 + 1.0;
                    vec4 sh = -step(h, vec4(0.0));

                    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
                    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

                    vec3 p0 = vec3(a0.xy,h.x);
                    vec3 p1 = vec3(a0.zw,h.y);
                    vec3 p2 = vec3(a1.xy,h.z);
                    vec3 p3 = vec3(a1.zw,h.w);

                    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
                    p0 *= norm.x;
                    p1 *= norm.y;
                    p2 *= norm.z;
                    p3 *= norm.w;

                    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
                    m = m * m;
                    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
                }
                
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
        this.corona.scale.setScalar(1.1); // Changed from 1.2 to 1.1
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
            0.5,    // Reduced from 0.7
            0.2,    // Reduced from 0.3
            0.95    // Increased from 0.9
        );
        
        this.composer.addPass(renderPass);
        this.composer.addPass(bloomPass);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        const time = performance.now() * 0.001;
        
        // Much slower rotation
        this.sun.rotation.z += 0.00005; // Half the previous speed
        this.corona.rotation.z -= 0.000025;
        
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
        const viewSize = 2.4;  // Increased from 2 to match camera bounds
        
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
