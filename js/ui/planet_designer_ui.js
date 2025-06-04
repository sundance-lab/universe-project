// js/ui/planet_designer_ui.js

import * as DOM from 'js/dom_elements.js';
import * as State from 'js/state.js';
import * as Config from 'js/config.js';
import * as MathUtils from 'js/utils/math_utils.js';
import * as ScreenManager from 'js/screen_manager.js';
import * as WorkerManager from 'js/workers/worker_manager.js';
import * as GameLifecycle from 'js/core/game_lifecycle.js';
import * as CoreGeneration from 'js/core/game_generation.js'; // Needs access to some generation helpers for randomness

export function generatePlanetInstanceFromBasis(basis, isForDesignerPreview = false) {
    // Helper to get a random number within a range.
    const getValueFromRange = (range, defaultValue, defaultSpread = 1.0) => {
        if (Array.isArray(range) && range.length === 2 && typeof range[0] === 'number' && typeof range[1] === 'number') {
            const min = Math.min(range[0], range[1]);
            const max = Math.max(range[0], range[1]);
            if (min === max) return min; // Avoid NaN if min == max from random * 0
            return min + Math.random() * (max - min);
        }
        // If range is a single number, use it directly (e.g., from older save format or fixed value)
        if (typeof range === 'number') return range;

        // If completely undefined or not a valid range array, use default with a bit of spread
        const base = typeof defaultValue === 'number' ? defaultValue : 0;
        const spread = typeof defaultSpread === 'number' ? defaultSpread : 1.0;
        if (isNaN(base) || isNaN(spread)) {
            console.warn("Invalid default/spread in getValueFromRange, returning 0", { range, defaultValue, defaultSpread });
            return 0;
        }
        return base + (Math.random() - 0.5) * spread * 2;
    };

    return {
        waterColor: basis.waterColor || '#0000FF',
        landColor: basis.landColor || '#008000',
        // Preserve seed for designer preview if it exists, otherwise generate a new one
        continentSeed: isForDesignerPreview ? (basis.continentSeed ?? Math.random()) : Math.random(),
        minTerrainHeight: getValueFromRange(basis.minTerrainHeightRange, Config.DEFAULT_MIN_TERRAIN_HEIGHT, 1.0),
        maxTerrainHeight: getValueFromRange(basis.maxTerrainHeightRange, Config.DEFAULT_MAX_TERRAIN_HEIGHT, 2.0),
        oceanHeightLevel: getValueFromRange(basis.oceanHeightRange, Config.DEFAULT_OCEAN_HEIGHT_LEVEL, 1.0)
    };
}


/**
 * Resizes the designer planet canvas to match its display size in the DOM.
 * This is crucial for preventing blurry rendering.
 */
export function resizeDesignerCanvasToDisplaySize() {
    const canvas = DOM.designerPlanetCanvas;
    if (!canvas) {
        // console.warn("resizeDesignerCanvasToDisplaySize: designerPlanetCanvas not found.");
        return;
    }
    const displayWidth = canvas.offsetWidth;
    const displayHeight = canvas.offsetHeight;

    if (displayWidth && displayHeight) {
        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
            console.log(`Resized designer canvas to: ${displayWidth}x${displayHeight}`);
        }
    } else {
        // If dimensions are not yet available, request another frame
        requestAnimationFrame(resizeDesignerCanvasToDisplaySize);
    }
}

export function populateDesignerInputsFromBasis() {
    if (!DOM.designerWaterColorInput) return; // Guard against null elements

    DOM.designerWaterColorInput.value = State.currentDesignerBasis.waterColor;
    DOM.designerLandColorInput.value = State.currentDesignerBasis.landColor;

    DOM.designerMinHeightMinInput.value = State.currentDesignerBasis.minTerrainHeightRange[0].toFixed(1);
    DOM.designerMinHeightMaxInput.value = State.currentDesignerBasis.minTerrainHeightRange[1].toFixed(1);

    DOM.designerMaxHeightMinInput.value = State.currentDesignerBasis.maxTerrainHeightRange[0].toFixed(1);
    DOM.designerMaxHeightMaxInput.value = State.currentDesignerBasis.maxTerrainHeightRange[1].toFixed(1);

    DOM.designerOceanHeightMinInput.value = State.currentDesignerBasis.oceanHeightRange[0].toFixed(1);
    DOM.designerOceanHeightMaxInput.value = State.currentDesignerBasis.oceanHeightRange[1].toFixed(1);
}

export function updateBasisAndRefreshDesignerPreview() {
    if (!DOM.designerWaterColorInput) return;

    State.currentDesignerBasis.waterColor = DOM.designerWaterColorInput.value;
    State.currentDesignerBasis.landColor = DOM.designerLandColorInput.value;

    let minH_min = parseFloat(DOM.designerMinHeightMinInput.value) || 0.0;
    let minH_max = parseFloat(DOM.designerMinHeightMaxInput.value) || 0.0;
    let maxH_min = parseFloat(DOM.designerMaxHeightMinInput.value) || 0.0;
    let maxH_max = parseFloat(DOM.designerMaxHeightMaxInput.value) || 0.0;
    let oceanH_min = parseFloat(DOM.designerOceanHeightMinInput.value) || 0.0;
    let oceanH_max = parseFloat(DOM.designerOceanHeightMaxInput.value) || 0.0;

    // Ensure min value is always less than or equal to max value for each range
    if (minH_min > minH_max) [minH_min, minH_max] = [minH_max, minH_min];
    if (maxH_min > maxH_max) [maxH_min, maxH_max] = [maxH_max, maxH_min];
    if (oceanH_min > oceanH_max) [oceanH_min, oceanH_max] = [oceanH_max, oceanH_min];

    // Clamp all values to be non-negative
    minH_min = Math.max(0, minH_min); minH_max = Math.max(0, minH_max);
    maxH_min = Math.max(0, maxH_min); maxH_max = Math.max(0, maxH_max);
    oceanH_min = Math.max(0, oceanH_min); oceanH_max = Math.max(0, oceanH_max);

    if (minH_max > oceanH_min) {
        oceanH_min = parseFloat((minH_max + 0.1).toFixed(1));
    }
    // Adjust ocean max if it's too low compared to ocean min
    if (oceanH_min > oceanH_max) {
        oceanH_max = parseFloat((oceanH_min + 0.1).toFixed(1));
    }
    // Adjust max terrain min if it's too low compared to ocean max
    if (oceanH_max > maxH_min) {
        maxH_min = parseFloat((oceanH_max + 0.1).toFixed(1));
    }
    // Adjust max terrain max if it's too low compared to max terrain min
    if (maxH_min > maxH_max) {
        maxH_max = parseFloat((maxH_min + 0.1).toFixed(1));
    }

    // Update the state
    State.currentDesignerBasis.minTerrainHeightRange = [minH_min, minH_max];
    State.currentDesignerBasis.maxTerrainHeightRange = [maxH_min, maxH_max];
    State.currentDesignerBasis.oceanHeightRange = [oceanH_min, oceanH_max];

    populateDesignerInputsFromBasis(); // Update input values to reflect clamped new values
    generateAndRenderDesignerPreviewInstance();
}

export function generateAndRenderDesignerPreviewInstance(resetRotation = false) {
    State.currentDesignerPlanetInstance = generatePlanetInstanceFromBasis(State.currentDesignerBasis, true);
    if (resetRotation) State.designerPlanetRotationQuat = MathUtils.quat_identity();
    resizeDesignerCanvasToDisplaySize(); // Ensure canvas is correctly sized before rendering

    if (!State.isRenderingDesignerPlanet && WorkerManager.designerWorker) {
        State.isRenderingDesignerPlanet = true;
        WorkerManager.renderPlanet(State.currentDesignerPlanetInstance, State.designerPlanetRotationQuat, DOM.designerPlanetCanvas.id);
    } else if (!WorkerManager.designerWorker) {
        console.warn("Designer worker not available for preview rendering.");
    }
}

export function renderDesignerPlanet(planetToRender, rotationQuaternion) {
    if (!planetToRender || !DOM.designerPlanetCanvas) return;

    // Check canvas dimensions before rendering
    if (DOM.designerPlanetCanvas.width === 0 || DOM.designerPlanetCanvas.height === 0) {
        console.warn("Designer canvas has 0 dimensions. Aborting render. Will retry after resize.");
        State.isRenderingDesignerPlanet = false; // Reset rendering flag
        requestAnimationFrame(() => {
            resizeDesignerCanvasToDisplaySize(); // Attempt to resize
            if (DOM.designerPlanetCanvas.width > 0 && DOM.designerPlanetCanvas.height > 0 && State.currentDesignerPlanetInstance) {
                // If dimensions are now valid, re-render
                WorkerManager.renderPlanet(State.currentDesignerPlanetInstance, State.designerPlanetRotationQuat, DOM.designerPlanetCanvas.id);
            }
        });
        return;
    }

    // Pass a fixed radius scaled by the smaller dimension of the canvas for consistency
    const fixedRadius = Math.min(DOM.designerPlanetCanvas.width, DOM.designerPlanetCanvas.height) / 2 * 0.9;
    WorkerManager.renderPlanet(planetToRender, rotationQuaternion, DOM.designerPlanetCanvas.id, fixedRadius);
}

export function randomizeDesignerPlanet() {
    State.currentDesignerBasis.waterColor = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
    State.currentDesignerBasis.landColor = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
    State.currentDesignerBasis.continentSeed = Math.random();

    // Generate random but logical height ranges
    let minH_min_rand = parseFloat((Math.random() * 2.0).toFixed(1)); // 0.0 to 2.0
    let minH_max_rand = parseFloat((minH_min_rand + Math.random() * 2.0 + 0.1).toFixed(1)); // min_min + small range

    let oceanH_min_rand = parseFloat((minH_max_rand + Math.random() * 1.5 + 0.1).toFixed(1)); // Starts above min_max
    let oceanH_max_rand = parseFloat((oceanH_min_rand + Math.random() * 2.5 + 0.1).toFixed(1)); // ocean_min + medium range

    let maxH_min_rand = parseFloat((oceanH_max_rand + Math.random() * 2.0 + 0.1).toFixed(1)); // Starts above ocean_max
    let maxH_max_rand = parseFloat((maxH_min_rand + Math.random() * 5.0 + 0.5).toFixed(1)); // max_min + large range

    State.currentDesignerBasis.minTerrainHeightRange = [minH_min_rand, minH_max_rand];
    State.currentDesignerBasis.maxTerrainHeightRange = [maxH_min_rand, maxH_max_rand];
    State.currentDesignerBasis.oceanHeightRange = [oceanH_min_rand, oceanH_max_rand];

    populateDesignerInputsFromBasis(); // Update input fields to reflect new random values
    generateAndRenderDesignerPreviewInstance(true); // Generate and render new preview, resetting rotation
}

export function saveCustomPlanetDesign() {
    updateBasisAndRefreshDesignerPreview(); // Ensure input values are incorporated into basis

    const newDesign = {
        designId: `design-${Date.now()}`, // Unique ID for the design
        name: `Custom Design ${State.gameSessionData.customPlanetDesigns.length + 1}`,
        waterColor: State.currentDesignerBasis.waterColor,
        landColor: State.currentDesignerBasis.landColor,
        continentSeed: State.currentDesignerBasis.continentSeed, // Save the exact seed for reproducibility
        minTerrainHeightRange: [...State.currentDesignerBasis.minTerrainHeightRange],
        maxTerrainHeightRange: [...State.currentDesignerBasis.maxTerrainHeightRange],
        oceanHeightRange: [...State.currentDesignerBasis.oceanHeightRange]
    };
    State.gameSessionData.customPlanetDesigns.push(newDesign);
    GameLifecycle.saveGameState(); // Persist changes
    populateSavedDesignsList(); // Refresh the list in the UI
}

export function loadAndPreviewDesign(designId) {
    const designToLoad = State.gameSessionData.customPlanetDesigns.find(d => d.designId === designId);
    if (designToLoad) {
        // Copy properties to currentDesignerBasis
        State.currentDesignerBasis.waterColor = designToLoad.waterColor;
        State.currentDesignerBasis.landColor = designToLoad.landColor;
        // Use ?? to handle cases where continentSeed might be undefined in older saved designs
        State.currentDesignerBasis.continentSeed = designToLoad.continentSeed ?? Math.random();

        // Helper to ensure compatibility with old single-value height properties vs. new ranges
        const ensureRange = (value, oldSingleProp, defaultVal, spread) => {
            if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
                return [...value];
            }
            // If it's a single number or undefined (from an old format), extrapolate to a small range
            const base = typeof oldSingleProp === 'number' ? oldSingleProp : (typeof defaultVal === 'number' ? defaultVal : 0);
            return [base, base + (typeof spread === 'number' ? spread : 1.0)];
        };

        State.currentDesignerBasis.minTerrainHeightRange = ensureRange(
            designToLoad.minTerrainHeightRange, (designToLoad).minTerrainHeight, // Casting to any for old format access
            Config.DEFAULT_MIN_TERRAIN_HEIGHT, 1.0
        );
        State.currentDesignerBasis.maxTerrainHeightRange = ensureRange(
            designToLoad.maxTerrainHeightRange, (designToLoad).maxTerrainHeight,
            Config.DEFAULT_MAX_TERRAIN_HEIGHT, 2.0
        );
        State.currentDesignerBasis.oceanHeightRange = ensureRange(
            designToLoad.oceanHeightRange, (designToLoad).oceanHeightLevel,
            Config.DEFAULT_OCEAN_HEIGHT_LEVEL, 1.0
        );

        populateDesignerInputsFromBasis(); // Update UI inputs
        generateAndRenderDesignerPreviewInstance(true); // Render new preview, resetting rotation
    }
}

export function populateSavedDesignsList() {
    if (!DOM.savedDesignsUl) return;

    DOM.savedDesignsUl.innerHTML = ''; // Clear existing list

    if (State.gameSessionData.customPlanetDesigns.length === 0) {
        DOM.savedDesignsUl.innerHTML = '<li>No designs saved yet.</li>';
        return;
    }

    State.gameSessionData.customPlanetDesigns.forEach(design => {
        const li = document.createElement('li');
        li.dataset.designId = design.designId; // Store ID for easy lookup

        const designNameSpan = document.createElement('span');
        designNameSpan.className = 'design-item-name';
        designNameSpan.textContent = design.name || `Design ${design.designId.slice(-4)}`; // Display custom name or last 4 of ID
        li.appendChild(designNameSpan);

        const loadBtn = document.createElement('button');
        loadBtn.className = 'design-item-load modal-button-apply';
        loadBtn.textContent = 'Load';
        loadBtn.title = `Load ${design.name || 'design'}`;
        loadBtn.onclick = (e) => { e.stopPropagation(); loadAndPreviewDesign(design.designId); }; // Load on click
        li.appendChild(loadBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'design-item-delete';
        deleteBtn.textContent = 'x';
        deleteBtn.title = `Delete ${design.name || 'design'}`;
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            if (confirm(`Delete design "${design.name || 'this design'}"? This cannot be undone.`)) {
                // Filter out the design to be deleted and update state
                State.gameSessionData.customPlanetDesigns = State.gameSessionData.customPlanetDesigns.filter(d => d.designId !== design.designId);
                GameLifecycle.saveGameState(); // Persist change
                populateSavedDesignsList(); // Refresh list to reflect deletion
            }
        };
        li.appendChild(deleteBtn);
        DOM.savedDesignsUl.appendChild(li);
    });
}

export function switchToPlanetDesignerScreen() {
    ScreenManager.setActiveScreen(DOM.planetDesignerScreen);
    populateDesignerInputsFromBasis(); // Populate inputs with current basis
    populateSavedDesignsList(); // Load and display saved designs
    resizeDesignerCanvasToDisplaySize(); // Ensure canvas is sized correctly
    requestAnimationFrame(() => {
        generateAndRenderDesignerPreviewInstance(true);
    });
}
