// js/utils/color_utils.js

export function hexToRgb(hex) {
    if (!hex || typeof hex !== 'string' || hex.length !== 7 || hex[0] !== '#') {
        console.warn("Invalid hex color format:", hex, "Using default black.");
        return { r: 0, g: 0, b: 0 };
    }
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
        console.warn("Failed to parse hex color:", hex, "Using default black.");
        return { r: 0, g: 0, b: 0 };
    }
    return { r, g, b };
}

export function adjustColor(hex, amount) {
    let r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);

    r = Math.max(0, Math.min(255, r + amount));
    g = Math.max(0, Math.min(255, g + amount));
    b = Math.max(0, Math.min(255, b + amount));

    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
6. js/workers/worker_manager.js

// js/workers/worker_manager.js

import * as DOM from '../dom_elements.js';
import * as State from '../state.js';
import * as Config from '../config.js';
import * as MathUtils from '../utils/math_utils.js'; // For quat_identity

export let planetVisualWorker = null;
export let designerWorker = null;

export function setupWorkers() {
    if (window.Worker) {
        try {
            planetVisualWorker = new Worker('planetRendererWorker.js');
            designerWorker = new Worker('planetRendererWorker.js');

            // --- Planet Visual Worker Messages ---
            planetVisualWorker.onmessage = function(e) {
                const { renderedData, width, height, senderId } = e.data;
                if (senderId === 'planet-visual-canvas' && DOM.planetVisualCanvas) {
                    const ctx = DOM.planetVisualCanvas.getContext('2d');
                    if (!ctx) {
                        console.error("Failed to get 2D context from planetVisualCanvas");
                        State.isRenderingVisualPlanet = false;
                        return;
                    }
                    ctx.clearRect(0, 0, DOM.planetVisualCanvas.width, DOM.planetVisualCanvas.height);
                    if (renderedData && width && height) {
                        try {
                            const clampedArray = new Uint8ClampedArray(renderedData);
                            const imageDataObj = new ImageData(clampedArray, width, height);
                            ctx.putImageData(imageDataObj, 0, 0);
                            DOM.planetVisualCanvas.style.transform = "";
                        } catch (err) {
                            console.error("Error putting ImageData on planetVisualCanvas:", err);
                        }
                    }
                }
                State.isRenderingVisualPlanet = false;
                // If a new render was requested while busy, trigger it now
                if (State.needsPlanetVisualRerender && State.currentPlanetDisplayedInPanel && DOM.planetVisualPanel.classList.contains('visible')) {
                    State.needsPlanetVisualRerender = false;
                    renderPlanet(State.currentPlanetDisplayedInPanel, State.planetVisualRotationQuat, DOM.planetVisualCanvas.id);
                }
            };
            planetVisualWorker.onerror = function(error) {
                console.error("Error in planetVisualWorker:", error.message, error.filename, error.lineno);
                State.isRenderingVisualPlanet = false; // Ensure flag is reset on error
            };

            // --- Designer Worker Messages ---
            designerWorker.onmessage = function(e) {
                const { renderedData, width, height, senderId } = e.data;
                if (senderId === 'designer-planet-canvas' && DOM.designerPlanetCanvas) {
                    const ctx = DOM.designerPlanetCanvas.getContext('2d');
                    if (!ctx) {
                        console.error("Failed to get 2D context from designerPlanetCanvas");
                        State.isRenderingDesignerPlanet = false;
                        return;
                    }
                    ctx.clearRect(0, 0, DOM.designerPlanetCanvas.width, DOM.designerPlanetCanvas.height);
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
                State.isRenderingDesignerPlanet = false;
            };
            designerWorker.onerror = function(error) {
                console.error("Error in designerWorker:", error.message, error.filename, error.lineno);
                State.isRenderingDesignerPlanet = false; // Ensure flag is reset on error
            };

        } catch (err) {
            console.error("Failed to create Web Workers. Make sure planetRendererWorker.js exists and is accessible.", err);
            planetVisualWorker = null;
            designerWorker = null;
        }
    } else {
        console.warn("Web Workers not supported in this browser. Planet rendering might be disabled.");
    }
}

/**
 * Sends a render request to the appropriate Web Worker.
 * @param {object} planetData - The data describing the planet to render.
 * @param {number[]} rotationQuaternion - The quaternion representing the planet's rotation.
 * @param {string} targetCanvasId - The ID of the canvas element (e.g., 'planet-visual-canvas', 'designer-planet-canvas').
 * @param {number} [planetRadius=undefined] - Optional: Override the planet radius calculated from canvas size.
 */
export function renderPlanet(planetData, rotationQuaternion, targetCanvasId, planetRadius = undefined) {
    const targetCanvas = DOM.elements[targetCanvasId]; // Access dynamically from DOM.elements object
    const workerToUse = (targetCanvasId === 'planet-visual-canvas') ? planetVisualWorker : designerWorker;

    if (!planetData || !targetCanvas || !workerToUse) {
        console.warn("WorkerManager: Missing data, canvas, or appropriate worker for renderPlanet.", { planetData, targetCanvasId, workerExists: !!workerToUse });
        if (targetCanvasId === 'designer-planet-canvas') State.isRenderingDesignerPlanet = false; // Reset flag on abort
        if (targetCanvasId === 'planet-visual-canvas') State.isRenderingVisualPlanet = false; // Reset flag on abort
        return;
    }

    if (targetCanvas.width === 0 || targetCanvas.height === 0) {
        console.warn(`WorkerManager: Target canvas ${targetCanvasId} has zero dimensions. Aborting worker call.`);
        // Reset flag now, and re-attempt render after a short delay/resize
        if (targetCanvasId === 'designer-planet-canvas') State.isRenderingDesignerPlanet = false;
        if (targetCanvasId === 'planet-visual-canvas') State.isRenderingVisualPlanet = false;

        requestAnimationFrame(() => {
            // Attempt to resize designer canvas if it's the target
            if (targetCanvasId === 'designer-planet-canvas') {
                // This would best be handled by a function in planet_designer_ui to avoid circular dep
                // For now, we'll indicate that renderPlanetVisual should call resizeDesignerCanvasToDisplaySize()
            }
            if (targetCanvas.width > 0 && targetCanvas.height > 0) {
                // Re-call renderPlanet if dimensions are now valid and it's still the active planet
                // This requires a check in the calling module to ensure the relevant 'currentPlanetDisplayedInPanel' or 'currentDesignerPlanetInstance' is still set.
                renderPlanet(planetData, rotationQuaternion, targetCanvasId, planetRadius);
            }
        });
        return;
    }

    const pD = { ...planetData }; // Create a shallow copy to avoid modifying original

    // Ensure essential properties exist for the worker
    if (pD.continentSeed === undefined) pD.continentSeed = Math.random();
    if (!pD.waterColor) pD.waterColor = '#000080';
    if (!pD.landColor) pD.landColor = '#006400';

    pD.minTerrainHeight = pD.minTerrainHeight ?? Config.DEFAULT_MIN_TERRAIN_HEIGHT;
    pD.maxTerrainHeight = pD.maxTerrainHeight ?? Config.DEFAULT_MAX_TERRAIN_HEIGHT;
    pD.oceanHeightLevel = pD.oceanHeightLevel ?? Config.DEFAULT_OCEAN_HEIGHT_LEVEL;

    const dataToSend = {
        waterColor: pD.waterColor, landColor: pD.landColor, continentSeed: pD.continentSeed,
        minTerrainHeight: pD.minTerrainHeight, maxTerrainHeight: pD.maxTerrainHeight, oceanHeightLevel: pD.oceanHeightLevel,
    };

    if (targetCanvasId === 'planet-visual-canvas') State.isRenderingVisualPlanet = true;
    else if (targetCanvasId === 'designer-planet-canvas') State.isRenderingDesignerPlanet = true;

    workerToUse.postMessage({
        cmd: 'renderPlanet',
        planetData: dataToSend,
        rotationQuaternion,
        canvasWidth: targetCanvas.width,
        canvasHeight: targetCanvas.height,
        senderId: targetCanvasId,
        planetRadiusOverride: planetRadius
    }, [/* No transferable objects here unless you're also sending buffers */]);
}

/**
 * Sends a preload request to the planet visual worker for efficient rendering.
 * @param {object} planetData The planet's descriptive data.
 * @param {string} planetId A unique ID for the planet (e.g., `preload-${planet.id}`).
 */
export function preloadPlanet(planetData, planetId) {
    if (!planetVisualWorker) {
        console.warn("Planet visual worker not available for preloading.");
        return;
    }
    const pD = { ...planetData };
    if (pD.continentSeed === undefined) pD.continentSeed = Math.random();
    if (!pD.waterColor) pD.waterColor = '#000080';
    if (!pD.landColor) pD.landColor = '#006400';
    pD.minTerrainHeight = pD.minTerrainHeight ?? Config.DEFAULT_MIN_TERRAIN_HEIGHT;
    pD.maxTerrainHeight = pD.maxTerrainHeight ?? Config.DEFAULT_MAX_TERRAIN_HEIGHT;
    pD.oceanHeightLevel = pD.oceanHeightLevel ?? Config.DEFAULT_OCEAN_HEIGHT_LEVEL;

    planetVisualWorker.postMessage({
        cmd: 'preloadPlanet',
        planetData: pD,
        rotationQuaternion: MathUtils.quat_identity(), // Dummy, not used for preload
        canvasWidth: DOM.planetVisualCanvas ? DOM.planetVisualCanvas.width : 200, // Dummy
        canvasHeight: DOM.planetVisualCanvas ? DOM.planetVisualCanvas.height : 200, // Dummy
        senderId: `preload-${planetId}`
    });
}
