import * as THREE from 'three';

export class SunRenderer {
  constructor(container) {
    this.boundResize = this.resize.bind(this);
    this.boundContextLost = this.handleContextLost.bind(this);
    this.boundContextRestored = this.handleContextRestored.bind(this);
    
    this.container = container;
    this.scene = new THREE.Scene();
    
    this.camera = new THREE.PerspectiveCamera(45, container.offsetWidth / container.offsetHeight, 0.1, 1000);
    
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
    const sunGeometry = new THREE.SphereGeometry(0.6, 64, 64);

    const sunMaterial = new THREE.ShaderMaterial({
    uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0xFFA500) },
        hotColor: { value: new THREE.Color(0xFFF7E6) },
        coolColor: { value: new THREE.Color(0xFF4500) },
        glowColor: { value: new THREE.Color(0xFFDF00) },
        noiseScale: { value: 1.5 },      // Reduced for larger flow patterns
        pulseSpeed: { value: 0.004 },    // Slower pulse for smoother flow
        centerBrightness: { value: 2.2 },
        edgeGlow: { value: 0.7 },
        turbulence: { value: 0.8 },      // Increased turbulence
        fireSpeed: { value: 0.15 },      // Slower fire speed for more fluid movement
        colorIntensity: { value: 1.4 },
        flowScale: { value: 2.0 },       // New uniform for flow pattern scale
        flowSpeed: { value: 0.2 }        // New uniform for flow movement speed
    },
    // ... rest of material config

// Add this new flow noise function after the existing fireNoise function:
fragmentShader: `
    // [Previous shader code remains the same until fireNoise function]

    float flowNoise(vec3 p) {
        float noise = 0.0;
        float amplitude = 1.0;
        float frequency = 1.0;
        float speed = flowSpeed * 0.5;
        
        // Create flowing motion
        vec3 flow = vec3(
            sin(p.y * 0.5 + time * speed) * 0.5,
            cos(p.x * 0.5 + time * speed) * 0.5,
            0.0
        );
        
        // Layer multiple noise functions for fluid movement
        for(int i = 0; i < 3; i++) {
            p += flow * amplitude;
            noise += amplitude * snoise(p * frequency);
            frequency *= 2.0;
            amplitude *= 0.5;
            flow *= 0.7;
        }
        
        return noise;
    }

    void main() {
        vec3 viewDir = normalize(vViewPosition);
        vec3 normal = normalize(vNormal);
        
        vec2 fireUV = vUv * noiseScale;
        float fireTime = time * fireSpeed;
        
        // Combine flow and fire patterns
        float flowPattern = flowNoise(vec3(fireUV * flowScale, fireTime));
        float firePattern = fireNoise(vec3(fireUV + flowPattern * 0.2, fireTime));
        float secondaryFlow = flowNoise(vec3(fireUV * 1.2 + 3.0, fireTime * 0.7));
        
        // Create more fluid combined noise
        float combinedNoise = mix(
            firePattern * 0.6 + secondaryFlow * 0.4,
            flowPattern,
            0.4
        ) * turbulence;
        
        float tempNoise = (flowPattern + firePattern) * 0.5;
        
        // Enhanced color mixing for more fluid appearance
        vec3 tempColor = mix(coolColor, hotColor, tempNoise);
        vec3 baseColor = mix(color, tempColor, combinedNoise * 0.6);
        
        // Add flowing surface detail
        float surfaceFlow = flowNoise(vec3(fireUV * 2.5, fireTime * 0.3));
        baseColor = mix(baseColor, hotColor, surfaceFlow * 0.3);
        
        vec3 finalColor = baseColor;
        
        // Enhanced center glow with flow
        float centerGlow = 1.0 - length(vUv - vec2(0.5));
        centerGlow += flowPattern * 0.2;
        finalColor = mix(finalColor, hotColor, centerGlow * 0.5);
        
        // Softer edge transition
        float edge = 1.0 - smoothstep(0.3, 0.5, length(vUv - vec2(0.5)));
        finalColor *= (centerBrightness - (1.0 - edge) * 0.5);
        
        // Enhanced edge glow with flow
        float edgeFactor = pow(1.0 - abs(dot(normal, viewDir)), 3.0);
        finalColor += glowColor * edgeFactor * edgeGlow * (1.0 + flowPattern * 0.2);
        
        // Add flowing color variations
        finalColor += vec3(0.2, 0.1, 0.0) * combinedNoise * 0.3;
        
        finalColor *= colorIntensity;
        
        // Smoother pulse with flow influence
        float pulse = sin(time * pulseSpeed + flowPattern) * 0.02 + 0.98;
        finalColor *= pulse;
        
        gl_FragColor = vec4(finalColor, 1.0);
    }
`,

// Update the corona material for matching flow:
const coronaMaterial = new THREE.ShaderMaterial({
    uniforms: {
        time: { value: 0 },
        glowColor: { value: new THREE.Color(0xFFA726) },
        pulseSpeed: { value: 0.1 }  // Slower pulse for corona
    },
    // ... rest of corona config
    fragmentShader: `
        uniform float time;
        uniform vec3 glowColor;
        uniform float pulseSpeed;
        varying vec2 vUv;
        
        void main() {
            float dist = length(vUv - vec2(0.5, 0.5)) * 2.0;
            float alpha = 1.0 - smoothstep(0.0, 1.0, dist);
            
            // Smoother corona pulse
            float pulse = sin(time * pulseSpeed) * 0.02 + 0.98;
            vec3 finalColor = glowColor;
            
            // Enhanced corona flow
            float flowEffect = sin(dist * 4.0 + time * 0.2) * 0.1 + 
                             cos(dist * 3.0 - time * 0.15) * 0.1;
            float colorShift = sin(dist * 3.14159 + time * 0.1) * 0.2 + 0.8;
            
            finalColor *= colorShift + flowEffect;
            finalColor *= pulse;
            
            float edgeFade = smoothstep(1.0, 0.2, dist);
            
            gl_FragColor = vec4(finalColor, alpha * 0.5 * edgeFade);
        }
    `
});

// In the update method, adjust the rotation speed:
update(time) {
    if (!this.sun || !this.corona || !this.renderer) return;
    
    try {
        this.sun.rotation.z += 0.00005; // Even slower rotation
        
        this.sun.material.uniforms.time.value = time * 0.0003; // Slower time progression
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
