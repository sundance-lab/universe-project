// js/ui/events.js

import * as DOM from '../dom_elements.js';
import * as State from '../state.js';
import * as Config from '../config.js';
import * as MathUtils from '../utils/math_utils.js';
import * as ScreenManager from './screen_manager.js';
import * as GalaxyUI from './galaxy_ui.js';
import * as SolarSystemUI from './solar_system_ui.js';
import * as PlanetDesignerUI from './planet_designer_ui.js';
import * as GameLifecycle from '../core/game_lifecycle.js';
import * as WorkerManager from '../workers/worker_manager.js';
import * as AnimationManager from '../core/animation_manager.js'; // Needed to stop animation on resize

export function setupGlobalEventListeners() {
    // --- Global Screen Navigation ---
    if (DOM.backToMainButton) DOM.backToMainButton.addEventListener('click', ScreenManager.switchToMainView);
    if (DOM.backToGalaxyButton) DOM.backToGalaxyButton.addEventListener('click', () => {
        if (State.gameSessionData.activeGalaxyId) {
            // Find the galaxy again from current state (in case it was regenerated)
            const targetGalaxy = State.gameSessionData.galaxies.find(g => g.id === State.gameSessionData.activeGalaxyId);
            if (targetGalaxy) {
                GalaxyUI.switchToGalaxyDetailView(targetGalaxy.id);
            } else {
                ScreenManager.switchToMainView(); // Fallback if active galaxy no longer exists
            }
        } else {
            ScreenManager.switchToMainView();
        }
    });

    // --- Global Controls (Customization, Regenerate, Designer) ---
    if (DOM.regenerateUniverseButton) DOM.regenerateUniverseButton.addEventListener('click', () => GameLifecycle.regenerateCurrentUniverseState(false));
    if (DOM.customizeGenerationButton) DOM.customizeGenerationButton.addEventListener('click', () => {
        if (!DOM.numGalaxiesInput) return; // Guard against null element
        DOM.numGalaxiesInput.value = State.appSettings.currentNumGalaxies; // Access appSettings
        DOM.minSSInput.value = State.appSettings.currentMinSSCount;
        DOM.maxSSInput.value = State.appSettings.currentMaxSSCount;
        DOM.ssSpreadInput.value = State.appSettings.currentMaxPlanetDistanceMultiplier.toFixed(1);
        DOM.minPlanetsInput.value = State.appSettings.currentMinPlanets;
        DOM.maxPlanetsInput.value = State.appSettings.currentMaxPlanets;
        DOM.showOrbitsInput.checked = State.appSettings.currentShowPlanetOrbits;
        DOM.customizationModal.classList.add('visible');
    });
    if (DOM.createPlanetDesignButton) DOM.createPlanetDesignButton.addEventListener('click', PlanetDesignerUI.switchToPlanetDesignerScreen);


    // --- Customization Modal ---
    if (DOM.cancelCustomizationButton) DOM.cancelCustomizationButton.addEventListener('click', () => { DOM.customizationModal.classList.remove('visible'); });
    if (DOM.applyCustomizationButton) DOM.applyCustomizationButton.addEventListener('click', () => {
        // Validation (copied from previous consolidate script logic)
        if (!DOM.numGalaxiesInput) return;
        const nG = parseInt(DOM.numGalaxiesInput.value, 10);
        const mSS = parseInt(DOM.minSSInput.value, 10);
        const mxSS = parseInt(DOM.maxSSInput.value, 10);
        const sp = parseFloat(DOM.ssSpreadInput.value);
        const mP = parseInt(DOM.minPlanetsInput.value, 10);
        const mxP = parseInt(DOM.maxPlanetsInput.value, 10);

        if (isNaN(nG) || nG < 1 || nG > 100 ||
            isNaN(mSS) || mSS < 1 || mSS > 1000 ||
            isNaN(mxSS) || mxSS < 1 || mxSS > 2000 || mxSS < mSS ||
            isNaN(sp) || sp < 0.1 || sp > 5.0 ||
            isNaN(mP) || mP < 0 || mP > 20 ||
            isNaN(mxP) || mxP < mP || mxP > 20) {
            alert("Invalid input values. Please check ranges and ensure Max >= Min. Ranges are: Galaxies (1-100), Solar Systems (1-1000, Max up to 2000), Spread (0.1-5.0), Planets (0-20, Max up to 20).");
            return;
        }
        // Apply settings to appSettings object
        State.appSettings.currentNumGalaxies = nG;
        State.appSettings.currentMinSSCount = mSS;
        State.appSettings.currentMaxSSCount = mxSS;
        State.appSettings.currentMaxPlanetDistanceMultiplier = sp;
        State.appSettings.currentMinPlanets = mP;
        State.appSettings.currentMaxPlanets = mxP;
        State.appSettings.currentShowPlanetOrbits = DOM.showOrbitsInput.checked;

        GameLifecycle.saveCustomizationSettings(); // Save these settings
        DOM.customizationModal.classList.remove('visible'); // Hide modal
        GameLifecycle.regenerateCurrentUniverseState(true); // Regenerate with new settings (force = true)
    });


    // --- Zoom Controls ---
    if (DOM.zoomInButton) DOM.zoomInButton.addEventListener('click', (e) => {
        if (DOM.galaxyDetailScreen.classList.contains('active')) GalaxyUI.handleGalaxyZoom('in', e);
        else if (DOM.solarSystemScreen.classList.contains('active')) SolarSystemUI.handleSolarSystemZoom('in', e);
    });
    if (DOM.zoomOutButton) DOM.zoomOutButton.addEventListener('click', (e) => {
        if (DOM.galaxyDetailScreen.classList.contains('active')) GalaxyUI.handleGalaxyZoom('out', e);
        else if (DOM.solarSystemScreen.classList.contains('active')) SolarSystemUI.handleSolarSystemZoom('out', e);
    });
    // Wheel zoom
    if (DOM.galaxyViewport) DOM.galaxyViewport.addEventListener('wheel', (e) => {
        if (DOM.galaxyDetailScreen.classList.contains('active')) {
            e.preventDefault(); // Prevent page scroll
            GalaxyUI.handleGalaxyZoom(e.deltaY < 0 ? 'in' : 'out', e);
        }
    });
    if (DOM.solarSystemScreen) DOM.solarSystemScreen.addEventListener('wheel', (e) => {
        if (DOM.solarSystemScreen.classList.contains('active')) {
            e.preventDefault(); // Prevent page scroll
            SolarSystemUI.handleSolarSystemZoom(e.deltaY < 0 ? 'in' : 'out', e);
        }
    });


    // --- Planet Visual Panel ---
    if (DOM.closePlanetVisualPanelBtn) DOM.closePlanetVisualPanelBtn.addEventListener('click', () => {
        if (DOM.planetVisualPanel) {
            DOM.planetVisualPanel.classList.remove('visible');
            State.currentPlanetDisplayedInPanel = null; // Clear displayed planet
        }
    });

    // Planet Visual Panel Dragging (header)
    if (DOM.planetVisualPanelHeader) DOM.planetVisualPanelHeader.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || !DOM.planetVisualPanel) return;
        State.isPanelDragging = true;
        DOM.planetVisualPanel.classList.add('dragging');
        DOM.planetVisualPanel.style.transition = 'none'; // Disable transition for dragging
        const rect = DOM.planetVisualPanel.getBoundingClientRect();
        State.visualPanelOffset.x = e.clientX - rect.left;
        State.visualPanelOffset.y = e.clientY - rect.top;
        // Set explicit position, remove transform for direct pixel control
        DOM.planetVisualPanel.style.left = `${e.clientX - State.visualPanelOffset.x}px`;
        DOM.planetVisualPanel.style.top = `${e.clientY - State.visualPanelOffset.y}px`;
        DOM.planetVisualPanel.style.transform = 'none';
        DOM.planetVisualPanel.style.right = 'auto'; // Ensure right/bottom don't interfere
        DOM.planetVisualPanel.style.bottom = 'auto';
        e.preventDefault(); // Prevent default browser drag behavior
    });

    // Planet Visual Canvas Dragging (for 3D rotation)
    if (DOM.planetVisualCanvas) {
        DOM.planetVisualCanvas.addEventListener('mousedown', (e) => {
            if (e.button !== 0 || !State.currentPlanetDisplayedInPanel) return;
            State.isDraggingPlanetVisual = true;
            State.startDragMouseX = e.clientX;
            State.startDragMouseY = e.clientY;
            State.startDragPlanetVisualQuat = [...State.planetVisualRotationQuat]; // Save current quaternion state
            DOM.planetVisualCanvas.classList.add('dragging');
            e.preventDefault(); // Prevent default drag behavior
        });
    }


    // --- Designer Planet Canvas Dragging (for 3D rotation) ---
    if (DOM.designerPlanetCanvas) {
        DOM.designerPlanetCanvas.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            State.isDraggingDesignerPlanet = true;
            State.designerStartDragMouseX = e.clientX;
            State.designerStartDragMouseY = e.clientY;
            State.startDragDesignerPlanetQuat = [...State.designerPlanetRotationQuat];
            DOM.designerPlanetCanvas.classList.add('dragging');
            e.preventDefault();
        });
    }

    // --- Global Mouse Move and Up (for dragging) ---
    window.addEventListener('mousemove', (e) => {
        // Panel dragging
        if (State.isPanelDragging && DOM.planetVisualPanel) {
            DOM.planetVisualPanel.style.left = `${e.clientX - State.visualPanelOffset.x}px`;
            DOM.planetVisualPanel.style.top = `${e.clientY - State.visualPanelOffset.y}px`;
        }

        // Planet Visual Canvas Rotation
        if (State.isDraggingPlanetVisual && State.currentPlanetDisplayedInPanel && DOM.planetVisualCanvas && DOM.planetVisualPanel.classList.contains('visible')) {
            const rect = DOM.planetVisualCanvas.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return; // Avoid division by zero

            const canvasWidth = rect.width;
            const canvasHeight = rect.height;
            const deltaX = e.clientX - State.startDragMouseX;
            const deltaY = e.clientY - State.startDragMouseY;

            // Calculate rotation amount based on mouse movement relative to canvas size and sensitivity
            const rotationAroundX = (deltaY / canvasHeight) * Math.PI * Config.PLANET_ROTATION_SENSITIVITY;
            const rotationAroundY = (deltaX / canvasWidth) * (2 * Math.PI) * Config.PLANET_ROTATION_SENSITIVITY;

            // Create quaternions for X and Y axis rotations
            const xAxisRotationQuat = MathUtils.quat_from_axis_angle([1, 0, 0], -rotationAroundX);
            const yAxisRotationQuat = MathUtils.quat_from_axis_angle([0, 1, 0], rotationAroundY);

            // Apply the new rotations to the initial quaternion when drag started
            const incrementalRotationQuat = MathUtils.quat_multiply(yAxisRotationQuat, xAxisRotationQuat);
            State.planetVisualRotationQuat = MathUtils.quat_normalize(MathUtils.quat_multiply(incrementalRotationQuat, State.startDragPlanetVisualQuat));

            // Request render if worker is not busy
            if (!State.isRenderingVisualPlanet && WorkerManager.planetVisualWorker) {
                WorkerManager.renderPlanet(State.currentPlanetDisplayedInPanel, State.planetVisualRotationQuat, DOM.planetVisualCanvas.id);
            } else {
                State.needsPlanetVisualRerender = true; // Mark for re-render when worker is free
            }
        }
        // Designer Planet Canvas Rotation
        else if (State.isDraggingDesignerPlanet && DOM.designerPlanetCanvas) {
            const rect = DOM.designerPlanetCanvas.getBoundingClientRect();
            const canvasEffectiveWidth = (DOM.designerPlanetCanvas.width > 0 ? DOM.designerPlanetCanvas.width : rect.width) || 1;
            const canvasEffectiveHeight = (DOM.designerPlanetCanvas.height > 0 ? DOM.designerPlanetCanvas.height : rect.height) || 1;
            if (canvasEffectiveWidth === 0 || canvasEffectiveWidth === 0) return;

            const deltaX = e.clientX - State.designerStartDragMouseX;
            const deltaY = e.clientY - State.designerStartDragMouseY;

            const rotationAroundX = (deltaY / canvasEffectiveHeight) * Math.PI * Config.PLANET_ROTATION_SENSITIVITY;
            const rotationAroundY = (deltaX / canvasEffectiveWidth) * (2 * Math.PI) * Config.PLANET_ROTATION_SENSITIVITY;

            const xAxisRotationQuat = MathUtils.quat_from_axis_angle([1, 0, 0], -rotationAroundX);
            const yAxisRotationQuat = MathUtils.quat_from_axis_angle([0, 1, 0], rotationAroundY);

            const incrementalRotationQuat = MathUtils.quat_multiply(yAxisRotationQuat, xAxisRotationQuat);
            State.designerPlanetRotationQuat = MathUtils.quat_normalize(MathUtils.quat_multiply(incrementalRotationQuat, State.startDragDesignerPlanetQuat));

            if (!State.isRenderingDesignerPlanet && State.currentDesignerPlanetInstance && WorkerManager.designerWorker) {
                PlanetDesignerUI.renderDesignerPlanet(State.currentDesignerPlanetInstance, State.designerPlanetRotationQuat);
            }
        }

        ScreenManager.panMouseMove(e); // Pass to general pan logic
    });

    window.addEventListener('mouseup', () => {
        // Reset specific dragging flags
        if (State.isPanelDragging && DOM.planetVisualPanel) {
            State.isPanelDragging = false;
            DOM.planetVisualPanel.classList.remove('dragging');
            DOM.planetVisualPanel.style.transition = '';
        }
        if (State.isDraggingPlanetVisual && DOM.planetVisualCanvas) {
            State.isDraggingPlanetVisual = false;
            DOM.planetVisualCanvas.classList.remove('dragging');
        }
        if (State.isDraggingDesignerPlanet && DOM.designerPlanetCanvas) {
            State.isDraggingDesignerPlanet = false;
            DOM.designerPlanetCanvas.classList.remove('dragging');
        }

        ScreenManager.panMouseUp(); // Pass to general pan logic
    });


    // --- Galaxy View Specific Panning & Click Handling ---
    if (DOM.galaxyViewport) {
        // Click handler for solar system icons (fires on release, after pan check)
        DOM.galaxyViewport.addEventListener('click', function(event) {
            // Check if it was a "real" pan (significant movement) or just a simple click
            const panThreshold = 5; // pixels
            if (State.gameSessionData.panning.isActive && (Math.abs(event.clientX - State.gameSessionData.panning.startX) > panThreshold ||
                Math.abs(event.clientY - State.gameSessionData.panning.startY) > panThreshold)) {
                return; // It was a pan, not a simple click of an icon
            }

            const ssIcon = event.target.closest('.solar-system-icon');
            if (ssIcon) {
                const ssId = ssIcon.dataset.solarSystemId;
                if (ssId) {
                    SolarSystemUI.switchToSolarSystemView(ssId);
                    event.stopPropagation(); // Stop propagation to prevent further clicks on the viewport
                }
            }
        }); // No `true` here to allow bubbling for the pan's mousedown

        // Galaxy Panning (separate from general pan for more specific logic)
        // Store current galaxy panning state
        let isGalaxyPanningSpecific = false;
        let galaxyPanStartSpecific = { x: 0, y: 0 };
        let galaxyLastPanSpecific = { x: 0, y: 0 };

        DOM.galaxyViewport.addEventListener('mousedown', (e) => {
            // Only activate if left-click, on galaxy detail screen, and not clicking on an icon/button
            if (e.button !== 0 || !DOM.galaxyDetailScreen.classList.contains('active') || e.target.closest('.solar-system-icon') || e.target.closest('button')) return;

            isGalaxyPanningSpecific = true;
            galaxyPanStartSpecific.x = e.clientX;
            galaxyPanStartSpecific.y = e.clientY;
            const gal = State.gameSessionData.galaxies.find(g => g.id === State.gameSessionData.activeGalaxyId);
            galaxyLastPanSpecific.x = gal ? gal.currentPanX || 0 : 0;
            galaxyLastPanSpecific.y = gal ? gal.currentPanY || 0 : 0;

            DOM.galaxyViewport.classList.add('dragging');
            if (DOM.galaxyZoomContent) DOM.galaxyZoomContent.style.transition = 'none'; // Disable transition during pan

            e.preventDefault(); // Prevent default browser drag behavior

            // Set up general panning state for click detection in the 'click' listener
            State.gameSessionData.panning.startX = e.clientX;
            State.gameSessionData.panning.startY = e.clientY;
            State.gameSessionData.panning.isActive = true; // Temporarily set to true for click detection
        });

        // Use a function for mousemove to allow easy attachment/detachment
        const galaxyMouseMoveHandler = (e) => {
            if (!isGalaxyPanningSpecific) return;
            const gal = State.gameSessionData.galaxies.find(g => g.id === State.gameSessionData.activeGalaxyId);
            if (!gal) return;

            const dx = e.clientX - galaxyPanStartSpecific.x;
            const dy = e.clientY - galaxyPanStartSpecific.y;

            gal.currentPanX = galaxyLastPanSpecific.x + dx;
            gal.currentPanY = galaxyLastPanSpecific.y + dy;

            GalaxyUI.clampGalaxyPan(gal);
            GalaxyUI.renderGalaxyDetailScreen(true); // Render interactively
        };
        window.addEventListener('mousemove', galaxyMouseMoveHandler); // Listen on window for dragging outside viewport

        const galaxyMouseUpHandler = () => {
            if (isGalaxyPanningSpecific) {
                isGalaxyPanningSpecific = false;
                if (DOM.galaxyViewport) DOM.galaxyViewport.classList.remove('dragging');
                if (DOM.galaxyZoomContent) DOM.galaxyZoomContent.style.transition = ''; // Re-enable transition
                GalaxyUI.renderGalaxyDetailScreen(false); // Final render with transitions re-enabled
                State.gameSessionData.panning.isActive = false; // Reset general pan state
            }
        };
        window.addEventListener('mouseup', galaxyMouseUpHandler); // Listen on window for releasing outside viewport
    }


    // --- Planet Designer Screen Inputs and Buttons ---
    if (DOM.designerRandomizeBtn) DOM.designerRandomizeBtn.addEventListener('click', PlanetDesignerUI.randomizeDesignerPlanet);
    if (DOM.designerSaveBtn) DOM.designerSaveBtn.addEventListener('click', PlanetDesignerUI.saveCustomPlanetDesign);
    if (DOM.designerCancelBtn) DOM.designerCancelBtn.addEventListener('click', () => {
        if (DOM.mainScreen) ScreenManager.setActiveScreen(DOM.mainScreen);
        else console.error("mainScreen not found for designerCancelBtn");
    });
    // Add change listeners for all designer input fields
    [
        DOM.designerMinHeightMinInput, DOM.designerMinHeightMaxInput,
        DOM.designerMaxHeightMinInput, DOM.designerMaxHeightMaxInput,
        DOM.designerOceanHeightMinInput, DOM.designerOceanHeightMaxInput,
        DOM.designerWaterColorInput, DOM.designerLandColorInput
    ].forEach(input => {
        if (input) input.addEventListener('change', PlanetDesignerUI.updateBasisAndRefreshDesignerPreview);
    });


    // --- Window Resize Listener ---
    // The previous implementation was trying to reassign `State.gameSessionData` itself, which is a `const` export.
    // Instead, we re-initialize its *properties*.
    window.addEventListener('resize', () => {
        const activeScreenElement = document.querySelector('.screen.active');
        const currentScreenId = activeScreenElement ? activeScreenElement.id : 'main-screen';

        // Preserve current custom planet designs across resize regeneration
        const preservedCustomDesigns = [...State.gameSessionData.customPlanetDesigns];

        // Mute properties of the existing State.gameSessionData object to clear it effectively
        State.gameSessionData.universe.diameter = null;
        State.gameSessionData.galaxies = [];
        State.gameSessionData.activeGalaxyId = null;
        State.gameSessionData.activeSolarSystemId = null;
        State.gameSessionData.solarSystemView = { zoomLevel: 1.0, currentPanX: 0, currentPanY: 0, planets: [], systemId: null };
        State.gameSessionData.isInitialized = false;
        // Re-initialize panning state properties as well, rather than replacing the object
        State.gameSessionData.panning.isActive = false;
        State.gameSessionData.panning.startX = 0;
        State.gameSessionData.panning.startY = 0;
        State.gameSessionData.panning.initialPanX = 0;
        State.gameSessionData.panning.initialPanY = 0;
        State.gameSessionData.panning.targetElement = null;
        State.gameSessionData.panning.viewportElement = null;
        State.gameSessionData.panning.dataObject = null;
        State.gameSessionData.panning.clampFunction = null;
        State.gameSessionData.panning.renderFunction = null;

        State.gameSessionData.customPlanetDesigns = preservedCustomDesigns; // Restore preserved designs

        // Clear UI elements
        if (DOM.universeCircle) DOM.universeCircle.innerHTML = '';
        if (DOM.galaxyZoomContent) {
            const canvasLines = DOM.galaxyZoomContent.querySelector('#solar-system-lines-canvas');
            DOM.galaxyZoomContent.innerHTML = '';
            if (canvasLines) DOM.galaxyZoomContent.appendChild(canvasLines);
        }
        if (DOM.solarSystemContent) DOM.solarSystemContent.innerHTML = '';
        // Clear orbit canvas if it exists
        if (State.solarSystemOrbitCtx && State.solarSystemOrbitCanvasEl) {
            State.solarSystemOrbitCtx.clearRect(0, 0, State.solarSystemOrbitCanvasEl.width, State.solarSystemOrbitCanvasEl.height);
        }
        // Stop any running animations
        AnimationManager.stopSolarSystemAnimation();

        // Re-initialize the game with forced regeneration
        GameLifecycle.initializeGame(true);

        // Attempt to return to the previously active screen
        const screenToActivate = DOM.elements[currentScreenId]; // Access directly by ID from exported DOM elements
        if (screenToActivate) {
            if (currentScreenId === 'planet-designer-screen') {
                PlanetDesignerUI.switchToPlanetDesignerScreen();
            } else if (currentScreenId === 'galaxy-detail-screen' && State.gameSessionData.activeGalaxyId) {
                GalaxyUI.switchToGalaxyDetailView(State.gameSessionData.activeGalaxyId);
            } else if (currentScreenId === 'solar-system-screen' && State.gameSessionData.activeSolarSystemId) {
                SolarSystemUI.switchToSolarSystemView(State.gameSessionData.activeSolarSystemId);
            } else {
                ScreenManager.setActiveScreen(screenToActivate);
            }
        } else {
            ScreenManager.setActiveScreen(DOM.mainScreen); // Fallback
        }

        // Handle re-rendering of planet visuals if a panel was open
        if (DOM.planetVisualPanel.classList.contains('visible') && State.currentPlanetDisplayedInPanel && DOM.planetVisualCanvas) {
            SolarSystemUI.renderPlanetVisualPanel(State.currentPlanetDisplayedInPanel, State.planetVisualRotationQuat, DOM.planetVisualCanvas);
        }
        if (DOM.designerPlanetCanvas && DOM.planetDesignerScreen.classList.contains('active')) {
            PlanetDesignerUI.resizeDesignerCanvasToDisplaySize();
            if (State.currentDesignerPlanetInstance) {
                PlanetDesignerUI.renderDesignerPlanet(State.currentDesignerPlanetInstance, State.designerPlanetRotationQuat);
            }
        }
    });

    // --- Solar System Panning ---
    if (DOM.solarSystemScreen) {
        DOM.solarSystemScreen.addEventListener('mousedown', (e) => {
            if (DOM.solarSystemScreen.classList.contains('active')) {
                // Pass SolarSystemUI.clampSolarSystemPan and SolarSystemUI.renderSolarSystemScreen functions
                ScreenManager.startPan(e, DOM.solarSystemScreen, DOM.solarSystemContent, State.gameSessionData.solarSystemView, SolarSystemUI.clampSolarSystemPan, SolarSystemUI.renderSolarSystemScreen);
            }
        });
    }

}
