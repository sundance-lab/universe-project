// public/js/planetVisualPanelManager.js
import '../styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// --- Shader Definitions ---
const glslRandom2to1 = `...`; // This code remains the same from your file
const glslSimpleValueNoise3D = `...`; // This code remains the same from your file

// MODIFIED: The layeredNoise function is slightly different in the new shaders.
// We will define the full, new shaders below.

// --- 1. NEW, ADVANCED SHADERS ---

const planetVertexShader = `
uniform float uTime;
uniform float uContinentSeed;  
uniform float uSphereRadius;   
uniform float uDisplacementAmount;

varying vec3 vNormal;
varying float vElevation;
varying vec3 vWorldPosition;  

// Your existing noise functions will be injected here by JS
$

// We use the same noise function but apply it at different scales
float layeredNoise(vec3 p, float seed, int octaves, float persistence, float lacunarity, float scale) {
  float total = 0.0;
  float frequency = scale;
  float amplitude = 1.0;
  float maxValue = 0.0; 

  for (int i = 0; i < octaves; i++) {
   total += valueNoise(p * frequency + seed * float(i) * 1.712, seed * 12.345 * float(i+1) * 0.931) * amplitude;
   maxValue += amplitude;
   amplitude *= persistence;
   frequency *= lacunarity;
  }
  if (maxValue == 0.0) return 0.0;
  return total / maxValue;
}

void main() {
  vec3 p = position;
  vec3 noiseInputPosition = (p / uSphereRadius) + (uContinentSeed * 10.0);
  
  // --- Create more realistic terrain ---
  // 1. Generate large, smooth continents with low-frequency noise
  float continentNoise = (layeredNoise(noiseInputPosition, uContinentSeed, 5, 0.5, 2.0, 1.5) + 1.0) * 0.5;

  // 2. Generate rougher, high-frequency noise for mountains
  float mountainNoise = (layeredNoise(noiseInputPosition, uContinentSeed * 2.0, 6, 0.45, 2.2, 8.0) + 1.0) * 0.5;

  // 3. Combine them: Apply mountains only where continent noise is high, creating mountain ranges on land.
  float continentMask = smoothstep(0.48, 0.52, continentNoise);
  float finalElevation = continentNoise + (mountainNoise * continentMask * 0.3);

  // 4. Final normalization and displacement
  vElevation = clamp(finalElevation, 0.0, 1.0);
  float displacement = vElevation * uDisplacementAmount; 
  vec3 displacedPosition = p + normal * displacement;
  
  vNormal = normal;
  vWorldPosition = (modelMatrix * vec4(displacedPosition, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
}
`;

const planetFragmentShader = `
uniform vec3 uLandColor;
uniform vec3 uWaterColor;
uniform float uOceanHeightLevel; // This is now the "sea level" or shallow water line

varying vec3 vNormal;
varying float vElevation;
varying vec3 vWorldPosition;  

// Your existing lighting function
vec3 calculateLighting(vec3 surfaceColor, vec3 normalVec, vec3 viewDir) {
  vec3 lightColor = vec3(1.0, 1.0, 0.95); 
  float ambientStrength = 0.25;
  float diffuseStrength = 0.7;
  float specularStrength = 0.3;
  float shininess = 16.0;

  vec3 lightDirection = normalize(vec3(0.8, 0.6, 1.0));

  vec3 ambient = ambientStrength * lightColor;
  vec3 norm = normalize(normalVec);
  float diff = max(dot(norm, lightDirection), 0.0);
  vec3 diffuse = diffuseStrength * diff * lightColor;
  vec3 reflectDir = reflect(-lightDirection, norm);
  float spec = pow(max(dot(viewDir, reflectDir), 0.0), shininess);
  vec3 specular = specularStrength * spec * lightColor;
  
  return (ambient + diffuse + specular) * surfaceColor;
}

void main() {
  vec3 finalColor;

  // --- Define elevation levels for our biome color ramp ---
  float seaLevel = uOceanHeightLevel;
  float deepWater = seaLevel * 0.6;
  float beachLevel = seaLevel + 0.03;
  float mountainLevel = seaLevel + 0.35;
  float snowLevel = seaLevel + 0.55;

  // --- Define colors for our biomes ---
  vec3 deepWaterColor = uWaterColor * 0.5;
  vec3 shallowWaterColor = uWaterColor;
  vec3 beachColor = vec3(0.86, 0.78, 0.59);
  vec3 plainsColor = uLandColor;
  vec3 mountainColor = uLandColor * 0.7 + vec3(0.4);
  vec3 snowColor = vec3(0.95, 0.95, 1.0);

  // --- Create the color ramp by mixing colors based on elevation ---
  if (vElevation < deepWater) {
      finalColor = deepWaterColor;
  } else if (vElevation < seaLevel) {
      float mixFactor = smoothstep(deepWater, seaLevel, vElevation);
      finalColor = mix(deepWaterColor, shallowWaterColor, mixFactor);
  } else if (vElevation < beachLevel) {
      float mixFactor = smoothstep(seaLevel, beachLevel, vElevation);
      finalColor = mix(shallowWaterColor, beachColor, mixFactor);
  } else if (vElevation < mountainLevel) {
      float mixFactor = smoothstep(beachLevel, mountainLevel, vElevation);
      finalColor = mix(beachColor, plainsColor, mixFactor);
  } else if (vElevation < snowLevel) {
      float mixFactor = smoothstep(mountainLevel, snowLevel, vElevation);
      finalColor = mix(plainsColor, mountainColor, mixFactor);
  } else {
      float mixFactor = smoothstep(snowLevel, snowLevel + 0.2, vElevation);
      finalColor = mix(mountainColor, snowColor, mixFactor);
  }

  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
  gl_FragColor = vec4(calculateLighting(finalColor, vNormal, viewDirection), 1.0);
}
`;

export const PlanetVisualPanelManager = (() => {
  console.log("PVisualPanelManager: Script loaded.");

  // DOM Elements
  let panelElement, headerElement, titleElement, sizeElement,
    closeButton, planet360CanvasElement;

  // State
  let currentPlanetData = null;
  let isDraggingPanel = false;
  let panelOffset = { x: 0, y: 0 };

  let is360ViewActive = false;
  let threeScene, threeCamera, threeRenderer, threePlanetMesh, threeControls, threeAnimationId;
  let threeShaderMaterial;

  const SPHERE_BASE_RADIUS = 0.8;
  
  // --- 2. MAKE PLANETS MORE SPHERICAL ---
  // Reduced this from 0.01 to make the terrain displacement less extreme.
  const DISPLACEMENT_SCALING_FACTOR = 0.005;

  // --- Panel Dragging Logic (Header Only) ---
  function _onHeaderMouseDown(e) {
    if (e.target.closest('button')) return;
    isDraggingPanel = true;
    panelElement.classList.add('dragging');
    const panelRect = panelElement.getBoundingClientRect();
    panelOffset = {
      x: e.clientX - panelRect.left,
      y: e.clientY - panelRect.top,
    };
    e.preventDefault();
  }

  function _onWindowMouseMove(e) {
    if (!isDraggingPanel) return;
    const newX = e.clientX - panelOffset.x;
    const newY = e.clientY - panelOffset.y;
    panelElement.style.left = `${newX}px`;
    panelElement.style.top = `${newY}px`;
    if (panelElement.style.transform !== 'none') {
       panelElement.style.transform = 'none';
    }
  }

  function _onWindowMouseUp() {
    if (isDraggingPanel) {
      isDraggingPanel = false;
      panelElement.classList.remove('dragging');
    }
  }
   
  // --- Core Module Functions ---
  function init() {
    panelElement = document.getElementById('planet-visual-panel');
    headerElement = document.getElementById('planet-visual-panel-header');
    titleElement = document.getElementById('planet-visual-title');
    sizeElement = document.getElementById('planet-visual-size');
    closeButton = document.getElementById('close-planet-visual-panel');
    planet360CanvasElement = document.getElementById('panel-planet-360-canvas');

    if (!planet360CanvasElement) console.error("PVisualPanelManager: CRITICAL - 360 Canvas not found in DOM!");

    closeButton?.addEventListener('click', _closePanel);
    headerElement?.addEventListener('mousedown', _onHeaderMouseDown);
    window.addEventListener('mousemove', _onWindowMouseMove);
    window.addEventListener('mouseup', _onWindowMouseUp);

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
      }
    });
     
    console.log("PVisualPanelManager: Init complete.");
  }

  function show(planetData) {
    if (panelElement) {
      panelElement.classList.add('visible');
      panelElement.style.left = '50%';
      panelElement.style.top = '50%';
      panelElement.style.transform = 'translate(-50%, -50%)';
    }
    if (planetData) {
      currentPlanetData = planetData;
      if (titleElement) titleElement.textContent = planetData.planetName || 'Planet';
      if (sizeElement) sizeElement.textContent = `${Number(planetData.size).toFixed(2)} units`;
      _switchTo360View();
    }
  }
   
  function _switchTo360View() {
    if (!currentPlanetData) return;
    is360ViewActive = true;
    _stopAndCleanupThreeJSView();

    if (planet360CanvasElement) {
      planet360CanvasElement.style.display = 'block';
       
      requestAnimationFrame(() => {
        if (planet360CanvasElement.offsetParent !== null) {
          const newWidth = planet360CanvasElement.offsetWidth;
          const newHeight = planet360CanvasElement.offsetHeight;
          if (newWidth > 0 && newHeight > 0) {
            planet360CanvasElement.width = newWidth;
            planet360CanvasElement.height = newHeight;
            _initThreeJSView(currentPlanetData);
          } else {
            console.warn("PVisualPanelManager: 360 canvas had zero dimensions. Using fallback.");
            planet360CanvasElement.width = 300;
            planet360CanvasElement.height = 300;
            _initThreeJSView(currentPlanetData);
          }
        }
      });
    }
  }

  function _initThreeJSView(planet) {
    if (!planet360CanvasElement || !planet) {
      return;
    }

    // --- Assemble the shader string ---
    const finalSimpleValueNoise = glslSimpleValueNoise3D.replace('$', glslRandom2to1);
    const finalLayeredNoise = planetVertexShader.includes("layeredNoise") ? "" : `...`; // Placeholder if needed, but the new vertex shader has it built-in.
    // The new vertex shader has the noise function inside it, so we only need to inject the base random function.
    const finalVertexShader = planetVertexShader.replace('$', glslSimpleValueNoise3D.replace('$', glslRandom2to1));

    threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color(0x050510);

    const aspectRatio = planet360CanvasElement.offsetWidth / planet360CanvasElement.offsetHeight;
    threeCamera = new THREE.PerspectiveCamera(60, aspectRatio, 0.1, 1000);
    const fovInRadians = THREE.MathUtils.degToRad(threeCamera.fov);
    const distance = SPHERE_BASE_RADIUS / Math.sin(fovInRadians / 2) + 0.2;
    threeCamera.position.z = Math.max(distance, SPHERE_BASE_RADIUS * 1.5);

    threeRenderer = new THREE.WebGLRenderer({ canvas: planet360CanvasElement, antialias: true });
    threeRenderer.setSize(planet360CanvasElement.offsetWidth, planet360CanvasElement.offsetHeight);
    threeRenderer.setPixelRatio(window.devicePixelRatio);

    const geometry = new THREE.SphereGeometry(SPHERE_BASE_RADIUS, 64, 48);

    // --- Calculate Shader Uniforms ---
    // The `uOceanHeightLevel` uniform is now used as the "sea level" in the fragment shader.
    // We adjust it based on the planet's data so it corresponds to a value between 0.0 and 1.0.
    // Let's target a default normalized sea level of ~0.5 for good visual range.
    let normalizedOceanLevel = 0.5;
    const pMin = planet.minTerrainHeight ?? 0.0;
    const pMax = planet.maxTerrainHeight ?? (pMin + 10.0);
    const pOcean = planet.oceanHeightLevel ?? (pMin + (pMax - pMin) * 0.3);
    if (pMax > pMin) {
      normalizedOceanLevel = (pOcean - pMin) / (pMax - pMin);
    }
    normalizedOceanLevel = Math.max(0.2, Math.min(0.8, normalizedOceanLevel)); // Clamp to a reasonable range
    
    const conceptualRange = Math.max(0, pMax - pMin);
    const displacementAmount = conceptualRange * DISPLACEMENT_SCALING_FACTOR;

    const uniforms = {
      uLandColor: { value: new THREE.Color(planet.landColor || '#556B2F') }, // Dark Olive Green
      uWaterColor: { value: new THREE.Color(planet.waterColor || '#1E90FF') }, // Dodger Blue
      uOceanHeightLevel: { value: normalizedOceanLevel },
      uContinentSeed: { value: planet.continentSeed ?? Math.random() },
      uTime: { value: 0.0 },
      uSphereRadius: { value: SPHERE_BASE_RADIUS },
      uDisplacementAmount: { value: displacementAmount }
    };

    threeShaderMaterial = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: finalVertexShader,
      fragmentShader: planetFragmentShader,
    });

    threePlanetMesh = new THREE.Mesh(geometry, threeShaderMaterial);
    threeScene.add(threePlanetMesh);

    threeControls = new OrbitControls(threeCamera, threeRenderer.domElement);
    threeControls.enableDamping = true;
    threeControls.dampingFactor = 0.05;
    threeControls.screenSpacePanning = false;
    threeControls.minDistance = SPHERE_BASE_RADIUS * 1.05;
    threeControls.maxDistance = SPHERE_BASE_RADIUS * 7;
    threeControls.target.set(0, 0, 0);

    _animateThreeJSView();
  }

  function _animateThreeJSView() {
    if (!is360ViewActive || !threeRenderer) return;
    threeAnimationId = requestAnimationFrame(_animateThreeJSView);
    if (threeShaderMaterial?.uniforms.uTime) {
      threeShaderMaterial.uniforms.uTime.value += 0.005;
    }
    if (threeControls) threeControls.update();
    if (threeRenderer && threeScene && threeCamera) threeRenderer.render(threeScene, threeCamera);
  }

  function _stopAndCleanupThreeJSView() {
    // This function remains the same
    if (threeAnimationId) cancelAnimationFrame(threeAnimationId);
    threeAnimationId = null;
    if (threeControls) threeControls.dispose();
    threeControls = null;
    if (threePlanetMesh) {
      if (threePlanetMesh.geometry) threePlanetMesh.geometry.dispose();
      if (threeShaderMaterial) threeShaderMaterial.dispose();
      if (threeScene) threeScene.remove(threePlanetMesh);
      threePlanetMesh = null;
      threeShaderMaterial = null;
    }
    if (threeScene) {
      while(threeScene.children.length > 0){ 
        threeScene.remove(threeScene.children[0]);
      }
    }
    if (threeRenderer) {
      threeRenderer.dispose();
      threeRenderer = null;
    }
    threeScene = null;
    threeCamera = null;
  }
   
  function _closePanel() {
    // This function remains the same
    if (panelElement) panelElement.classList.remove('visible');
    is360ViewActive = false;
    _stopAndCleanupThreeJSView();
    if (planet360CanvasElement) planet360CanvasElement.style.display = 'none';
  }

  // --- Public API ---
  return {
    init,
    show,
    hide: _closePanel,
    isVisible: () => panelElement?.classList.contains('visible'),
    getCurrentPlanetData: () => currentPlanetData,
  };
})();
