// public/js/planetVisualPanelManager.js
import '../styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// --- Shader Definitions ---
// GLSL utility for a pseudo-random number from a vec2
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
    f = f * f * (3.0 - 2.0 * f);

    float bottomLeftFront = random(i.xy + i.z * 0.37); 
    float bottomRightFront= random(i.xy + vec2(1.0, 0.0) + i.z * 0.37);
    float topLeftFront  = random(i.xy + vec2(0.0, 1.0) + i.z * 0.37);
    float topRightFront = random(i.xy + vec2(1.0, 1.0) + i.z * 0.37);
    float bottomLeftBack = random(i.xy + (i.z + 1.0) * 0.37);
    float topRightBack  = random(i.xy + vec2(1.0, 1.0) + (i.z + 1.0) * 0.37);
    float bottomRightBack= random(i.xy + vec2(1.0, 0.0) + (i.z + 1.0) * 0.37);
    float topLeftBack   = random(i.xy + vec2(0.0, 1.0) + (i.z + 1.0) * 0.37);

    float bottomInterX1 = mix(bottomLeftFront, bottomRightFront, f.x);
    float topInterX1  = mix(topLeftFront,  topRightFront,  f.x);
    float bottomInterX2 = mix(bottomLeftBack,  bottomRightBack,  f.x);
    float topInterX2  = mix(topLeftBack,   topRightBack,   f.x);
    float interY1 = mix(bottomInterX1, topInterX1, f.y);
    float interY2 = mix(bottomInterX2, topInterX2, f.y);
    return mix(interY1, interY2, f.z); 
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
      total += valueNoise(p * frequency + seed * float(i) * 1.7, seed * 12.345 * float(i+1)) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }
    if (maxValue == 0.0) return 0.0;
    return total / maxValue; 
  }
`;

const planetVertexShader = `
  uniform float uTime;
  uniform float uMinTerrainHeight;  
  uniform float uMaxTerrainHeight;  
  uniform float uContinentSeed;     
  uniform float uSphereRadius;      
  uniform float uDisplacementScale; 

  varying vec3 vNormal;
  varying float vElevation;         
  varying vec3 vWorldPosition;      
  varying vec3 vComputedNormal;     

  ${glslLayeredNoise} 

  void main() {
    vNormal = normal; 
    vec3 basePosition = position;
    vec3 noiseInputPosition = basePosition * 2.5 + (uContinentSeed * 10.0); 
    float noiseValue = layeredNoise(noiseInputPosition, uContinentSeed, 4, 0.5, 2.0); 
    vElevation = noiseValue; 
    float actualDisplacement = noiseValue * uDisplacementScale; 
    vec3 displacedPosition = basePosition + normal * actualDisplacement;
    vComputedNormal = normalize(normalMatrix * normal); 
    vWorldPosition = (modelMatrix * vec4(displacedPosition, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
  }
`;

const planetFragmentShader = `
  uniform vec3 uLandColor;
  uniform vec3 uWaterColor;
  uniform float uOceanHeightLevel; // Normalized (0-1)

  varying vec3 vNormal;         
  varying float vElevation;     
  varying vec3 vWorldPosition;  
  varying vec3 vComputedNormal; 

  vec3 calculateLighting(vec3 surfaceColor, vec3 normalVec, vec3 worldPos) {
    vec3 lightColor = vec3(1.0, 1.0, 0.95); 
    float ambientStrength = 0.3;
    float diffuseStrength = 0.8;
    vec3 lightDirection = normalize(vec3(1.0, 0.7, 0.8)); 
    vec3 ambient = ambientStrength * lightColor;
    float diff = max(dot(normalize(normalVec), lightDirection), 0.0);
    vec3 diffuse = diffuseStrength * diff * lightColor;
    return (ambient + diffuse) * surfaceColor;
  }

  void main() {
    vec3 finalColor;
    if (vElevation < uOceanHeightLevel) {
      float depthFactor = smoothstep(0.0, uOceanHeightLevel, vElevation); 
      finalColor = mix(uWaterColor * 0.7, uWaterColor, depthFactor); 
    } else {
      float landElevationFactor = smoothstep(uOceanHeightLevel, 1.0, vElevation); 
      vec3 baseLand = uLandColor;
      finalColor = mix(baseLand, baseLand * 0.5, landElevationFactor * landElevationFactor); 
      float peakFactor = smoothstep(0.85, 1.0, vElevation); 
      finalColor = mix(finalColor, vec3(0.95, 0.95, 1.0), peakFactor * 0.8); 
    }
    gl_FragColor = vec4(calculateLighting(finalColor, vComputedNormal, vWorldPosition), 1.0);
  }
`;


export const PlanetVisualPanelManager = (() => {
  console.log("PVisualPanelManager: Script loaded.");

  let panelElement, headerElement, titleElement, sizeElement,
      planetPreviewCanvasElement, closeButton, enter360ViewButton,
      planet360CanvasElement;

  let currentPlanetData = null;
  let rotationQuat2D = [1, 0, 0, 0];
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

  const SPHERE_BASE_RADIUS = 0.8;
  const TERRAIN_DISPLACEMENT_VISUAL_SCALE = 0.015;

  function _initThreeJSView(planet) {
    if (!planet360CanvasElement || !planet) {
        console.error("PVisualPanelManager: Cannot init 360 view - canvas or planet data missing.");
        return;
    }
     if (planet360CanvasElement.offsetWidth === 0 || planet360CanvasElement.offsetHeight === 0) {
        console.warn("PVisualPanelManager: 360 canvas has zero dimensions on init. Applying current style dimensions.");
        planet360CanvasElement.width = parseInt(window.getComputedStyle(planet360CanvasElement).width, 10) || 300;
        planet360CanvasElement.height = parseInt(window.getComputedStyle(planet360CanvasElement).height, 10) || 300;
        if (planet360CanvasElement.width === 0 || planet360CanvasElement.height === 0) { // Final fallback
            planet360CanvasElement.width = 300; planet360CanvasElement.height = 300;
        }
    }

    console.log("PVisualPanelManager: Initializing Three.js view for shader planet:", planet.planetName, planet);

    threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color(0x050510);

    const aspectRatio = planet360CanvasElement.offsetWidth / planet360CanvasElement.offsetHeight;
    threeCamera = new THREE.PerspectiveCamera(65, aspectRatio, 0.1, 1000);
    threeCamera.position.z = 1.7;

    threeRenderer = new THREE.WebGLRenderer({ canvas: planet360CanvasElement, antialias: true });
    threeRenderer.setSize(planet360CanvasElement.offsetWidth, planet360CanvasElement.offsetHeight);
    threeRenderer.setPixelRatio(window.devicePixelRatio);

    const geometry = new THREE.SphereGeometry(SPHERE_BASE_RADIUS, 64, 48);

    let normalizedOceanLevel = 0.3;
    const pMin = planet.minTerrainHeight ?? 0.0;
    const pMax = planet.maxTerrainHeight ?? 10.0;
    const pOcean = planet.oceanHeightLevel ?? (pMin + (pMax - pMin) * 0.3);

    if (pMax > pMin) {
      normalizedOceanLevel = (pOcean - pMin) / (pMax - pMin);
    }
    normalizedOceanLevel = Math.max(0.0, Math.min(1.0, normalizedOceanLevel));
    const effectiveDisplacementScale = (pMax - pMin) * TERRAIN_DISPLACEMENT_VISUAL_SCALE; // Scale based on actual range

    const uniforms = {
      uLandColor: { value: new THREE.Color(planet.landColor || '#006400') },
      uWaterColor: { value: new THREE.Color(planet.waterColor || '#0000FF') },
      uOceanHeightLevel: { value: normalizedOceanLevel },
      uMinTerrainHeight: { value: pMin },
      uMaxTerrainHeight: { value: pMax },
      uContinentSeed: { value: planet.continentSeed ?? Math.random() },
      uTime: { value: 0.0 },
      uSphereRadius: { value: SPHERE_BASE_RADIUS },
      uDisplacementScale: { value: effectiveDisplacementScale }
    };

    threeShaderMaterial = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: planetVertexShader,
      fragmentShader: planetFragmentShader,
    });

    threePlanetMesh = new THREE.Mesh(geometry, threeShaderMaterial);
    threeScene.add(threePlanetMesh);

    threeControls = new OrbitControls(threeCamera, threeRenderer.domElement);
    threeControls.enableDamping = true;
    threeControls.dampingFactor = 0.05;
    threeControls.screenSpacePanning = false;
    threeControls.minDistance = SPHERE_BASE_RADIUS * 1.1;
    threeControls.maxDistance = SPHERE_BASE_RADIUS * 5;
    threeControls.target.set(0, 0, 0);

    _animateThreeJSView();
  }

  function _updateThreeJSPlanetAppearance(planet) {
    if (threeShaderMaterial && planet) {
      threeShaderMaterial.uniforms.uLandColor.value.set(planet.landColor || '#006400');
      threeShaderMaterial.uniforms.uWaterColor.value.set(planet.waterColor || '#0000FF');

      let normalizedOceanLevel = 0.3;
      const pMin = planet.minTerrainHeight ?? 0.0;
      const pMax = planet.maxTerrainHeight ?? 10.0;
      const pOcean = planet.oceanHeightLevel ?? (pMin + (pMax - pMin) * 0.3);
      if (pMax > pMin) {
        normalizedOceanLevel = (pOcean - pMin) / (pMax - pMin);
      }
      normalizedOceanLevel = Math.max(0.0, Math.min(1.0, normalizedOceanLevel));
      const effectiveDisplacementScale = (pMax - pMin) * TERRAIN_DISPLACEMENT_VISUAL_SCALE;

      threeShaderMaterial.uniforms.uOceanHeightLevel.value = normalizedOceanLevel;
      threeShaderMaterial.uniforms.uMinTerrainHeight.value = pMin;
      threeShaderMaterial.uniforms.uMaxTerrainHeight.value = pMax;
      threeShaderMaterial.uniforms.uContinentSeed.value = planet.continentSeed ?? Math.random();
      threeShaderMaterial.uniforms.uDisplacementScale.value = effectiveDisplacementScale;

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
    if (threeControls) threeControls.dispose();
    threeControls = null;
    if (threePlanetMesh) {
        if(threePlanetMesh.geometry) threePlanetMesh.geometry.dispose();
        if(threeShaderMaterial) threeShaderMaterial.dispose();
        if(threeScene) threeScene.remove(threePlanetMesh);
        threePlanetMesh = null;
        threeShaderMaterial = null;
    }
    if (threeScene) {
        while(threeScene.children.length > 0){
            const child = threeScene.children[0];
            threeScene.remove(child);
            // Basic cleanup for known types; more complex scenes need more careful disposal
            if (child.isMesh && child.geometry) child.geometry.dispose();
            if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                else child.material.dispose();
            }
        }
    }
    if (threeRenderer) {
        threeRenderer.dispose();
        // threeRenderer.forceContextLoss(); // Can be aggressive, use if WebGL contexts stick
        threeRenderer.domElement = null;
        threeRenderer = null;
    }
    threeScene = null;
    threeCamera = null;
    console.log("PVisualPanelManager: Three.js 360 view cleaned up.");
  }

  function _renderPreview() {
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
            if (planet360CanvasElement.offsetParent !== null) {
                 const newWidth = planet360CanvasElement.offsetWidth;
                 const newHeight = planet360CanvasElement.offsetHeight;
                 if(planet360CanvasElement.width !== newWidth) planet360CanvasElement.width = newWidth;
                 if(planet360CanvasElement.height !== newHeight) planet360CanvasElement.height = newHeight;
                
                if (newWidth > 0 && newHeight > 0) {
                    _initThreeJSView(currentPlanetData);
                } else {
                     console.warn("PVisualPanelManager: 360 canvas offsetWidth/Height is 0 after display block. Three.js init might have issues.");
                     // Attempt init with last known good size or default
                      planet360CanvasElement.width = planet360CanvasElement.width || 300;
                      planet360CanvasElement.height = planet360CanvasElement.height || 300;
                     _initThreeJSView(currentPlanetData);
                }
            } else {
                console.warn("PVisualPanelManager: 360 canvas not attached to DOM or visible. Three.js init deferred or potentially flawed.");
            }
        });
    }
    if (enter360ViewButton) enter360ViewButton.textContent = "Show 2D Preview";
  }

  function _switchToPreviewView() {
    is360ViewActive = false;
    _stopAndCleanupThreeJSView();
    if (planet360CanvasElement) planet360CanvasElement.style.display = 'none';
    if (planetPreviewCanvasElement) {
        planetPreviewCanvasElement.style.display = 'block';
        // Ensure 2D preview is rendered correctly after being hidden
        if (currentPlanetData) {
             requestAnimationFrame(() => _rerenderPreviewIfNeeded());
        }
    }
    if (enter360ViewButton) enter360ViewButton.textContent = "Enter 360° View";
    console.log("PVisualPanelManager: Switched to 2D preview view.");
  }

  function _onCanvasMouseDown(e) { 
    if (e.button !== 0 || !currentPlanetData || is360ViewActive) return;
    isDraggingPlanet2D = true;
    startDragMouse2D.x = e.clientX;
    startDragMouse2D.y = e.clientY;
    startDragPlanetQuat2D = [...rotationQuat2D];
    planetPreviewCanvasElement?.classList.add('dragging');
    e.preventDefault();
  }
  function _onHeaderMouseDown(e) { 
    if (e.button !== 0 || !panelElement) return;
    isDraggingPanel = true;
    headerElement?.classList.add('dragging');
    panelElement.style.transition = 'none';
    const rect = panelElement.getBoundingClientRect();
    panelOffset.x = e.clientX - rect.left;
    panelOffset.y = e.clientY - rect.top;
    panelElement.style.transform = 'none'; // Important if panel was centered with transform
    panelElement.style.left = `${e.clientX - panelOffset.x}px`;
    panelElement.style.top = `${e.clientY - panelOffset.y}px`;
    e.preventDefault();
  }
  function _onWindowMouseMove(e) { 
    if (isDraggingPanel && panelElement) {
        panelElement.style.left = `${e.clientX - panelOffset.x}px`;
        panelElement.style.top = `${e.clientY - panelOffset.y}px`;
    } else if (isDraggingPlanet2D && planetPreviewCanvasElement && !is360ViewActive) {
        const rect = planetPreviewCanvasElement.getBoundingClientRect();
        if (rect.width === 0) return;
        const deltaX = e.clientX - startDragMouse2D.x;
        const deltaY = e.clientY - startDragMouse2D.y;
        const sensitivity = window.PLANET_ROTATION_SENSITIVITY || 0.75;
        const rotX = (deltaY / rect.width) * Math.PI * sensitivity;
        const rotY = (deltaX / rect.width) * (2 * Math.PI) * sensitivity;
        const rotQuatX = window.quat_from_axis_angle([1, 0, 0], -rotX);
        const rotQuatY = window.quat_from_axis_angle([0, 1, 0], rotY);
        const incrRotQuat = window.quat_multiply(rotQuatY, rotQuatX);
        rotationQuat2D = window.quat_normalize(window.quat_multiply(incrRotQuat, startDragPlanetQuat2D));
        _renderPreview();
    }
  }
  function _onWindowMouseUp() { 
    if (isDraggingPanel) {
        isDraggingPanel = false;
        headerElement?.classList.remove('dragging');
        panelElement?.style.removeProperty('transition');
    }
    if (isDraggingPlanet2D) {
        isDraggingPlanet2D = false;
        planetPreviewCanvasElement?.classList.remove('dragging');
    }
  }

  function _closePanel() { 
    if (is360ViewActive) {
        _switchToPreviewView(); 
    }
    panelElement?.classList.remove('visible');
    currentPlanetData = null;
    isRenderingPreview = false;
    needsPreviewRerender = false;
  }

  return {
    init: () => {
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
            _rerenderPreviewIfNeeded(); // This will internall call _renderPreview which resizes
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
    },

    show: (planetData) => {
      if (!panelElement || !planetData) {
        _closePanel();
        return;
      }
      console.log("PVisualPanelManager: Show called for planet:", planetData.planetName || planetData.id);

      const isNewPlanet = !currentPlanetData || currentPlanetData.id !== planetData.id;
      currentPlanetData = planetData;
      
      panelElement.classList.add('visible'); // Make panel visible first

      if (is360ViewActive) {
        if(isNewPlanet) { // If in 360 view but showing a new planet data
            _updateThreeJSPlanetAppearance(currentPlanetData); // Update the existing 3D view
        } else {
            // Same planet, 360 view already active, do nothing or minor update if needed
        }
      } else {
         // Should be in preview view or just opening
         _switchToPreviewView(); // This also handles rendering the 2D preview of currentPlanetData
      }


      if (titleElement) titleElement.textContent = currentPlanetData.planetName || 'Planet';
      if (sizeElement) sizeElement.textContent = currentPlanetData.size ? `${Math.round(currentPlanetData.size)} px (diameter)` : 'N/A';

      if (typeof window.quat_identity === 'function' && isNewPlanet) { // Reset 2D preview rotation only for new planet
        rotationQuat2D = window.quat_identity();
      }

      
      if (!panelElement.style.left || panelElement.style.left === '0px' || panelElement.style.transform === '') {
        panelElement.style.left = '50%';
        panelElement.style.top = '50%';
        panelElement.style.transform = 'translate(-50%, -50%)';
      }
    },

    hide: _closePanel,

    handleWorkerMessage: ({ renderedData, width, height, error, senderId }) => {
      if (senderId !== 'planet-visual-panel-preview-canvas') {
        if (needsPreviewRerender && !is360ViewActive && planetPreviewCanvasElement?.offsetParent !== null ) _renderPreview();
        return;
      }
      isRenderingPreview = false;

      if (error) {
        console.error("PVisualPanelManager: Worker reported an error for preview canvas:", error);
      } else if (planetPreviewCanvasElement && panelElement?.classList.contains('visible') && currentPlanetData && !is360ViewActive) {
        const ctx = planetPreviewCanvasElement.getContext('2d');
        if (ctx && renderedData) {
          try {
            const canvas = planetPreviewCanvasElement;
            if (canvas.width !== width || canvas.height !== height) { // Resize if worker data dimensions differ
                canvas.width = width;
                canvas.height = height;
            }
            const clampedArray = new Uint8ClampedArray(renderedData);
            const imageDataObj = new ImageData(clampedArray, width, height);
            ctx.clearRect(0,0,width,height); // Clear before drawing
            ctx.putImageData(imageDataObj, 0, 0);
          } catch (err) {
            console.error("PVisualPanelManager: Error putting ImageData on preview canvas:", err);
          }
        }
      }
      if (needsPreviewRerender && !is360ViewActive && planetPreviewCanvasElement?.offsetParent !== null) _renderPreview();
    },
    isVisible: () => panelElement?.classList.contains('visible'),
    getCurrentPlanetData: () => currentPlanetData,
    rerenderPreviewIfNeeded: _rerenderPreviewIfNeeded,
  };
})();
