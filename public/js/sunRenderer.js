class SunRenderer {
    constructor(container) {
        this.container = container;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, container.offsetWidth / container.offsetHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        
        this.setupRenderer();
        this.createSun();
        this.setupLighting();
        this.setupPostProcessing();
        this.animate();

        // Add resize handler
        window.addEventListener('resize', () => this.resize());
    }

    setupRenderer() {
        this.renderer.setSize(this.container.offsetWidth, this.container.offsetHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);
        this.camera.position.z = 3; // Changed from 2 for better view
    }

    createSun() {
        // Create the sun's core
        const sunGeometry = new THREE.SphereGeometry(1, 32, 32);
        const sunMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                color: { value: new THREE.Color(0xffaa00) },
                noiseScale: { value: 5.0 },
                pulseSpeed: { value: 0.1 }
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vNormal;
                
                void main() {
                    vUv = uv;
                    vNormal = normal;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform vec3 color;
                uniform float noiseScale;
                uniform float pulseSpeed;
                varying vec2 vUv;
                varying vec3 vNormal;
                
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
                    
                    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
                    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
                    vec3 x3 = x0 - 1. + 3.0 * C.xxx;
                    
                    i = mod(i, 289.0 ); 
                    vec4 p = permute( permute( permute( 
                                i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                            + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
                            + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
                            
                    float n_ = 1.0/7.0;
                    vec3  ns = n_ * D.wyz - D.xzx;
                    
                    vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
                    
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
                    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                                dot(p2,x2), dot(p3,x3) ) );
                }
                
                void main() {
                    // Multiple layers of noise for more detail
                    float noise1 = snoise(vec3(vUv * noiseScale, time * 0.1));
                    float noise2 = snoise(vec3(vUv * noiseScale * 2.0, time * 0.15));
                    float combinedNoise = noise1 * 0.7 + noise2 * 0.3;
                    
                    // Enhanced color variation
                    vec3 hotSpot = vec3(1.0, 0.8, 0.3);
                    vec3 finalColor = mix(color, hotSpot, combinedNoise);
                    
                    // Improved rim lighting
                    float rimLight = 1.0 - max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0);
                    finalColor += vec3(1.0, 0.6, 0.3) * pow(rimLight, 3.0);
                    
                    // Add subtle pulsing
                    float pulse = sin(time * pulseSpeed) * 0.1 + 0.9;
                    finalColor *= pulse;
                    
                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `
        });

        this.sun = new THREE.Mesh(sunGeometry, sunMaterial);
        this.scene.add(this.sun);

        // Add corona particles
        const coronaParticles = new THREE.BufferGeometry();
        const particleCount = 2000; // Increased from 1000
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);

        for(let i = 0; i < particleCount; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const r = 1 + Math.pow(Math.random(), 2) * 0.8;

            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);

            // More varied corona colors
            const intensity = Math.random();
            colors[i * 3] = 1.0;
            colors[i * 3 + 1] = 0.6 + (intensity * 0.4);
            colors[i * 3 + 2] = 0.1 + (intensity * 0.3);
        }

        coronaParticles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        coronaParticles.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const coronaMaterial = new THREE.PointsMaterial({
            size: 0.02,
            transparent: true,
            opacity: 0.6,
            vertexColors: true,
            blending: THREE.AdditiveBlending
        });

        this.corona = new THREE.Points(coronaParticles, coronaMaterial);
        this.scene.add(this.corona);
    }

    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
    }

    setupPostProcessing() {
        this.composer = new THREE.EffectComposer(this.renderer);
        const renderPass = new THREE.RenderPass(this.scene, this.camera);
        const bloomPass = new THREE.UnrealBloomPass(
            new THREE.Vector2(this.container.offsetWidth, this.container.offsetHeight),
            2.0,    // Increased bloom intensity
            0.5,    // Adjusted bloom radius
            0.75    // Adjusted bloom threshold
        );
        
        this.composer.addPass(renderPass);
        this.composer.addPass(bloomPass);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        const time = performance.now() * 0.001;
        
        // Smoother rotation
        this.sun.rotation.y += 0.0005;
        this.corona.rotation.y += 0.00025;
        
        // Animate corona particles
        const positions = this.corona.geometry.attributes.position.array;
        for(let i = 0; i < positions.length; i += 3) {
            const x = positions[i];
            const y = positions[i + 1];
            const z = positions[i + 2];
            
            // Add subtle wavering motion
            positions[i] = x + Math.sin(time + x) * 0.001;
            positions[i + 1] = y + Math.cos(time + y) * 0.001;
            positions[i + 2] = z + Math.sin(time + z) * 0.001;
        }
        this.corona.geometry.attributes.position.needsUpdate = true;
        
        // Update shader time
        this.sun.material.uniforms.time.value = time * 0.5;
        
        this.composer.render();
    }

    resize() {
        const width = this.container.offsetWidth;
        const height = this.container.offsetHeight;
        
        this.camera.aspect = width / height;
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
