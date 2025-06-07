// public/js/planetVisualPanelManager.js
import '../styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// --- Shader Definitions ---
// (Using the GLSL code you provided in the prompt)
const glslRandom2to1 = `
  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
  }
`;

const glslSimpleValueNoise3D = `
  ${glslRandom2to1} 

  float valueNoise(vec3 p, float seed) {
    vec3 i = floor(p + seed * 0.123); 
    vec3 f = fract(p + seed * 0.123); 
    f = f * f * (3.0 - 2.0 * f); // Smoothstep interpolation

    // Get random values for the 8 corners of the cube
    float c000 = random(i.xy + i.z * 0.37);       // Bottom-left-front
    float c100 = random(i.xy + vec2(1.0, 0.0) + i.z * 0.37); // Bottom-right-front
    float c010 = random(i.xy + vec2(0.0, 1.0) + i.z * 0.37); // Top-left-front
    float c110 = random(i.xy + vec2(1.0, 1.0) + i.z * 0.37); // Top-right-front
    float c001 = random(i.xy + (i.z + 1.0) * 0.37);      // Bottom-left-back
    float c101 = random(i.xy + vec2(1.0, 0.0) + (i.z + 1.0) * 0.37); // Bottom-right-back
    float c011 = random(i.xy + vec2(0.0, 1.0) + (i.z + 1.0) * 0.37); // Top-left-back
    float c111 = random(i.xy + vec2(1.0, 1.0) + (i.z + 1.0) * 0.37); // Top-right-back

    // Interpolate along x
    float u00 = mix(c000, c100, f.x);
    float u01 = mix(c001, c101, f.x);
    float u10 = mix(c010, c110, f.x);
    float u11 = mix(c011, c111, f.x);

    // Interpolate along y
    float v0 = mix(u00, u10, f.y);
    float v1 = mix(u01, u11, f.y);

    // Interpolate along z
    return mix(v0, v1, f.z); 
  }
`;

const glslLayeredNoise = `
  ${glslSimpleValueNoise3D} 

  float layeredNoise(vec3 p, float seed, int octaves, float persistence, float lacunarity) {
    float total = 0.0;
    float frequency = 1.0;
    float amplitude = 1.0;
    float maxValue = 0.0; 

    for (int i = 0; i < octaves; i++) {
      total += valueNoise(p * frequency + seed * float(i) * 1.712, seed * 12.345 * float(i+1) * 0.931) * amplitude; // Varied seed inputs slightly
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }
    if (maxValue == 0.0) return 0.0; // Avoid division by zero
    return total / maxValue; // Normalize to roughly -1 to 1 or 0 to 1 depending on valueNoise range
  }
`;

const planetVertexShader = `
  uniform float uTime;
  // uMinTerrainHeight & uMaxTerrainHeight are not directly used in shader for displacement
  // but are used in JS to calculate uDisplacementAmount and uOceanHeightLevel
  uniform float uContinentSeed;   
  uniform float uSphereRadius;     
  uniform float uDisplacementAmount; // This controls the max world-space displacement

  varying vec3 vNormal;           // Original geometric normal
  varying float vElevation;       // Normalized elevation (0 to 1) passed to fragment
  varying vec3 vWorldPosition;   
  // varying vec3 vComputedNormal; // We'll use the original vNormal for lighting for now

  ${glslLayeredNoise} 

  void main() {
    vec3 basePosition = position; // This is the original vertex position on the unit sphere (if radius=1) or scaled sphere
    
    // Input for noise function - can be varied
    // Multiplying by uSphereRadius normalizes if basePosition isn't already unit length for noise
    vec3 noiseInputPosition = (basePosition / uSphereRadius) * 2.5 + (uContinentSeed * 10.0); 
    
    // layeredNoise should ideally return a value between -1 and 1 or 0 and 1.
    // Let's assume it's roughly -1 to 1 for now.
    float rawNoiseValue = layeredNoise(noiseInputPosition, uContinentSeed, 4, 0.5, 2.0); 

    // Normalize rawNoiseValue to a 0.0 - 1.0 range for vElevation
    vElevation = (rawNoiseValue + 1.0) * 0.5; 
    vElevation = clamp(vElevation, 0.0, 1.0);

    // Calculate displacement:
    // vElevation (0-1) scales the uDisplacementAmount.
    // If uDisplacementAmount is 0, planet is smooth.
    // If rawNoiseValue gives negative values, this will only create bumps outwards.
    // To have dips and bumps, use: float displacement = rawNoiseValue * uDisplacementAmount; (and adjust vElevation normalization)
    float displacement = vElevation * uDisplacementAmount; 

    vec3 displacedPosition = basePosition + normal * displacement;
    
    vNormal = normal; // Pass the original geometric normal for lighting a generally smooth sphere
    vWorldPosition = (modelMatrix * vec4(displacedPosition, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
  }
`;

const planetFragmentShader = `
  uniform vec3 uLandColor;
  uniform vec3 uWaterColor;
  uniform float uOceanHeightLevel; // Expected to be normalized (0-1) from JS

  varying vec3 vNormal;          // Original sphere normal, interpolated
  varying float vElevation;       // Normalized elevation (0 to 1) from vertex shader
  varying vec3 vWorldPosition;   
  // varying vec3 vComputedNormal; // Not using explicitly computed normal here for simplicity

  // Simple Blinn-Phong-like lighting
  vec3 calculateLighting(vec3 surfaceColor, vec3 normalVec, vec3 viewDir) {
    vec3 lightColor = vec3(1.0, 1.0, 0.95); 
    float ambientStrength = 0.25; // Reduced ambient
    float diffuseStrength = 0.7;
    float specularStrength = 0.3; // Added specular
    float shininess = 16.0;       // Shininess for specular

    vec3 lightDirection = normalize(vec3(0.8, 0.6, 1.0)); // Adjusted light direction for better side illumination

    // Ambient
    vec3 ambient = ambientStrength * lightColor;

    // Diffuse
    vec3 norm = normalize(normalVec);
    float diff = max(dot(norm, lightDirection), 0.0);
    vec3 diffuse = diffuseStrength * diff * lightColor;

    // Specular
    vec3 reflectDir = reflect(-lightDirection, norm);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), shininess);
    vec3 specular = specularStrength * spec * lightColor;
    
    return (ambient + diffuse + specular) * surfaceColor;
  }

  void main() {
    vec3 finalColor;

    if (vElevation < uOceanHeightLevel) {
      // Water: make it slightly transparent and add specular for water-like shine
      float depthFactor = smoothstep(0.0, uOceanHeightLevel, vElevation); 
      finalColor = mix(uWaterColor * 0.7, uWaterColor, depthFactor); // color based on depth

      // For water, specular might make it look more "wet"
      // The lighting function will apply this.
    } else {
      // Land
      float landElevationFactor = smoothstep(uOceanHeightLevel, 1.0, vElevation); 
      vec3 baseLand = uLandColor;
      
      // Color land: darker near water, lighter towards peaks
      finalColor = mix(baseLand * 0.6, baseLand * 1.15, landElevationFactor * landElevationFactor);

      // Add peak highlights
      float peakFactor = smoothstep(0.8, 1.0, vElevation); // Start highlights a bit lower
      finalColor = mix(finalColor, vec3(0.95, 0.95, 0.98), peakFactor * 0.75); // Brighter, slightly bluish peaks
    }

    vec3 viewDirection = normalize(cameraPosition - vWorldPosition); // Needed for specular
    gl_FragColor = vec4(calculateLighting(finalColor, vNormal, viewDirection), 1.0);
  }
`;


export const PlanetVisualPanelManager = (() => {
  console.log("PVisualPanelManager: Script loaded.");

  // DOM Elements
  let panelElement, headerElement, titleElement, sizeElement,
      planetPreviewCanvasElement, closeButton, enter360ViewButton,
      planet360CanvasElement;

  // State
  let currentPlanetData = null;
  let rotationQuat2D = [1, 0, 0, 0]; // For 2D Preview
  let startDragPlanetQuat2D = [1, 0, 0, 0];
  let startDragMouse2D = { x: 0, y: 0 };
  let isDraggingPlanet2D = false;
  let isDraggingPanel = false;
  let panelOffset = { x: 0, y: 0 };
  let isRenderingPreview = false;
  let needsPreviewRerender = false;

  let is360ViewActive = false;
  let threeScene, threeCamera, threeRenderer, threePlanetMesh, threeControls, threeAnimationId;
  let threeShaderMaterial;

  const SPHERE_BASE_RADIUS = 0.8; // Keep this for the geometry
  // This factor scales the *conceptual terrain range* to a *visual displacement amount*.
  // e.g., if conceptual range (maxH-minH) is 10, and factor is 0.01, max bump is 0.1 world units.
  // To make it an "actual sphere" (smooth), this factor (or the resulting uDisplacementAmount) should be 0.
  const DISPLACEMENT_SCALING_FACTOR = 0.01; // Adjust for desired bumpiness. 0.0 = smooth.

function init() {
  panelElement = document.getElementById('planet-visual-panel');
  headerElement = document.getElementById('planet-visual-panel-header');
  titleElement = document.getElementById('planet-visual-title');
  sizeElement = document.getElementById('planet-visual-size');
  planetPreviewCanvasElement = document.getElementById('planet-visual-canvas');
  closeButton = document.getElementById('close-planet-visual-panel');
  planet360CanvasElement = document.getElementById('panel-planet-360-canvas');
  enter360ViewButton = document.getElementById('enter-360-view-button');

  if (!planet360CanvasElement) console.error("PVisualPanelManager: CRITICAL - 360 Canvas not found in DOM!");

  if (typeof window.quat_identity === 'function') {
    rotationQuat2D = window.quat_identity();
  }

  closeButton?.addEventListener('click', _closePanel);
  headerElement?.addEventListener('mousedown', _onHeaderMouseDown);
  planetPreviewCanvasElement?.addEventListener('mousedown', _onCanvasMouseDown);

  enter360ViewButton?.addEventListener('click', () => {
    if (is360ViewActive) _switchToPreviewView();
    else _switchTo360View();
  });

  window.addEventListener('resize', () => {
    const panelIsVisible = panelElement?.classList.contains('visible');
    if (is360ViewActive && panelIsVisible && threeRenderer && threeCamera && planet360CanvasElement?.offsetParent !== null) {
      const canvas = planet360CanvasElement;
      const newWidth = canvas.offsetWidth;
      const newHeight = canvas.offsetHeight;
      if (newWidth > 0 && newHeight > 0) {
        threeCamera.aspect = newWidth / newHeight;
        threeCamera.updateProjectionMatrix();
        threeRenderer.setSize(newWidth, newHeight);
      }
    } else if (!is360ViewActive && panelIsVisible && planetPreviewCanvasElement?.offsetParent !== null) {
      _rerenderPreviewIfNeeded(); // This will internally call _renderPreview which resizes
    }
  });

  window.addEventListener('mousemove', _onWindowMouseMove);
  window.addEventListener('mouseup', _onWindowMouseUp);

  setInterval(() => {
    if (needsPreviewRerender && !is360ViewActive && planetPreviewCanvasElement?.offsetParent !== null && panelElement?.classList.contains('visible')) {
      _renderPreview();
    }
  }, 250);
  console.log("PVisualPanelManager: Init complete.");
}

function show(planetData) {
  // Make the panel visible
  if (panelElement) {
    panelElement.classList.add('visible');
  }
  // Set and display planet data if passed in
  if (planetData) {
    currentPlanetData = planetData;
    // Optionally update the UI with the new planet's info here
    _rerenderPreviewIfNeeded();
  }
}
  
  function _initThreeJSView(planet) {
    if (!planet360CanvasElement || !planet) {
      console.error("PVisualPanelManager: Cannot init 360 view - canvas or planet data missing.");
      return;
    }
    // Canvas size handling
    if (planet360CanvasElement.offsetWidth === 0 || planet360CanvasElement.offsetHeight === 0) {
      console.warn("PVisualPanelManager: 360 canvas has zero dimensions on init. Attempting to use CSS computed size or fallback.");
      const computedStyle = window.getComputedStyle(planet360CanvasElement);
      planet360CanvasElement.width = parseInt(computedStyle.width, 10) || 300;
      planet360CanvasElement.height = parseInt(computedStyle.height, 10) || 300;
       if (planet360CanvasElement.width === 0 || planet360CanvasElement.height === 0) { // Final fallback
            planet360CanvasElement.width = 300; planet360CanvasElement.height = 300;
            console.warn("PVisualPanelManager: Fallback to 300x300 for 360 canvas buffer.");
       }
    }

    console.log("PVisualPanelManager: Initializing Three.js view for shader planet:", planet.planetName, planet);

    threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color(0x050510); // Darker space

    const aspectRatio = planet360CanvasElement.offsetWidth / planet360CanvasElement.offsetHeight;
    threeCamera = new THREE.PerspectiveCamera(60, aspectRatio, 0.1, 1000); // fov 60
    // Position camera to view the sphere (radius 0.8) nicely
    const fovInRadians = THREE.MathUtils.degToRad(threeCamera.fov);
    const distance = SPHERE_BASE_RADIUS / Math.sin(fovInRadians / 2) + 0.2; // Add a bit of padding
    threeCamera.position.z = Math.max(distance, SPHERE_BASE_RADIUS * 1.5); // Ensure not too close


    threeRenderer = new THREE.WebGLRenderer({ canvas: planet360CanvasElement, antialias: true });
    threeRenderer.setSize(planet360CanvasElement.offsetWidth, planet360CanvasElement.offsetHeight);
    threeRenderer.setPixelRatio(window.devicePixelRatio);

    const geometry = new THREE.SphereGeometry(SPHERE_BASE_RADIUS, 64, 48);

    // Calculate normalized ocean level (0-1)
    let normalizedOceanLevel = 0.3; // Default if properties are missing
    const pMinConceptual = planet.minTerrainHeight ?? 0.0;
    const pMaxConceptual = planet.maxTerrainHeight ?? (pMinConceptual + 10.0); // Ensure max is >= min
    const pOceanConceptual = planet.oceanHeightLevel ?? (pMinConceptual + (pMaxConceptual - pMinConceptual) * 0.3);

    if (pMaxConceptual > pMinConceptual) {
      normalizedOceanLevel = (pOceanConceptual - pMinConceptual) / (pMaxConceptual - pMinConceptual);
    }
    normalizedOceanLevel = Math.max(0.0, Math.min(1.0, normalizedOceanLevel)); // Clamp to 0-1

    // Calculate uDisplacementAmount for the shader
    // This is the maximum amplitude of displacement in world units.
    const conceptualTerrainRange = Math.max(0, pMaxConceptual - pMinConceptual); // Ensure non-negative range
    const displacementAmount = conceptualTerrainRange * DISPLACEMENT_SCALING_FACTOR;
    // If you want a perfectly smooth sphere option, you could have a setting for DISPLACEMENT_SCALING_FACTOR = 0

    const uniforms = {
      uLandColor: { value: new THREE.Color(planet.landColor || '#006400') },
      uWaterColor: { value: new THREE.Color(planet.waterColor || '#0000FF') },
      uOceanHeightLevel: { value: normalizedOceanLevel },
      uContinentSeed: { value: planet.continentSeed ?? Math.random() },
      uTime: { value: 0.0 },
      uSphereRadius: { value: SPHERE_BASE_RADIUS }, // Pass base radius to shader
      uDisplacementAmount: { value: displacementAmount }
    };

    threeShaderMaterial = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: planetVertexShader,
      fragmentShader: planetFragmentShader,
      // flatShading: true, // Try if normals look odd with displacement, but usually false for spheres
    });

    threePlanetMesh = new THREE.Mesh(geometry, threeShaderMaterial);
    threeScene.add(threePlanetMesh);

    threeControls = new OrbitControls(threeCamera, threeRenderer.domElement);
    threeControls.enableDamping = true;
    threeControls.dampingFactor = 0.05;
    threeControls.screenSpacePanning = false;
    threeControls.minDistance = SPHERE_BASE_RADIUS * 1.05; // Min zoom
    threeControls.maxDistance = SPHERE_BASE_RADIUS * 7;   // Max zoom
    threeControls.target.set(0, 0, 0);

    _animateThreeJSView();
  }

  function _updateThreeJSPlanetAppearance(planet) {
    if (threeShaderMaterial && planet) {
      threeShaderMaterial.uniforms.uLandColor.value.set(planet.landColor || '#006400');
      threeShaderMaterial.uniforms.uWaterColor.value.set(planet.waterColor || '#0000FF');

      let normalizedOceanLevel = 0.3;
      const pMinConceptual = planet.minTerrainHeight ?? 0.0;
      const pMaxConceptual = planet.maxTerrainHeight ?? (pMinConceptual + 10.0);
      const pOceanConceptual = planet.oceanHeightLevel ?? (pMinConceptual + (pMaxConceptual - pMinConceptual) * 0.3);
      if (pMaxConceptual > pMinConceptual) {
        normalizedOceanLevel = (pOceanConceptual - pMinConceptual) / (pMaxConceptual - pMinConceptual);
      }
      normalizedOceanLevel = Math.max(0.0, Math.min(1.0, normalizedOceanLevel));

      const conceptualTerrainRange = Math.max(0, pMaxConceptual - pMinConceptual);
      const displacementAmount = conceptualTerrainRange * DISPLACEMENT_SCALING_FACTOR;
      
      threeShaderMaterial.uniforms.uOceanHeightLevel.value = normalizedOceanLevel;
      threeShaderMaterial.uniforms.uContinentSeed.value = planet.continentSeed ?? Math.random();
      threeShaderMaterial.uniforms.uDisplacementAmount.value = displacementAmount;

      console.log("PVisualPanelManager: Updated Three.js planet shader uniforms for:", planet.planetName);
    }
  }

  function _animateThreeJSView() {
    if (!is360ViewActive || !threeRenderer) return;
    threeAnimationId = requestAnimationFrame(_animateThreeJSView);
    if (threeShaderMaterial && threeShaderMaterial.uniforms.uTime) {
        threeShaderMaterial.uniforms.uTime.value += 0.005;
    }
    if(threeControls) threeControls.update();
    if(threeRenderer && threeScene && threeCamera) threeRenderer.render(threeScene, threeCamera);
  }

  function _stopAndCleanupThreeJSView() {
    if (threeAnimationId) cancelAnimationFrame(threeAnimationId);
    threeAnimationId = null;
    if (threeControls) {
        threeControls.dispose();
        threeControls = null;
    }
    if (threePlanetMesh) {
        if(threePlanetMesh.geometry) threePlanetMesh.geometry.dispose();
        if(threeShaderMaterial) threeShaderMaterial.dispose();
        if(threeScene) threeScene.remove(threePlanetMesh); // Check if threeScene exists
        threePlanetMesh = null;
        threeShaderMaterial = null;
    }
    if (threeScene) {
        // Remove any other dynamically added objects from the scene if necessary
        // For simple scenes, this might be enough. For complex ones, traverse and dispose.
        while(threeScene.children.length > 0){ 
            const object = threeScene.children[0];
            threeScene.remove(object);
            // Add more specific disposal if object has geometry/material/textures
             if (object.geometry) object.geometry.dispose();
             if (object.material) {
                 if (Array.isArray(object.material)) {
                     object.material.forEach(material => material.dispose());
                 } else {
                     object.material.dispose();
                 }
             }
        }
    }
    if (threeRenderer) {
        threeRenderer.dispose(); // Essential for releasing WebGL context
        // threeRenderer.domElement = null; // The canvas is managed elsewhere
        threeRenderer = null;
    }
    threeScene = null;
    threeCamera = null;
    console.log("PVisualPanelManager: Three.js 360 view cleaned up.");
  }
  
  function _renderPreview() {
    // ... (Ensure this function correctly sizes and renders the 2D preview
    //      to planetPreviewCanvasElement using the worker, as in your previous complete version)
    if (isRenderingPreview || !window.planetVisualWorker || !currentPlanetData || !planetPreviewCanvasElement) {
      if (currentPlanetData) needsPreviewRerender = true; return;
    }
    if (planetPreviewCanvasElement.offsetParent === null) {
      needsPreviewRerender = true; return;
    }
 const canvas = planetPreviewCanvasElement;
    const currentWidth = canvas.offsetWidth;
    const currentHeight = canvas.offsetHeight;
    if (canvas.width !== currentWidth || canvas.height !== currentHeight) {
      canvas.width = currentWidth;
      canvas.height = currentHeight;
    }
    if (canvas.width === 0 || canvas.height === 0) {
      console.warn("PVisualPanelManager: Preview canvas size 0x0, skipping worker call.");
      needsPreviewRerender = true; return;
    }
    isRenderingPreview = true;
    needsPreviewRerender = false;
    window.renderPlanetVisual(currentPlanetData, rotationQuat2D, canvas, 'planet-visual-panel-preview-canvas');
  }

  function _rerenderPreviewIfNeeded() {
    if (panelElement?.classList.contains('visible') && currentPlanetData && !is360ViewActive && planetPreviewCanvasElement?.offsetParent !== null) {
      _renderPreview();
    }
  }

function _switchTo360View() {
  if (!currentPlanetData) return;

  is360ViewActive = true;
  _stopAndCleanupThreeJSView(); // Clean up before switching

  if (planetPreviewCanvasElement) planetPreviewCanvasElement.style.display = 'none';
  if (planet360CanvasElement) {
    planet360CanvasElement.style.display = 'block';
    requestAnimationFrame(() => { // Ensure display:block is effective before sizing

      // Ensure canvas is sized correctly for Three.js before init
      if (planet360CanvasElement.offsetParent !== null) {
          const newWidth = planet360CanvasElement.offsetWidth;
          const newHeight = planet360CanvasElement.offsetHeight;
          if (newWidth > 0 && newHeight > 0) {
            planet360CanvasElement.width = newWidth;
            planet360CanvasElement.height = newHeight;
            _initThreeJSView(currentPlanetData); // Re-initialize the 3D view
          } else {
            console.warn("PVisualPanelManager: 360 canvas had zero dimensions after display:block. Three.js init was skipped");
            planet360CanvasElement.width = planet360CanvasElement.width || 300;
            planet360CanvasElement.height = planet360CanvasElement.height || 300;
             _initThreeJSView(currentPlanetData); // Re-initialize the 3D view
          }
      } else {
        console.warn("PVisualPanelManager: 360 canvas not attached to DOM or visible, deferring Three.js init.");
      }
    }); // End requestAnimationFrame
  }
  if (enter360ViewButton) enter360ViewButton.textContent = "Show 2D Preview"; // Text adjustment
}

  function _closePanel() {
  if (panelElement) {
    panelElement.classList.remove('visible');
  }
  is360ViewActive = false;
  _stopAndCleanupThreeJSView();
  if (planetPreviewCanvasElement) planetPreviewCanvasElement.style.display = 'block';
  if (planet360CanvasElement) planet360CanvasElement.style.display = 'none';
  if (enter360ViewButton) enter360ViewButton.textContent = "Show 3D View";
}

function handleWorkerMessage(event) {
  // Example: updating the preview canvas with data from a worker
  if (!planetPreviewCanvasElement) return;
  const { data } = event;
  if (data.type === 'planetVisualRender' && data.canvasId === 'planet-visual-panel-preview-canvas') {
    const ctx = planetPreviewCanvasElement.getContext('2d');
    if (ctx && data.imageBitmap) {
      ctx.clearRect(0, 0, planetPreviewCanvasElement.width, planetPreviewCanvasElement.height);
      ctx.drawImage(data.imageBitmap, 0, 0);
      isRenderingPreview = false;
    }
  }
}
  
    // Add this at the end of your module, before closing the IIFE
  return {
    init,
    show,
    hide: _closePanel,
    handleWorkerMessage,
    isVisible: () => panelElement?.classList.contains('visible'),
    getCurrentPlanetData: () => currentPlanetData,
    rerenderPreviewIfNeeded: _rerenderPreviewIfNeeded,
  };
})();
