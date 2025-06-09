// public/js/sunRenderer.js

import * as THREE from 'three';

export class SunRenderer {
  constructor(container) {
    this.boundResize = this.resize.bind(this);
    this.boundContextLost = this.handleContextLost.bind(this);
    this.boundContextRestored = this.handleContextRestored.bind(this);
    
    this.container = container;
    this.scene = new THREE.Scene();
    
    this.camera = new THREE.OrthographicCamera(-1.1, 1.1, 1.1, -1.1, 0.1, 1000);
    
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
    const sunGeometry = new THREE.CircleGeometry(0.6, 32);

    const sunMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0xff8800) },
        noiseScale: { value: 3.0 },
        pulseSpeed: { value: 0.05 }
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
        
        // Simplex 3D Noise (by Ian McEwan, Ashima Arts)
        vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
        vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

        float snoise(vec3 v){ 
          const vec2 C = vec2(1.0/6.0, 1.0/3.0) ;
          const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
          vec3 i  = floor(v + dot(v, C.yyy) );
          vec3 x0 = v - i + dot(i, C.xxx) ;
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
          vec3 ns = n_ * D.wyz - D.xzx;
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
          
          float pulse = sin(time * pulseSpeed) * 0.05 + 0.95;
          finalColor *= pulse;
          
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
    
    const coronaGeometry = new THREE.CircleGeometry(0.8, 32);
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
          // Create a softer, stronger glow
          float alpha = smoothstep(0.5, 0.2, dist) * 0.5;
          vec3 coronaColor = vec3(1.0, 0.6, 0.2);
          gl_FragColor = vec4(coronaColor, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });

    this.corona = new THREE.Mesh(coronaGeometry, coronaMaterial);
    this.corona.scale.setScalar(1.25);
    this.scene.add(this.corona);
  };

  #setupLighting = () => {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    this.scene.add(ambientLight);
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

    this.camera.position.z = 5;
    this.camera.lookAt(0, 0, 0);
  };
  
update(time) {
    if (!this.sun || !this.corona || !this.renderer) return;
    
    try {
        // Slow down the rotation speeds significantly
        this.sun.rotation.z += 0.002;       // Reduced from 0.00005
        this.corona.rotation.z -= 0.001;    // Reduced from 0.000025
        
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
    const width = Math.max(1, this.container.offsetWidth);
    const height = Math.max(1, this.container.offsetHeight);
    
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
