// public/js/planetDesigner.js
import '../styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { getPlanetShaders } from './shaders.js';

export const PlanetDesigner = (() => {
  // --- CACHED DOM ELEMENTS ---
  let savedDesignsUl, designerPlanetCanvas, designerWaterColorInput, designerLandColorInput, designerMinHeightInput, designerMaxHeightInput, designerOceanHeightInput,
    designerSaveBtn, designerCancelBtn, designerRiverBasinInput, designerRiverBasinValue,
    designerForestDensityInput, designerForestDensityValue, designerRandomizeBtn, boundResizeHandler;

  // --- THREE.JS & STATE VARIABLES ---
  const DISPLACEMENT_SCALING_FACTOR = 0.005;
  const SPHERE_BASE_RADIUS = 0.8;

  let currentDesignerBasis = {
    waterColor: '#1E90FF', landColor: '#556B2F', continentSeed: Math.random(),
    riverBasin: 0.05, forestDensity: 0.5,
    minTerrainHeight: 0.0, maxTerrainHeight: 10.0, oceanHeightLevel: 1.0
  };

  let designerThreeScene, designerThreeCamera, designerThreeRenderer,
    designerThreePlanetMesh, designerThreeControls, designerThreeAnimationId, designerShaderMaterial;

  // This is the named function that will handle resize events.
  function _onDesignerResize() {
    if (designerThreeRenderer && document.getElementById('planet-designer-screen')?.classList.contains('active')) {
      const newWidth = designerPlanetCanvas.offsetWidth;
      const newHeight = designerPlanetCanvas.offsetHeight;
      if (newWidth > 0 && newHeight > 0) {
        designerThreeCamera.aspect = newWidth / newHeight;
        designerThreeCamera.updateProjectionMatrix();
        designerThreeRenderer.setSize(newWidth, newHeight);
      }
    }
  }

  // --- THREE.JS INITIALIZATION & CLEANUP ---
  function _initDesignerThreeJSView() {
    if (!designerPlanetCanvas) return;
    
    const { vertexShader, fragmentShader } = getPlanetShaders();

    designerThreeScene = new THREE.Scene();
    designerThreeScene.background = new THREE.Color(0x1a1a2a);
    designerThreeCamera = new THREE.PerspectiveCamera(60, designerPlanetCanvas.offsetWidth / designerPlanetCanvas.offsetHeight, 0.001, 100);
    designerThreeCamera.position.z = 2.5;

    designerThreeRenderer = new THREE.WebGLRenderer({ canvas: designerPlanetCanvas, antialias: true });
    designerThreeRenderer.setSize(designerPlanetCanvas.offsetWidth, designerPlanetCanvas.offsetHeight);
    designerThreeRenderer.setPixelRatio(window.devicePixelRatio);
    
    const geometry = new THREE.SphereGeometry(SPHERE_BASE_RADIUS, 128, 64); // Reduced poly count for performance

    const uniforms = {
      uLandColor: { value: new THREE.Color() }, uWaterColor: { value: new THREE.Color() },
      uOceanHeightLevel: { value: 0.5 }, uContinentSeed: { value: Math.random() },
      uRiverBasin: { value: 0.05 }, uForestDensity: { value: 0.5 },
      uTime: { value: 0.0 }, uSphereRadius: { value: SPHERE_BASE_RADIUS },
      uDisplacementAmount: { value: 0.0 }
    };
    
    designerShaderMaterial = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader
    });
    
    designerThreePlanetMesh = new THREE.Mesh(geometry, designerShaderMaterial);
    designerThreeScene.add(designerThreePlanetMesh);

    designerThreeControls = new OrbitControls(designerThreeCamera, designerThreeRenderer.domElement);
    designerThreeControls.enableDamping = true;
    designerThreeControls.dampingFactor = 0.1;
    designerThreeControls.rotateSpeed = 0.5;
    designerThreeControls.minDistance = 0.9;
    designerThreeControls.maxDistance = 4;

    _animateDesignerThreeJSView();
  }

  function _animateDesignerThreeJSView() {
    if (!designerThreeRenderer) return;
    designerThreeAnimationId = requestAnimationFrame(_animateDesignerThreeJSView);
    if (designerShaderMaterial?.uniforms.uTime) designerShaderMaterial.uniforms.uTime.value += 0.015;
    if (designerThreeControls) designerThreeControls.update();
    if (designerThreeScene && designerThreeCamera) designerThreeRenderer.render(designerThreeScene, designerThreeCamera);
  }

  function _stopAndCleanupDesignerThreeJSView() {
    if (designerThreeAnimationId) cancelAnimationFrame(designerThreeAnimationId);
    if (designerThreeControls) designerThreeControls.dispose();
    if (designerShaderMaterial) designerShaderMaterial.dispose();
    if (designerThreePlanetMesh) {
      if(designerThreePlanetMesh.geometry) designerThreePlanetMesh.geometry.dispose();
      if(designerThreeScene) designerThreeScene.remove(designerThreePlanetMesh);
    }
    if (designerThreeRenderer) designerThreeRenderer.dispose();
    designerThreeAnimationId = null; designerThreeControls = null; designerShaderMaterial = null;
    designerThreePlanetMesh = null; designerThreeRenderer = null; designerThreeScene = null; designerThreeCamera = null;
  }

  // --- DATA FLOW & UI LOGIC ---

  // Refactored input handler. It only has one job: update the basis object.
  function _handleControlChange(event) {
    const input = event.target;
    // Update the central 'currentDesignerBasis' object from the UI
    switch (input.id) {
        case 'designer-water-color':
            currentDesignerBasis.waterColor = input.value;
            break;
        case 'designer-land-color':
            currentDesignerBasis.landColor = input.value;
            break;
        case 'designer-river-basin':
            const riverBasin = parseFloat(input.value);
            currentDesignerBasis.riverBasin = riverBasin;
            designerRiverBasinValue.textContent = riverBasin.toFixed(2);
            break;
        case 'designer-forest-density':
            const forestDensity = parseFloat(input.value);
            currentDesignerBasis.forestDensity = forestDensity;
            designerForestDensityValue.textContent = forestDensity.toFixed(2);
            break;
        case 'designer-min-height':
            currentDesignerBasis.minTerrainHeight = parseFloat(input.value);
            break;
        case 'designer-max-height':
            currentDesignerBasis.maxTerrainHeight = parseFloat(input.value);
            break;
        case 'designer-ocean-height':
            currentDesignerBasis.oceanHeightLevel = parseFloat(input.value);
            break;
    }
    // After any height changes, ensure ocean level is valid
    const { minTerrainHeight, maxTerrainHeight, oceanHeightLevel } = currentDesignerBasis;
    currentDesignerBasis.oceanHeightLevel = Math.max(minTerrainHeight, Math.min(maxTerrainHeight, oceanHeightLevel));

    // Now, trigger a refresh of the 3D view from the updated basis
    _refreshDesignerPreview();
  }

  /**
   * Refreshed function. Reads ONLY from the 'currentDesignerBasis' object (the single source of truth)
   * and updates the shader uniforms accordingly.
   */
  function _refreshDesignerPreview() {
    if (!designerShaderMaterial) return;

    // Read values from the basis object
    const {
        waterColor, landColor, continentSeed, riverBasin, forestDensity,
        minTerrainHeight, maxTerrainHeight, oceanHeightLevel
    } = currentDesignerBasis;

    // Normalize height values for the shader
    const terrainRange = Math.max(0.1, maxTerrainHeight - minTerrainHeight);
    const normalizedOceanLevel = (oceanHeightLevel - minTerrainHeight) / terrainRange;

    // Set all shader uniforms
    const uniforms = designerShaderMaterial.uniforms;
    uniforms.uWaterColor.value.set(waterColor);
    uniforms.uLandColor.value.set(landColor);
    uniforms.uContinentSeed.value = continentSeed;
    uniforms.uRiverBasin.value = riverBasin;
    uniforms.uForestDensity.value = forestDensity;
    uniforms.uOceanHeightLevel.value = Math.max(0.0, Math.min(1.0, normalizedOceanLevel));

    const displacementAmount = terrainRange * DISPLACEMENT_SCALING_FACTOR;
    uniforms.uDisplacementAmount.value = displacementAmount;
  }
  
  function _populateDesignerInputsFromBasis() {
    if (!designerWaterColorInput) return;
    const basis = currentDesignerBasis;
    designerWaterColorInput.value = basis.waterColor;
    designerLandColorInput.value = basis.landColor;
    designerRiverBasinInput.value = basis.riverBasin;
    designerRiverBasinValue.textContent = Number(basis.riverBasin).toFixed(2);
    designerForestDensityInput.value = basis.forestDensity;
    designerForestDensityValue.textContent = Number(basis.forestDensity).toFixed(2);
    designerMinHeightInput.value = basis.minTerrainHeight;
    designerMaxHeightInput.value = basis.maxTerrainHeight;
    designerOceanHeightInput.value = basis.oceanHeightLevel;
  }
  
  function _randomizeDesignerPlanet() {
    function _getRandomHexColor() { return '#' + (Math.random() * 0xFFFFFF | 0).toString(16).padStart(6, '0'); }
    function _getRandomFloat(min, max, p = 1) { const f = Math.pow(10, p); return parseFloat((Math.random() * (max - min) + min).toFixed(p)); }
    
    const minH = _getRandomFloat(0.0, 4.0);
    const maxH = _getRandomFloat(minH + 1.0, minH + 10.0);
    
    currentDesignerBasis = {
        waterColor: _getRandomHexColor(),
        landColor: _getRandomHexColor(),
        continentSeed: Math.random(),
        riverBasin: _getRandomFloat(0.01, 0.15, 2),
        forestDensity: _getRandomFloat(0.1, 0.9, 2),
        minTerrainHeight: minH,
        maxTerrainHeight: maxH,
        oceanHeightLevel: _getRandomFloat(minH, maxH)
    };
    
    _populateDesignerInputsFromBasis();
    _refreshDesignerPreview();
  }

  // --- PERSISTENCE LOGIC (Save/Load/Delete) ---
  // (These functions are mostly unchanged but included for completeness)

  function _generateUUID() { /* ... */ }
  function _saveCustomPlanetDesign() { /* ... */ }
  function _loadAndPreviewDesign(designId) {
    const designToLoad = window.gameSessionData?.customPlanetDesigns?.find(d => d.designId === designId);
    if (designToLoad) {
        // Create a a clean copy and ensure defaults for older saves
        const newBasis = { ...designToLoad };
        newBasis.riverBasin = newBasis.riverBasin ?? 0.05;
        newBasis.forestDensity = newBasis.forestDensity ?? 0.5;
        delete newBasis.designId;
        delete newBasis.designName;
        currentDesignerBasis = newBasis;
        
        _populateDesignerInputsFromBasis();
        _refreshDesignerPreview();
    }
  }
  function _deleteCustomPlanetDesign(designId) { /* ... */ }
  function _populateSavedDesignsList() { /* ... */ }


  // =======================================================================
  //  PUBLIC API
  // =======================================================================

  return {
    init: () => {
      // --- CACHE ALL DOM ELEMENTS ONCE ---
      designerPlanetCanvas = document.getElementById('designer-planet-canvas');
      designerWaterColorInput = document.getElementById('designer-water-color');
      designerLandColorInput = document.getElementById('designer-land-color');
      designerRiverBasinInput = document.getElementById('designer-river-basin');
      designerRiverBasinValue = document.getElementById('designer-river-basin-value');
      designerForestDensityInput = document.getElementById('designer-forest-density');
      designerForestDensityValue = document.getElementById('designer-forest-density-value');
      designerMinHeightInput = document.getElementById('designer-min-height');
      designerMaxHeightInput = document.getElementById('designer-max-height');
      designerOceanHeightInput = document.getElementById('designer-ocean-height');
      savedDesignsUl = document.getElementById('saved-designs-ul');
      designerRandomizeBtn = document.getElementById('designer-randomize-btn');
      designerSaveBtn = document.getElementById('designer-save-btn');
      designerCancelBtn = document.getElementById('designer-cancel-btn');

      // --- ATTACH EVENT LISTENERS ---

      // Listen for any change on any control
      document.querySelectorAll('.designer-control').forEach(input => {
        input.addEventListener('input', _handleControlChange);
      });
      
      // Attach other button listeners
      designerRandomizeBtn?.addEventListener('click', _randomizeDesignerPlanet);
      designerSaveBtn?.addEventListener('click', _saveCustomPlanetDesign);
      
      designerCancelBtn?.addEventListener('click', () => {
        PlanetDesigner.deactivate();
        // A placeholder for a more robust back navigation
        if (window.history.length > 1) {
            window.history.back();
        } else if (window.switchToMainView) {
            window.switchToMainView();
        }
      });

      // Use event delegation for the saved designs list
      savedDesignsUl?.addEventListener('click', (e) => {
        const targetButton = e.target.closest('button');
        if (!targetButton) return;

        const id = targetButton.dataset.id;
        if (!id) return;

        if (targetButton.classList.contains('design-item-load')) {
            _loadAndPreviewDesign(id);
        } else if (targetButton.classList.contains('design-item-delete')) {
          if (confirm("Are you sure you want to delete this planet design?")) {
            _deleteCustomPlanetDesign(id);
          }
        }
      });
      
      // Bind the resize handler only once and store the reference
      boundResizeHandler = _onDesignerResize.bind(this);
      window.addEventListener('resize', boundResizeHandler);
    },

    activate: () => {
      console.log("PlanetDesigner.activate called.");
      _populateDesignerInputsFromBasis();
      _populateSavedDesignsList();
      
      // Using requestAnimationFrame ensures the canvas is visible and has dimensions before initializing WebGL
      requestAnimationFrame(() => {
        _stopAndCleanupDesignerThreeJSView(); // Clean up any previous instance first
        _initDesignerThreeJSView();
        _refreshDesignerPreview(); // Initial setup of the planet view
      });
    },

    deactivate: () => {
        console.log("PlanetDesigner.deactivate called for cleanup.");
        _stopAndCleanupDesignerThreeJSView();
        // Remove the specific resize listener to prevent memory leaks
        if (boundResizeHandler) {
            window.removeEventListener('resize', boundResizeHandler);
            boundResizeHandler = null; // Clear the reference for garbage collection
        }
    }
  };
})();
