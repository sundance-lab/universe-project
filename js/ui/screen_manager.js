// js/ui/screen_manager.js

import * as DOM from 'js/dom_elements.js';
import * as State from 'js/state.js';
import * as Config from 'js/config.js';
import * as AnimationManager from 'js/core/animation_manager.js';
import * as GameLifecycle from 'js/core/game_lifecycle.js';
import * as GalaxyUI from 'js/galaxy_ui.js';

export function setActiveScreen(screenToShow) {
    // Hide all screens and remove panning class
    [DOM.mainScreen, DOM.galaxyDetailScreen, DOM.solarSystemScreen, DOM.planetDesignerScreen].forEach(s => {
        if (s) s.classList.remove('active', 'panning-active');
    });

    if (screenToShow) {
        screenToShow.classList.add('active');
    }

    if (DOM.zoomControlsElement) {
        if (screenToShow === DOM.galaxyDetailScreen || screenToShow === DOM.solarSystemScreen) {
            DOM.zoomControlsElement.classList.add('visible');
        } else {
            DOM.zoomControlsElement.classList.remove('visible');
        }
    }

    // Manage visibility of general control buttons
    const showGlobalControls = (screenToShow === DOM.mainScreen || screenToShow === DOM.galaxyDetailScreen || screenToShow === DOM.solarSystemScreen);
    if (DOM.regenerateUniverseButton) DOM.regenerateUniverseButton.style.display = showGlobalControls ? 'block' : 'none';
    if (DOM.customizeGenerationButton) DOM.customizeGenerationButton.style.display = showGlobalControls ? 'block' : 'none';
    if (DOM.createPlanetDesignButton) DOM.createPlanetDesignButton.style.display = showGlobalControls ? 'block' : 'none';


    // Hide planet visual panel if not on solar system screen or if solar system is not active
    if (!(screenToShow === DOM.solarSystemScreen && DOM.planetVisualPanel && DOM.planetVisualPanel.classList.contains('visible')) && DOM.planetVisualPanel) {
        DOM.planetVisualPanel.classList.remove('visible');
    }
}

/**
 * Switches the view back to the main Universe screen.
 */
export function switchToMainView() {
    State.gameSessionData.activeGalaxyId = null;
    State.gameSessionData.activeSolarSystemId = null;
    AnimationManager.stopSolarSystemAnimation(); // Ensure solar system animation stops
    setActiveScreen(DOM.mainScreen);
}

export function makeTitleEditable(titleTextElement, inputElement, onSaveCallback) {
    if (!titleTextElement || !inputElement) return;

    // On double click, hide text, show input, focus
    titleTextElement.ondblclick = () => {
        titleTextElement.style.display = 'none';
        inputElement.style.display = 'inline-block';
        inputElement.value = titleTextElement.textContent; // Set input value to current text
        inputElement.focus();
        inputElement.select(); // Select all text for easy editing
    };

    // Save the new name on blur (when input loses focus)
    const saveName = () => {
        const newName = inputElement.value.trim();
        // Call the provided callback to update game state, get the actual name back for display
        const displayedName = onSaveCallback(newName || null); // Pass null if input is empty
        titleTextElement.textContent = displayedName;
        inputElement.style.display = 'none';
        titleTextElement.style.display = 'inline-block';
    };

    inputElement.onblur = saveName;

    // Handle Enter key (save) and Escape key (cancel)
    inputElement.onkeydown = (e) => {
        if (e.key === 'Enter') {
            inputElement.blur(); // Trigger blur to save
        } else if (e.key === 'Escape') {
            inputElement.value = titleTextElement.textContent; // Revert to original text
            inputElement.blur(); // Trigger blur without saving changes
        }
    };
}

export function startPan(event, viewportEl, contentEl, dataObjRef, clampFunction, renderFunction) {
    if (event.button !== 0 || event.target.closest('button')) return; // Only left-click and not on a button
    // Prevent panning if clicking directly on a solar system icon *within* the galaxy view
    if (viewportEl === DOM.galaxyViewport && event.target.closest('.solar-system-icon')) return;

    State.gameSessionData.panning.isActive = true;
    State.gameSessionData.panning.startX = event.clientX;
    State.gameSessionData.panning.startY = event.clientY;
    State.gameSessionData.panning.initialPanX = dataObjRef.currentPanX || 0;
    State.gameSessionData.panning.initialPanY = dataObjRef.currentPanY || 0;
    State.gameSessionData.panning.targetElement = contentEl;
    State.gameSessionData.panning.viewportElement = viewportEl;
    State.gameSessionData.panning.dataObject = dataObjRef;
    State.gameSessionData.panning.clampFunction = clampFunction;
    State.gameSessionData.panning.renderFunction = renderFunction;

    if (viewportEl) viewportEl.classList.add('dragging');
    if (contentEl) contentEl.style.transition = 'none'; // Disable transition during drag
    event.preventDefault(); // Prevent default browser drag behavior (e.g., image drag)
}

export function panMouseMove(event) {
    if (!State.gameSessionData.panning.isActive) return;
    const panning = State.gameSessionData.panning;
    if (!panning.dataObject) return;

    const deltaX = event.clientX - panning.startX;
    const deltaY = event.clientY - panning.startY;

    panning.dataObject.currentPanX = panning.initialPanX + deltaX;
    panning.dataObject.currentPanY = panning.initialPanY + deltaY;

    if (panning.viewportElement && panning.clampFunction && panning.renderFunction) {
        // Pass width/height to clamp function if its the solar system screen
        if (panning.viewportElement === DOM.solarSystemScreen) {
            panning.clampFunction(panning.dataObject, panning.viewportElement.offsetWidth, panning.viewportElement.offsetHeight);
        } else {
            panning.clampFunction(panning.dataObject);
        }
        panning.renderFunction(true); // Render interactively (no transition)
    }
}

/**
 * Finishes a panning operation, re-enabling transitions and updating final position.
 * Should be attached to `window.mouseup`.
 */
export function panMouseUp() {
    if (!State.gameSessionData.panning.isActive) return;

    const panning = State.gameSessionData.panning;
    if (panning.viewportElement) panning.viewportElement.classList.remove('dragging');

    panning.isActive = false;
    if (panning.targetElement) panning.targetElement.style.transition = ''; // Re-enable transition

    // Re-render non-interactively to apply final transitions
    if (panning.viewportElement === DOM.galaxyDetailScreen) GalaxyUI.renderGalaxyDetailScreen(false);
    else if (panning.viewportElement === DOM.solarSystemScreen) GalaxyUI.renderGalaxyDetailScreen(false); 
                                                                                                  
    if (panning.renderFunction) {
        // Pass false for isInteractive to allow transition
        panning.renderFunction(false);
    }
    // Clear state
    panning.targetElement = null;
    panning.viewportElement = null;
    panning.dataObject = null;
    panning.clampFunction = null;
    panning.renderFunction = null;
}
