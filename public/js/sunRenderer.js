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
    // Slightly flattened sphere for better top-down appearance
    const sunGeometry = new THREE.SphereGeometry(0.6, 64, 64);

    const sunMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0xFFFF00) },  // Pure yellow base
        glowColor: { value: new THREE.Color(0xFFDD00) },  // Slightly warmer yellow for glow
        noiseScale: { value: 3.0 },
        pulseSpeed: { value: 0.015 },
        centerBrightness: { value: 2.0 },  // Increased brightness
        edgeGlow: { value: 0.6 }  // Enhanced edge glow
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        
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
        uniform vec3 glowColor;
        uniform float noiseScale;
        uniform float pulseSpeed;
        uniform float centerBrightness;
        uniform float edgeGlow;
        
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        
        // [Keep existing noise functions]
        
        void main() {
          vec3 viewDir = normalize(vViewPosition);
          vec3 normal = normalize(vNormal);
          
          // Create circular gradient for top-down view
          float distFromCenter = length(vUv - vec2(0.5, 0.5)) * 2.0;
          float circular = 1.0 - smoothstep(0.0, 1.0, distFromCenter);
          
          // Enhanced noise for surface detail
          float noise = snoise(vec3(vUv * noiseScale, time * 0.1));
          float detailNoise = snoise(vec3(vUv * noiseScale * 2.0, time * 0.2)) * 0.5;
          
          // Pulsing effect
          float pulse = sin(time * pulseSpeed) * 0.05 + 0.95;
          
          // Combine colors with enhanced glow
          vec3 baseColor = mix(color, glowColor, noise * 0.3);
          vec3 finalColor = baseColor;
          
          // Add brightness at center
          finalColor *= (centerBrightness - distFromCenter);
          
          // Add edge glow
          float edgeFactor = pow(1.0 - abs(dot(normal, viewDir)), 3.0);
          finalColor += glowColor * edgeFactor * edgeGlow;
          
          // Apply circular falloff for top-down effect
          finalColor *= circular * pulse;
          
          // Add extra brightness at center
          finalColor += color * (1.0 - distFromCenter) * 0.5;
          
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      side: THREE.FrontSide,
      transparent: true,
      blending: THREE.AdditiveBlending
    });

    this.sun = new THREE.Mesh(sunGeometry, sunMaterial);
    this.scene.add(this.sun);
    
    // Adjust corona for top-down view
    const coronaGeometry = new THREE.CircleGeometry(1.0, 64);
    const coronaMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        glowColor: { value: new THREE.Color(0xFFFF80) }
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
        uniform vec3 glowColor;
        varying vec2 vUv;
        
        void main() {
          float dist = length(vUv - vec2(0.5, 0.5)) * 2.0;
          float alpha = 1.0 - smoothstep(0.0, 1.0, dist);
          float pulse = sin(time * 0.2) * 0.05 + 0.95;
          
          vec3 finalColor = glowColor;
          finalColor *= pulse;
          
          gl_FragColor = vec4(finalColor, alpha * 0.5);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.corona = new THREE.Mesh(coronaGeometry, coronaMaterial);
    this.corona.position.z = -0.1; // Slightly behind the sun
    this.corona.scale.setScalar(1.5);
    this.scene.add(this.corona);
  };

  #setupLighting = () => {
    // Simplified lighting for top-down view
    const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.4);
    this.scene.add(ambientLight);

    const topLight = new THREE.DirectionalLight(0xFFFFFF, 0.6);
    topLight.position.set(0, 0, 1);
    this.scene.add(topLight);
  };

  #setupRenderer = () => {
    // [Keep existing setup code]
    
    // Adjust camera for top-down view
    this.camera.position.set(0, 0, 5);
    this.camera.lookAt(0, 0, 0);
  };
  
  update(time) {
    if (!this.sun || !this.corona || !this.renderer) return;
    
    try {
      // Slower rotation for top-down view
      this.sun.rotation.z += 0.0005;
      
      this.sun.material.uniforms.time.value = time * 0.001;
      if (this.corona.material.uniforms) {
        this.corona.material.uniforms.time.value = time * 0.001;
      }
      
      this.renderer.render(this.scene, this.camera);
    } catch (error) {
      console.error('Error in SunRenderer update loop:', error);
    }
  }
  
  update(time) {
    if (!this.sun || !this.corona || !this.renderer) return;
    
    try {
      this.sun.rotation.y += 0.001; // Slower, more realistic rotation
      this.corona.rotation.y -= 0.0001; // Slower corona rotation
      
      this.sun.material.uniforms.time.value = time * 0.001;
      if (this.corona.material.uniforms) {
        this.corona.material.uniforms.time.value = time * 0.001;
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
