// planetDesigner.js

window.PlanetDesigner = (() => {
    console.log("PlanetDesigner.js: Script loaded.");
    // DOM Elements - will be fetched in init
    let designerPlanetCanvas, designerWaterColorInput, designerLandColorInput,
        designerMinHeightMinInput, designerMinHeightMaxInput,
        designerMaxHeightMinInput, designerMaxHeightMaxInput,
        designerOceanHeightMinInput, designerOceanHeightMaxInput,
        savedDesignsUl, designerRandomizeBtn, designerSaveBtn, designerCancelBtn;

    // State specific to the Planet Designer
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

    function _resizeDesignerCanvasToDisplaySize() {
        if (!designerPlanetCanvas) {
            console.warn("PlanetDesigner: _resizeDesignerCanvasToDisplaySize - canvas not found.");
            return;
        }
        const displayWidth = designerPlanetCanvas.offsetWidth;
        const displayHeight = designerPlanetCanvas.offsetHeight;
        // console.log(`PlanetDesigner: Resizing. Offset W/H: ${displayWidth}/${displayHeight}. Current W/H: ${designerPlanetCanvas.width}/${designerPlanetCanvas.height}`);
        if (displayWidth && displayHeight) {
            if (designerPlanetCanvas.width !== displayWidth || designerPlanetCanvas.height !== displayHeight) {
                designerPlanetCanvas.width = displayWidth;
                designerPlanetCanvas.height = displayHeight;
                console.log(`PlanetDesigner: Canvas resized to ${designerPlanetCanvas.width}x${designerPlanetCanvas.height}`);
            }
        } else {
            requestAnimationFrame(_resizeDesignerCanvasToDisplaySize);
        }
    }

    function _populateDesignerInputsFromBasis() {
        // ... (content is the same, removed for brevity in this example, ensure yours is complete)
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
        console.log("PlanetDesigner: Attempting _renderDesignerPlanetInternal. isRendering:", isRenderingDesignerPlanet, "Worker?", !!window.designerWorker, "Instance?", !!currentDesignerPlanetInstance, "Canvas?", !!designerPlanetCanvas);
        if (isRenderingDesignerPlanet || !window.designerWorker || !currentDesignerPlanetInstance || !designerPlanetCanvas) {
            if (!window.designerWorker) console.warn("PlanetDesigner: Worker not available for preview rendering.");
            if (!currentDesignerPlanetInstance) console.warn("PlanetDesigner: Instance not available for preview rendering.");
            if (!designerPlanetCanvas) console.warn("PlanetDesigner: Canvas not available for preview rendering.");
            if (isRenderingDesignerPlanet) console.log("PlanetDesigner: Bailed: Already rendering designer planet.");
            return;
        }
         if (designerPlanetCanvas.width === 0 || designerPlanetCanvas.height === 0) {
            console.warn(`PlanetDesigner: Canvas has 0 dimensions (W:${designerPlanetCanvas.width}, H:${designerPlanetCanvas.height}, offsetW:${designerPlanetCanvas.offsetWidth}). Scheduling resize and retry.`);
            requestAnimationFrame(() => {
                console.log("PlanetDesigner: rAF for resize/retry triggered for 0-dim canvas.");
                _resizeDesignerCanvasToDisplaySize();
                if (designerPlanetCanvas.width > 0 && designerPlanetCanvas.height > 0) {
                     console.log("PlanetDesigner: Canvas now has dimensions after rAF. Retrying render.");
                     _renderDesignerPlanetInternal();
                } else {
                    console.warn("PlanetDesigner: Canvas still 0 dimensions after rAF.offsetWidth:", designerPlanetCanvas.offsetWidth);
                }
            });
            return;
        }

        console.log("PlanetDesigner: Setting isRenderingDesignerPlanet = true and calling window.renderPlanetVisual for designerPlanetCanvas");
        isRenderingDesignerPlanet = true;
        window.renderPlanetVisual(currentDesignerPlanetInstance, designerPlanetRotationQuat, designerPlanetCanvas);
    }

    function _generateAndRenderDesignerPreviewInstance(resetRotation = false) {
        console.log("PlanetDesigner: _generateAndRenderDesignerPreviewInstance called. Reset rotation:", resetRotation);
        currentDesignerPlanetInstance = window.generatePlanetInstanceFromBasis(currentDesignerBasis, true);
        if (resetRotation) designerPlanetRotationQuat = window.quat_identity();
        _resizeDesignerCanvasToDisplaySize(); // Ensure size before render attempt
        _renderDesignerPlanetInternal();
    }

    function _updateBasisAndRefreshDesignerPreview() {
         // ... (content is the same, ensure yours is complete)
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
        // ... (content is the same, ensure yours is complete)
        _populateDesignerInputsFromBasis(); // ensure this is called
        _generateAndRenderDesignerPreviewInstance(true); // ensure this is called
    }

    function _saveCustomPlanetDesign() {
        // ... (content is the same, ensure yours is complete)
        _populateSavedDesignsList(); // ensure this is called
    }

    function _loadAndPreviewDesign(designId) {
        // ... (content is the same, ensure yours is complete)
        _populateDesignerInputsFromBasis(); // ensure this is called
        _generateAndRenderDesignerPreviewInstance(true); // ensure this is called
    }

    function _populateSavedDesignsList() {
        // ... (content is the same for brevity, ensure yours is complete)
    }

    function _onDesignerCanvasMouseDown(e) {
        // ... (content is the same)
    }

    function _onWindowMouseMove(e) { // This only handles designer planet drag now
        if (isDraggingDesignerPlanet && designerPlanetCanvas) {
            // ... (rest of the designer planet drag logic, ensure it calls _renderDesignerPlanetInternal or similar)
            // For brevity, assuming the logic for calculating rotation and calling _renderDesignerPlanetInternal is correct
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

            _renderDesignerPlanetInternal(); // Request render due to drag
        }
    }

    function _onWindowMouseUp() {  // This only handles designer planet drag mouseup
        if (isDraggingDesignerPlanet) {
            isDraggingDesignerPlanet = false;
            if(designerPlanetCanvas) designerPlanetCanvas.classList.remove('dragging');
        }
    }

    return {
        init: () => {
            designerPlanetCanvas = document.getElementById('designer-planet-canvas');
            // ... (get other designer DOM elements) ...
            console.log("PlanetDesigner.init called. designerPlanetCanvas:", !!designerPlanetCanvas, "window.designerWorker:", !!window.designerWorker);

            designerPlanetRotationQuat = window.quat_identity();
            startDragDesignerPlanetQuat = window.quat_identity();
            // Ensure all defaults are assigned *after* window.DEFAULT_... constants are set by script.js
            currentDesignerBasis.minTerrainHeightRange = [window.DEFAULT_MIN_TERRAIN_HEIGHT || 0.0, (window.DEFAULT_MIN_TERRAIN_HEIGHT || 0.0) + 2.0];
            currentDesignerBasis.maxTerrainHeightRange = [window.DEFAULT_MAX_TERRAIN_HEIGHT || 8.0, (window.DEFAULT_MAX_TERRAIN_HEIGHT || 8.0) + 4.0];
            currentDesignerBasis.oceanHeightRange = [window.DEFAULT_OCEAN_HEIGHT_LEVEL || 1.0, (window.DEFAULT_OCEAN_HEIGHT_LEVEL || 1.0) + 2.0];

            // ... (attach event listeners as before) ...
            if (designerPlanetCanvas) designerPlanetCanvas.addEventListener('mousedown', _onDesignerCanvasMouseDown);
            window.addEventListener('mousemove', _onWindowMouseMove);
            window.addEventListener('mouseup', _onWindowMouseUp);
            // Other listeners for buttons, inputs as they were
        },
        activate: () => {
            console.log("PlanetDesigner.activate called.");
            _populateDesignerInputsFromBasis();
            _populateSavedDesignsList();
            _resizeDesignerCanvasToDisplaySize(); // Call resize first
            requestAnimationFrame(() => { // Then render on next frame
                console.log("PlanetDesigner: rAF in activate firing for initial render.");
                _generateAndRenderDesignerPreviewInstance(true);
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
                        console.log("PlanetDesigner: Image data put on designer canvas.");
                    } catch (err) {
                        console.error("PlanetDesigner: Error putting ImageData on designerPlanetCanvas:", err);
                    }
                }
            }
            isRenderingDesignerPlanet = false;
            console.log("PlanetDesigner: Set isRenderingDesignerPlanet = false.");
        }
    };
})();
