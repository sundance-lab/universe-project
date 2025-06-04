// js/ui/solar_system_ui.js

import * as DOM from './dom_elements.js';
import * as State from './state.js';
import * as Config from './config.js';
import * as MathUtils from '../utils/math_utils.js';
import * as ColorUtils from '../utils/color_utils.js';
import * as ScreenManager from './screen_manager.js';
import * as AnimationManager from '../core/animation_manager.js';
import * as WorkerManager from '../workers/worker_manager.js';
import * as GameLifecycle from '../core/game_lifecycle.js';
import * as PlanetDesignerUI from './planet_designer_ui.js'; // For generatePlanetInstanceFromBasis

/**
 * Draws the orbital paths for all planets in the solar system view.
 * Uses the canvas element dedicated for orbits.
 */
export function drawAllOrbits() {
    if (!State.solarSystemOrbitCtx || !State.solarSystemOrbitCanvasEl || !State.gameSessionData.solarSystemView.planets) return;

    // Clear previous drawings
    State.solarSystemOrbitCtx.clearRect(0, 0, State.solarSystemOrbitCanvasEl.width, State.solarSystemOrbitCanvasEl.height);

    // Hide or show the orbit canvas based on user preference
    if (!State.currentShowPlanetOrbits && State.solarSystemOrbitCanvasEl) {
        State.solarSystemOrbitCanvasEl.style.display = 'none';
        return;
    } else if (State.solarSystemOrbitCanvasEl) {
        State.solarSystemOrbitCanvasEl.style.display = 'block';
    }

    const canvasCenterX = State.solarSystemOrbitCanvasEl.width / 2;
    const canvasCenterY = State.solarSystemOrbitCanvasEl.height / 2;

    State.gameSessionData.solarSystemView.planets.forEach(planetData => {
        const orbitalRadius = planetData.distance;
        State.solarSystemOrbitCtx.beginPath();
        State.solarSystemOrbitCtx.arc(canvasCenterX, canvasCenterY, orbitalRadius, 0, 2 * Math.PI);
        State.solarSystemOrbitCtx.strokeStyle = 'rgba(255,255,255,0.2)'; // Light white dashed line
        State.solarSystemOrbitCtx.lineWidth = 1;
        State.solarSystemOrbitCtx.setLineDash([5, 5]); // Dashed line style
        State.solarSystemOrbitCtx.stroke();
    });

    State.solarSystemOrbitCtx.setLineDash([]); // Reset line dash for other drawings
}

/**
 * Renders the solar system screen, displaying the sun and planets.
 * @param {boolean} isInteractive - If true, disables CSS transitions for immediate updates (e.g., during panning/zooming).
 */
export function renderSolarSystemScreen(isInteractive = false) {
    if (!DOM.solarSystemContent || !DOM.solarSystemScreen || !State.gameSessionData.activeSolarSystemId) {
        return;
    }

    // Ensure orbit canvas is correctly sized for current max orbital distance
    if (State.solarSystemOrbitCanvasEl && (State.solarSystemOrbitCanvasEl.width !== State.ORBIT_CANVAS_SIZE || State.solarSystemOrbitCanvasEl.height !== State.ORBIT_CANVAS_SIZE)) {
        State.solarSystemOrbitCanvasEl.width = State.ORBIT_CANVAS_SIZE;
        State.solarSystemOrbitCanvasEl.height = State.ORBIT_CANVAS_SIZE;
    }

    const displayData = State.gameSessionData.solarSystemView;
    let panX = displayData.currentPanX || 0;
    let panY = displayData.currentPanY || 0;
    let zoom = displayData.zoomLevel || Config.SOLAR_SYSTEM_VIEW_MIN_ZOOM;

    // Apply pan and zoom transforms to the solar system content
    DOM.solarSystemContent.style.transition = isInteractive ? 'none' : 'transform 0.1s ease-out';
    DOM.solarSystemContent.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;

    // Update solar system title
    const galaxyID = State.gameSessionData.activeSolarSystemId.match(/^(galaxy-\d+)-ss-\d+$/)?.[1];
    const activeGalaxy = galaxyID ? State.gameSessionData.galaxies.find(g => g.id === galaxyID) : null;
    const solarSystemObject = activeGalaxy?.solarSystems?.find(ss => ss.id === displayData.systemId);

    if (DOM.solarSystemTitleText) {
        const systemIDNum = displayData.systemId ? displayData.systemId.substring(displayData.systemId.lastIndexOf('-') + 1) : 'N/A';
        DOM.solarSystemTitleText.textContent = (solarSystemObject?.customName) ? solarSystemObject.customName : `System ${systemIDNum}`;
    }

    // Draw orbits if interactive (e.g., during pan/zoom) or if animation is not running (for initial draw)
    if (isInteractive || !State.animationFrameId) { drawAllOrbits(); }
}

/**
 * Clamps the solar system's pan coordinates to prevent panning outside the viewable area.
 * @param {object} dataObject - The solar system's view data object.
 * @param {number} viewportWidth - The current width of the solar system viewport.
 * @param {number} viewportHeight - The current height of the solar system viewport.
 */
export function clampSolarSystemPan(dataObject, viewportWidth, viewportHeight) {
    if (!dataObject || !viewportWidth || !viewportHeight) {
        if (dataObject) { dataObject.currentPanX = 0; dataObject.currentPanY = 0; }
        return;
    }
    const zoom = dataObject.zoomLevel;
    const contentWidth = State.SOLAR_SYSTEM_EXPLORABLE_RADIUS * 2;
    const contentHeight = State.SOLAR_SYSTEM_EXPLORABLE_RADIUS * 2;

    const scaledContentWidth = contentWidth * zoom;
    const scaledContentHeight = contentHeight * zoom;

    // Calculate maximum allowed pan distance from center
    const maxPanX = Math.max(0, (scaledContentWidth - viewportWidth) / 2);
    const maxPanY = Math.max(0, (scaledContentHeight - viewportHeight) / 2);

    // Clamp current pan coordinates
    dataObject.currentPanX = Math.max(-maxPanX, Math.min(maxPanX, dataObject.currentPanX));
    dataObject.currentPanY = Math.max(-maxPanY, Math.min(maxPanY, dataObject.currentPanY));
}

/**
 * Handles zooming in or out for the solar system screen.
 * @param {'in'|'out'} direction - The direction of zoom.
 * @param {MouseEvent} [mouseEvent=null] - The mouse event (if triggered by wheel) to fix zoom on mouse position.
 */
export function handleSolarSystemZoom(direction, mouseEvent = null) {
    const displayData = State.gameSessionData.solarSystemView;
    const viewportElement = DOM.solarSystemScreen;
    if (!displayData || !viewportElement) return;

    const oldZoom = displayData.zoomLevel;
    let newZoom = oldZoom + (direction === 'in' ? (Config.ZOOM_STEP * oldZoom) : -(Config.ZOOM_STEP * oldZoom));

    // Calculate effective minimum zoom to ensure the entire explorable radius is initially visible
    let effectiveMinZoom = Config.SOLAR_SYSTEM_VIEW_MIN_ZOOM;
    const vw = viewportElement.offsetWidth;
    const vh = viewportElement.offsetHeight;
    if (State.SOLAR_SYSTEM_EXPLORABLE_RADIUS > 0 && (vw > 0 || vh > 0)) {
        const zoomToFitWidth = vw > 0 ? vw / (State.SOLAR_SYSTEM_EXPLORABLE_RADIUS * 2) : 0;
        const zoomToFitHeight = vh > 0 ? vh / (State.SOLAR_SYSTEM_EXPLORABLE_RADIUS * 2) : 0;
        effectiveMinZoom = Math.max(Config.SOLAR_SYSTEM_VIEW_MIN_ZOOM, zoomToFitWidth, zoomToFitHeight);
    }

    // Clamp new zoom level within min/max bounds
    newZoom = Math.max(effectiveMinZoom, Math.min(Config.SOLAR_SYSTEM_VIEW_MAX_ZOOM, newZoom));

    // If zoom hasn't effectively changed, return early
    if (Math.abs(oldZoom - newZoom) < 0.0001) return;

    displayData.zoomLevel = newZoom;

    // Adjust pan to keep the mouse point fixed during zooming
    if (mouseEvent && viewportElement) {
        const rect = viewportElement.getBoundingClientRect();
        const mouseXInViewport = mouseEvent.clientX - rect.left;
        const mouseYInViewport = mouseEvent.clientY - rect.top;

        // Mouse coordinates relative to viewport center
        const mouseXRelativeToCenter = mouseXInViewport - (viewportElement.offsetWidth / 2);
        const mouseYRelativeToCenter = mouseYInViewport - (viewportYInViewport / 2); // Corrected: viewportYInViewport -> viewportHeight / 2)

        const currentPanX = displayData.currentPanX || 0;
        const currentPanY = displayData.currentPanY || 0;

        // World coordinates of the mouse point
        const worldX = (mouseXRelativeToCenter - currentPanX) / oldZoom;
        const worldY = (mouseYRelativeToCenter - currentPanY) / oldZoom;

        // New pan position to keep worldX, worldY under the mouse
        displayData.currentPanX = mouseXRelativeToCenter - (worldX * newZoom);
        displayData.currentPanY = mouseYRelativeToCenter - (worldY * newZoom);
    }

    clampSolarSystemPan(displayData, viewportElement.offsetWidth, viewportElement.offsetHeight); // Re-clamp pan after zoom and pan adjustment
    drawAllOrbits(); // Redraw orbits as canvas might be re-scaled and to reflect current zoom
    renderSolarSystemScreen(true); // Re-render interactively
    AnimationManager.startSolarSystemAnimation(); // Ensure animation keeps running
}


/**
 * @param {object} planetData The planet's descriptive data.
 * @param {number[]} rotationQuaternion The quaternion representing the planet's rotation.
 * @param {HTMLElement} targetCanvas - The canvas element to render to (e.g., DOM.planetVisualCanvas).
 */
export function renderPlanetVisualPanel(planetData, rotationQuaternion, targetCanvas = DOM.planetVisualCanvas) {
    WorkerManager.renderPlanet(planetData, rotationQuaternion, targetCanvas.id);
}


/**
 * Switches the view to a specific solar system's detail screen.
 * Generates planets, sun, and their orbits.
 * @param {string} solarSystemId - The ID of the solar system to display.
 */
export function switchToSolarSystemView(solarSystemId) {
    State.gameSessionData.activeSolarSystemId = solarSystemId;
    const galaxyID = solarSystemId.match(/^(galaxy-\d+)-ss-\d+$/)?.[1]; // Extract galaxy ID part

    const activeGalaxy = galaxyID ? State.gameSessionData.galaxies.find(g => g.id === galaxyID) : null;
    const solarSystemObject = activeGalaxy?.solarSystems?.find(ss => ss.id === solarSystemId);

    // Reset solar system view state for a fresh start
    State.gameSessionData.solarSystemView.zoomLevel = 0.5; // Start with a reasonable zoom
    State.gameSessionData.solarSystemView.currentPanX = 0;
    State.gameSessionData.solarSystemView.currentPanY = 0;
    State.gameSessionData.solarSystemView.systemId = solarSystemId;

    if (DOM.solarSystemContent) DOM.solarSystemContent.innerHTML = ''; // Clear previous content

    // --- Render Sun ---
    let currentSunSize = Config.SUN_ICON_SIZE;
    if (solarSystemObject && typeof solarSystemObject.sunSizeFactor === 'number') {
        currentSunSize = Config.SUN_ICON_SIZE * solarSystemObject.sunSizeFactor;
    }
    currentSunSize = Math.max(currentSunSize, 15); // Ensure a minimum sun size
    const sunEl = document.createElement('div');
    sunEl.className = 'sun-icon sun-animated';
    sunEl.style.width = `${currentSunSize}px`;
    sunEl.style.height = `${currentSunSize}px`;

    // Set CSS variables for sun coloring/glow via adjustColor utility
    sunEl.style.setProperty('--sun-core-color', Config.FIXED_COLORS.sunFill);
    sunEl.style.setProperty('--sun-mid-color', Config.FIXED_COLORS.sunBorder);
    sunEl.style.setProperty('--sun-edge-color', ColorUtils.adjustColor(Config.FIXED_COLORS.sunBorder, -40));
    sunEl.style.setProperty('--sun-actual-border-color', Config.FIXED_COLORS.sunBorder);

    if (DOM.solarSystemContent) DOM.solarSystemContent.appendChild(sunEl);

    // --- Setup Orbit Canvas ---
    // Recreate canvas to ensure correct size and reset context
    State.solarSystemOrbitCanvasEl = document.createElement('canvas');
    State.solarSystemOrbitCanvasEl.id = 'solar-system-orbit-canvas';
    State.solarSystemOrbitCanvasEl.width = State.ORBIT_CANVAS_SIZE;
    State.solarSystemOrbitCanvasEl.height = State.ORBIT_CANVAS_SIZE;
    if (DOM.solarSystemContent) DOM.solarSystemContent.appendChild(State.solarSystemOrbitCanvasEl);
    State.solarSystemOrbitCtx = State.solarSystemOrbitCanvasEl.getContext('2d');

    // --- Generate and Render Planets ---
    State.gameSessionData.solarSystemView.planets = []; // Clear previous planets
    let usedDistances = []; // To ensure planets don't overlap orbits

    const numPlanets = Math.floor(Math.random() * (State.currentMaxPlanets - State.currentMinPlanets + 1)) + State.currentMinPlanets;

    for (let i = 0; i < numPlanets; i++) {
        const planetSize = Math.random() * (Config.MAX_PLANET_SIZE - Config.MIN_PLANET_SIZE) + Config.MIN_PLANET_SIZE;
        let planetDistance, attemptCount = 0;
        // Try to find a non-overlapping orbital distance
        do {
            planetDistance = Math.floor(Math.random() * (State.MAX_PLANET_DISTANCE - State.MIN_PLANET_DISTANCE + 1)) + State.MIN_PLANET_DISTANCE;
            let tooClose = false;
            for (const d of usedDistances) {
                if (Math.abs(planetDistance - d.distance) < (Config.MIN_ORBITAL_SEPARATION + (d.size + planetSize) / 2)) {
                    tooClose = true;
                    break;
                }
            }
            if (!tooClose) break;
            attemptCount++;
        } while (attemptCount < 200); // Limit attempts to prevent infinite loop

        if (attemptCount === 200) continue; // Skip if no suitable distance found
        usedDistances.push({ distance: planetDistance, size: planetSize });

        // Select a planet design basis (custom or default)
        const basisToUse = (State.gameSessionData.customPlanetDesigns.length > 0)
            ? State.gameSessionData.customPlanetDesigns[Math.floor(Math.random() * State.gameSessionData.customPlanetDesigns.length)]
            : {
                waterColor: '#0077be', landColor: '#3A5F0B',
                minTerrainHeightRange: [0.0, 1.0], // Use ranges here
                maxTerrainHeightRange: [5.0, 8.0],
                oceanHeightRange: [1.0, 3.0]
            };

        // Generate a new planet instance with specific properties
        const newPlanetData = PlanetDesignerUI.generatePlanetInstanceFromBasis(basisToUse, false);

        // Calculate initial orbital and axial rotation properties
        const initialOrbitalAngle = Math.random() * 2 * Math.PI;
        const orbitalSpeed = Math.random() * (Config.MAX_ROTATION_SPEED_RAD_PER_PERLIN_UNIT - Config.MIN_ROTATION_SPEED_RAD_PER_PERLIN_UNIT) + Config.MIN_ROTATION_SPEED_RAD_PER_PERLIN_UNIT;
        const initialAxialAngle = Math.random() * 2 * Math.PI;
        const axialSpeed = Config.DEFAULT_PLANET_AXIAL_SPEED;

        const newPlanet = {
            id: `planet-${i + 1}`,
            size: planetSize,
            distance: planetDistance,
            currentOrbitalAngle: initialOrbitalAngle,
            orbitalSpeed: orbitalSpeed,
            currentAxialAngle: initialAxialAngle,
            axialSpeed: axialSpeed,
            element: null, // Placeholder for the DOM element
            planetName: `Planet ${i + 1}`,
            type: 'terrestrial', // Or other types like gas giant, barren, etc.
            // Pass the detailed design properties to the planet object
            waterColor: newPlanetData.waterColor,
            landColor: newPlanetData.landColor,
            continentSeed: newPlanetData.continentSeed,
            minTerrainHeight: newPlanetData.minTerrainHeight,
            maxTerrainHeight: newPlanetData.maxTerrainHeight,
            oceanHeightLevel: newPlanetData.oceanHeightLevel,
            sourceDesignId: basisToUse.designId || null // Track which custom design it came from
        };
        State.gameSessionData.solarSystemView.planets.push(newPlanet);

        // Create and style the planet's DOM element
        const planetEl = document.createElement('div');
        planetEl.classList.add('planet-icon', 'clickable-when-paused'); // Add class for visual panel clickability

        planetEl.style.width = `${newPlanet.size}px`;
        planetEl.style.height = `${newPlanet.size}px`;

        // Apply a simple radial gradient for planet visual appearance
        const radialPos = 15 + Math.random() * 40;
        const radialSize = 20 + Math.random() * 30;
        let backgroundStyle = `radial-gradient(circle at ${radialPos}% ${radialPos}%, ${newPlanet.landColor} ${radialSize}%, transparent ${radialSize + 20}%), ${newPlanet.waterColor}`;
        // Add a second layer for more texture complexity
        if (Math.random() < 0.5) {
            const radialPos2 = 15 + Math.random() * 40;
            const radialSize2 = 20 + Math.random() * 30;
            backgroundStyle = `radial-gradient(circle at ${90 - radialPos2}% ${90 - radialPos2}%, ${ColorUtils.adjustColor(newPlanet.landColor, -30)} ${radialSize2}%, transparent ${radialSize2 + 20}%), ${backgroundStyle}`;
        }
        planetEl.style.background = backgroundStyle;
        planetEl.style.boxShadow = `0 0 ${newPlanet.size / 3}px rgba(255,255,255,0.3)`; // Simple glow

        // Add click listener to open planet visual panel
        planetEl.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent click from bubbling up to general pan listener
            if (!DOM.planetVisualPanel || !DOM.planetVisualTitle || !DOM.planetVisualSize || !DOM.planetVisualCanvas) {
                console.error("Planet visual panel elements not found!");
                return;
            }
            const wasPanelVisible = DOM.planetVisualPanel.classList.contains('visible');
            State.currentPlanetDisplayedInPanel = newPlanet; // Store reference to currently displayed planet
            DOM.planetVisualTitle.textContent = newPlanet.planetName;
            DOM.planetVisualSize.textContent = Math.round(newPlanet.size);
            DOM.planetVisualPanel.classList.add('visible');

            // Reset/restore panel position if it was previously open
            if (!wasPanelVisible) {
                DOM.planetVisualPanel.style.left = '50%';
                DOM.planetVisualPanel.style.top = '50%';
                DOM.planetVisualPanel.style.transform = 'translate(-50%, -50%)';
                DOM.planetVisualPanel.style.transition = ''; // Remove transition during initial placement
            } else {
                DOM.planetVisualPanel.style.transition = 'none'; // No transition if already visible
            }
            State.planetVisualRotationQuat = MathUtils.quat_identity(); // Reset rotation
            renderPlanetVisualPanel(newPlanet, State.planetVisualRotationQuat, DOM.planetVisualCanvas);
        });

        if (DOM.solarSystemContent) DOM.solarSystemContent.appendChild(planetEl);
        newPlanet.element = planetEl; // Store reference to the DOM element
    }

    // Preload planet data into worker cache for smoother visual panel loading
    if (WorkerManager.planetVisualWorker && State.gameSessionData.solarSystemView.planets && DOM.planetVisualCanvas) {
        State.gameSessionData.solarSystemView.planets.forEach(planetToPreload => {
            WorkerManager.preloadPlanet(planetToPreload, planetToPreload.id);
        });
    } else if (!DOM.planetVisualCanvas) {
        console.warn("planetVisualCanvas not found for preloading.");
    }

    // Set solar system screen as active
    ScreenManager.setActiveScreen(DOM.solarSystemScreen);

    // Make solar system title editable
    ScreenManager.makeTitleEditable(DOM.solarSystemTitleText, DOM.solarSystemTitleInput, (newName) => {
        if (solarSystemObject) {
            solarSystemObject.customName = newName || null;
            GameLifecycle.saveGameState(); // Save state after name change
            // Re-render galaxy detail screen to update system name there (if applicable)
            // This would likely involve a separate re-render for consistency:
            // GalaxyUI.renderGalaxyDetailScreen(false);
            return solarSystemObject.customName || `System ${solarSystemId.substring(solarSystemId.lastIndexOf('-') + 1)}`;
        }
        return `System ${solarSystemId.substring(solarSystemId.lastIndexOf('-') + 1)}`;
    });

    renderSolarSystemScreen(false); // Initial render with transitions (not interactive)
    AnimationManager.startSolarSystemAnimation(); // Start the planet animation loop
}
