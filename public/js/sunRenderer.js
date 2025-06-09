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
    const sunGeometry = new THREE.SphereGeometry(3.0, 64, 64);

    const sunMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0xFFA500) },
        hotColor: { value: new THREE.Color(0xFFF7E6) },
        coolColor: { value: new THREE.Color(0xFF4500) },
        glowColor: { value: new THREE.Color(0xFFDF00) },
        noiseScale: { value: 1.5 },
        pulseSpeed: { value: 0.004 },
        centerBrightness: { value: 2.2 },
        edgeGlow: { value: 0.7 },
        turbulence: { value: 0.8 },
        fireSpeed: { value: 0.15 },
        colorIntensity: { value: 1.4 },
        flowScale: { value: 2.0 },
        flowSpeed: { value: 0.2 }
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
        
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        
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
          
          vec3 p0 = vec3(a0.xy, h.x);
          vec3 p1 = vec3(a0.zw, h.y);
          vec3 p2 = vec3(a1.xy, h.z);
          vec3 p3 = vec3(a1.zw, h.w);
          
          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
          p0 *= norm.x;
          p1 *= norm.y;
          p2 *= norm.z;
          p3 *= norm.w;
          
          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }

        float flowNoise(vec3 p) {
            float noise = 0.0;
            float amplitude = 1.0;
            float frequency = 1.0;
            float speed = flowSpeed * 0.5;
            
            vec3 flow = vec3(
                sin(p.y * 0.5 + time * speed) * 0.5,
                cos(p.x * 0.5 + time * speed) * 0.5,
                0.0
            );
            
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
            
            float centerGlow = 1.0 - length(vUv - vec2(0.5));
            centerGlow += flowPattern * 0.2;
            finalColor = mix(finalColor, hotColor, centerGlow * 0.5);
            
            float edge = 1.0 - smoothstep(0.3, 0.5, length(vUv - vec2(0.5)));
            finalColor *= (centerBrightness - (1.0 - edge) * 0.5);
            
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

      const coronaGeometry = new THREE.SphereGeometry(5.0, 64, 64);
    const coronaMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        glowColor: { value: new THREE.Color(0xFFA726) },
        pulseSpeed: { value: 0.1 }
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
        uniform vec3 glowColor;
        uniform float pulseSpeed;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        
        void main() {
            vec3 viewDir = normalize(vViewPosition);
            vec3 normal = normalize(vNormal);
            
            float dist = length(vUv - vec2(0.5, 0.5)) * 2.0;
            float alpha = 1.0 - smoothstep(0.0, 1.0, dist);
            
            float pulse = sin(time * pulseSpeed) * 0.02 + 0.98;
            vec3 finalColor = glowColor;
            
            float flowEffect = sin(dist * 4.0 + time * 0.2) * 0.1 + 
                             cos(dist * 3.0 - time * 0.15) * 0.1;
            float colorShift = sin(dist * 3.14159 + time * 0.1) * 0.2 + 0.8;
            
            finalColor *= colorShift + flowEffect;
            finalColor *= pulse;
            
            float edgeFade = smoothstep(1.0, 0.2, dist);
            
            // Add view-dependent rim effect
            float rim = pow(1.0 - abs(dot(normal, viewDir)), 3.0);
            alpha *= rim * 0.8 + 0.2;
            
            gl_FragColor = vec4(finalColor, alpha * 0.5 * edgeFade);
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
  };

  #setupLighting = () => {
    const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.4);
    this.scene.add(ambientLight);

    const topLight = new THREE.DirectionalLight(0xFFFFFF, 0.6);
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

    this.camera.position.set(0, 0, 25);
    this.camera.lookAt(0, 0, 0);
  };
  
  update(time) {
    if (!this.sun || !this.corona || !this.renderer) return;
    
    try {
      this.sun.rotation.z += 0.00005;
      
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
