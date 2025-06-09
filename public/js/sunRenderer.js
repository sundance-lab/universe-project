import * as THREE from 'three';

export class SunRenderer {
  constructor(container, solarSystemType = Math.floor(Math.random() * 5)) {
    this.boundResize = this.resize.bind(this);
    this.boundContextLost = this.handleContextLost.bind(this);
    this.boundContextRestored = this.handleContextRestored.bind(this);
    
    this.container = container;
    this.scene = new THREE.Scene();
    this.solarSystemType = solarSystemType; // 0-4 for different types
    
    // Define size variations - base sizes before scaling
    this.sizeTiers = {
      dwarf: 15,
      normal: 30,
      giant: 60,
      supergiant: 120,
      hypergiant: 240
    };
    
    // Define visual variations per solar system type
    this.sunVariations = [
      { // Type 0: Young, Blue-White Hot Star
        baseColor: new THREE.Color(0x4A90E2),
        hotColor: new THREE.Color(0xFFFFFF),
        coolColor: new THREE.Color(0x2979FF),
        glowColor: new THREE.Color(0x64B5F6),
        coronaColor: new THREE.Color(0x90CAF9),
        turbulence: 0.9,
        fireSpeed: 0.2,
        pulseSpeed: 0.006,
        sizeCategory: 'normal'
      },
      { // Type 1: Red Giant
        baseColor: new THREE.Color(0xFF5722),
        hotColor: new THREE.Color(0xFF8A65),
        coolColor: new THREE.Color(0xBF360C),
        glowColor: new THREE.Color(0xFF7043),
        coronaColor: new THREE.Color(0xFFAB91),
        turbulence: 0.6,
        fireSpeed: 0.1,
        pulseSpeed: 0.003,
        sizeCategory: 'giant'
      },
      { // Type 2: Yellow Main Sequence (Similar to Sol)
        baseColor: new THREE.Color(0xFFA500),
        hotColor: new THREE.Color(0xFFF7E6),
        coolColor: new THREE.Color(0xFF4500),
        glowColor: new THREE.Color(0xFFDF00),
        coronaColor: new THREE.Color(0xFFA726),
        turbulence: 0.8,
        fireSpeed: 0.15,
        pulseSpeed: 0.004,
        sizeCategory: 'normal'
      },
      { // Type 3: White Dwarf
        baseColor: new THREE.Color(0xE0E0E0),
        hotColor: new THREE.Color(0xFAFAFA),
        coolColor: new THREE.Color(0xBDBDBD),
        glowColor: new THREE.Color(0xF5F5F5),
        coronaColor: new THREE.Color(0xEEEEEE),
        turbulence: 1.0,
        fireSpeed: 0.25,
        pulseSpeed: 0.008,
        sizeCategory: 'dwarf'
      },
      { // Type 4: Hypergiant
        baseColor: new THREE.Color(0xE65100),
        hotColor: new THREE.Color(0xFFAB40),
        coolColor: new THREE.Color(0xBF360C),
        glowColor: new THREE.Color(0xFFD740),
        coronaColor: new THREE.Color(0xFFC107),
        turbulence: 0.7,
        fireSpeed: 0.12,
        pulseSpeed: 0.002,
        sizeCategory: 'hypergiant'
      }
    ];
    
    this.camera = new THREE.PerspectiveCamera(45, container.offsetWidth / container.offsetHeight, 0.1, 10000);
    
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

  #createSun = () => {
    const variation = this.sunVariations[this.solarSystemType];
    const baseSize = this.sizeTiers[variation.sizeCategory];
    
    // Random size variation within category (±20%)
    const sizeVariation = 0.8 + Math.random() * 0.4;
    const finalSize = baseSize * sizeVariation;
    
    // Scale corona size based on sun size
    const coronaScale = 1.6 + (Math.log10(finalSize) * 0.1);
    
    const sunGeometry = new THREE.SphereGeometry(finalSize, 64, 64);

    const sunMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: variation.baseColor },
        hotColor: { value: variation.hotColor },
        coolColor: { value: variation.coolColor },
        glowColor: { value: variation.glowColor },
        noiseScale: { value: 1.5 },
        pulseSpeed: { value: variation.pulseSpeed },
        centerBrightness: { value: 2.2 },
        edgeGlow: { value: 0.7 },
        turbulence: { value: variation.turbulence },
        fireSpeed: { value: variation.fireSpeed },
        colorIntensity: { value: 1.4 },
        flowScale: { value: 2.0 },
        flowSpeed: { value: 0.2 },
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
        uniform vec3 color;
        uniform vec3 hotColor;
        uniform vec3 coolColor;
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
        
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        
        // [Previous noise functions remain the same]
        vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
        vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
        
        float snoise(vec3 v){ 
          // [Previous snoise implementation remains the same]
        }

        float flowNoise(vec3 p) {
            float noise = 0.0;
            float amplitude = 1.0;
            float frequency = 1.0;
            float speed = flowSpeed * 0.5;
            
            // Scale noise based on sun size
            float sizeScale = log(sunSize) * 0.2;
            
            vec3 flow = vec3(
                sin(p.y * 0.5 + time * speed) * 0.5,
                cos(p.x * 0.5 + time * speed) * 0.5,
                0.0
            );
            
            for(int i = 0; i < 3; i++) {
                p += flow * amplitude;
                noise += amplitude * snoise(p * frequency * sizeScale);
                frequency *= 2.0;
                amplitude *= 0.5;
                flow *= 0.7;
            }
            
            return noise;
        }

        void main() {
            vec3 viewDir = normalize(vViewPosition);
            vec3 normal = normalize(vNormal);
            
            // Scale UV coordinates based on sun size
            float uvScale = 1.0 / log(sunSize + 1.0);
            vec2 fireUV = vUv * noiseScale * uvScale;
            float fireTime = time * fireSpeed;
            
            float flowPattern = flowNoise(vec3(fireUV * flowScale, fireTime));
            float firePattern = snoise(vec3(fireUV + flowPattern * 0.2, fireTime));
            float secondaryFlow = flowNoise(vec3(fireUV * 1.2 + 3.0, fireTime * 0.7));
            
            float combinedNoise = mix(
                firePattern * 0.6 + secondaryFlow * 0.4,
                flowPattern,
                0.4
            ) * turbulence;
            
            float tempNoise = (flowPattern + firePattern) * 0.5;
            
            vec3 tempColor = mix(coolColor, hotColor, tempNoise);
            vec3 baseColor = mix(color, tempColor, combinedNoise * 0.6);
            
            float surfaceFlow = flowNoise(vec3(fireUV * 2.5, fireTime * 0.3));
            baseColor = mix(baseColor, hotColor, surfaceFlow * 0.3);
            
            vec3 finalColor = baseColor;
            
            // Adjust glow based on sun size
            float sizeAdjustedGlow = centerBrightness * (1.0 + log(sunSize) * 0.1);
            float centerGlow = 1.0 - length(vUv - vec2(0.5));
            centerGlow += flowPattern * 0.2;
            finalColor = mix(finalColor, hotColor, centerGlow * 0.5);
            
            float edge = 1.0 - smoothstep(0.3, 0.5, length(vUv - vec2(0.5)));
            finalColor *= (sizeAdjustedGlow - (1.0 - edge) * 0.5);
            
            float edgeFactor = pow(1.0 - abs(dot(normal, viewDir)), 3.0);
            finalColor += glowColor * edgeFactor * edgeGlow * (1.0 + flowPattern * 0.2);
            
            finalColor += vec3(0.2, 0.1, 0.0) * combinedNoise * 0.3;
            
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

    this.sun = new THREE.Mesh(sunGeometry, sunMaterial);
    this.scene.add(this.sun);

    // Corona size scales with sun size
    const coronaGeometry = new THREE.SphereGeometry(finalSize * coronaScale, 64, 64);
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
            
            // Adjust rim effect based on sun size
            float sizeFactor = log(sunSize) * 0.2;
            float rimPower = max(3.0, 6.0 - sizeFactor);
            float rim = pow(1.0 - abs(dot(normal, viewDir)), rimPower);
            
            float dist = length(vUv - vec2(0.5, 0.5)) * 2.0;
            
            // Adjust fade based on sun size
            float fadeStartAdjusted = fadeStart * (1.0 + sizeFactor * 0.1);
            float fadeEndAdjusted = fadeEnd * (1.0 + sizeFactor * 0.15);
            float alpha = smoothstep(fadeEndAdjusted, fadeStartAdjusted, dist);
            alpha *= rim;
            
            float pulse = sin(time * pulseSpeed) * 0.02 + 0.98;
            vec3 finalColor = glowColor;
            
            // Add subtle color variation based on size
            float colorShift = sin(dist * 3.14159 + time * 0.1) * (0.1 / log(sunSize + 1.0)) + 0.9;
            finalColor *= colorShift;
            finalColor *= pulse;
            
            // Adjust alpha falloff based on size
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
    this.corona.scale.setScalar(1.6);
    this.scene.add(this.corona);
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

    // Adjust camera distance based on sun size
    const variation = this.sunVariations[this.solarSystemType];
    const baseSize = this.sizeTiers[variation.sizeCategory];
    const cameraDistance = baseSize * 8 + 250;
    
    this.camera.position.set(0, 0, cameraDistance);
    this.camera.lookAt(0, 0, 0);
  };
  
  update(time) {
    if (!this.sun || !this.corona || !this.renderer) return;
    
    try {
      // Adjust rotation speed based on size
      const variation = this.sunVariations[this.solarSystemType];
      const baseSize = this.sizeTiers[variation.sizeCategory];
      const rotationSpeed = 0.00005 / (Math.log10(baseSize) * 0.5);
      
      this.sun.rotation.z += rotationSpeed;
      
      this.sun.material.uniforms.time.value = time * 0.0003;
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

      if (this.sun) {
        this.scene.remove(this.sun);
        this.sun.geometry.dispose();
        this.sun.material.dispose();
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
      this.sun = null;
      this.corona = null;
      this.renderer = null;
      this.scene = null;
      this.camera = null;
      this.container = null;
    }
  }
}
