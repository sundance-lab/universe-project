// planetDesigner.js

window.PlanetDesigner = (() => {
  console.log("PlanetDesigner.js: Script loaded.");
  // DOM Elements - will be fetched in init
  let designerPlanetCanvas, designerWaterColorInput, designerLandColorInput,
    designerMinHeightMinInput, designerMinHeightMaxInput,
    designerMaxHeightMinInput, designerMaxHeightMaxInput,
    designerOceanHeightMinInput, designerOceanHeightMaxInput,
    savedDesignsUl, designerRandomizeBtn, designerSaveBtn, designerCancelBtn,
    planetDesignerScreenElement; // For reference if needed

  // State specific to the Planet Designer
  let currentDesignerBasis = {
    waterColor: '#000080',
    landColor: '#006400',
    continentSeed: Math.random(),
    minTerrainHeightRange: [0.0, 2.0], // Will be overwritten by defaults in init
    maxTerrainHeightRange: [8.0, 12.0], // Will be overwritten by defaults in init
    oceanHeightRange: [1.0, 3.0]      // Will be overwritten by defaults in init
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
    if (crypto && crypto.randomUUID) {
        return crypto.randomUUID();
    } else {
        console.warn("PlanetDesigner: crypto.randomUUID not available, using Math.random fallback for UUID.");
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
  }

  function _getRandomHexColor() {
    let n = (Math.random() * 0xfffff * 1000000).toString(16);
    return '#' + n.slice(0, 6).padStart(6, '0');
  }

  function _getRandomFloat(min, max, precision = 1) {
    const factor = Math.pow(10, precision);
    return parseFloat((Math.random() * (max - min) + min).toFixed(precision));
  }


  // --- UI AND BASIS MANAGEMENT ---
 function _populateDesignerInputsFromBasis() {
  if (!designerWaterColorInput || !designerLandColorInput || !designerMinHeightMinInput) {
    console.warn("PlanetDesigner: Cannot populate inputs, DOM elements not ready.");
    return;
  }
  designerWaterColorInput.value = currentDesignerBasis.waterColor;
  designerLandColorInput.value = currentDesignerBasis.landColor;
  designerMinHeightMinInput.value = currentDesignerBasis.minTerrainHeightRange[0].toFixed(1); // Corrected
  designerMinHeightMaxInput.value = currentDesignerBasis.minTerrainHeightRange[1].toFixed(1); // Corrected
  designerMaxHeightMinInput.value = currentDesignerBasis.maxTerrainHeightRange[0].toFixed(1); // Corrected
  designerMaxHeightMaxInput.value = currentDesignerBasis.maxTerrainHeightRange[1].toFixed(1); // Corrected
  designerOceanHeightMinInput.value = currentDesignerBasis.oceanHeightRange[0].toFixed(1); // Corrected
  designerOceanHeightMaxInput.value = currentDesignerBasis.oceanHeightRange[1].toFixed(1); // Corrected
 }

  function _updateBasisAndRefreshDesignerPreview() {
    if (!designerWaterColorInput) { // Check if DOM elements are ready
        console.warn("PlanetDesigner: Inputs not ready for _updateBasisAndRefreshDesignerPreview");
        return;
    }
    currentDesignerBasis.waterColor = designerWaterColorInput.value;
    currentDesignerBasis.landColor = designerLandColorInput.value;

    let minH_min = parseFloat(designerMinHeightMinInput.value) || 0.0;
    let minH_max = parseFloat(designerMinHeightMaxInput.value) || 0.0;
    let maxH_min = parseFloat(designerMaxHeightMinInput.value) || 0.0;
    let maxH_max = parseFloat(designerMaxHeightMaxInput.value) || 0.0;
    let oceanH_min = parseFloat(designerOceanHeightMinInput.value) || 0.0;
    let oceanH_max = parseFloat(designerOceanHeightMaxInput.value) || 0.0;

    // Ensure min <= max for each individual range
    if (minH_min > minH_max) [minH_min, minH_max] = [minH_max, minH_min];
    if (maxH_min > maxH_max) [maxH_min, maxH_max] = [maxH_max, maxH_min];
    if (oceanH_min > oceanH_max) [oceanH_min, oceanH_max] = [oceanH_max, oceanH_min];

    // Ensure non-negative values
    minH_min = Math.max(0, minH_min); minH_max = Math.max(0, minH_max);
    maxH_min = Math.max(0, maxH_min); maxH_max = Math.max(0, maxH_max);
    oceanH_min = Math.max(0, oceanH_min); oceanH_max = Math.max(0, oceanH_max);

    // Cascade adjustments to prevent illogical overlaps (somewhat opinionated ordering)
    // 1. Ensure min terrain max is above ocean min
    if (minH_max >= oceanH_min) oceanH_min = parseFloat((minH_max + 0.1).toFixed(1));
    // 2. Ensure ocean max is above new ocean min
    if (oceanH_min >= oceanH_max) oceanH_max = parseFloat((oceanH_min + 0.1).toFixed(1));
    // 3. Ensure max terrain min is above new ocean max
    if (oceanH_max >= maxH_min) maxH_min = parseFloat((oceanH_max + 0.1).toFixed(1));
    // 4. Ensure max terrain max is above new max terrain min
    if (maxH_min >= maxH_max) maxH_max = parseFloat((maxH_min + 0.1).toFixed(1));


    currentDesignerBasis.minTerrainHeightRange = [minH_min, minH_max];
    currentDesignerBasis.maxTerrainHeightRange = [maxH_min, maxH_max];
    currentDesignerBasis.oceanHeightRange = [oceanH_min, oceanH_max];
    // ContinentSeed is not changed by these inputs

    _populateDesignerInputsFromBasis(); // Re-populate to reflect any auto-corrections
    _generateAndRenderDesignerPreviewInstance(false); // Don't reset rotation if user is just tweaking sliders
  }

  function _randomizeDesignerPlanet() {
    currentDesignerBasis.waterColor = _getRandomHexColor();
    currentDesignerBasis.landColor = _getRandomHexColor();
    currentDesignerBasis.continentSeed = Math.random();

    // Generate somewhat logical random ranges for terrain
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
    _generateAndRenderDesignerPreviewInstance(true); // Reset rotation for a new random look
  }

  // --- SAVED DESIGNS MANAGEMENT ---
  function _saveCustomPlanetDesign() {
      const designName = prompt("Enter a name for this planet design:", "My Custom Planet");
    if (designName === null || designName.trim() === "") { // User cancelled or entered nothing
        return;
    }

    const newDesign = {
        designId: _generateUUID(),
        designName: designName.trim(),
        ...JSON.parse(JSON.stringify(currentDesignerBasis)) // Deep copy of basis values
    };

    if (window.gameSessionData && Array.isArray(window.gameSessionData.customPlanetDesigns)) {
        window.gameSessionData.customPlanetDesigns.push(newDesign);
        if (typeof window.saveGameState === 'function') {
            window.saveGameState(); // Persist to localStorage via script.js
        } else {
            console.warn("PlanetDesigner: window.saveGameState function not found.");
        }
        _populateSavedDesignsList();
    } else {
        console.error("PlanetDesigner: window.gameSessionData.customPlanetDesigns is not available.");
    }
  }

  function _loadAndPreviewDesign(designId) {
    if (window.gameSessionData && Array.isArray(window.gameSessionData.customPlanetDesigns)) {
        const designToLoad = window.gameSessionData.customPlanetDesigns.find(d => d.designId === designId);
        if (designToLoad) {
            currentDesignerBasis = { ...JSON.parse(JSON.stringify(designToLoad)) }; // Deep copy
            // Remove designId and designName from basis if they were copied
            delete currentDesignerBasis.designId;
            delete currentDesignerBasis.designName;
            
            _populateDesignerInputsFromBasis();
            _generateAndRenderDesignerPreviewInstance(true); // Reset rotation when loading a saved design
        } else {
            console.warn("PlanetDesigner: Could not find design with ID:", designId);
        }
    } else {
        console.error("PlanetDesigner: window.gameSessionData.customPlanetDesigns is not available for loading.");
    }
  }

  function _deleteCustomPlanetDesign(designId) {
     if (window.gameSessionData && Array.isArray(window.gameSessionData.customPlanetDesigns)) {
        const initialLength = window.gameSessionData.customPlanetDesigns.length;
        window.gameSessionData.customPlanetDesigns = window.gameSessionData.customPlanetDesigns.filter(d => d.designId !== designId);
        
        if (window.gameSessionData.customPlanetDesigns.length < initialLength) {
            if (typeof window.saveGameState === 'function') {
                window.saveGameState();
            }
            _populateSavedDesignsList(); // Refresh the list UI
            console.log("PlanetDesigner: Deleted design ID:", designId);
        } else {
            console.warn("PlanetDesigner: Design ID not found for deletion:", designId);
        }
    } else {
        console.error("PlanetDesigner: window.gameSessionData.customPlanetDesigns is not available for deletion.");
    }
  }


  function _populateSavedDesignsList() {
    if (!savedDesignsUl) {
        console.warn("PlanetDesigner: savedDesignsUl element not found.");
        return;
    }
    savedDesignsUl.innerHTML = ''; // Clear existing list

    if (window.gameSessionData && Array.isArray(window.gameSessionData.customPlanetDesigns) && window.gameSessionData.customPlanetDesigns.length > 0) {
        window.gameSessionData.customPlanetDesigns.forEach(design => {
            const li = document.createElement('li');
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'design-item-name';
            nameSpan.textContent = design.designName || 'Unnamed Design';
            li.appendChild(nameSpan);

            const loadBtn = document.createElement('button');
            loadBtn.className = 'design-item-load modal-button-apply'; // Reusing modal style
            loadBtn.textContent = 'Load';
            loadBtn.dataset.id = design.designId;
            li.appendChild(loadBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'design-item-delete';
            deleteBtn.innerHTML = '&times;'; // Using a times symbol for delete
            deleteBtn.title = 'Delete Design';
            deleteBtn.dataset.id = design.designId;
            li.appendChild(deleteBtn);

            savedDesignsUl.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.textContent = 'No saved designs yet.';
        li.style.textAlign = 'center';
        li.style.fontStyle = 'italic';
        savedDesignsUl.appendChild(li);
    }
  }

// planetDesigner.js
// ... (other code before this section) ...

 function _resizeDesignerCanvasToDisplaySize() {
  if (!designerPlanetCanvas) {
   console.warn("PlanetDesigner: _resizeDesignerCanvasToDisplaySize - canvas not found.");
   return false; // Indicate failure or inability to resize
  }
  const displayWidth = designerPlanetCanvas.offsetWidth;
  const displayHeight = designerPlanetCanvas.offsetHeight;

  if (displayWidth && displayHeight) {
   if (designerPlanetCanvas.width !== displayWidth || designerPlanetCanvas.height !== displayHeight) {
    designerPlanetCanvas.width = displayWidth;
    designerPlanetCanvas.height = displayHeight;
    console.log(`PlanetDesigner: Canvas resized to ${designerPlanetCanvas.width}x${designerPlanetCanvas.height}`);
   }
   return true; // Indicate success or that dimensions are currently valid
  } else {
   // Canvas has no dimensions currently. The caller (render function) will decide to retry.
   // console.warn("PlanetDesigner: _resizeDesignerCanvasToDisplaySize - Canvas has 0 dimensions currently.");
   return false; // Indicate dimensions are not ready
  }
 }

 function _renderDesignerPlanetInternal() {
  if (isRenderingDesignerPlanet) {
    // console.log("PlanetDesigner: _renderDesignerPlanetInternal - Already rendering.");
    return;
  }
  if (!window.designerWorker) {
    console.warn("PlanetDesigner: _renderDesignerPlanetInternal - window.designerWorker not available.");
    return;
  }
  if (!currentDesignerPlanetInstance) {
    console.warn("PlanetDesigner: _renderDesignerPlanetInternal - currentDesignerPlanetInstance is null.");
    return;
  }
  if (!designerPlanetCanvas) {
    console.warn("PlanetDesigner: _renderDesignerPlanetInternal - designerPlanetCanvas is null.");
    return;
  }

  // Attempt to resize and check dimensions. _resizeDesignerCanvasToDisplaySize will
  // update canvas.width/height if necessary and possible.
  const canvasHasValidDimensions = _resizeDesignerCanvasToDisplaySize();

  if (!canvasHasValidDimensions) { // This implies designerPlanetCanvas.width or height might still be 0
    console.warn("PlanetDesigner: Canvas has 0 dimensions or resize failed. Retrying _renderDesignerPlanetInternal on next frame.");
    requestAnimationFrame(() => {
      // On the next frame, _renderDesignerPlanetInternal will be called again,
      // which will re-attempt _resizeDesignerCanvasToDisplaySize.
      _renderDesignerPlanetInternal();
    });
    return;
  }

  // If we reach here, canvas dimensions should be valid (>0)
  isRenderingDesignerPlanet = true;
  // console.log("PlanetDesigner: Calling window.renderPlanetVisual for designer canvas.");
  window.renderPlanetVisual(currentDesignerPlanetInstance, designerPlanetRotationQuat, designerPlanetCanvas);
  // isRenderingDesignerPlanet will be set to false in handleDesignerWorkerMessage
 }

 function _generateAndRenderDesignerPreviewInstance(resetRotation = false) {
  if (typeof window.generatePlanetInstanceFromBasis !== 'function') {
    console.error("PlanetDesigner: window.generatePlanetInstanceFromBasis is not defined!");
    return;
  }
  currentDesignerPlanetInstance = window.generatePlanetInstanceFromBasis(currentDesignerBasis, true); // true for designer preview (uses currentDesignerBasis.continentSeed)
  if (resetRotation && typeof window.quat_identity === 'function') {
    designerPlanetRotationQuat = window.quat_identity();
  }
  // _resizeDesignerCanvasToDisplaySize(); // REMOVED - _renderDesignerPlanetInternal handles it
  _renderDesignerPlanetInternal();
 }

// ... (code for activate function - its call to _resizeDesignerCanvasToDisplaySize is fine as an initial attempt) ...
/*
  activate: () => {
   console.log("PlanetDesigner.activate called.");
   if (!designerPlanetCanvas) designerPlanetCanvas = document.getElementById('designer-planet-canvas');

   _populateDesignerInputsFromBasis();
   _populateSavedDesignsList();
   _resizeDesignerCanvasToDisplaySize(); // This call is fine, attempts an immediate resize.
                                         // If it fails (e.g. panel not visible yet),
                                         // _renderDesignerPlanetInternal will handle the retry.
   requestAnimationFrame(() => { 
    console.log("PlanetDesigner: rAF in activate firing for initial render.");
    _generateAndRenderDesignerPreviewInstance(true); 
   });
  },
*/
// ... (rest of the planetDesigner.js code) ...

  // --- MOUSE EVENT HANDLERS for planet rotation ---
  function _onDesignerCanvasMouseDown(e) {
    if (e.button !== 0 || !currentDesignerPlanetInstance || !designerPlanetCanvas) return;
    isDraggingDesignerPlanet = true;
    startDragDesignerPlanetQuat = [...designerPlanetRotationQuat];
    designerStartDragMouseX = e.clientX;
    designerStartDragMouseY = e.clientY;
    if (designerPlanetCanvas) designerPlanetCanvas.classList.add('dragging');
    e.preventDefault();
  }

  function _onWindowMouseMove(e) {
    if (isDraggingDesignerPlanet && designerPlanetCanvas) {
      const rect = designerPlanetCanvas.getBoundingClientRect();
      const canvasEffectiveWidth = (designerPlanetCanvas.width > 0 ? designerPlanetCanvas.width : designerPlanetCanvas.offsetWidth) || 1;
      const canvasEffectiveHeight = (designerPlanetCanvas.height > 0 ? designerPlanetCanvas.height : designerPlanetCanvas.offsetHeight) || 1;
      if (canvasEffectiveWidth === 0 || canvasEffectiveHeight === 0) return;

      const deltaX = e.clientX - designerStartDragMouseX;
      const deltaY = e.clientY - designerStartDragMouseY;
      const rotationSensitivity = typeof window.PLANET_ROTATION_SENSITIVITY === 'number' ? window.PLANET_ROTATION_SENSITIVITY : 0.75;

      const rotationAroundX = (deltaY / canvasEffectiveHeight) * Math.PI * rotationSensitivity;
      const rotationAroundY = (deltaX / canvasEffectiveWidth) * (2 * Math.PI) * rotationSensitivity;

      if (typeof window.quat_from_axis_angle !== 'function' || typeof window.quat_multiply !== 'function' || typeof window.quat_normalize !== 'function') {
          console.error("PlanetDesigner: Quaternion math functions not found on window!");
          isDraggingDesignerPlanet = false; // Stop dragging if math is broken
          return;
      }
      const xAxisRotationQuat = window.quat_from_axis_angle([1, 0, 0], -rotationAroundX);
      const yAxisRotationQuat = window.quat_from_axis_angle([0, 1, 0], rotationAroundY);
      const incrementalRotationQuat = window.quat_multiply(yAxisRotationQuat, xAxisRotationQuat);
      designerPlanetRotationQuat = window.quat_normalize(window.quat_multiply(incrementalRotationQuat, startDragDesignerPlanetQuat));
      _renderDesignerPlanetInternal();
    }
  }

  function _onWindowMouseUp() {
    if (isDraggingDesignerPlanet) {
      isDraggingDesignerPlanet = false;
      if(designerPlanetCanvas) designerPlanetCanvas.classList.remove('dragging');
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

      console.log("PlanetDesigner.init called. designerPlanetCanvas:", !!designerPlanetCanvas, "window.designerWorker:", !!window.designerWorker);

      if (typeof window.quat_identity === 'function') {
        designerPlanetRotationQuat = window.quat_identity();
        startDragDesignerPlanetQuat = window.quat_identity();
      } else {
        console.error("PlanetDesigner: window.quat_identity function not found! Rotation may fail.");
        designerPlanetRotationQuat = [1,0,0,0]; // Fallback
        startDragDesignerPlanetQuat = [1,0,0,0];
      }
      
      // Ensure all defaults are assigned *after* window.DEFAULT_... constants are set by script.js
      currentDesignerBasis.minTerrainHeightRange = [window.DEFAULT_MIN_TERRAIN_HEIGHT || 0.0, (window.DEFAULT_MIN_TERRAIN_HEIGHT || 0.0) + 2.0];
      currentDesignerBasis.maxTerrainHeightRange = [window.DEFAULT_MAX_TERRAIN_HEIGHT || 8.0, (window.DEFAULT_MAX_TERRAIN_HEIGHT || 8.0) + 4.0];
      currentDesignerBasis.oceanHeightRange = [window.DEFAULT_OCEAN_HEIGHT_LEVEL || 1.0, (window.DEFAULT_OCEAN_HEIGHT_LEVEL || 1.0) + 2.0];
      currentDesignerBasis.continentSeed = Math.random(); // Initialize with a random seed

      // Event Listeners
      if (designerPlanetCanvas) designerPlanetCanvas.addEventListener('mousedown', _onDesignerCanvasMouseDown);
      window.addEventListener('mousemove', _onWindowMouseMove); // Shared listeners
      window.addEventListener('mouseup', _onWindowMouseUp);     // Shared listeners

      const inputsToWatch = [
        designerWaterColorInput, designerLandColorInput,
        designerMinHeightMinInput, designerMinHeightMaxInput,
        designerMaxHeightMinInput, designerMaxHeightMaxInput,
        designerOceanHeightMinInput, designerOceanHeightMaxInput
      ];
      inputsToWatch.forEach(input => {
        if (input) input.addEventListener('change', _updateBasisAndRefreshDesignerPreview);
      });

      if (designerRandomizeBtn) designerRandomizeBtn.addEventListener('click', _randomizeDesignerPlanet);
      if (designerSaveBtn) designerSaveBtn.addEventListener('click', _saveCustomPlanetDesign);
      if (designerCancelBtn) {
          designerCancelBtn.addEventListener('click', () => {
              if (window.setActiveScreen && window.mainScreen) {
                  window.setActiveScreen(window.mainScreen);
              } else if (window.switchToMainView) { 
                  window.switchToMainView();
              } else {
                  console.warn("PlanetDesigner: Cannot navigate back.");
              }
          });
      }

      if (savedDesignsUl) {
          savedDesignsUl.addEventListener('click', (e) => {
              const target = e.target;
              if (target.classList.contains('design-item-load') && target.dataset.id) {
                  _loadAndPreviewDesign(target.dataset.id);
              } else if (target.classList.contains('design-item-delete') && target.dataset.id) {
                  if (confirm("Are you sure you want to delete this planet design?")) {
                      _deleteCustomPlanetDesign(target.dataset.id);
                  }
              }
          });
      }
    },
    activate: () => {
      console.log("PlanetDesigner.activate called.");
       // Re-ensure canvas is available (in case activate is called before element fully in DOM, though unlikely with DOMContentLoaded)
      if (!designerPlanetCanvas) designerPlanetCanvas = document.getElementById('designer-planet-canvas');

      _populateDesignerInputsFromBasis();
      _populateSavedDesignsList();
      _resizeDesignerCanvasToDisplaySize(); 
      requestAnimationFrame(() => { 
        console.log("PlanetDesigner: rAF in activate firing for initial render.");
        _generateAndRenderDesignerPreviewInstance(true); // Reset rotation on activation
      });
    },
    handleDesignerWorkerMessage: ({ renderedData, width, height }) => {
      console.log("PlanetDesigner: handleDesignerWorkerMessage received from worker.");
      if (designerPlanetCanvas) {
        const ctx = designerPlanetCanvas.getContext('2d');
        if (!ctx) {
          console.error("PlanetDesigner: Failed to get 2D context from designerPlanetCanvas in worker message handler.");
          isRenderingDesignerPlanet = false;
          return;
        }
        ctx.clearRect(0, 0, designerPlanetCanvas.width, designerPlanetCanvas.height);
        if (renderedData && width && height) {
          try {
            const clampedArray = new Uint8ClampedArray(renderedData);
            const imageDataObj = new ImageData(clampedArray, width, height);
            ctx.putImageData(imageDataObj, 0, 0);
          } catch (err) {
            console.error("PlanetDesigner: Error putting ImageData on designerPlanetCanvas:", err);
          }
        }
      }
      isRenderingDesignerPlanet = false;
    }
  };
})();
