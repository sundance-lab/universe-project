// js/ui/galaxy_ui.js

import * as DOM from './dom_elements.js';
import * as State from './state.js';
import * as Config from './config.js';
import * as MathUtils from '../utils/math_utils.js';
import * as ScreenManager from './screen_manager.js';
import * as GameLifecycle from '../core/game_lifecycle.js';
import * as GameGeneration from '../core/game_generation.js';
import * as SolarSystemUI from './solar_system_ui.js'; // To call switchToSolarSystemView

// Variable for canvas 2D rendering context
let linesCtx;

export function renderMainScreen() {
    if (DOM.mainScreenTitleText) DOM.mainScreenTitleText.textContent = "Universe";
    if (!DOM.universeCircle) return;

    DOM.universeCircle.innerHTML = ''; // Clear existing galaxies

    State.gameSessionData.galaxies.forEach(galaxy => {
        const galaxyIDNum = galaxy.id.split('-').pop(); // Extract number from ID like 'galaxy-1'
        const el = document.createElement('div');
        el.className = 'galaxy-icon';
        el.style.width = `${Config.GALAXY_ICON_SIZE}px`;
        el.style.height = `${Config.GALAXY_ICON_SIZE}px`;
        el.style.left = `${galaxy.x}px`;
        el.style.top = `${galaxy.y}px`;
        el.style.backgroundColor = Config.FIXED_COLORS.galaxyIconFill;
        el.style.border = `3px solid ${Config.FIXED_COLORS.galaxyIconBorder}`;
        el.title = galaxy.customName || `Galaxy ${galaxyIDNum}`; // Set title for tooltip
        el.dataset.galaxyId = galaxy.id; // Store galaxy ID for event listener

        el.addEventListener('click', () => switchToGalaxyDetailView(galaxy.id));
        DOM.universeCircle.appendChild(el);
    });
}

/**
 * Draws connection lines between solar systems in the current galaxy view.
 * @param {object} galaxy - The galaxy data containing solar systems and connections.
 */
export function drawGalaxyLines(galaxy) {
    if (!DOM.solarSystemLinesCanvasEl || !DOM.galaxyZoomContent) return;

    // Ensure canvas dimensions match its parent for correct rendering
    if (DOM.galaxyZoomContent.offsetWidth > 0 && DOM.solarSystemLinesCanvasEl.width !== DOM.galaxyZoomContent.offsetWidth) {
        DOM.solarSystemLinesCanvasEl.width = DOM.galaxyZoomContent.offsetWidth;
    }
    if (DOM.galaxyZoomContent.offsetHeight > 0 && DOM.solarSystemLinesCanvasEl.height !== DOM.galaxyZoomContent.offsetHeight) {
        DOM.solarSystemLinesCanvasEl.height = DOM.galaxyZoomContent.offsetHeight;
    }

    // Get 2D rendering context (initialize if not already)
    if (!linesCtx) linesCtx = DOM.solarSystemLinesCanvasEl.getContext('2d');
    if (!linesCtx) {
        console.error("Could not get 2D context for galaxy lines canvas.");
        return;
    }

    linesCtx.clearRect(0, 0, DOM.solarSystemLinesCanvasEl.width, DOM.solarSystemLinesCanvasEl.height); // Clear previous lines

    if (!galaxy || !galaxy.lineConnections || !galaxy.solarSystems) return;

    linesCtx.strokeStyle = Config.FIXED_COLORS.connectionLine;
    linesCtx.lineWidth = 0.5;
    linesCtx.setLineDash([]); // Ensure no dashes are used for connection lines

    // Cache solar system positions for efficient drawing
    const systemPositions = {};
    galaxy.solarSystems.forEach(ss => {
        systemPositions[ss.id] = { x: ss.x + ss.iconSize / 2, y: ss.y + ss.iconSize / 2 };
    });

    // Draw each connection line
    galaxy.lineConnections.forEach(connection => {
        const fromPos = systemPositions[connection.fromId];
        const toPos = systemPositions[connection.toId];
        if (fromPos && toPos) {
            linesCtx.beginPath();
            linesCtx.moveTo(fromPos.x, fromPos.y);
            linesCtx.lineTo(toPos.x, toPos.y);
            linesCtx.stroke();
        }
    });
}

/**
 * Renders the detail view of a galaxy, showing its solar systems and connections.
 * @param {boolean} isInteractive - If true, disables CSS transitions for immediate updates (e.g., during panning/zooming).
 */
export function renderGalaxyDetailScreen(isInteractive = false) {
    const galaxy = State.gameSessionData.galaxies.find(g => g.id === State.gameSessionData.activeGalaxyId);
    if (!galaxy) {
        ScreenManager.switchToMainView(); // Fallback if galaxy is somehow not found
        return;
    }
    if (!DOM.galaxyViewport || !DOM.galaxyZoomContent) return;

    // Set galaxy viewport dimensions (assumes it matches universe diameter setup)
    DOM.galaxyViewport.style.width = `${State.gameSessionData.universe.diameter || 500}px`;
    DOM.galaxyViewport.style.height = `${State.gameSessionData.universe.diameter || 500}px`;

    // Remove existing solar system icons to re-render them
    const existingIcons = DOM.galaxyZoomContent.querySelectorAll('.solar-system-icon');
    existingIcons.forEach(icon => icon.remove());

    const zoomScaleDivisor = 0.6; // Controls how much icon size changes with zoom (e.g., 0.6 = moderate scaling)
    galaxy.solarSystems.forEach(solarSystem => {
        const el = document.createElement('div');
        el.className = 'solar-system-icon';

        // Calculate icon display size: larger at higher zoom levels, then counter-scaled by transform
        const baseEffectiveZoom = 1 + (galaxy.currentZoom - Config.GALAXY_VIEW_MIN_ZOOM) * zoomScaleDivisor;
        let displayIconPx = solarSystem.iconSize * baseEffectiveZoom;
        if (galaxy.currentZoom > 0) {
            displayIconPx = displayIconPx / galaxy.currentZoom; // Counter-scale due to transform scale
        }
        displayIconPx = Math.max(2.5, displayIconPx); // Ensure minimum size for visibility

        el.style.width = `${displayIconPx}px`;
        el.style.height = `${displayIconPx}px`;

        // Adjust position so the icon's center aligns with the system's (X,Y) coordinates
        const currentOffset = displayIconPx / 2;
        const baseCircleOffset = solarSystem.iconSize / 2;
        el.style.left = `${solarSystem.x + baseCircleOffset - currentOffset}px`;
        el.style.top = `${solarSystem.y + baseCircleOffset - currentOffset}px`;

        el.dataset.solarSystemId = solarSystem.id;
        el.title = solarSystem.customName || `System ${solarSystem.id.split('-').pop()}`; // Tooltip

        // Add event listener to switch to solar system view on click
        el.addEventListener('click', e => { e.stopPropagation(); SolarSystemUI.switchToSolarSystemView(solarSystem.id); });
        DOM.galaxyZoomContent.appendChild(el);
    });

    // Ensure the lines canvas is the first child of galaxyZoomContent so icons are on top
    if (DOM.solarSystemLinesCanvasEl.parentNode !== DOM.galaxyZoomContent || DOM.galaxyZoomContent.firstChild !== DOM.solarSystemLinesCanvasEl) {
        DOM.galaxyZoomContent.insertBefore(DOM.solarSystemLinesCanvasEl, DOM.galaxyZoomContent.firstChild);
    }
    drawGalaxyLines(galaxy); // Redraw lines

    // Apply pan and zoom transforms
    DOM.galaxyZoomContent.style.transition = isInteractive ? 'none' : 'transform 0.1s ease-out';
    DOM.galaxyZoomContent.style.transform = `translate(${galaxy.currentPanX}px,${galaxy.currentPanY}px)scale(${galaxy.currentZoom})`;

    // Update galaxy title
    if (DOM.galaxyDetailTitleText) {
        const galaxyIDNum = galaxy.id.split('-').pop();
        DOM.galaxyDetailTitleText.textContent = galaxy.customName || `Galaxy ${galaxyIDNum}`;
    }
}

export function clampGalaxyPan(galaxy) {
    if (!galaxy || !DOM.galaxyViewport) return;

    const viewportWidth = DOM.galaxyViewport.offsetWidth;
    const viewportHeight = DOM.galaxyViewport.offsetHeight;
    const zoom = galaxy.currentZoom;

    if (zoom <= Config.GALAXY_VIEW_MIN_ZOOM) {
        // If zoomed out to minimum, reset pan to center
        galaxy.currentPanX = 0;
        galaxy.currentPanY = 0;
    } else {
        // Calculate the effective size of the content after zooming
        const zoomedUniverseWidth = (State.gameSessionData.universe.diameter || 500) * zoom;
        const zoomedUniverseHeight = (State.gameSessionData.universe.diameter || 500) * zoom;

        // Calculate the maximum allowed panning offset from the center of the viewport
        const maxPanOffsetX = Math.max(0, (zoomedUniverseWidth - viewportWidth) / 2);
        const maxPanOffsetY = Math.max(0, (zoomedUniverseHeight - viewportHeight) / 2);

        // Clamp the pan coordinates within the calculated limits
        galaxy.currentPanX = Math.max(-maxPanOffsetX, Math.min(maxPanOffsetX, galaxy.currentPanX));
        galaxy.currentPanY = Math.max(-maxPanOffsetY, Math.min(maxPanOffsetY, galaxy.currentPanY));
    }
}

export function handleGalaxyZoom(direction, mouseEvent = null) {
    const galaxy = State.gameSessionData.galaxies.find(g => g.id === State.gameSessionData.activeGalaxyId);
    if (!galaxy) return;

    const oldZoom = galaxy.currentZoom;
    let newZoom = oldZoom + (direction === 'in' ? (Config.ZOOM_STEP * oldZoom) : -(Config.ZOOM_STEP * oldZoom));

    // Clamp new zoom level within min/max bounds
    newZoom = Math.max(Config.GALAXY_VIEW_MIN_ZOOM, Math.min(Config.GALAXY_VIEW_MAX_ZOOM, newZoom));

    // If zoom hasn't effectively changed, return early
    if (Math.abs(oldZoom - newZoom) < 0.0001) return;

    galaxy.currentZoom = newZoom;

    // Adjust pan to keep the mouse point fixed during zooming
    if (mouseEvent && DOM.galaxyViewport) {
        const rect = DOM.galaxyViewport.getBoundingClientRect();
        const mouseXInViewport = mouseEvent.clientX - rect.left;
        const mouseYInViewport = mouseEvent.clientY - rect.top;

        // Mouse coordinates relative to viewport center
        const mouseXRelativeToCenter = mouseXInViewport - (DOM.galaxyViewport.offsetWidth / 2);
        const mouseYRelativeToCenter = mouseYInViewport - (DOM.galaxyViewport.offsetHeight / 2);

        const currentPanX = galaxy.currentPanX || 0;
        const currentPanY = galaxy.currentPanY || 0;

        // World coordinates of the mouse point
        const worldX = (mouseXRelativeToCenter - currentPanX) / oldZoom;
        const worldY = (mouseYRelativeToCenter - currentPanY) / oldZoom;

        // New pan position to keep worldX, worldY under the mouse
        galaxy.currentPanX = mouseXRelativeToCenter - (worldX * newZoom);
        galaxy.currentPanY = mouseYRelativeToCenter - (worldY * newZoom);
    }

    clampGalaxyPan(galaxy); // Re-clamp pan after zoom and pan adjustment
    renderGalaxyDetailScreen(true); // Re-render interactively
}

export function switchToGalaxyDetailView(galaxyId) {
    const galaxy = State.gameSessionData.galaxies.find(g => g.id === galaxyId);
    if (!galaxy) {
        ScreenManager.switchToMainView(); // Fallback if galaxy not found
        return;
    }

    State.gameSessionData.activeGalaxyId = galaxyId;
    const galaxyIDNum = galaxy.id.split('-').pop();

    // Update back button text (e.g., "<- Galaxy 1" or "<- Andromeda")
    if (DOM.backToGalaxyButton) {
        DOM.backToGalaxyButton.textContent = galaxy.customName ? `← ${galaxy.customName}` : `← Galaxy ${galaxyIDNum}`;
    }

    State.gameSessionData.activeSolarSystemId = null; // Clear active solar system when going to galaxy view
    AnimationManager.stopSolarSystemAnimation(); // Ensure solar system animation stops

    // Initialize/restore galaxy's specific zoom and pan
    galaxy.currentZoom = galaxy.currentZoom || 1.0;
    galaxy.currentPanX = galaxy.currentPanX || 0;
    galaxy.currentPanY = galaxy.currentPanY || 0;

    // Set galaxy title (text and input for editing)
    if (DOM.galaxyDetailTitleText) {
        DOM.galaxyDetailTitleText.textContent = galaxy.customName || `Galaxy ${galaxyIDNum}`;
        DOM.galaxyDetailTitleText.style.display = 'inline-block';
    }
    if (DOM.galaxyDetailTitleInput) {
        DOM.galaxyDetailTitleInput.style.display = 'none';
    }

    ScreenManager.setActiveScreen(DOM.galaxyDetailScreen);

    // Make galaxy title editable
    ScreenManager.makeTitleEditable(DOM.galaxyDetailTitleText, DOM.galaxyDetailTitleInput, (newName) => {
        galaxy.customName = newName || null;
        GameLifecycle.saveGameState(); // Save state after name change
        renderMainScreen(); // Re-render main screen to update galaxy name there
        return galaxy.customName || `Galaxy ${galaxyIDNum}`;
    });

    // Set galaxy viewport dimensions (matches universe diameter)
    if (DOM.galaxyViewport && State.gameSessionData.universe.diameter) {
        DOM.galaxyViewport.style.width = `${State.gameSessionData.universe.diameter}px`;
        DOM.galaxyViewport.style.height = `${State.gameSessionData.universe.diameter}px`;
    }

    // Generate solar systems if not already generated for this galaxy
    if (!galaxy.layoutGenerated) {
        // Delay generation slightly to ensure DOM elements are fully rendered and have dimensions
        setTimeout(() => {
            function attemptLayoutGeneration(retriesLeft = 5) {
                if (DOM.galaxyViewport && DOM.galaxyViewport.offsetWidth > 0 && DOM.galaxyViewport.offsetHeight > 0) {
                    GameGeneration.generateSolarSystemsForGalaxy(galaxyId);
                    renderGalaxyDetailScreen(false);
                } else if (retriesLeft > 0) {
                    requestAnimationFrame(() => attemptLayoutGeneration(retriesLeft - 1));
                } else {
                    console.warn("Galaxy viewport never got dimensions for layout generation. Proceeding without layout.");
                    galaxy.layoutGenerated = true; // Mark as generated to avoid infinite loops
                    renderGalaxyDetailScreen(false);
                }
            }
            attemptLayoutGeneration();
        }, 50); // Small delay
    } else {
        renderGalaxyDetailScreen(false); // Render using existing layout
    }
}
