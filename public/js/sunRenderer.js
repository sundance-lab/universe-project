import * as THREE from 'three';

// LOD configuration
const LOD_LEVELS = {
  ULTRA_CLOSE: {
    distance: 150,
    segments: 1024,
    noiseDetail: 8.0,
    textureDetail: 8.0
  },
  CLOSE: {
    distance: 300,     // Changed from 512
    segments: 512,     // Increased from 256
    noiseDetail: 4.0,  // Added .0 for consistency
    textureDetail: 4.0 // Added .0 for consistency
  },
  MEDIUM: {
    distance: 600,
    segments: 192,     // Increased from 128
    noiseDetail: 2.0,  // Increased from 1.0
    textureDetail: 2.0 // Increased from 1.0
  },
  FAR: {
    distance: 1200,
    segments: 128,     // Increased from 96
    noiseDetail: 1.0,  // Increased from 0.75
    textureDetail: 1.0 // Increased from 0.75
  }
};

export class SunRenderer {
  constructor(container, solarSystemType = Math.floor(Math.random() * 5)) {
    this.boundResize = this.resize.bind(this);
    this.boundContextLost = this.handleContextLost.bind(this);
    this.boundContextRestored = this.handleContextRestored.bind(this);
    
    this.container = container;
    this.scene = new THREE.Scene();
    this.solarSystemType = solarSystemType;
    
    this.currentLOD = null;
    this.lodGroup = new THREE.LOD();
    this.scene.add(this.lodGroup);

this.sizeTiers = {
  dwarf: {
    size: 15,
    detailMultiplier: 1.5
  },
  normal: {
    size: 30,
    detailMultiplier: 1.3
  },
  giant: {
    size: 60,
    detailMultiplier: 1.1
  },
  supergiant: {
    size: 120,
    detailMultiplier: 1.0
  },
  hypergiant: {
    size: 240,
    detailMultiplier: 0.9
  }
};
    
    this.sunVariations = [
      { // Type 0: Young, Blue-White Hot Star
        baseColor: new THREE.Color(0x4A90E2),
        hotColor: new THREE.Color(0xFFFFFF),
        coolColor: new THREE.Color(0x2979FF),
        glowColor: new THREE.Color(0x64B5F6),
        coronaColor: new THREE.Color(0x90CAF9),
        midColor: new THREE.Color(0x82B1FF),
        peakColor: new THREE.Color(0xE3F2FD),
        valleyColor: new THREE.Color(0x1565C0),
        turbulence: 1.2,
        fireSpeed: 0.35,
        pulseSpeed: 0.006,
        sizeCategory: 'normal',
        terrainScale: 2.0,
        fireIntensity: 1.8
      },
      { // Type 1: Red Giant
        baseColor: new THREE.Color(0xFF5722),
        hotColor: new THREE.Color(0xFF8A65),
        coolColor: new THREE.Color(0xBF360C),
        glowColor: new THREE.Color(0xFF7043),
        coronaColor: new THREE.Color(0xFFAB91),
        midColor: new THREE.Color(0xFF7043),
        peakColor: new THREE.Color(0xFFCCBC),
        valleyColor: new THREE.Color(0x8D1F06),
        turbulence: 1.0,
        fireSpeed: 0.25,
        pulseSpeed: 0.003,
        sizeCategory: 'giant',
        terrainScale: 1.8,
        fireIntensity: 1.6
      },
      { // Type 2: Yellow Main Sequence
        baseColor: new THREE.Color(0xFFA500),
        hotColor: new THREE.Color(0xFFF7E6),
        coolColor: new THREE.Color(0xFF4500),
        glowColor: new THREE.Color(0xFFDF00),
        coronaColor: new THREE.Color(0xFFA726),
        midColor: new THREE.Color(0xFFB74D),
        peakColor: new THREE.Color(0xFFE0B2),
        valleyColor: new THREE.Color(0xE65100),
        turbulence: 1.1,
        fireSpeed: 0.3,
        pulseSpeed: 0.004,
        sizeCategory: 'normal',
        terrainScale: 2.2,
        fireIntensity: 1.7
      },
      { // Type 3: White Dwarf
        baseColor: new THREE.Color(0xE0E0E0),
        hotColor: new THREE.Color(0xFAFAFA),
        coolColor: new THREE.Color(0xBDBDBD),
        glowColor: new THREE.Color(0xF5F5F5),
        coronaColor: new THREE.Color(0xEEEEEE),
        midColor: new THREE.Color(0xE0E0E0),
        peakColor: new THREE.Color(0xFFFFFF),
        valleyColor: new THREE.Color(0x9E9E9E),
        turbulence: 1.3,
        fireSpeed: 0.4,
        pulseSpeed: 0.008,
        sizeCategory: 'dwarf',
        terrainScale: 2.5,
        fireIntensity: 2.0
      },
      { // Type 4: Hypergiant
        baseColor: new THREE.Color(0xE65100),
        hotColor: new THREE.Color(0xFFAB40),
        coolColor: new THREE.Color(0xBF360C),
        glowColor: new THREE.Color(0xFFD740),
        coronaColor: new THREE.Color(0xFFC107),
        midColor: new THREE.Color(0xFF9800),
        peakColor: new THREE.Color(0xFFE0B2),
        valleyColor: new THREE.Color(0xBF360C),
        turbulence: 1.15,
        fireSpeed: 0.28,
        pulseSpeed: 0.002,
        sizeCategory: 'hypergiant',
        terrainScale: 1.5,
        fireIntensity: 1.9
      }
    ];
    
    this.camera = new THREE.PerspectiveCamera(45, container.offsetWidth / container.offsetHeight, 0.1, 100000);
    
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true, 
      preserveDrawingBuffer: false
    });
    
      this.#setupRenderer();
    this.#createSun();
    this.#setupLighting();
    
    window.addEventListener('resize', this.boundResize);
    
    const canvas = this.renderer.domElement;
    canvas.addEventListener('webglcontextlost', this.boundContextLost, false);
    canvas.addEventListener('webglcontextrestored', this.boundContextRestored, false);
  }
  
  handleContextLost() {
    console.warn('SunRenderer: WebGL context lost. Rendering will be paused.');
  }
  
  handleContextRestored() {
    console.log('SunRenderer: WebGL context restored. Reinitializing renderer state.');
    this.#setupRenderer();
  }

  #calculateLODLevel(cameraDistance) {
    if (cameraDistance < LOD_LEVELS.ULTRA_CLOSE.distance) return LOD_LEVELS.ULTRA_CLOSE;
    if (cameraDistance < LOD_LEVELS.CLOSE.distance) return LOD_LEVELS.CLOSE;
    if (cameraDistance < LOD_LEVELS.MEDIUM.distance) return LOD_LEVELS.MEDIUM;
    return LOD_LEVELS.FAR;
  }

  #createSunGeometry(segments) {
    return new THREE.SphereGeometry(1, segments, segments);
  }
  
  #createSun = () => {
    const variation = this.sunVariations[this.solarSystemType];
    const baseSize = this.sizeTiers[variation.sizeCategory].size;
    const detailMultiplier = this.sizeTiers[variation.sizeCategory].detailMultiplier;
    
    const sizeVariation = 0.8 + Math.random() * 0.4;
    const finalSize = baseSize * sizeVariation;
    
    // Create different LOD levels
    Object.values(LOD_LEVELS).forEach(level => {
      const adjustedSegments = Math.floor(level.segments * detailMultiplier);
      const geometry = this.#createSunGeometry(adjustedSegments);
      const material = this.#createSunMaterial(variation, finalSize, level);
      
      const sunMesh = new THREE.Mesh(geometry, material);
      sunMesh.scale.setScalar(finalSize);
      this.lodGroup.addLevel(sunMesh, level.distance);
    });

    const coronaScale = 1.2 + (Math.log10(finalSize) * 0.05);
    const coronaGeometry = new THREE.SphereGeometry(finalSize * coronaScale, 512, 512);
    const coronaMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        glowColor: { value: variation.coronaColor },
        pulseSpeed: { value: variation.pulseSpeed * 0.8 },
        fadeStart: { value: 0.2 }, 
        fadeEnd: { value: 1.2 },
        sunSize: { value: finalSize }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        uniform float sunSize;
        
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 glowColor;
        uniform float pulseSpeed;
        uniform float fadeStart;
        uniform float fadeEnd;
        uniform float sunSize;
        
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        
        void main() {
            vec3 viewDir = normalize(vViewPosition);
            vec3 normal = normalize(vNormal);
            
            float sizeFactor = log(sunSize) * 0.2;
            float rimPower = max(3.0, 6.0 - sizeFactor);
            float rim = pow(1.0 - abs(dot(normal, viewDir)), rimPower);
            
            float dist = length(vUv - vec2(0.5, 0.5)) * 2.0;
            
            float fadeStartAdjusted = fadeStart * (1.0 + sizeFactor * 0.1);
            float fadeEndAdjusted = fadeEnd * (1.0 + sizeFactor * 0.15);
            float alpha = smoothstep(fadeEndAdjusted, fadeStartAdjusted, dist);
            alpha *= rim;
            
            float pulse = sin(time * pulseSpeed) * 0.02 + 0.98;
            vec3 finalColor = glowColor;
            
            float colorShift = sin(dist * 3.14159 + time * 0.1) * (0.1 / log(sunSize + 1.0)) + 0.9;
            finalColor *= colorShift;
            finalColor *= pulse;
            
            float alphaAdjust = 1.0 / (1.0 + log(sunSize) * 0.1);
            alpha = pow(alpha, 1.5 + sizeFactor * 0.2) * alphaAdjust;
            
            gl_FragColor = vec4(finalColor, alpha * 0.3);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.corona = new THREE.Mesh(coronaGeometry, coronaMaterial);
    this.corona.position.z = 0;
    this.corona.scale.setScalar(1.2);
    this.scene.add(this.corona);
  }

  #createSunMaterial(variation, finalSize, lodLevel) {
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
        noiseScale: { value: 1.5 },
        pulseSpeed: { value: variation.pulseSpeed },
        centerBrightness: { value: 2.2 },
        edgeGlow: { value: 0.7 },
        turbulence: { value: variation.turbulence },
        fireSpeed: { value: variation.fireSpeed },
        colorIntensity: { value: 2 },
        flowScale: { value: 2.0 },
        flowSpeed: { value: 0.3 },
        sunSize: { value: finalSize },
        terrainScale: { value: variation.terrainScale },
        fireIntensity: { value: variation.fireIntensity },
        detailLevel: { value: lodLevel.noiseDetail },
        textureDetail: { value: lodLevel.textureDetail },
        cameraDistance: { value: 0.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec3 vWorldPosition;
        uniform float detailLevel;
        uniform float cameraDistance;
        
        varying float vDetailLevel;
        
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
        uniform float time;
        uniform vec3 color;
        uniform vec3 hotColor;
        uniform vec3 coolColor;
        uniform vec3 midColor;
        uniform vec3 peakColor;
        uniform vec3 valleyColor;
        uniform vec3 glowColor;
        uniform float noiseScale;
        uniform float pulseSpeed;
        uniform float centerBrightness;
        uniform float edgeGlow;
        uniform float turbulence;
        uniform float fireSpeed;
        uniform float colorIntensity;
        uniform float flowScale;
        uniform float flowSpeed;
        uniform float sunSize;
        uniform float terrainScale;
        uniform float fireIntensity;
        uniform float detailLevel;
        uniform float textureDetail;
        
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
          p0 *= norm.x;
          p1 *= norm.y;
          p2 *= norm.z;
          p3 *= norm.w;
          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }

float microDetail(vec3 p) {
    float detail = 0.0;
    float freq = 4.0;
    float amp = 0.5;
    
    for(int i = 0; i < 3; i++) {
        detail += snoise(p * freq) * amp;
        freq *= 3.0;
        amp *= 0.5;
    }
    return detail;
}

        float lodNoise(vec3 p, float detail) {
          return snoise(p * detail) * (1.0 / detail);
        }

float terrainNoise(vec3 p) {
    float elevation = 0.0;
    float frequency = 1.0;
    float amplitude = 1.0;
    float maxAmplitude = 0.0;
    
    // Base detail
    int iterations = int(8.0 * detailLevel);
    
    for(int i = 0; i < iterations; i++) {
        elevation += amplitude * lodNoise(p * frequency * terrainScale, textureDetail);
        maxAmplitude += amplitude;
        amplitude *= 0.65;    // Adjusted for better detail retention
        frequency *= 2.4;     // Increased frequency scaling
    }
    
    // Add high-frequency detail for close-up views
    float closeupDetail = 0.0;
    frequency = 8.0;
    amplitude = 0.3;
    
    for(int i = 0; i < 3; i++) {
        closeupDetail += amplitude * lodNoise(p * frequency * terrainScale, textureDetail * 2.0);
        amplitude *= 0.5;
        frequency *= 3.0;
    }
    
    float dist = length(vViewPosition);
    float closeupFactor = 1.0 - smoothstep(0.0, 300.0, dist);
    
    return (elevation / maxAmplitude) + (closeupDetail * closeupFactor);
}

float fireNoise(vec3 p) {
    float noise = 0.0;
    float amplitude = 1.0;
    float frequency = 1.0;
    
    vec3 flow = vec3(
        sin(p.y * 0.5 + time * flowSpeed) * 0.5,
        cos(p.x * 0.5 + time * flowSpeed) * 0.5,
        0.0
    );

    // First pass for base noise
    for(int i = 0; i < int(3.0 * detailLevel); i++) {
        p += flow * amplitude;
        noise += amplitude * lodNoise(p * frequency + time * fireSpeed, textureDetail);
        frequency *= 2.0;
        amplitude *= 0.5;
        flow *= 0.7;
    }
    
    // Second pass for high frequency detail
    float highFreqNoise = 0.0;
    frequency = 6.0;
    amplitude = 0.4;
    
    for(int i = 0; i < 3; i++) {
        highFreqNoise += amplitude * lodNoise(p * frequency + time * fireSpeed * 2.0, textureDetail);
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    
    float dist = length(vViewPosition);
    float closeupFactor = 1.0 - smoothstep(0.0, 300.0, dist);
    
    return (noise + highFreqNoise * closeupFactor) * fireIntensity;
}

        void main() {
            vec3 viewDir = normalize(vViewPosition);
            vec3 normal = normalize(vNormal);

            float distanceToCamera = length(vViewPosition);
            float closeupDetailScale = 1.0 - smoothstep(0.0, 300.0, distanceToCamera);
            float extraDetail = 1.0 + closeupDetailScale * 2.0;
            
            float terrain = terrainNoise(vWorldPosition * 0.02 * extraDetail);
            float fireEffect = fireNoise(vWorldPosition * 0.03 * extraDetail);
            
            vec2 fireUV = vUv * noiseScale;
            float fireTime = time * fireSpeed;
            float flowPattern = fireNoise(vec3(fireUV * flowScale, fireTime));
            
            vec3 terrainColor;
            if(terrain > 0.6) {
                terrainColor = mix(peakColor, hotColor, (terrain - 0.6) / 0.4);
            } else if(terrain > 0.4) {
                terrainColor = mix(midColor, peakColor, (terrain - 0.4) / 0.2);
            } else if(terrain > 0.2) {
                terrainColor = mix(color, midColor, (terrain - 0.2) / 0.2);
            } else {
                terrainColor = mix(valleyColor, color, terrain / 0.2);
            }
            
            vec3 fireColor = mix(coolColor, hotColor, fireEffect);
            vec3 finalColor = mix(terrainColor, fireColor, flowPattern * 0.6);
            
            float edgeFactor = pow(1.0 - abs(dot(normal, viewDir)), 3.0);
            finalColor += glowColor * edgeFactor * edgeGlow * (1.0 + flowPattern * 0.4);
            
            float detailFactor = 1.0 + log(textureDetail);
            finalColor *= detailFactor;
            
            float closeupDetail = 1.0 + (1.0 - smoothstep(0.0, 1.0, length(vViewPosition) / 1000.0)) * 0.2;
            finalColor *= closeupDetail;
            
            finalColor *= colorIntensity;
            
            float pulse = sin(time * pulseSpeed + flowPattern) * 0.02 + 0.98;
            finalColor *= pulse;
            
            gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      side: THREE.FrontSide,
      transparent: true,
      blending: THREE.AdditiveBlending
    });
  }
  
  #setupLighting = () => {
    const variation = this.sunVariations[this.solarSystemType];
    
    const ambientLight = new THREE.AmbientLight(variation.baseColor, 0.4);
    this.scene.add(ambientLight);

    const topLight = new THREE.DirectionalLight(variation.hotColor, 0.6);
    topLight.position.set(0, 0, 1);
    this.scene.add(topLight);
  };
  
   #setupRenderer = () => {
    const width = Math.max(1, this.container.offsetWidth);
    const height = Math.max(1, this.container.offsetHeight);
    
    this.renderer.setSize(width, height, false); 
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
    this.renderer.setClearColor(0x000000, 0);
    
    const canvas = this.renderer.domElement;
    canvas.style.position = 'absolute';
    canvas.style.background = 'transparent';
    canvas.style.pointerEvents = 'none';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    
    if (!this.container.contains(canvas)) {
      this.container.appendChild(canvas);
    }

    const variation = this.sunVariations[this.solarSystemType];
    const baseSize = this.sizeTiers[variation.sizeCategory].size;
    const cameraDistance = baseSize * 6 + 150; // Increased distance
    
    this.camera.position.set(0, 0, cameraDistance);
    this.camera.lookAt(0, 0, 0);
};
  
  update(time) {
    if (!this.lodGroup || !this.corona || !this.renderer) return;
    
    try {
      const variation = this.sunVariations[this.solarSystemType];
      const baseSize = this.sizeTiers[variation.sizeCategory].size;
      const rotationSpeed = 0.00005 / (Math.log10(baseSize) * 0.5);
      
      this.lodGroup.rotation.z += rotationSpeed;
      
      const cameraDistance = this.camera.position.distanceTo(this.lodGroup.position);
      const currentLOD = this.#calculateLODLevel(cameraDistance);
      
      this.lodGroup.levels.forEach(level => {
        if (level.object.material.uniforms) {
          level.object.material.uniforms.time.value = time * 0.0003;
          level.object.material.uniforms.cameraDistance.value = cameraDistance;
        }
      });
      
      if (this.corona.material.uniforms) {
        this.corona.material.uniforms.time.value = time * 0.0002;
      }
      
      this.renderer.render(this.scene, this.camera);
    } catch (error) {
      console.error('Error in SunRenderer update loop:', error);
    }
  }

  
  resize() {
    if (!this.container || !this.camera || !this.renderer) return;
    
    const width = Math.max(1, this.container.offsetWidth);
    const height = Math.max(1, this.container.offsetHeight);
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(width, height, false);
  }

  dispose() {
    try {
      if (this.boundResize) {
        window.removeEventListener('resize', this.boundResize);
      }
      const canvas = this.renderer?.domElement;
      if (canvas) {
        if (this.boundContextLost) {
          canvas.removeEventListener('webglcontextlost', this.boundContextLost, false);
        }
        if (this.boundContextRestored) {
          canvas.removeEventListener('webglcontextrestored', this.boundContextRestored, false);
        }
      }

      if (this.lodGroup) {
        this.lodGroup.levels.forEach(level => {
          if (level.object) {
            level.object.geometry.dispose();
            level.object.material.dispose();
          }
        });
        this.scene.remove(this.lodGroup);
      }

      if (this.corona) {
        this.scene.remove(this.corona);
        this.corona.geometry.dispose();
        this.corona.material.dispose();
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
      this.boundResize = null;
      this.boundContextLost = null;
      this.boundContextRestored = null;
      this.lodGroup = null;
      this.corona = null;
      this.renderer = null;
      this.scene = null;
      this.camera = null;
      this.container = null;
    }
  }
}
