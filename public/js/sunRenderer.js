import * as THREE from 'three';

// LOD (Level of Detail) configuration defines how the sun's detail changes with distance.
const LOD_LEVELS = {
    ULTRA_CLOSE: { distance: 150, segments: 1024, noiseDetail: 12.0, textureDetail: 12.0 },
    CLOSE: { distance: 300, segments: 512, noiseDetail: 4.0, textureDetail: 4.0 },
    MEDIUM: { distance: 600, segments: 256, noiseDetail: 2.0, textureDetail: 2.0 },
    FAR: { distance: 1200, segments: 128, noiseDetail: 1.0, textureDetail: 1.0 }
};

/**
 * Renders a dynamic, procedural sun with level-of-detail and a glowing corona.
 * It can create several types of stars, from blue giants to white dwarfs.
 */
export class SunRenderer {
    // Using '_' for private methods for broader compatibility.
    constructor(container, solarSystemType = Math.floor(Math.random() * 5)) {
        this.container = container;
        this.solarSystemType = solarSystemType;

        // Binding methods to 'this' context to ensure they work as event listeners.
        this.boundResize = this._resize.bind(this);
        this.boundContextLost = this._handleContextLost.bind(this);
        this.boundContextRestored = this._handleContextRestored.bind(this);

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, container.offsetWidth / container.offsetHeight, 0.1, 100000);
        
        this.lodGroup = new THREE.LOD();
        this.scene.add(this.lodGroup);

        // Configuration for different sun sizes.
        this.sizeTiers = {
            dwarf: { size: 15, detailMultiplier: 1.5 },
            normal: { size: 30, detailMultiplier: 1.3 },
            giant: { size: 60, detailMultiplier: 1.1 },
            supergiant: { size: 120, detailMultiplier: 1.0 },
            hypergiant: { size: 240, detailMultiplier: 0.9 }
        };
        
        // Configuration for different sun visual types.
        this.sunVariations = [
            { // Type 0: Young, Blue-White Hot Star
                baseColor: new THREE.Color(0x4A90E2), hotColor: new THREE.Color(0xFFFFFF), coolColor: new THREE.Color(0x2979FF),
                glowColor: new THREE.Color(0x64B5F6), coronaColor: new THREE.Color(0x90CAF9), midColor: new THREE.Color(0x82B1FF),
                peakColor: new THREE.Color(0xE3F2FD), valleyColor: new THREE.Color(0x1565C0), turbulence: 1.2, fireSpeed: 0.35,
                pulseSpeed: 0.006, sizeCategory: 'normal', terrainScale: 2.0, fireIntensity: 1.8
            },
            { // Type 1: Red Giant
                baseColor: new THREE.Color(0xFF5722), hotColor: new THREE.Color(0xFF8A65), coolColor: new THREE.Color(0xBF360C),
                glowColor: new THREE.Color(0xFF7043), coronaColor: new THREE.Color(0xFFAB91), midColor: new THREE.Color(0xFF7043),
                peakColor: new THREE.Color(0xFFCCBC), valleyColor: new THREE.Color(0x8D1F06), turbulence: 1.0, fireSpeed: 0.25,
                pulseSpeed: 0.003, sizeCategory: 'giant', terrainScale: 1.8, fireIntensity: 1.6
            },
            { // Type 2: Yellow Main Sequence
                baseColor: new THREE.Color(0xFFA500), hotColor: new THREE.Color(0xFFF7E6), coolColor: new THREE.Color(0xFF4500),
                glowColor: new THREE.Color(0xFFDF00), coronaColor: new THREE.Color(0xFFA726), midColor: new THREE.Color(0xFFB74D),
                peakColor: new THREE.Color(0xFFE0B2), valleyColor: new THREE.Color(0xE65100), turbulence: 1.1, fireSpeed: 0.3,
                pulseSpeed: 0.004, sizeCategory: 'normal', terrainScale: 2.2, fireIntensity: 1.7
            },
            { // Type 3: White Dwarf
                baseColor: new THREE.Color(0xE0E0E0), hotColor: new THREE.Color(0xFFFFFF), coolColor: new THREE.Color(0x9E9E9E),
                glowColor: new THREE.Color(0x82B1FF), coronaColor: new THREE.Color(0xBBDEFB), midColor: new THREE.Color(0xF5F5F5),
                peakColor: new THREE.Color(0xFFFFFF), valleyColor: new THREE.Color(0x757575), turbulence: 1.5, fireSpeed: 0.5,
                pulseSpeed: 0.01, sizeCategory: 'dwarf', terrainScale: 3.0, fireIntensity: 2.5
            },
            { // Type 4: Hypergiant
                baseColor: new THREE.Color(0xE65100), hotColor: new THREE.Color(0xFFAB40), coolColor: new THREE.Color(0xBF360C),
                glowColor: new THREE.Color(0xFFD740), coronaColor: new THREE.Color(0xFFC107), midColor: new THREE.Color(0xFF9800),
                peakColor: new THREE.Color(0xFFE0B2), valleyColor: new THREE.Color(0xBF360C), turbulence: 1.15, fireSpeed: 0.28,
                pulseSpeed: 0.002, sizeCategory: 'hypergiant', terrainScale: 1.5, fireIntensity: 1.9
            }
        ];
        
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: false
        });

        this._setupRenderer();
        this._createSun();
        this._setupLighting();

        // Add event listeners for window resize and WebGL context loss/restoration.
        window.addEventListener('resize', this.boundResize);
        const canvas = this.renderer.domElement;
        canvas.addEventListener('webglcontextlost', this.boundContextLost, false);
        canvas.addEventListener('webglcontextrestored', this.boundContextRestored, false);
    }

    _handleContextLost(event) {
        event.preventDefault();
        console.warn('SunRenderer: WebGL context lost. Pausing rendering.');
    }

    _handleContextRestored() {
        console.log('SunRenderer: WebGL context restored. Reinitializing renderer state.');
        this._setupRenderer();
    }

    _createSunGeometry(segments) {
        return new THREE.SphereGeometry(1, segments, segments);
    }
    
    _createSun() {
        const variation = this.sunVariations[this.solarSystemType];
        const baseSize = this.sizeTiers[variation.sizeCategory].size;
        const detailMultiplier = this.sizeTiers[variation.sizeCategory].detailMultiplier;

        const sizeVariation = 0.8 + Math.random() * 0.4;
        const finalSize = baseSize * sizeVariation;
        
        // Create different LOD meshes for the sun's surface. This part is unchanged.
        Object.values(LOD_LEVELS).forEach(level => {
            const adjustedSegments = Math.floor(level.segments * detailMultiplier);
            const geometry = this._createSunGeometry(adjustedSegments);
            const material = this._createSunMaterial(variation, finalSize, level);
            
            const sunMesh = new THREE.Mesh(geometry, material);
            sunMesh.scale.setScalar(finalSize);
            this.lodGroup.addLevel(sunMesh, level.distance);
        });

        // --- NEW CORONA IMPLEMENTATION ---
        
        // The new corona is a large, camera-facing plane (a billboard) with a custom shader
        // to create a soft, extended, and non-uniform glow.

        // 1. Greatly increase the scale of the corona geometry.
        const coronaScale = 20.0 + (Math.log10(finalSize) * 2.5);
        const coronaGeometry = new THREE.PlaneGeometry(finalSize * coronaScale, finalSize * coronaScale);

        const coronaMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                glowColor: { value: variation.coronaColor },
                pulseSpeed: { value: variation.pulseSpeed * 0.4 }, // Slow down the pulse for a subtle effect
            },
            vertexShader: `
                // The vertex shader simply passes the UV coordinates to the fragment shader.
                // The mesh's rotation will be handled in the update loop to face the camera.
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 glowColor;
                uniform float time;
                uniform float pulseSpeed;
                
                varying vec2 vUv;

                // Added permute function, which is a dependency for the snoise function.
                vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
                
                // 2D Simplex noise function to create a "wispy" and non-uniform corona.
                float snoise(vec2 v) {
                    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
                    vec2 i  = floor(v + dot(v, C.yy));
                    vec2 x0 = v -   i + dot(i, C.xx);
                    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
                    vec4 x12 = x0.xyxy + C.xxzz;
                    x12.xy -= i1;
                    i = mod(i, 289.0);
                    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
                    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
                    m = m*m; m = m*m;
                    vec3 x = 2.0 * fract(p * C.www) - 1.0;
                    vec3 h = abs(x) - 0.5;
                    vec3 ox = floor(x + 0.5);
                    vec3 a0 = x - ox;
                    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
                    vec3 g;
                    g.x  = a0.x  * x0.x  + h.x  * x0.y;
                    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
                    return 130.0 * dot(m, g);
                }

                void main() {
                    // Calculate distance from the center of the plane (UV coordinates 0.5, 0.5)
                    float dist = distance(vUv, vec2(0.5));

                    // 2. Create a very soft, gradual falloff using smoothstep and pow.
                    // The glow fades from the center outwards.
                    float falloff = smoothstep(0.5, 0.0, dist);
                    falloff = pow(falloff, 2.0); // Use pow to control the fade curve.

                    // Add subtle, slow-moving noise to break up the perfect gradient.
                    float noise = snoise(vUv * 5.0 + time * 0.05);
                    falloff *= (0.75 + noise * 0.25); // Mix noise in gently.

                    // A slow, subtle pulse for the whole corona.
                    float pulse = 1.0 + sin(time * pulseSpeed) * 0.1;

                    // 3. Keep the final alpha very low for a subtle, translucent effect.
                    float finalAlpha = falloff * 0.12;
                    
                    gl_FragColor = vec4(glowColor * pulse, finalAlpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });

        this.corona = new THREE.Mesh(coronaGeometry, coronaMaterial);
        // The corona is placed at the sun's position but will not rotate with it.
        // Its rotation will be updated to always face the camera.
        this.corona.position.copy(this.lodGroup.position);
        this.scene.add(this.corona);
    }

    _createSunMaterial(variation, finalSize, lodLevel) {
        return new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                color: { value: variation.baseColor },
                hotColor: { value: variation.hotColor },
                coolColor: { value: variation.coolColor },
                midColor: { value: variation.midColor },
                peakColor: { value: variation.peakColor },
                valleyColor: { value: variation.valleyColor },
                glowColor: { value: variation.glowColor },
                pulseSpeed: { value: variation.pulseSpeed },
                turbulence: { value: variation.turbulence },
                fireSpeed: { value: variation.fireSpeed },
                colorIntensity: { value: 2.0 },
                flowScale: { value: 2.0 },
                flowSpeed: { value: 0.3 },
                sunSize: { value: finalSize },
                terrainScale: { value: variation.terrainScale },
                fireIntensity: { value: variation.fireIntensity },
                detailLevel: { value: lodLevel.noiseDetail },
                textureDetail: { value: lodLevel.textureDetail },
                cameraDistance: { value: 0.0 },
                detailScaling: { value: 2.0 },
                minDetailLevel: { value: 0.5 },
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vNormal;
                varying vec3 vViewPosition;
                varying vec3 vWorldPosition;
                uniform float detailLevel;
                varying float vDetailLevel; // Pass detail level to fragment shader.
                
                void main() {
                    vUv = uv;
                    vNormal = normalize(normalMatrix * normal);
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    vViewPosition = -mvPosition.xyz;
                    vDetailLevel = detailLevel;
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                precision highp float;
                uniform float time;
                uniform vec3 color, hotColor, coolColor, midColor, peakColor, valleyColor, glowColor;
                uniform float pulseSpeed, turbulence, fireSpeed, colorIntensity;
                uniform float flowScale, flowSpeed, sunSize, terrainScale, fireIntensity;
                uniform float detailLevel, textureDetail, minDetailLevel, detailScaling, cameraDistance;
                
                varying vec2 vUv;
                varying vec3 vNormal;
                varying vec3 vViewPosition;
                varying vec3 vWorldPosition;
                varying float vDetailLevel;

                vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
                vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
                float snoise(vec3 v){
                    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
                    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
                    vec3 i  = floor(v + dot(v, C.yyy));
                    vec3 x0 = v - i + dot(i, C.xxx);
                    vec3 g = step(x0.yzx, x0.xyz);
                    vec3 l = 1.0 - g;
                    vec3 i1 = min(g.xyz, l.zxy);
                    vec3 i2 = max(g.xyz, l.zxy);
                    vec3 x1 = x0 - i1 + C.xxx;
                    vec3 x2 = x0 - i2 + C.yyy;
                    vec3 x3 = x0 - D.yyy;
                    i = mod(i, 289.0);
                    vec4 p = permute(permute(permute(
                                i.z + vec4(0.0, i1.z, i2.z, 1.0))
                                + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                                + i.x + vec4(0.0, i1.x, i2.x, 1.0));
                    float n_ = 0.142857142857;
                    vec3 ns = n_ * D.wyz - D.xzx;
                    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
                    vec4 x_ = floor(j * ns.z);
                    vec4 y_ = floor(j - 7.0 * x_);
                    vec4 x = x_ *ns.x + ns.yyyy;
                    vec4 y = y_ *ns.x + ns.yyyy;
                    vec4 h = 1.0 - abs(x) - abs(y);
                    vec4 b0 = vec4(x.xy, y.xy);
                    vec4 b1 = vec4(x.zw, y.zw);
                    vec4 s0 = floor(b0)*2.0 + 1.0;
                    vec4 s1 = floor(b1)*2.0 + 1.0;
                    vec4 sh = -step(h, vec4(0.0));
                    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
                    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
                    vec3 p0 = vec3(a0.xy,h.x);
                    vec3 p1 = vec3(a0.zw,h.y);
                    vec3 p2 = vec3(a1.xy,h.z);
                    vec3 p3 = vec3(a1.zw,h.w);
                    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
                    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
                    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
                    m = m * m;
                    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
                }
                
                float getDetailLevel() {
                    float dist = length(vViewPosition);
                    return max(minDetailLevel, vDetailLevel * (1.0 + detailScaling / (dist + 1.0)));
                }

                float terrainNoise(vec3 p) {
                    float detail = getDetailLevel();
                    float elevation = 0.0;
                    float frequency = 1.0;
                    float amplitude = 1.0;
                    float maxAmplitude = 0.0;
                    int iterations = int(min(12.0, 8.0 * detail));
                    
                    for(int i = 0; i < iterations; i++) {
                        vec3 noisePos = p * frequency * terrainScale;
                        float noiseVal = snoise(noisePos);
                        elevation += amplitude * noiseVal;
                        maxAmplitude += amplitude;
                        amplitude *= 0.65;
                        frequency *= 2.4;
                    }
                    return elevation / maxAmplitude;
                }

                float fireNoise(vec3 p) {
                    float detail = getDetailLevel();
                    float noise = 0.0;
                    float amplitude = 1.0;
                    float frequency = 1.0;
                    vec3 flow = vec3(sin(p.y * 0.5 + time * flowSpeed), cos(p.x * 0.5 + time * flowSpeed), 0.0);
                    int iterations = int(min(8.0, 4.0 * detail));
                    
                    for(int i = 0; i < iterations; i++) {
                        p += flow * amplitude * turbulence;
                        vec3 noisePos = p * frequency + time * fireSpeed;
                        noise += amplitude * snoise(noisePos);
                        frequency *= 2.0;
                        amplitude *= 0.5;
                    }
                    return noise * fireIntensity;
                }

                void main() {
                    vec3 viewDir = normalize(vViewPosition);
                    vec3 normal = normalize(vNormal);
                    
                    float terrain = terrainNoise(vWorldPosition * 0.02);
                    float fireEffect = fireNoise(vWorldPosition * 0.03);
                    float flowPattern = fireNoise(vec3(vUv * flowScale, time * fireSpeed));
                    
                    vec3 terrainColor;
                    if(terrain > 0.6) terrainColor = mix(peakColor, hotColor, (terrain - 0.6) / 0.4);
                    else if(terrain > 0.4) terrainColor = mix(midColor, peakColor, (terrain - 0.4) / 0.2);
                    else if(terrain > 0.2) terrainColor = mix(color, midColor, (terrain - 0.2) / 0.2);
                    else terrainColor = mix(valleyColor, color, terrain / 0.2);
                    
                    vec3 fireColor = mix(coolColor, hotColor, fireEffect);
                    vec3 finalColor = mix(terrainColor, fireColor, flowPattern * 0.5);
                    
                    float edgeFactor = pow(1.0 - abs(dot(normal, viewDir)), 3.0);
                    finalColor += glowColor * edgeFactor * 0.7 * (1.0 + flowPattern * 0.4);
                    
                    finalColor *= colorIntensity;
                    float pulse = sin(time * pulseSpeed + flowPattern) * 0.02 + 0.98;
                    finalColor *= pulse;
                    
                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `,
            side: THREE.FrontSide,
            blending: THREE.AdditiveBlending,
            transparent: false,
            depthWrite: true,
        });
    }

    _setupLighting() {
        const variation = this.sunVariations[this.solarSystemType];
        const ambientLight = new THREE.AmbientLight(variation.baseColor, 0.4);
        this.scene.add(ambientLight);

        const topLight = new THREE.DirectionalLight(variation.hotColor, 0.6);
        topLight.position.set(0, 0, 1);
        this.scene.add(topLight);
    };

    _setupRenderer() {
        const width = Math.max(1, this.container.offsetWidth);
        const height = Math.max(1, this.container.offsetHeight);

        this.renderer.setSize(width, height, false);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x000000, 0);

        const canvas = this.renderer.domElement;
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.background = 'transparent';
        canvas.style.pointerEvents = 'none';
        canvas.style.width = '100%';
        canvas.style.height = '100%';

        if (!this.container.contains(canvas)) {
            this.container.appendChild(canvas);
        }

        const variation = this.sunVariations[this.solarSystemType];
        const baseSize = this.sizeTiers[variation.sizeCategory].size;
        const cameraDistance = baseSize * 5;

        this.camera.position.set(0, 0, cameraDistance);
        this.camera.lookAt(0, 0, 0);
    };
    
    update(time) {
        if (!this.lodGroup || !this.corona || !this.renderer) return;

        try {
            const variation = this.sunVariations[this.solarSystemType];
            const baseSize = this.sizeTiers[variation.sizeCategory].size;
            const rotationSpeed = 0.00005 / (Math.log10(baseSize) * 0.5);

            this.lodGroup.rotation.y += rotationSpeed;
            this.lodGroup.update(this.camera);

            // --- CORONA UPDATE ---
            // Make the corona plane always face the camera (billboarding).
            if (this.corona) {
                this.corona.quaternion.copy(this.camera.quaternion);
            }

            const cameraDistance = this.camera.position.distanceTo(this.lodGroup.position);
            
            this.lodGroup.levels.forEach(level => {
                if (level.object.material.uniforms) {
                    level.object.material.uniforms.time.value = time * 0.0003;
                    level.object.material.uniforms.cameraDistance.value = cameraDistance;
                }
            });

            if (this.corona.material.uniforms) {
                // Use a slightly different time multiplier for the corona to desynchronize it from the surface.
                this.corona.material.uniforms.time.value = time * 0.00015;
            }

            this.renderer.render(this.scene, this.camera);
        } catch (error) {
            console.error('Error in SunRenderer update loop:', error);
        }
    }
    
    _resize() {
        if (!this.container || !this.camera || !this.renderer) return;

        const width = Math.max(1, this.container.offsetWidth);
        const height = Math.max(1, this.container.offsetHeight);

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height, false);
    }

    dispose() {
        try {
            window.removeEventListener('resize', this.boundResize);
            const canvas = this.renderer?.domElement;
            if (canvas) {
                canvas.removeEventListener('webglcontextlost', this.boundContextLost, false);
                canvas.removeEventListener('webglcontextrestored', this.boundContextRestored, false);
            }
            
            this.lodGroup.traverse(object => {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(material => material.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            });
            this.scene.remove(this.lodGroup);

            if (this.corona) {
                this.corona.geometry.dispose();
                this.corona.material.dispose();
                this.scene.remove(this.corona);
            }
            
            if (this.renderer) {
                this.renderer.dispose();
                if (canvas && canvas.parentNode) {
                    canvas.parentNode.removeChild(canvas);
                }
            }
        } catch (error) {
            console.error('Error during SunRenderer disposal:', error);
        } finally {
            this.container = null;
            this.scene = null;
            this.camera = null;
            this.renderer = null;
            this.lodGroup = null;
            this.corona = null;
        }
    }
}
