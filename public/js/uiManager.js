// public/js/uiManager.js
import * as THREE from 'three';
import { GalaxyRenderer } from './galaxyRenderer.js';
import { generateSolarSystemsForGalaxy } from './universeGenerator.js';
import { SolarSystemRenderer } from './solarSystemRenderer.js';
import { HexPlanetViewController } from './hexPlanetViewController.js';
import GameStateManager from './gameStateManager.js'; // Import the state manager

export const UIManager = (() => {
    let elements = {};
    let callbacks = {};
    let currentStarfieldCleanup;
    let currentGalaxyRenderer = null;

    // Cached DOM elements for Galaxy Customization
    let galaxyCustomizationModal, galaxyCustomizeBtn;
    let galaxyRadiusInput, galaxyThicknessInput, galaxyCoreRadiusInput, galaxyNumArmsInput, galaxyArmRotationMultiplierInput;
    let galaxyStarsDecorativeInput, galaxyStarsCoreInput, galaxyStarsDiskInput, galaxyStarsHaloInput, galaxyDecorativeStarMaxSizeInput, galaxyDecorativeStarMinSizeInput;
    let galaxyDustCountInput, galaxyDustSizeInput, galaxyDustOpacityInput;
    let galaxyNebulaClusterCountInput, galaxyNebulaParticleCountPerClusterInput, galaxyNebulaSizeInput, galaxyNebulaOpacityInput;
    let galaxyDistantGalaxiesCountInput, galaxyDistantGalaxiesMinScaleInput, galaxyDistantGalaxiesMaxScaleInput, galaxyDistantGalaxiesMinOpacityInput, galaxyDistantGalaxiesMaxOpacityInput, galaxyDistantGalaxiesMinDistanceMultiplierInput, galaxyDistantGalaxiesMaxDistanceAdditionInput;
    let galaxySisterStarCountInput, galaxySisterRadiusMultiplierInput, galaxySisterThicknessMultiplierInput, galaxySisterDisplacementMultiplierInput, galaxySisterParticleSizeInput, galaxySisterOpacityInput;
    let galaxyCameraFovInput, galaxyCameraNearInput, galaxyCameraFarInput, galaxyControlsDampingFactorInput, galaxyControlsMinDistanceInput, galaxyControlsMaxDistanceMultiplierInput, galaxyRotationSpeedInput;
    let galaxyColorStarTextureColorInput, galaxyColorCoreGlowColorInput, galaxyColorDustColorStop0Input, galaxyColorDustColorStop04Input, galaxyColorNebulaColorStop0Input, galaxyColorNebulaColorStop04Input, galaxyColorBackgroundStarColorInput, galaxyColorSkyboxColorInput;
    let galaxyRandomizePaletteBtn, galaxyRandomizeAllBtn, galaxySaveDesignBtn, galaxyLoadDesignBtn, galaxyCancelBtn, galaxyApplyBtn;
    let savedGalaxyDesignsUl;

    // Event handler references for cleanup
    let boundGalaxyControlChangeHandler, boundGalaxyRandomizeAllHandler, boundGalaxyRandomizePaletteHandler, boundGalaxySaveDesignHandler, boundGalaxyLoadDesignHandler, boundGalaxyCancelHandler, boundGalaxyApplyHandler, boundSavedGalaxyDesignsClickHandler;


    function _getPlanetTypeString(planetType) { /* ... no changes ... */ }

    function _renderPlanetSidebar(planets) { /* ... no changes ... */ }

    function makeTitleEditable(titleTextElement, inputElement, onSaveCallback) {
        if (!titleTextElement || !inputElement) return;

        titleTextElement.ondblclick = () => {
            titleTextElement.style.display = 'none';
            inputElement.style.display = 'inline-block';
            inputElement.value = titleTextElement.textContent;
            inputElement.focus();
            inputElement.select();
        };
        const saveName = () => {
            const newName = inputElement.value.trim();
            // The onSaveCallback now handles the state update directly.
            const displayName = onSaveCallback(newName || null);
            titleTextElement.textContent = displayName;
            inputElement.style.display = 'none';
            titleTextElement.style.display = 'inline-block';
        };
        inputElement.onblur = saveName;
        inputElement.onkeydown = (e) => {
            if (e.key === 'Enter') inputElement.blur();
            else if (e.key === 'Escape') {
                inputElement.value = titleTextElement.textContent;
                inputElement.blur();
            }
        };
    }

    function generateStarBackgroundCanvas(containerElement) { /* ... no changes ... */ }

    function setActiveScreen(screenToShow) {
        const screens = [elements.mainScreen, elements.galaxyDetailScreen, elements.solarSystemScreen, elements.planetDesignerScreen, elements.hexPlanetScreen, galaxyCustomizationModal].filter(s => s);
        screens.forEach(s => s.classList.remove('active', 'panning-active', 'visible'));
        if (screenToShow) screenToShow.classList.add('active');
        if (elements.planetSidebar) elements.planetSidebar.style.display = (screenToShow === elements.solarSystemScreen) ? 'block' : 'none';
        const isOnOverlayScreen = (screenToShow === elements.planetDesignerScreen || screenToShow === elements.hexPlanetScreen || screenToShow === galaxyCustomizationModal);
        
        if (elements.devPanelButton) {
            elements.devPanelButton.style.display = isOnOverlayScreen ? 'none' : 'block';
        }
    }

    function switchToGalaxyDetailView(galaxyId) {
        if (window.activeSolarSystemRenderer) {
            window.activeSolarSystemRenderer.dispose();
            window.activeSolarSystemRenderer = null;
        }
        if (currentGalaxyRenderer) {
            currentGalaxyRenderer.dispose();
            currentGalaxyRenderer = null;
        }

        const galaxy = GameStateManager.getGalaxies().find(g => g.id === galaxyId);
        if (!galaxy) {
            console.error("Could not find galaxy to switch to:", galaxyId);
            return;
        }

        GameStateManager.setActiveGalaxyId(galaxyId);

        if (!galaxy.layoutGenerated) {
            // Pass the game state to the generator function
            generateSolarSystemsForGalaxy(galaxy, elements.galaxyDetailScreen, callbacks.getCustomizationSettings().ssCountRange, GameStateManager.getState());
        }

        setActiveScreen(elements.galaxyDetailScreen);

        const onSystemClick = (solarSystemId) => {
            switchToSolarSystemView(solarSystemId);
        };

        currentGalaxyRenderer = GalaxyRenderer;
        currentGalaxyRenderer.resetConfig();
        
        const galaxyConfig = galaxy.generationParams?.galaxyConfig;
        if (galaxyConfig) {
            currentGalaxyRenderer.updateConfig(galaxyConfig);
        }
        
        currentGalaxyRenderer.init(elements.galaxyCanvasContainer, galaxy, onSystemClick);
        
        const galaxyNumDisplay = galaxy.id.split('-').pop();
        if (elements.galaxyDetailTitleText) {
            elements.galaxyDetailTitleText.textContent = galaxy.customName || `Galaxy ${galaxyNumDisplay}`;
        }
        makeTitleEditable(elements.galaxyDetailTitleText, elements.galaxyDetailTitleInput, (newName) => {
            // Use the manager to update the galaxy's name
            GameStateManager.updateGalaxyProperty(galaxy.id, 'customName', newName);
            return newName || `Galaxy ${galaxyNumDisplay}`;
        });
    }

    function switchToSolarSystemView(solarSystemId) {
        if (currentGalaxyRenderer) {
            currentGalaxyRenderer.dispose();
            currentGalaxyRenderer = null;
        }
        if (window.activeSolarSystemRenderer) {
            elements.solarSystemContent.removeEventListener('click', _onSolarSystemCanvasClick);
            window.activeSolarSystemRenderer.dispose();
            window.activeSolarSystemRenderer = null;
        }
        
        GameStateManager.setActiveSolarSystemId(solarSystemId);
        
        const solarSystemObject = GameStateManager.getActiveSolarSystem();
        if (!solarSystemObject) {
            console.error("Could not find solar system to switch to:", solarSystemId);
            switchToGalaxyDetailView(GameStateManager.getState().activeGalaxyId);
            return;
        }
        
        if (!solarSystemObject.planets) {
            callbacks.generatePlanetsForSystem(solarSystemObject);
        }

        const solarSystemDataForRenderer = {
            id: solarSystemObject.id,
            sun: { size: solarSystemObject.sunSizeFactor, type: Math.floor(Math.random() * 5) },
            planets: solarSystemObject.planets.map(p => ({ ...p }))
        };
        setActiveScreen(elements.solarSystemScreen);
        
        const devSettings = callbacks.getDevSettings();
        SolarSystemRenderer.init(solarSystemDataForRenderer, devSettings);
        window.activeSolarSystemRenderer = SolarSystemRenderer;
        
        elements.solarSystemContent.addEventListener('click', _onSolarSystemCanvasClick);
        
        _renderPlanetSidebar(solarSystemObject.planets);

        makeTitleEditable(elements.solarSystemTitleText, elements.solarSystemTitleInput, (newName) => {
            // Use the manager to update the system's name
            GameStateManager.updateSolarSystemProperty(solarSystemObject.id, 'customName', newName);
            return newName || `System ${solarSystemId.split('-').pop()}`;
        });
    }

    function _onSolarSystemCanvasClick(event) { /* ... no changes ... */ }

    function switchToHexPlanetView(planetData, onBackCallback) { /* ... no changes ... */ }

    // --- Galaxy Customization Functions (Refactored) ---

    function getGalaxyElements() { /* ... no changes ... */ }

    function showGalaxyCustomizationModal() {
        if (!galaxyCustomizationModal) getGalaxyElements();
        setActiveScreen(galaxyCustomizationModal);
        galaxyCustomizationModal.classList.add('visible');
        populateGalaxyCustomizationUI(GalaxyRenderer.getCurrentConfig());
        populateSavedGalaxyDesignsList();
    }

    function hideGalaxyCustomizationModal() {
        galaxyCustomizationModal.classList.remove('visible');
        if (GameStateManager.getState().activeGalaxyId) {
            setActiveScreen(elements.galaxyDetailScreen);
        } else {
            callbacks.regenerateUniverseState();
        }
    }
    
    function _toHex(c) { /* ... no changes ... */ }
    function _rgbToHex(color) { /* ... no changes ... */ }
    function populateGalaxyCustomizationUI(config) { /* ... no changes ... */ }
    function _getGalaxyConfigFromUI() { /* ... no changes ... */ }

    function _applyGalaxySettings() {
        const newConfig = _getGalaxyConfigFromUI();
        const activeGalaxy = GameStateManager.getActiveGalaxy();
        if (activeGalaxy) {
            const newGenerationParams = {
                ...activeGalaxy.generationParams,
                galaxyConfig: newConfig
            };
            // Use manager to update state and save
            GameStateManager.updateGalaxyProperty(activeGalaxy.id, 'generationParams', newGenerationParams);
        }
        
        GalaxyRenderer.updateConfig(newConfig);
        hideGalaxyCustomizationModal();
    }

    function _randomizeAllGalaxySettings() { /* ... no changes ... */ }
    function _randomizeGalaxyPalette() { /* ... no changes ... */ }
    function _generateUUID() { /* ... no changes ... */ }

    function _saveGalaxyDesign() {
        // Get name based on current number of saved designs
        const designName = `Custom Galaxy ${GameStateManager.getCustomGalaxyDesigns().length + 1}`;
        const newDesign = {
            designId: _generateUUID(),
            designName: designName,
            config: GalaxyRenderer.getCurrentConfig()
        };

        // Use the manager to save the design
        GameStateManager.addCustomGalaxyDesign(newDesign);
        console.log(`Galaxy design '${designName}' saved.`);
        
        populateSavedGalaxyDesignsList();
    }

    function _loadGalaxyDesign(designId) {
        // Get design from the manager
        const designToLoad = GameStateManager.getCustomGalaxyDesigns().find(d => d.designId === designId);
        if (designToLoad) {
            populateGalaxyCustomizationUI(designToLoad.config);
            GalaxyRenderer.updateConfig(designToLoad.config);
            console.log(`Galaxy design '${designToLoad.designName}' loaded.`);
        } else {
            console.warn(`Design with ID '${designId}' not found.`);
        }
    }

    function _deleteGalaxyDesign(designId) {
        // Use the manager to delete the design
        GameStateManager.deleteCustomGalaxyDesign(designId);
        console.log(`Galaxy design with ID '${designId}' deleted.`);
        populateSavedGalaxyDesignsList();
    }

    function populateSavedGalaxyDesignsList() {
        if (!savedGalaxyDesignsUl) return;
        savedGalaxyDesignsUl.innerHTML = '';
        
        const designs = GameStateManager.getCustomGalaxyDesigns();

        if (designs.length === 0) {
            const li = document.createElement('li');
            li.textContent = "No saved galaxy designs yet.";
            li.style.fontStyle = "italic";
            li.style.color = "#95a5a6";
            savedGalaxyDesignsUl.appendChild(li);
            return;
        }
        
        designs.forEach(design => {
            const li = document.createElement('li');
            const nameSpan = document.createElement('span');
            nameSpan.className = 'design-item-name';
            nameSpan.textContent = design.designName;
            
            const buttonsDiv = document.createElement('div');
            const loadBtn = document.createElement('button');
            loadBtn.textContent = 'Load';
            loadBtn.className = 'design-item-load';
            loadBtn.dataset.id = design.designId;
            
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '×';
            deleteBtn.className = 'design-item-delete';
            deleteBtn.dataset.id = design.designId;
            deleteBtn.title = `Delete ${design.designName}`;
            
            buttonsDiv.appendChild(loadBtn);
            buttonsDiv.appendChild(deleteBtn);
            li.appendChild(nameSpan);
            li.appendChild(buttonsDiv);
            savedGalaxyDesignsUl.appendChild(li);
        });
    }

    return {
        init: (domElements, appCallbacks) => {
            elements = domElements;
            callbacks = appCallbacks;
            window.switchToGalaxyDetailView = switchToGalaxyDetailView;
            window.switchToSolarSystemView = switchToSolarSystemView;
            window.switchToHexPlanetView = switchToHexPlanetView;

            elements.galaxyCanvasContainer = document.getElementById('galaxy-canvas-container');
            
            elements.devPanelButton?.addEventListener('click', () => {
                callbacks.showDevPanel();
            });

            elements.backToGalaxyButton.addEventListener('click', () => {
                const activeGalaxyId = GameStateManager.getState().activeGalaxyId;
                if (activeGalaxyId) {
                    switchToGalaxyDetailView(activeGalaxyId);
                }
            });

            // Initialize galaxy customization elements and listeners
            getGalaxyElements();
            
            boundGalaxyApplyHandler = () => _applyGalaxySettings();
            boundGalaxyCancelHandler = () => hideGalaxyCustomizationModal();
            boundGalaxyRandomizeAllHandler = () => _randomizeAllGalaxySettings();
            boundGalaxyRandomizePaletteHandler = () => _randomizeGalaxyPalette();
            boundGalaxySaveDesignHandler = () => _saveGalaxyDesign();
            boundSavedGalaxyDesignsClickHandler = (e) => {
                const targetButton = e.target.closest('button');
                if (!targetButton) return;
                const id = targetButton.dataset.id;
                if (!id) return;

                if (targetButton.classList.contains('design-item-load')) {
                    _loadGalaxyDesign(id);
                } else if (targetButton.classList.contains('design-item-delete')) {
                    _deleteGalaxyDesign(id);
                }
            };

            galaxyApplyBtn?.addEventListener('click', boundGalaxyApplyHandler);
            galaxyCancelBtn?.addEventListener('click', boundGalaxyCancelHandler);
            galaxyRandomizeAllBtn?.addEventListener('click', boundGalaxyRandomizeAllHandler);
            galaxyRandomizePaletteBtn?.addEventListener('click', boundGalaxyRandomizePaletteHandler);
            galaxySaveDesignBtn?.addEventListener('click', boundGalaxySaveDesignHandler);
            savedGalaxyDesignsUl?.addEventListener('click', boundSavedGalaxyDesignsClickHandler);
        },
        setActiveScreen: setActiveScreen,
        showGalaxyCustomizationModal: showGalaxyCustomizationModal,
    };
})();
