// public/js/planetDesigner.js
import '../styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// --- SHADER DEFINITIONS ---

const glslRandom2to1 = `
float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}
`;

const glslSimpleValueNoise3D = `
$

float valueNoise(vec3 p, float seed) {
  vec3 i = floor(p + seed * 0.123);
  vec3 f = fract(p + seed * 0.123);
  f = f * f * (3.0 - 2.0 * f);

  float c000 = random(i.xy + i.z * 0.37);
  float c100 = random(i.xy + vec2(1.0, 0.0) + i.z * 0.37);
  float c010 = random(i.xy + vec2(0.0, 1.0) + i.z * 0.37);
  float c110 = random(i.xy + vec2(1.0, 1.0) + i.z * 0.37);
  float c001 = random(i.xy + (i.z + 1.0) * 0.37);
  float c101 = random(i.xy + vec2(1.0, 0.0) + (i.z + 1.0) * 0.37);
  float c011 = random(i.xy + vec2(0.0, 1.0) + (i.z + 1.0) * 0.37);
  float c111 = random(i.xy + vec2(1.0, 1.0) + (i.z + 1.0) * 0.37);

  float u00 = mix(c000, c100, f.x);
  float u01 = mix(c001, c101, f.x);
  float u10 = mix(c010, c110, f.x);
  float u11 = mix(c011, c111, f.x);
  float v0 = mix(u00, u10, f.y);
  float v1 = mix(u01, u11, f.y);
  return mix(v0, v1, f.z);
}
`;

const planetVertexShader = `
uniform float uTime;
uniform float uContinentSeed;
uniform float uSphereRadius;
uniform float uDisplacementAmount;
uniform float uContinentSharpness;

varying vec3 vNormal;
varying float vElevation;
varying vec3 vWorldPosition;

// Noise functions will be injected here
$

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

  // Generate base continent noise
  float continentNoise = (layeredNoise(noiseInputPosition, uContinentSeed, 5, 0.5, 2.0, 1.5) + 1.0) * 0.5;

  // Apply sharpness to define continent edges
  continentNoise = pow(continentNoise, uContinentSharpness);
  
  // Generate mountain details
  float mountainNoise = (layeredNoise(noiseInputPosition, uContinentSeed * 2.0, 6, 0.45, 2.2, 8.0) + 1.0) * 0.5;
  // Apply mountains primarily on the raised continent areas
  float continentMask = smoothstep(0.48, 0.52, continentNoise);
  float finalElevation = continentNoise + (mountainNoise * continentMask * 0.3);

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
uniform float uOceanHeightLevel;

varying vec3 vNormal;
varying float vElevation;
varying vec3 vWorldPosition;

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

  float seaLevel = uOceanHeightLevel;
  float deepWater = seaLevel * 0.6;
  float beachLevel = seaLevel + 0.03;
  float mountainLevel = seaLevel + 0.35;
  float snowLevel = seaLevel + 0.55;

  vec3 deepWaterColor = uWaterColor * 0.5;
  vec3 shallowWaterColor = uWaterColor;
  vec3 beachColor = vec3(0.86, 0.78, 0.59);
  vec3 plainsColor = uLandColor;
  vec3 mountainColor = uLandColor * 0.7 + vec3(0.4);
  vec3 snowColor = vec3(0.95, 0.95, 1.0);

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


export const PlanetDesigner = (() => {
  console.log("PlanetDesigner.js: Script loaded.");

  // DOM Elements
  let designerPlanetCanvas, designerWaterColorInput, designerLandColorInput,
    designerMinHeightMinInput, designerMinHeightMaxInput,
    designerMaxHeightMinInput, designerMaxHeightMaxInput,
    designerOceanHeightMinInput, designerOceanHeightMaxInput,
    savedDesignsUl, designerRandomizeBtn, designerSaveBtn, designerCancelBtn,
    designerContinentSharpnessInput, designerContinentSharpnessValue;

  // Constants
  const DISPLACEMENT_SCALING_FACTOR = 0.005;
  const SPHERE_BASE_RADIUS = 0.8;

  // State
  let currentDesignerBasis = {
    waterColor: '#1E90FF',
    landColor: '#556B2F',
    continentSeed: Math.random(),
    continentSharpness: 1.8,
    minTerrainHeightRange: [0.0, 2.0],
    maxTerrainHeightRange: [8.0, 12.0],
    oceanHeightRange: [1.0, 3.0]
  };
  
  // Three.js State
  let designerThreeScene, designerThreeCamera, designerThreeRenderer,
    designerThreePlanetMesh, designerThreeControls, designerThreeAnimationId,
    designerShaderMaterial;
    
  function _initDesignerThreeJSView() {
    if (!designerPlanetCanvas) return;

    const noiseFunctions = glslSimpleValueNoise3D.replace('$', glslRandom2to1);
    const finalVertexShader = planetVertexShader.replace('$', noiseFunctions);

    designerThreeScene = new THREE.Scene();
    designerThreeScene.background = new THREE.Color(0x1a1a2a);
    const aspectRatio = designerPlanetCanvas.offsetWidth / designerPlanetCanvas.offsetHeight;
    designerThreeCamera = new THREE.PerspectiveCamera(60, aspectRatio, 0.1, 100);
    designerThreeCamera.position.z = 1.8;

    designerThreeRenderer = new THREE.WebGLRenderer({ canvas: designerPlanetCanvas, antialias: true });
    designerThreeRenderer.setSize(designerPlanetCanvas.offsetWidth, designerPlanetCanvas.offsetHeight);
    designerThreeRenderer.setPixelRatio(window.devicePixelRatio);
    
    const geometry = new THREE.SphereGeometry(SPHERE_BASE_RADIUS, 128, 64);
    
    const uniforms = {
        uLandColor: { value: new THREE.Color() },
        uWaterColor: { value: new THREE.Color() },
        uOceanHeightLevel: { value: 0.5 },
        uContinentSeed: { value: Math.random() },
        uContinentSharpness: { value: 1.8 },
        uTime: { value: 0.0 },
        uSphereRadius: { value: SPHERE_BASE_RADIUS },
        uDisplacementAmount: { value: 0.0 }
    };

    designerShaderMaterial = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: finalVertexShader,
      fragmentShader: planetFragmentShader,
    });

    designerThreePlanetMesh = new THREE.Mesh(geometry, designerShaderMaterial);
    designerThreeScene.add(designerThreePlanetMesh);

    designerThreeControls = new OrbitControls(designerThreeCamera, designerThreeRenderer.domElement);
    designerThreeControls.enableDamping = true;
    designerThreeControls.dampingFactor = 0.1;
    designerThreeControls.minDistance = 1;
    designerThreeControls.maxDistance = 4;

    _animateDesignerThreeJSView();
  }

  function _animateDesignerThreeJSView() {
    if (!designerThreeRenderer) return;
    designerThreeAnimationId = requestAnimationFrame(_animateDesignerThreeJSView);
    if (designerShaderMaterial?.uniforms.uTime) {
      designerShaderMaterial.uniforms.uTime.value += 0.015;
    }
    if (designerThreeControls) designerThreeControls.update();
    if (designerThreeScene && designerThreeCamera) {
      designerThreeRenderer.render(designerThreeScene, designerThreeCamera);
    }
  }

  function _stopAndCleanupDesignerThreeJSView() {
    if (designerThreeAnimationId) cancelAnimationFrame(designerThreeAnimationId);
    if (designerThreeControls) designerThreeControls.dispose();
    if (designerThreePlanetMesh) {
      if(designerThreePlanetMesh.geometry) designerThreePlanetMesh.geometry.dispose();
      if(designerShaderMaterial) designerShaderMaterial.dispose();
      if(designerThreeScene) designerThreeScene.remove(designerThreePlanetMesh);
    }
    if (designerThreeRenderer) designerThreeRenderer.dispose();
    designerThreeAnimationId = null;
    designerThreeControls = null;
    designerThreeRenderer = null;
    designerThreeScene = null;
    designerThreeCamera = null;
  }

  function _populateDesignerInputsFromBasis() {
    if (!designerWaterColorInput) return;
    designerWaterColorInput.value = currentDesignerBasis.waterColor;
    designerLandColorInput.value = currentDesignerBasis.landColor;
    if(designerContinentSharpnessInput) {
        designerContinentSharpnessInput.value = currentDesignerBasis.continentSharpness;
        designerContinentSharpnessValue.textContent = Number(currentDesignerBasis.continentSharpness).toFixed(1);
    }
    designerMinHeightMinInput.value = currentDesignerBasis.minTerrainHeightRange[0].toFixed(1);
    designerMinHeightMaxInput.value = currentDesignerBasis.minTerrainHeightRange[1].toFixed(1);
    designerMaxHeightMinInput.value = currentDesignerBasis.maxTerrainHeightRange[0].toFixed(1);
    designerMaxHeightMaxInput.value = currentDesignerBasis.maxTerrainHeightRange[1].toFixed(1);
    designerOceanHeightMinInput.value = currentDesignerBasis.oceanHeightRange[0].toFixed(1);
    designerOceanHeightMaxInput.value = currentDesignerBasis.oceanHeightRange[1].toFixed(1);
  }

  function _updateBasisAndRefreshDesignerPreview() {
    if (!designerWaterColorInput || !designerShaderMaterial) return;

    // Read all values from inputs and store them in the basis object
    currentDesignerBasis.waterColor = designerWaterColorInput.value;
    currentDesignerBasis.landColor = designerLandColorInput.value;
    currentDesignerBasis.continentSharpness = parseFloat(designerContinentSharpnessInput.value);
    
    // Use the average of the ranges for the live preview
    const previewMinHeight = (parseFloat(designerMinHeightMinInput.value) + parseFloat(designerMinHeightMaxInput.value)) / 2;
    const previewMaxHeight = (parseFloat(designerMaxHeightMinInput.value) + parseFloat(designerMaxHeightMaxInput.value)) / 2;
    const previewOceanHeight = (parseFloat(designerOceanHeightMinInput.value) + parseFloat(designerOceanHeightMaxInput.value)) / 2;

    // Update all shader uniforms from the basis
    const uniforms = designerShaderMaterial.uniforms;
    uniforms.uWaterColor.value.set(currentDesignerBasis.waterColor);
    uniforms.uLandColor.value.set(currentDesignerBasis.landColor);
    uniforms.uContinentSeed.value = currentDesignerBasis.continentSeed;
    uniforms.uContinentSharpness.value = currentDesignerBasis.continentSharpness;
    
    const terrainRange = Math.max(0.1, previewMaxHeight - previewMinHeight);
    let normalizedOceanLevel = (previewOceanHeight - previewMinHeight) / terrainRange;
    normalizedOceanLevel = Math.max(0.2, Math.min(0.8, normalizedOceanLevel));
    uniforms.uOceanHeightLevel.value = normalizedOceanLevel;

    const displacementAmount = terrainRange * DISPLACEMENT_SCALING_FACTOR;
    uniforms.uDisplacementAmount.value = displacementAmount;
  }
  
  function _randomizeDesignerPlanet() {
    function _getRandomHexColor() {return'#'+(Math.random()*0xFFFFFF|0).toString(16).padStart(6,'0')}
    function _getRandomFloat(min,max,p=1){const f=Math.pow(10,p);return parseFloat((Math.random()*(max-min)+min).toFixed(p))}
    
    currentDesignerBasis.waterColor = _getRandomHexColor();
    currentDesignerBasis.landColor = _getRandomHexColor();
    currentDesignerBasis.continentSeed = Math.random();
    currentDesignerBasis.continentSharpness = _getRandomFloat(1.2, 2.8);
    
    const minH1 = _getRandomFloat(0.0, 2.0), minH2 = minH1 + _getRandomFloat(0.5, 2.0);
    currentDesignerBasis.minTerrainHeightRange = [minH1, minH2];
    const maxH1 = _getRandomFloat(6.0, 10.0), maxH2 = maxH1 + _getRandomFloat(2.0, 5.0);
    currentDesignerBasis.maxTerrainHeightRange = [maxH1, maxH2];
    const oceanH1 = _getRandomFloat(minH2, (minH2 + maxH1) / 2), oceanH2 = oceanH1 + _getRandomFloat(0.5, 2.0);
    currentDesignerBasis.oceanHeightRange = [oceanH1, oceanH2];

    _populateDesignerInputsFromBasis();
    _updateBasisAndRefreshDesignerPreview();
  }

  function _generateUUID() { return crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==='x'?r:(r&3|8);return v.toString(16)})}
  function _saveCustomPlanetDesign() { 
      const designName = prompt("Enter a name for this planet design:", "My Custom Planet");
      if (!designName?.trim()) return;
      
      // Save all properties from the basis, including the new sharpness
      const newDesign = { 
          designId: _generateUUID(), 
          designName: designName.trim(), 
          ...JSON.parse(JSON.stringify(currentDesignerBasis)) 
      };
      if (window.gameSessionData?.customPlanetDesigns) {
         window.gameSessionData.customPlanetDesigns.push(newDesign);
         if (typeof window.saveGameState === 'function') window.saveGameState();
         _populateSavedDesignsList();
      }
  }
  function _loadAndPreviewDesign(designId) {
      const designToLoad = window.gameSessionData?.customPlanetDesigns?.find(d => d.designId === designId);
      if (designToLoad) {
          // Ensure sharpness has a default value if loading an old design
          if(designToLoad.continentSharpness === undefined) designToLoad.continentSharpness = 1.8;
          currentDesignerBasis = { ...JSON.parse(JSON.stringify(designToLoad)) };
          delete currentDesignerBasis.designId;
          delete currentDesignerBasis.designName;
          _populateDesignerInputsFromBasis();
          _updateBasisAndRefreshDesignerPreview();
      }
  }
  function _deleteCustomPlanetDesign(designId) {
      if (window.gameSessionData?.customPlanetDesigns) {
          window.gameSessionData.customPlanetDesigns = window.gameSessionData.customPlanetDesigns.filter(d => d.designId !== designId);
          if (typeof window.saveGameState === 'function') window.saveGameState();
          _populateSavedDesignsList();
      }
  }
  function _populateSavedDesignsList() {
      if (!savedDesignsUl) return;
      savedDesignsUl.innerHTML = '';
      const designs = window.gameSessionData?.customPlanetDesigns;
      if (designs?.length > 0) {
          designs.forEach(design => {
            const li = document.createElement('li');
            li.innerHTML = `<span class="design-item-name">${design.designName || 'Unnamed Design'}</span> <button class="design-item-load modal-button-apply" data-id="${design.designId}">Load</button> <button class="design-item-delete" data-id="${design.designId}" title="Delete Design">&times;</button>`;
            savedDesignsUl.appendChild(li);
          });
      } else {
          savedDesignsUl.innerHTML = '<li>No saved designs yet.</li>';
      }
  }

  return {
    init: () => {
      // Get all DOM elements
      designerPlanetCanvas = document.getElementById('designer-planet-canvas');
      designerWaterColorInput = document.getElementById('designer-water-color');
      designerLandColorInput = document.getElementById('designer-land-color');
      designerContinentSharpnessInput = document.getElementById('designer-continent-sharpness');
      designerContinentSharpnessValue = document.getElementById('designer-continent-sharpness-value');
      designerMinHeightMinInput = document.getElementById('designer-min-height-min');
      designerMinHeightMaxInput = document.getElementById('designer-min-height-max');
      designerMaxHeightMinInput = document.getElementById('designer-max-height-min');
      designerMaxHeightMaxInput = document.getElementById('designer-max-height-max');
      designerOceanHeightMinInput = document.getElementById('designer-ocean-height-min');
      designerOceanHeightMaxInput = document.getElementById('designer-ocean-height-max');
      savedDesignsUl = document.getElementById('saved-designs-ul');
      designerRandomizeBtn = document.getElementById('designer-randomize-btn');
      designerSaveBtn = document.getElementById('designer-save-btn');
      designerCancelBtn = document.getElementById('designer-cancel-btn');

      // Setup event listeners
      const inputsToWatch = [
        designerWaterColorInput, designerLandColorInput,
        designerMinHeightMinInput, designerMinHeightMaxInput,
        designerMaxHeightMinInput, designerMaxHeightMaxInput,
        designerOceanHeightMinInput, designerOceanHeightMaxInput
      ];
      inputsToWatch.forEach(input => input?.addEventListener('change', _updateBasisAndRefreshDesignerPreview));
      
      // Add specific listener for the new slider
      designerContinentSharpnessInput?.addEventListener('input', () => {
          if(designerContinentSharpnessValue) {
             designerContinentSharpnessValue.textContent = Number(designerContinentSharpnessInput.value).toFixed(1);
          }
          _updateBasisAndRefreshDesignerPreview();
      });

      designerRandomizeBtn?.addEventListener('click', _randomizeDesignerPlanet);
      designerSaveBtn?.addEventListener('click', _saveCustomPlanetDesign);
      designerCancelBtn?.addEventListener('click', () => {
        _stopAndCleanupDesignerThreeJSView();
        if (window.switchToMainView) window.switchToMainView();
      });

      savedDesignsUl?.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        if (!id) return;
        if (e.target.classList.contains('design-item-load')) _loadAndPreviewDesign(id);
        else if (e.target.classList.contains('design-item-delete')) {
          if (confirm("Are you sure you want to delete this planet design?")) _deleteCustomPlanetDesign(id);
        }
      });
      
      window.addEventListener('resize', () => {
        if (designerThreeRenderer && document.getElementById('planet-designer-screen')?.classList.contains('active')) {
          const newWidth = designerPlanetCanvas.offsetWidth;
          const newHeight = designerPlanetCanvas.offsetHeight;
          if (newWidth > 0 && newHeight > 0) {
            designerThreeCamera.aspec = newWidth / newHeight;
            designerThreeCamera.updateProjectionMatrix();
            designerThreeRenderer.setSize(newWidth, newHeight);
          }
        }
      });
    },

    activate: () => {
      console.log("PlanetDesigner.activate called.");
      if (!designerPlanetCanvas) designerPlanetCanvas = document.getElementById('designer-planet-canvas');
      
      _populateDesignerInputsFromBasis();
      _populateSavedDesignsList();

      requestAnimationFrame(() => {
        _stopAndCleanupDesignerThreeJSView();
        _initDesignerThreeJSView();
        _updateBasisAndRefreshDesignerPreview();
      });
    },
  };
})();
