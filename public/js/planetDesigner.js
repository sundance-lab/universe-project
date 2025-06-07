// public/js/planetDesigner.js

// Note: It is best practice to only import CSS in your main entry script (script.js),
// but leaving this here is harmless with Parcel.
import '../styles.css';

// FIXED: Restructured to use a single, standard IIFE pattern.
// This resolves the "Unexpected end of file" syntax error.
export const PlanetDesigner = (() => {
  console.log("PlanetDesigner.js: Script loaded.");

  // DOM Elements
  let designerPlanetCanvas, designerWaterColorInput, designerLandColorInput,
    designerMinHeightMinInput, designerMinHeightMaxInput,
    designerMaxHeightMinInput, designerMaxHeightMaxInput,
    designerOceanHeightMinInput, designerOceanHeightMaxInput,
    savedDesignsUl, designerRandomizeBtn, designerSaveBtn, designerCancelBtn,
    planetDesignerScreenElement;

  // State
  let currentDesignerBasis = {
    waterColor: '#000080',
    landColor: '#006400',
    continentSeed: Math.random(),
    minTerrainHeightRange: [0.0, 2.0],
    maxTerrainHeightRange: [8.0, 12.0],
    oceanHeightRange: [1.0, 3.0]
  };
  let currentDesignerPlanetInstance = null;
  let designerPlanetRotationQuat = [1, 0, 0, 0];
  let startDragDesignerPlanetQuat = [1, 0, 0, 0];
  let designerStartDragMouseX = 0;
  let designerStartDragMouseY = 0;
  let isDraggingDesignerPlanet = false;
  let isRenderingDesignerPlanet = false;

  // --- HELPER FUNCTIONS ---
  function _generateUUID() {
    if (crypto?.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function _getRandomHexColor() {
    return '#' + (Math.random() * 0xffffff | 0).toString(16).padStart(6, '0');
  }

  function _getRandomFloat(min, max, precision = 1) {
    const factor = Math.pow(10, precision);
    return parseFloat((Math.random() * (max - min) + min).toFixed(precision));
  }

  // --- UI AND BASIS MANAGEMENT ---
  function _populateDesignerInputsFromBasis() {
    if (!designerWaterColorInput) return;
    
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
    if (!designerWaterColorInput) return;

    currentDesignerBasis.waterColor = designerWaterColorInput.value;
    currentDesignerBasis.landColor = designerLandColorInput.value;

    let minH_min = parseFloat(designerMinHeightMinInput.value) || 0.0;
    let minH_max = parseFloat(designerMinHeightMaxInput.value) || 0.0;
    let maxH_min = parseFloat(designerMaxHeightMinInput.value) || 0.0;
    let maxH_max = parseFloat(designerMaxHeightMaxInput.value) || 0.0;
    let oceanH_min = parseFloat(designerOceanHeightMinInput.value) || 0.0;
    let oceanH_max = parseFloat(designerOceanHeightMaxInput.value) || 0.0;

    // Simple range validation
    if (minH_min > minH_max) [minH_min, minH_max] = [minH_max, minH_min];
    if (maxH_min > maxH_max) [maxH_min, maxH_max] = [maxH_max, maxH_min];
    if (oceanH_min > oceanH_max) [oceanH_min, oceanH_max] = [oceanH_max, oceanH_min];

    currentDesignerBasis.minTerrainHeightRange = [minH_min, minH_max];
    currentDesignerBasis.maxTerrainHeightRange = [maxH_min, maxH_max];
    currentDesignerBasis.oceanHeightRange = [oceanH_min, oceanH_max];

    _populateDesignerInputsFromBasis();
    _generateAndRenderDesignerPreviewInstance(false);
  }

  function _randomizeDesignerPlanet() {
    currentDesignerBasis.waterColor = _getRandomHexColor();
    currentDesignerBasis.landColor = _getRandomHexColor();
    currentDesignerBasis.continentSeed = Math.random();

    let minH_min = _getRandomFloat(0.0, 1.0);
    let minH_max = _getRandomFloat(minH_min + 0.5, minH_min + 2.5);
    let oceanH_min = _getRandomFloat(minH_max + 0.1, minH_max + 1.0);
    let oceanH_max = _getRandomFloat(oceanH_min + 0.5, oceanH_min + 2.0);
    let maxH_min = _getRandomFloat(oceanH_max + 0.1, oceanH_max + 3.0);
    let maxH_max = _getRandomFloat(maxH_min + 1.0, maxH_min + 5.0);

    currentDesignerBasis.minTerrainHeightRange = [minH_min, minH_max];
    currentDesignerBasis.maxTerrainHeightRange = [maxH_min, maxH_max];
    currentDesignerBasis.oceanHeightRange = [oceanH_min, oceanH_max];

    _populateDesignerInputsFromBasis();
    _generateAndRenderDesignerPreviewInstance(true);
  }

  // --- SAVED DESIGNS MANAGEMENT ---
  function _saveCustomPlanetDesign() {
    const designName = prompt("Enter a name for this planet design:", "My Custom Planet");
    if (!designName?.trim()) return;

    const newDesign = {
      designId: _generateUUID(),
      designName: designName.trim(),
      ...JSON.parse(JSON.stringify(currentDesignerBasis))
    };

    if (window.gameSessionData?.customPlanetDesigns) {
      window.gameSessionData.customPlanetDesigns.push(newDesign);
      if (typeof window.saveGameState === 'function') {
        window.saveGameState();
      }
      _populateSavedDesignsList();
    }
  }

  function _loadAndPreviewDesign(designId) {
    const designToLoad = window.gameSessionData?.customPlanetDesigns?.find(d => d.designId === designId);
    if (designToLoad) {
      currentDesignerBasis = { ...JSON.parse(JSON.stringify(designToLoad)) };
      delete currentDesignerBasis.designId;
      delete currentDesignerBasis.designName;
      _populateDesignerInputsFromBasis();
      _generateAndRenderDesignerPreviewInstance(true);
    }
  }

  function _deleteCustomPlanetDesign(designId) {
    if (window.gameSessionData?.customPlanetDesigns) {
      const initialLength = window.gameSessionData.customPlanetDesigns.length;
      window.gameSessionData.customPlanetDesigns = window.gameSessionData.customPlanetDesigns.filter(d => d.designId !== designId);

      if (window.gameSessionData.customPlanetDesigns.length < initialLength) {
        if (typeof window.saveGameState === 'function') {
          window.saveGameState();
        }
        _populateSavedDesignsList();
      }
    }
  }

  function _populateSavedDesignsList() {
    if (!savedDesignsUl) return;
    savedDesignsUl.innerHTML = '';

    const designs = window.gameSessionData?.customPlanetDesigns;
    if (designs?.length > 0) {
      designs.forEach(design => {
        const li = document.createElement('li');
        li.innerHTML = `
          <span class="design-item-name">${design.designName || 'Unnamed Design'}</span>
          <button class="design-item-load modal-button-apply" data-id="${design.designId}">Load</button>
          <button class="design-item-delete" data-id="${design.designId}" title="Delete Design">&times;</button>
        `;
        savedDesignsUl.appendChild(li);
      });
    } else {
      savedDesignsUl.innerHTML = '<li>No saved designs yet.</li>';
    }
  }

  // --- CANVAS AND RENDERING ---
  function _resizeDesignerCanvasToDisplaySize() {
    if (!designerPlanetCanvas) return false;
    
    // Defer resize if canvas is not visible in the DOM, prevents setting size to 0
    if (designerPlanetCanvas.offsetParent === null) return false;

    const displayWidth = designerPlanetCanvas.offsetWidth;
    const displayHeight = designerPlanetCanvas.offsetHeight;

    if (displayWidth && displayHeight && (designerPlanetCanvas.width !== displayWidth || designerPlanetCanvas.height !== displayHeight)) {
      designerPlanetCanvas.width = displayWidth;
      designerPlanetCanvas.height = displayHeight;
    }
    return designerPlanetCanvas.width > 0 && designerPlanetCanvas.height > 0;
  }

  function _renderDesignerPlanetInternal() {
    if (isRenderingDesignerPlanet || !window.designerWorker || !currentDesignerPlanetInstance || !designerPlanetCanvas) {
      return;
    }

    if (!_resizeDesignerCanvasToDisplaySize()) {
      requestAnimationFrame(_renderDesignerPlanetInternal);
      return;
    }

    isRenderingDesignerPlanet = true;
    window.renderPlanetVisual(currentDesignerPlanetInstance, designerPlanetRotationQuat, designerPlanetCanvas);
  }

  function _generateAndRenderDesignerPreviewInstance(resetRotation = false) {
    if (typeof window.generatePlanetInstanceFromBasis !== 'function' || typeof window.quat_identity !== 'function') {
      console.error("PlanetDesigner: Required global functions (generatePlanetInstanceFromBasis, quat_identity) not found!");
      return;
    }
    currentDesignerPlanetInstance = window.generatePlanetInstanceFromBasis(currentDesignerBasis, true);
    if (resetRotation) {
      designerPlanetRotationQuat = window.quat_identity();
    }
    _renderDesignerPlanetInternal();
  }

  // --- MOUSE EVENT HANDLERS ---
  function _onDesignerCanvasMouseDown(e) {
    if (e.button !== 0 || !currentDesignerPlanetInstance) return;
    isDraggingDesignerPlanet = true;
    startDragDesignerPlanetQuat = [...designerPlanetRotationQuat];
    designerStartDragMouseX = e.clientX;
    designerStartDragMouseY = e.clientY;
    designerPlanetCanvas.classList.add('dragging');
    e.preventDefault();
  }

  function _onWindowMouseMove(e) {
    if (!isDraggingDesignerPlanet) return;
    
    const canvasEffectiveWidth = designerPlanetCanvas.width || 1;
    const deltaX = e.clientX - designerStartDragMouseX;
    const deltaY = e.clientY - designerStartDragMouseY;
    const rotationSensitivity = window.PLANET_ROTATION_SENSITIVITY || 0.75;
    
    const rotationAroundX = (deltaY / canvasEffectiveWidth) * Math.PI * rotationSensitivity;
    const rotationAroundY = (deltaX / canvasEffectiveWidth) * (2 * Math.PI) * rotationSensitivity;

    const xAxisRotationQuat = window.quat_from_axis_angle([1, 0, 0], -rotationAroundX);
    const yAxisRotationQuat = window.quat_from_axis_angle([0, 1, 0], rotationAroundY);
    const incrementalRotationQuat = window.quat_multiply(yAxisRotationQuat, xAxisRotationQuat);
    
    designerPlanetRotationQuat = window.quat_normalize(window.quat_multiply(incrementalRotationQuat, startDragDesignerPlanetQuat));
    _renderDesignerPlanetInternal();
  }

  function _onWindowMouseUp() {
    if (isDraggingDesignerPlanet) {
      isDraggingDesignerPlanet = false;
      designerPlanetCanvas.classList.remove('dragging');
    }
  }
  
  // --- PUBLIC API ---
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
      planetDesignerScreenElement = document.getElementById('planet-designer-screen');

      // Initialize defaults based on globals
      currentDesignerBasis.minTerrainHeightRange = [window.DEFAULT_MIN_TERRAIN_HEIGHT, window.DEFAULT_MIN_TERRAIN_HEIGHT + 2.0];
      currentDesignerBasis.maxTerrainHeightRange = [window.DEFAULT_MAX_TERRAIN_HEIGHT, window.DEFAULT_MAX_TERRAIN_HEIGHT + 4.0];
      currentDesignerBasis.oceanHeightRange = [window.DEFAULT_OCEAN_HEIGHT_LEVEL, window.DEFAULT_OCEAN_HEIGHT_LEVEL + 2.0];
      
      // Event Listeners
      designerPlanetCanvas?.addEventListener('mousedown', _onDesignerCanvasMouseDown);
      window.addEventListener('mousemove', _onWindowMouseMove);
      window.addEventListener('mouseup', _onWindowMouseUp);

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
        if (window.switchToMainView) {
          window.switchToMainView();
        }
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
    },
    
    activate: () => {
      console.log("PlanetDesigner.activate called.");
      if (!designerPlanetCanvas) designerPlanetCanvas = document.getElementById('designer-planet-canvas');
      _populateDesignerInputsFromBasis();
      _populateSavedDesignsList();
      requestAnimationFrame(() => { 
        _generateAndRenderDesignerPreviewInstance(true);
      });
    },

    handleDesignerWorkerMessage: ({ renderedData, width, height }) => {
      if (designerPlanetCanvas) {
        const ctx = designerPlanetCanvas.getContext('2d');
        if (ctx && renderedData) {
          try {
            const clampedArray = new Uint8ClampedArray(renderedData);
            const imageDataObj = new ImageData(clampedArray, width, height);
            ctx.clearRect(0, 0, width, height); // Clear first
            ctx.putImageData(imageDataObj, 0, 0);
          } catch (err) {
            console.error("PlanetDesigner: Error putting ImageData on canvas:", err);
          }
        }
      }
      isRenderingDesignerPlanet = false;
    }
  }; // end of return object
})(); // end of IIFE
