// planetDesigner.js

const PlanetDesigner = (() => {
    // DOM Elements - will be fetched in init
    let designerPlanetCanvas, designerWaterColorInput, designerLandColorInput,
        designerMinHeightMinInput, designerMinHeightMaxInput,
        designerMaxHeightMinInput, designerMaxHeightMaxInput,
        designerOceanHeightMinInput, designerOceanHeightMaxInput,
        savedDesignsUl, designerRandomizeBtn, designerSaveBtn, designerCancelBtn;

    // State specific to the Planet Designer
    let currentDesignerBasis = {
        waterColor: '#000080', // Default, will be overwritten by constants from main script if needed
        landColor: '#006400',
        continentSeed: Math.random(),
        minTerrainHeightRange: [0.0, 2.0],
        maxTerrainHeightRange: [8.0, 12.0],
        oceanHeightRange: [1.0, 3.0]
    };
    let currentDesignerPlanetInstance = null;
    let designerPlanetRotationQuat = [1, 0, 0, 0]; // Initialized by quat_identity later
    let startDragDesignerPlanetQuat = [1, 0, 0, 0];
    let designerStartDragMouseX = 0;
    let designerStartDragMouseY = 0;
    let isDraggingDesignerPlanet = false;
    let isRenderingDesignerPlanet = false; // Flag for worker rendering

    // References to shared/global elements from script.js
    // These would ideally be passed or event-driven in a more complex system
    // For now, we assume they are available in the scope where script.js runs them
    // e.g., mainScriptAccess.generatePlanetInstanceFromBasis()

    function _resizeDesignerCanvasToDisplaySize() {
        if (!designerPlanetCanvas) return;
        const displayWidth = designerPlanetCanvas.offsetWidth;
        const displayHeight = designerPlanetCanvas.offsetHeight;
        if (displayWidth && displayHeight) {
            if (designerPlanetCanvas.width !== displayWidth || designerPlanetCanvas.height !== displayHeight) {
                designerPlanetCanvas.width = displayWidth;
                designerPlanetCanvas.height = displayHeight;
            }
        } else {
            requestAnimationFrame(_resizeDesignerCanvasToDisplaySize);
        }
    }

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

    function _renderDesignerPlanetInternal() {
        if (isRenderingDesignerPlanet || !window.designerWorker || !currentDesignerPlanetInstance || !designerPlanetCanvas) {
            if (!window.designerWorker) console.warn("Designer worker not available for preview rendering.");
            return;
        }
         if (designerPlanetCanvas.width === 0 || designerPlanetCanvas.height === 0) {
            console.warn("Designer canvas has 0 dimensions. Aborting render. Will try after rAF.");
            requestAnimationFrame(() => {
                _resizeDesignerCanvasToDisplaySize();
                if (designerPlanetCanvas.width > 0 && designerPlanetCanvas.height > 0) {
                     _renderDesignerPlanetInternal(); // Re-call self
                } else {
                    console.warn("Designer canvas still has 0 dimensions after rAF.");
                }
            });
            return;
        }

        isRenderingDesignerPlanet = true;
        // Call the global renderPlanetVisual function from script.js
        window.renderPlanetVisual(currentDesignerPlanetInstance, designerPlanetRotationQuat, designerPlanetCanvas);
    }


    function _generateAndRenderDesignerPreviewInstance(resetRotation = false) {
        // Uses global generatePlanetInstanceFromBasis from script.js
        currentDesignerPlanetInstance = window.generatePlanetInstanceFromBasis(currentDesignerBasis, true);
        if (resetRotation) designerPlanetRotationQuat = window.quat_identity();
        _resizeDesignerCanvasToDisplaySize();
        _renderDesignerPlanetInternal();
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

        if (minH_min > minH_max) [minH_min, minH_max] = [minH_max, minH_min];
        if (maxH_min > maxH_max) [maxH_min, maxH_max] = [maxH_max, maxH_min];
        if (oceanH_min > oceanH_max) [oceanH_min, oceanH_max] = [oceanH_max, oceanH_min];

        minH_min = Math.max(0, minH_min); minH_max = Math.max(0, minH_max);
        maxH_min = Math.max(0, maxH_min); maxH_max = Math.max(0, maxH_max);
        oceanH_min = Math.max(0, oceanH_min); oceanH_max = Math.max(0, oceanH_max);

        if (minH_max > oceanH_min) oceanH_min = parseFloat((minH_max + 0.1).toFixed(1));
        if (oceanH_min > oceanH_max) oceanH_max = parseFloat((oceanH_min + 0.1).toFixed(1));
        if (oceanH_max > maxH_min) maxH_min = parseFloat((oceanH_max + 0.1).toFixed(1));
        if (maxH_min > maxH_max) maxH_max = parseFloat((maxH_min + 0.1).toFixed(1));

        currentDesignerBasis.minTerrainHeightRange = [minH_min, minH_max];
        currentDesignerBasis.maxTerrainHeightRange = [maxH_min, maxH_max];
        currentDesignerBasis.oceanHeightRange = [oceanH_min, oceanH_max];

        _populateDesignerInputsFromBasis();
        _generateAndRenderDesignerPreviewInstance();
    }

    function _randomizeDesignerPlanet() {
        currentDesignerBasis.waterColor = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
        currentDesignerBasis.landColor = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
        currentDesignerBasis.continentSeed = Math.random();

        let minB = 0.0, maxB = 2.0;
        let minH_min_rand = parseFloat((Math.random() * (maxB - minB) + minB).toFixed(1));
        let minH_max_rand = parseFloat((minH_min_rand + Math.random() * 2.0 + 0.1).toFixed(1));
        let oceanB = minH_max_rand;
        let oceanH_min_rand = parseFloat((oceanB + Math.random() * 1.5 + 0.1).toFixed(1));
        let oceanH_max_rand = parseFloat((oceanH_min_rand + Math.random() * 2.5 + 0.1).toFixed(1));
        let maxBH = oceanH_max_rand;
        let maxH_min_rand = parseFloat((maxBH + Math.random() * 2.0 + 0.1).toFixed(1));
        let maxH_max_rand = parseFloat((maxH_min_rand + Math.random() * 5.0 + 0.5).toFixed(1));

        currentDesignerBasis.minTerrainHeightRange = [minH_min_rand, minH_max_rand];
        currentDesignerBasis.maxTerrainHeightRange = [maxH_min_rand, maxH_max_rand];
        currentDesignerBasis.oceanHeightRange = [oceanH_min_rand, oceanH_max_rand];

        _populateDesignerInputsFromBasis();
        _generateAndRenderDesignerPreviewInstance(true);
    }

    function _saveCustomPlanetDesign() {
        _updateBasisAndRefreshDesignerPreview();
        const newDesign = {
            designId: `design-${Date.now()}`,
            name: `Custom Design ${window.gameSessionData.customPlanetDesigns.length + 1}`,
            waterColor: currentDesignerBasis.waterColor,
            landColor: currentDesignerBasis.landColor,
            continentSeed: currentDesignerBasis.continentSeed,
            minTerrainHeightRange: [...currentDesignerBasis.minTerrainHeightRange],
            maxTerrainHeightRange: [...currentDesignerBasis.maxTerrainHeightRange],
            oceanHeightRange: [...currentDesignerBasis.oceanHeightRange]
        };
        window.gameSessionData.customPlanetDesigns.push(newDesign);
        window.saveGameState(); // Global function
        _populateSavedDesignsList();
    }

    function _loadAndPreviewDesign(designId) {
        const designToLoad = window.gameSessionData.customPlanetDesigns.find(d => d.designId === designId);
        if (designToLoad) {
            currentDesignerBasis.waterColor = designToLoad.waterColor;
            currentDesignerBasis.landColor = designToLoad.landColor;
            currentDesignerBasis.continentSeed = designToLoad.continentSeed || Math.random();
            const ensureRange = (value, oldSingleProp, defaultVal, spread) => {
                if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
                    return [...value];
                }
                const base = typeof oldSingleProp === 'number' ? oldSingleProp : (typeof defaultVal === 'number' ? defaultVal : 0);
                return [base, base + (typeof spread === 'number' ? spread : 1.0)];
            };
            currentDesignerBasis.minTerrainHeightRange = ensureRange(designToLoad.minTerrainHeightRange, designToLoad.minTerrainHeight, window.DEFAULT_MIN_TERRAIN_HEIGHT, 1.0);
            currentDesignerBasis.maxTerrainHeightRange = ensureRange(designToLoad.maxTerrainHeightRange, designToLoad.maxTerrainHeight, window.DEFAULT_MAX_TERRAIN_HEIGHT, 2.0);
            currentDesignerBasis.oceanHeightRange = ensureRange(designToLoad.oceanHeightRange, designToLoad.oceanHeightLevel, window.DEFAULT_OCEAN_HEIGHT_LEVEL, 1.0);
            _populateDesignerInputsFromBasis();
            _generateAndRenderDesignerPreviewInstance(true);
        }
    }

    function _populateSavedDesignsList() {
        if (!savedDesignsUl) return;
        savedDesignsUl.innerHTML = '';
        if (window.gameSessionData.customPlanetDesigns.length === 0) {
            savedDesignsUl.innerHTML = '<li>No designs saved yet.</li>';
            return;
        }
        window.gameSessionData.customPlanetDesigns.forEach(design => {
            const li = document.createElement('li');
            li.dataset.designId = design.designId;
            const designNameSpan = document.createElement('span');
            designNameSpan.className = 'design-item-name';
            designNameSpan.textContent = design.name || `Design ${design.designId.slice(-4)}`;
            li.appendChild(designNameSpan);
            const loadBtn = document.createElement('button');
            loadBtn.className = 'design-item-load modal-button-apply';
            loadBtn.textContent = 'Load';
            loadBtn.title = `Load ${design.name || 'design'}`;
            loadBtn.onclick = (e) => { e.stopPropagation(); _loadAndPreviewDesign(design.designId); };
            li.appendChild(loadBtn);
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'design-item-delete';
            deleteBtn.textContent = 'x';
            deleteBtn.title = `Delete ${design.name || 'design'}`;
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                if (confirm(`Delete design "${design.name || 'this design'}"? This cannot be undone.`)) {
                    window.gameSessionData.customPlanetDesigns = window.gameSessionData.customPlanetDesigns.filter(d => d.designId !== design.designId);
                    window.saveGameState();
                    _populateSavedDesignsList();
                }
            };
            li.appendChild(deleteBtn);
            savedDesignsUl.appendChild(li);
        });
    }

    // Event Handlers for designer canvas dragging
    function _onDesignerCanvasMouseDown(e) {
        if (e.button !== 0) return;
        isDraggingDesignerPlanet = true;
        designerStartDragMouseX = e.clientX;
        designerStartDragMouseY = e.clientY;
        startDragDesignerPlanetQuat = [...designerPlanetRotationQuat]; // Create a new array copy
        if(designerPlanetCanvas) designerPlanetCanvas.classList.add('dragging');
        e.preventDefault();
    }

    function _onWindowMouseMove(e) {
        if (isDraggingDesignerPlanet && designerPlanetCanvas) {
            const rect = designerPlanetCanvas.getBoundingClientRect();
            const canvasEffectiveWidth = (designerPlanetCanvas.width > 0 ? designerPlanetCanvas.width : rect.width) || 1;
            const canvasEffectiveHeight = (designerPlanetCanvas.height > 0 ? designerPlanetCanvas.height : rect.height) || 1;
            if (canvasEffectiveWidth === 0 || canvasEffectiveHeight === 0) return;

            const deltaX = e.clientX - designerStartDragMouseX;
            const deltaY = e.clientY - designerStartDragMouseY;

            const rotationAroundX = (deltaY / canvasEffectiveHeight) * Math.PI * window.PLANET_ROTATION_SENSITIVITY;
            const rotationAroundY = (deltaX / canvasEffectiveWidth) * (2 * Math.PI) * window.PLANET_ROTATION_SENSITIVITY;

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

    // Public API
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

            // Initialize rotation quaternions using the (now global) math util
            designerPlanetRotationQuat = window.quat_identity();
            startDragDesignerPlanetQuat = window.quat_identity();

            // Set default basis values from global constants if available
            currentDesignerBasis.minTerrainHeightRange = [window.DEFAULT_MIN_TERRAIN_HEIGHT || 0.0, (window.DEFAULT_MIN_TERRAIN_HEIGHT || 0.0) + 2.0];
            currentDesignerBasis.maxTerrainHeightRange = [window.DEFAULT_MAX_TERRAIN_HEIGHT || 8.0, (window.DEFAULT_MAX_TERRAIN_HEIGHT || 8.0) + 4.0];
            currentDesignerBasis.oceanHeightRange = [window.DEFAULT_OCEAN_HEIGHT_LEVEL || 1.0, (window.DEFAULT_OCEAN_HEIGHT_LEVEL || 1.0) + 2.0];


            // Attach event listeners
            if (designerRandomizeBtn) designerRandomizeBtn.addEventListener('click', _randomizeDesignerPlanet);
            if (designerSaveBtn) designerSaveBtn.addEventListener('click', _saveCustomPlanetDesign);
            if (designerCancelBtn) designerCancelBtn.addEventListener('click', () => {
                 window.setActiveScreen(window.mainScreen); // Uses globals from script.js
            });

            const inputsToWatch = [
                designerMinHeightMinInput, designerMinHeightMaxInput,
                designerMaxHeightMinInput, designerMaxHeightMaxInput,
                designerOceanHeightMinInput, designerOceanHeightMaxInput,
                designerWaterColorInput, designerLandColorInput
            ];
            inputsToWatch.forEach(input => {
                if (input) input.addEventListener('change', _updateBasisAndRefreshDesignerPreview);
            });

            if (designerPlanetCanvas) designerPlanetCanvas.addEventListener('mousedown', _onDesignerCanvasMouseDown);
            window.addEventListener('mousemove', _onWindowMouseMove); // Moved relevant part of global mousemove
            window.addEventListener('mouseup', _onWindowMouseUp);     // Moved relevant part of global mouseup
        },
        activate: () => { // Called when switching to the designer screen
            _populateDesignerInputsFromBasis();
            _populateSavedDesignsList();
            _resizeDesignerCanvasToDisplaySize();
            requestAnimationFrame(() => {
                _generateAndRenderDesignerPreviewInstance(true); // reset rotation on activate
            });
        },
        handleDesignerWorkerMessage: ({ renderedData, width, height }) => {
            if (designerPlanetCanvas) {
                const ctx = designerPlanetCanvas.getContext('2d');
                if (!ctx) {
                    console.error("Failed to get 2D context from designerPlanetCanvas");
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
                        console.error("Error putting ImageData on designerPlanetCanvas:", err);
                    }
                }
            }
            isRenderingDesignerPlanet = false;
        }
    };
})();

// Make PlanetDesigner globally available if script.js needs to call init/activate.
// Or, script.js could include this file and then immediately call init.
// For now, let's assume it's available after this script loads.
