// public/js/planetDesigner.js
import '../styles.css'; // Keep for overall styling if needed
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Re-use or adapt shaders from PlanetVisualPanelManager (or define them here if they diverge)
// For consistency, let's assume we can use the same basic ones for now.
// In a larger setup, you might have a shared shader module.
const planetVertexShader = `
  varying vec3 vNormal;
  varying vec2 vUv;

  void main() {
    vNormal = normal;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const planetFragmentShader = `
  uniform vec3 uDisplayColor;
  uniform float uTime;
  varying vec3 vNormal;
  varying vec2 vUv;

  void main() {
    vec3 lightDirection = normalize(vec3(1.0, 1.0, 1.0));
    float lightIntensity = max(0.0, dot(normalize(vNormal), lightDirection)) * 0.7 + 0.3;
    gl_FragColor = vec4(uDisplayColor * lightIntensity, 1.0);
  }
`;


export const PlanetDesigner = (() => {
  console.log("PlanetDesigner.js: Script loaded.");

  // DOM Elements
  let designerPlanetCanvas, designerWaterColorInput, designerLandColorInput,
      designerMinHeightMinInput, designerMinHeightMaxInput,
      designerMaxHeightMinInput, designerMaxHeightMaxInput,
      designerOceanHeightMinInput, designerOceanHeightMaxInput,
      savedDesignsUl, designerRandomizeBtn, designerSaveBtn, designerCancelBtn;
      // planetDesignerScreenElement is not directly used in rendering, remove if not needed elsewhere

  // State for Designer Basis
  let currentDesignerBasis = {
    waterColor: '#000080',
    landColor: '#006400',
    continentSeed: Math.random(), // Still useful for when you implement procedural shaders
    minTerrainHeightRange: [0.0, 2.0],
    maxTerrainHeightRange: [8.0, 12.0],
    oceanHeightRange: [1.0, 3.0]
  };

  // Three.js State for Designer Preview
  let designerThreeScene, designerThreeCamera, designerThreeRenderer,
      designerThreePlanetMesh, designerThreeControls, designerThreeAnimationId,
      designerShaderMaterial;

  // No longer needed:
  // let currentDesignerPlanetInstance = null; // This was for the worker
  // let isRenderingDesignerPlanet = false; // This was for 2D canvas worker pipeline

  // Mouse dragging state for Three.js OrbitControls (handled by OrbitControls itself)
  // We still need legacy mouse drag variables if OrbitControls are disabled for some reason
  // or if we implement custom drag outside of orbit controls. For now, OrbitControls handles it.
  // let designerPlanetRotationQuat = [1, 0, 0, 0]; // If needed without OrbitControls
  // let startDragDesignerPlanetQuat = [1, 0, 0, 0];
  // let designerStartDragMouseX = 0;
  // let designerStartDragMouseY = 0;
  // let isDraggingDesignerPlanet = false;


  // --- THREE.JS SETUP FOR DESIGNER PREVIEW ---
  function _initDesignerThreeJSView() {
    if (!designerPlanetCanvas) {
        console.error("PlanetDesigner: Designer canvas not found for Three.js init.");
        return;
    }
    console.log("PlanetDesigner: Initializing Three.js view.");

    // 1. Scene
    designerThreeScene = new THREE.Scene();
    designerThreeScene.background = new THREE.Color(0x1a1a2a); // Slightly different background for designer

    // 2. Camera - Ensure canvas has dimensions
    if(designerPlanetCanvas.offsetWidth === 0 || designerPlanetCanvas.offsetHeight === 0){
        console.warn("PlanetDesigner: Designer canvas has no dimensions yet for Three.js camera. Using defaults.");
        designerPlanetCanvas.width = designerPlanetCanvas.width || 300; // Fallback if CSS hasn't sized it
        designerPlanetCanvas.height = designerPlanetCanvas.height || 300;
    }
    const aspectRatio = designerPlanetCanvas.offsetWidth / designerPlanetCanvas.offsetHeight;
    designerThreeCamera = new THREE.PerspectiveCamera(60, aspectRatio, 0.1, 100);
    designerThreeCamera.position.z = 1.8; // Closer for smaller designer preview

    // 3. Renderer
    designerThreeRenderer = new THREE.WebGLRenderer({ canvas: designerPlanetCanvas, antialias: true });
    designerThreeRenderer.setSize(designerPlanetCanvas.offsetWidth, designerPlanetCanvas.offsetHeight);
    designerThreeRenderer.setPixelRatio(window.devicePixelRatio);

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    designerThreeScene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight.position.set(2, 2, 3);
    designerThreeScene.add(directionalLight);

    // 5. Planet Geometry
    const geometry = new THREE.SphereGeometry(0.8, 48, 24); // Slightly less segments for designer

    // 6. Shader Material (initially based on currentDesignerBasis)
    const uniforms = {
      uDisplayColor: { value: new THREE.Color(currentDesignerBasis.landColor) },
      uTime: { value: 0.0 },
      // TODO: Add waterColor, seed, height uniforms here
      // uWaterColor: {value: new THREE.Color(currentDesignerBasis.waterColor)},
      // uOceanHeight: {value: (currentDesignerBasis.oceanHeightRange[0] + currentDesignerBasis.oceanHeightRange[1]) / 2}, // Example: average
      // uContinentSeed: {value: currentDesignerBasis.continentSeed},
    };

    designerShaderMaterial = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: planetVertexShader,
      fragmentShader: planetFragmentShader,
    });

    designerThreePlanetMesh = new THREE.Mesh(geometry, designerShaderMaterial);
    designerThreeScene.add(designerThreePlanetMesh);

    // 7. Controls
    designerThreeControls = new OrbitControls(designerThreeCamera, designerThreeRenderer.domElement);
    designerThreeControls.enableDamping = true;
    designerThreeControls.dampingFactor = 0.1;
    designerThreeControls.screenSpacePanning = false;
    designerThreeControls.minDistance = 1;
    designerThreeControls.maxDistance = 4;
    designerThreeControls.target.set(0,0,0);
    designerThreeControls.enableZoom = true; // Allow zoom in designer

    _animateDesignerThreeJSView();
  }

  function _animateDesignerThreeJSView() {
    if (!designerThreeRenderer) return; // Stop if not initialized / cleaned up
    designerThreeAnimationId = requestAnimationFrame(_animateDesignerThreeJSView);

    if (designerShaderMaterial && designerShaderMaterial.uniforms.uTime) {
      designerShaderMaterial.uniforms.uTime.value += 0.015; // Slightly faster for preview
    }
    if(designerThreeControls) designerThreeControls.update();
    if(designerThreeScene && designerThreeCamera) {
        designerThreeRenderer.render(designerThreeScene, designerThreeCamera);
    }
  }

  function _stopAndCleanupDesignerThreeJSView() {
    if (designerThreeAnimationId) {
      cancelAnimationFrame(designerThreeAnimationId);
      designerThreeAnimationId = null;
    }
    if (designerThreeControls) {
      designerThreeControls.dispose();
      designerThreeControls = null;
    }
    if (designerThreePlanetMesh) {
      if(designerThreePlanetMesh.geometry) designerThreePlanetMesh.geometry.dispose();
      if(designerShaderMaterial) designerShaderMaterial.dispose();
      if(designerThreeScene) designerThreeScene.remove(designerThreePlanetMesh);
      designerThreePlanetMesh = null;
      designerShaderMaterial = null;
    }
     if (designerThreeScene) {
        const toRemove = [];
        designerThreeScene.traverse(child => {
            if (child.isLight) toRemove.push(child);
        });
        toRemove.forEach(obj => designerThreeScene.remove(obj));
    }
    if (designerThreeRenderer) {
      designerThreeRenderer.dispose();
      designerThreeRenderer = null;
    }
    designerThreeScene = null;
    designerThreeCamera = null;
  }

  // --- UI AND BASIS MANAGEMENT ---
  function _populateDesignerInputsFromBasis() {
    if (!designerWaterColorInput) return; // Check if DOM elements are ready
    designerWaterColorInput.value = currentDesignerBasis.waterColor;
    designerLandColorInput.value = currentDesignerBasis.landColor;
    designerMinHeightMinInput.value = currentDesignerBasis.minTerrainHeightRange[0].toFixed(1);
    designerMinHeightMaxInput.value = currentDesignerBasis.minTerrainHeightRange[1].toFixed(1);
    designerMaxHeightMinInput.value = currentDesignerBasis.maxTerrainHeightRange[0].toFixed(1);
    designerMaxHeightMaxInput.value = currentDesignerBasis.maxTerrainHeightRange[1].toFixed(1);
    designerOceanHeightMinInput.value = currentDesignerBasis.oceanHeightRange[0].toFixed(1);
    designerOceanHeightMaxInput.value = currentDesignerBasis.oceanHeightRange[1].toFixed(1);
  }

  function _updateBasisAndRefreshDesignerPreview() {
    if (!designerWaterColorInput) return; // Ensure elements are queried

    currentDesignerBasis.waterColor = designerWaterColorInput.value;
    currentDesignerBasis.landColor = designerLandColorInput.value;
    // ... (parse float values for height ranges as before) ...
    let minH_min = parseFloat(designerMinHeightMinInput.value) || 0.0;
    let minH_max = parseFloat(designerMinHeightMaxInput.value) || 0.0;
    let maxH_min = parseFloat(designerMaxHeightMinInput.value) || 0.0;
    let maxH_max = parseFloat(designerMaxHeightMaxInput.value) || 0.0;
    let oceanH_min = parseFloat(designerOceanHeightMinInput.value) || 0.0;
    let oceanH_max = parseFloat(designerOceanHeightMaxInput.value) || 0.0;

    if (minH_min > minH_max) [minH_min, minH_max] = [minH_max, minH_min];
    if (maxH_min > maxH_max) [maxH_min, maxH_max] = [maxH_max, maxH_min];
    if (oceanH_min > oceanH_max) [oceanH_min, oceanH_max] = [oceanH_max, oceanH_min];

    currentDesignerBasis.minTerrainHeightRange = [minH_min, minH_max];
    currentDesignerBasis.maxTerrainHeightRange = [maxH_min, maxH_max];
    currentDesignerBasis.oceanHeightRange = [oceanH_min, oceanH_max];
    currentDesignerBasis.continentSeed = parseFloat(document.getElementById('designer-continent-seed')?.value || Math.random()); // Example if you add a seed input

    _populateDesignerInputsFromBasis(); // Update inputs if validation changed them

    // Update Three.js material uniforms
    if (designerShaderMaterial) {
      designerShaderMaterial.uniforms.uDisplayColor.value.set(currentDesignerBasis.landColor);
      // TODO: Update other uniforms (waterColor, seed, heights) when shader supports them
      // designerShaderMaterial.uniforms.uWaterColor.value.set(currentDesignerBasis.waterColor);
      // designerShaderMaterial.uniforms.uContinentSeed.value = currentDesignerBasis.continentSeed;
    }
    // No explicit call to re-render is needed with requestAnimationFrame loop if scene objects change.
    // If OrbitControls were not used, you would call designerThreeRenderer.render(...) here.
  }

  function _randomizeDesignerPlanet() {
    // ... (logic for randomizing currentDesignerBasis remains largely the same) ...
    currentDesignerBasis.waterColor = _getRandomHexColor();
    currentDesignerBasis.landColor = _getRandomHexColor();
    currentDesignerBasis.continentSeed = Math.random();
    // ... set random height ranges ...

    _populateDesignerInputsFromBasis();
    _updateBasisAndRefreshDesignerPreview(); // This will update the Three.js material
  }

  // --- SAVED DESIGNS MANAGEMENT (largely unchanged, as it deals with basis data) ---
  function _generateUUID() { /* ... as before ... */ return crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==='x'?r:(r&3|8);return v.toString(16)})}
  function _getRandomHexColor() { /* ... as before ... */return'#'+(Math.random()*0xFFFFFF|0).toString(16).padStart(6,'0')}
  function _getRandomFloat(min,max,precision=1){ /* ... as before ... */const factor=Math.pow(10,precision);return parseFloat((Math.random()*(max-min)+min).toFixed(precision))}

  function _saveCustomPlanetDesign() { /* ... as before ... */
    const designName = prompt("Enter a name for this planet design:", "My Custom Planet");
    if (!designName?.trim()) return;
    const newDesign = { designId: _generateUUID(), designName: designName.trim(), ...JSON.parse(JSON.stringify(currentDesignerBasis)) };
    if (window.gameSessionData?.customPlanetDesigns) {
        window.gameSessionData.customPlanetDesigns.push(newDesign);
        if (typeof window.saveGameState === 'function') window.saveGameState();
        _populateSavedDesignsList();
    }
  }

  function _loadAndPreviewDesign(designId) { /* ... as before, but updates currentDesignerBasis and then calls _updateBasisAndRefreshDesignerPreview ... */
    const designToLoad = window.gameSessionData?.customPlanetDesigns?.find(d => d.designId === designId);
    if (designToLoad) {
        currentDesignerBasis = { ...JSON.parse(JSON.stringify(designToLoad)) };
        delete currentDesignerBasis.designId; // Not part of the 'renderable' basis
        delete currentDesignerBasis.designName;
        _populateDesignerInputsFromBasis();
        _updateBasisAndRefreshDesignerPreview(); // This will update the Three.js material
    }
  }
  function _deleteCustomPlanetDesign(designId) { /* ... as before ... */
    if (window.gameSessionData?.customPlanetDesigns) {
        const initialLength = window.gameSessionData.customPlanetDesigns.length;
        window.gameSessionData.customPlanetDesigns = window.gameSessionData.customPlanetDesigns.filter(d => d.designId !== designId);
        if (window.gameSessionData.customPlanetDesigns.length < initialLength) {
            if (typeof window.saveGameState === 'function') window.saveGameState();
            _populateSavedDesignsList();
        }
    }
  }
  function _populateSavedDesignsList() { /* ... as before ... */
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

  // --- CANVAS AND RENDERING (OBSOLETE 2D Parts) ---
  // _resizeDesignerCanvasToDisplaySize() // OBSOLETE for Three.js (renderer.setSize handles it)
  // _renderDesignerPlanetInternal()      // OBSOLETE (replaced by _animateDesignerThreeJSView)
  // _generateAndRenderDesignerPreviewInstance() // OBSOLETE (logic merged into activate and UI updates)


  // --- MOUSE EVENT HANDLERS (OBSOLETE if using OrbitControls exclusively) ---
  // _onDesignerCanvasMouseDown(e)
  // _onWindowMouseMove(e)
  // _onWindowMouseUp()
  // If you need specific click interactions on the planet *besides* orbit controls,
  // you'll use Three.js Raycaster.

  return {
    init: () => {
      designerPlanetCanvas = document.getElementById('designer-planet-canvas');
      designerWaterColorInput = document.getElementById('designer-water-color');
      designerLandColorInput = document.getElementById('designer-land-color');
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
      // planetDesignerScreenElement = document.getElementById('planet-designer-screen'); // Not used directly

      // Initialize defaults based on globals (could be hardcoded or from config)
      currentDesignerBasis.minTerrainHeightRange = [window.DEFAULT_MIN_TERRAIN_HEIGHT || 0.0, (window.DEFAULT_MIN_TERRAIN_HEIGHT || 0.0) + 2.0];
      currentDesignerBasis.maxTerrainHeightRange = [window.DEFAULT_MAX_TERRAIN_HEIGHT || 8.0, (window.DEFAULT_MAX_TERRAIN_HEIGHT || 8.0) + 4.0];
      currentDesignerBasis.oceanHeightRange = [window.DEFAULT_OCEAN_HEIGHT_LEVEL || 1.0, (window.DEFAULT_OCEAN_HEIGHT_LEVEL || 1.0) + 2.0];

      // Event Listeners for UI controls
      const inputsToWatch = [
        designerWaterColorInput, designerLandColorInput,
        designerMinHeightMinInput, designerMinHeightMaxInput,
        designerMaxHeightMinInput, designerMaxHeightMaxInput,
        designerOceanHeightMinInput, designerOceanHeightMaxInput
      ];
      inputsToWatch.forEach(input => input?.addEventListener('change', _updateBasisAndRefreshDesignerPreview));

      designerRandomizeBtn?.addEventListener('click', _randomizeDesignerPlanet);
      designerSaveBtn?.addEventListener('click', _saveCustomPlanetDesign);
      designerCancelBtn?.addEventListener('click', () => {
        _stopAndCleanupDesignerThreeJSView(); // Stop Three.js when leaving
        if (window.switchToMainView) window.switchToMainView();
      });

      savedDesignsUl?.addEventListener('click', (e) => {
        const target = e.target;
        const id = target.dataset.id;
        if (!id) return;
        if (target.classList.contains('design-item-load')) {
          _loadAndPreviewDesign(id);
        } else if (target.classList.contains('design-item-delete')) {
          if (confirm("Are you sure you want to delete this planet design?")) {
            _deleteCustomPlanetDesign(id);
          }
        }
      });

      // Three.js Resize handler specifically for designer canvas
      window.addEventListener('resize', () => {
        if (designerThreeRenderer && designerThreeCamera && designerPlanetCanvas && 
            document.getElementById('planet-designer-screen')?.classList.contains('active')) { // Check if designer screen is active

            // Ensure canvas CSS is making it responsive before getting offsetWidth/Height
            designerPlanetCanvas.style.width = '100%'; // Assuming CSS in .designer-preview centers it
            designerPlanetCanvas.style.height = '100%';// This might be overridden by aspect-ratio in CSS

            const newWidth = designerPlanetCanvas.offsetWidth;
            const newHeight = designerPlanetCanvas.offsetHeight;

            if (newWidth > 0 && newHeight > 0) {
                designerThreeCamera.aspect = newWidth / newHeight;
                designerThreeCamera.updateProjectionMatrix();
                designerThreeRenderer.setSize(newWidth, newHeight);
            }
        }
      });


      // Old mouse listeners for 2D canvas drag are removed as OrbitControls will handle it.
      // designerPlanetCanvas?.addEventListener('mousedown', _onDesignerCanvasMouseDown);
      // window.addEventListener('mousemove', _onWindowMouseMove);
      // window.addEventListener('mouseup', _onWindowMouseUp);
    },

    activate: () => {
      console.log("PlanetDesigner.activate called.");
      if (!designerPlanetCanvas) designerPlanetCanvas = document.getElementById('designer-planet-canvas');
       _populateDesignerInputsFromBasis();
      _populateSavedDesignsList();

      // Ensure canvas has dimensions from CSS before initializing Three.js
      requestAnimationFrame(() => {
        if(designerPlanetCanvas.offsetWidth === 0 || designerPlanetCanvas.offsetHeight === 0) {
            // Fallback logic if CSS hasn't sized it, or style it explicitly.
            // This might happen if the screen is 'display:none' then 'display:flex'
            // The CSS for #designer-planet-canvas should control its size ideally.
            console.warn("PlanetDesigner: Canvas had 0 dimensions on activate. Re-checking.");
            // Optionally force a size or wait for CSS to apply.
            // For now, Three.js init will use canvas.width/height attributes or fallback.
        }
        _stopAndCleanupDesignerThreeJSView(); // Cleanup previous if any
        _initDesignerThreeJSView();
        _updateBasisAndRefreshDesignerPreview(); // Ensure material is set from current basis
      });
    },

    // This worker message handler is now OBSOLETE for the designer
    // handleDesignerWorkerMessage: ({ renderedData, width, height }) => { ... }
  };
})();
