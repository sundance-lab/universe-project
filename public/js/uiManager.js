// public/js/uiManager.js
import * as THREE from 'three'; // NEW: Add this import statement
import { GalaxyRenderer } from './galaxyRenderer.js';
import { stopSolarSystemAnimation } from './animationController.js';
import { generateSolarSystemsForGalaxy } from './universeGenerator.js';
import { SolarSystemRenderer } from './solarSystemRenderer.js';
import { HexPlanetViewController } from './hexPlanetViewController.js';

export const UIManager = (() => {
    let elements = {};
    let callbacks = {};
    let currentStarfieldCleanup;
    let focusedPlanetId = null;
    let currentGalaxyRenderer = null;

    // NEW: Cached DOM elements for Galaxy Customization
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

    // NEW: Event handler references for cleanup
    let boundGalaxyControlChangeHandler, boundGalaxyRandomizeAllHandler, boundGalaxyRandomizePaletteHandler, boundGalaxySaveDesignHandler, boundGalaxyLoadDesignHandler, boundGalaxyCancelHandler, boundGalaxyApplyHandler, boundSavedGalaxyDesignsClickHandler;


    function _getPlanetTypeString(planetType) {
        switch (planetType) {
            case 1: return 'Volcanic World';
            case 2: return 'Icy World';
            case 3: return 'Desert World';
            case 0:
            default:
                return 'Terran World';
        }
    }

    function _renderPlanetSidebar(planets) {
        if (!elements.planetSidebarList) return;
        elements.planetSidebarList.innerHTML = '';

        if (!planets || planets.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No planets detected.';
            li.style.fontStyle = 'italic';
            li.style.color = '#7f8c8d';
            elements.planetSidebarList.appendChild(li);
            return;
        }

        planets.forEach((planet, index) => {
            const li = document.createElement('li');
            li.className = 'planet-sidebar-item';
            li.textContent = `Planet ${index + 1} (${_getPlanetTypeString(planet.planetType)})`;
            li.title = `Click to focus on Planet ${index + 1}`;
            li.dataset.planetId = planet.id;

            if (planet.id === focusedPlanetId) {
                li.classList.add('active-focus');
            }

            li.addEventListener('click', () => {
                togglePlanetFocus(planet.id);
            });
            elements.planetSidebarList.appendChild(li);
        });
    }

    function togglePlanetFocus(planetId) {
        const renderer = window.activeSolarSystemRenderer;
        if (!renderer) return;

        if (focusedPlanetId === planetId) {
            renderer.unfocusPlanet();
            focusedPlanetId = null;
        } else {
            if (renderer.focusOnPlanet(planetId)) {
                focusedPlanetId = planetId;
            }
        }

        const activeGalaxy = window.gameSessionData.galaxies.find(g => window.gameSessionData.activeSolarSystemId.startsWith(g.id));
        const solarSystemObject = activeGalaxy?.solarSystems.find(s => s.id === window.gameSessionData.activeSolarSystemId);
        _renderPlanetSidebar(solarSystemObject?.planets);
    }

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

    function generateStarBackgroundCanvas(containerElement) {
        if (currentStarfieldCleanup) currentStarfieldCleanup();
        const existingBackground = containerElement.querySelector('.star-background');
        if (existingBackground) existingBackground.remove();
        const canvas = document.createElement('canvas');
        canvas.className = 'star-background';
        containerElement.insertBefore(canvas, containerElement.firstChild);
        const updateCanvasSize = () => {
            const rect = containerElement.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
        };
        updateCanvasSize();
        const ctx = canvas.getContext('2d');
        const stars = [];
        const numStars = Math.floor((canvas.width * canvas.height) / 1000);
        for (let i = 0; i < numStars; i++) {
            stars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: 0.5 + Math.random() * 1.5,
                brightness: 0.3 + Math.random() * 0.7,
                twinkleSpeed: 0.5 + Math.random() * 2,
                parallaxFactor: 0.1 + Math.random() * 0.005
            });
        }
        let animationFrame;
        function animate(timestamp) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            stars.forEach(star => {
                const twinkle = Math.sin(timestamp * 0.001 * star.twinkleSpeed) * 0.5 + 0.5;
                ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness * twinkle})`;
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
                ctx.fill();
            });
            animationFrame = requestAnimationFrame(animate);
        }
        animate(0);
        currentStarfieldCleanup = () => { if (animationFrame) cancelAnimationFrame(animationFrame); };
    }

    function setActiveScreen(screenToShow) {
        const screens = [elements.mainScreen, elements.galaxyDetailScreen, elements.solarSystemScreen, elements.planetDesignerScreen, elements.hexPlanetScreen, galaxyCustomizationModal].filter(s => s);
        screens.forEach(s => s.classList.remove('active', 'panning-active', 'visible'));
        if (screenToShow) screenToShow.classList.add('active');
        if (elements.planetSidebar) elements.planetSidebar.style.display = (screenToShow === elements.solarSystemScreen) ? 'block' : 'none';
        const isOnOverlayScreen = (screenToShow === elements.planetDesignerScreen || screenToShow === elements.hexPlanetScreen || screenToShow === galaxyCustomizationModal);
        if(elements.regenerateUniverseButton) elements.regenerateUniverseButton.style.display = isOnOverlayScreen ? 'none' : 'block';
        if(elements.createPlanetDesignButton) elements.createPlanetDesignButton.style.display = isOnOverlayScreen ? 'none' : 'block';
        if(elements.devControlsButton) elements.devControlsButton.style.display = isOnOverlayScreen ? 'none' : 'block';
    }

    function renderMainScreen() {
        if (elements.mainScreenTitleText) elements.mainScreenTitleText.textContent = "Universe";
        if (!elements.universeCircle) return;
        elements.universeCircle.innerHTML = '';
        window.gameSessionData.galaxies.forEach(galaxy => {
            const GALAXY_ICON_SIZE = 60;
            const galaxyNumDisplay = galaxy.id.split('-').pop();
            const galaxyElement = document.createElement('div');
            galaxyElement.className = 'galaxy-icon';
            galaxyElement.style.width = `${GALAXY_ICON_SIZE}px`;
            galaxyElement.style.height = `${GALAXY_ICON_SIZE}px`;
            galaxyElement.style.left = `${galaxy.x}px`;
            galaxyElement.style.top = `${galaxy.y}px`;
            galaxyElement.title = galaxy.customName || `Galaxy ${galaxyNumDisplay}`;
            galaxyElement.dataset.galaxyId = galaxy.id;
            galaxyElement.addEventListener('click', () => switchToGalaxyDetailView(galaxy.id));
            elements.universeCircle.appendChild(galaxyElement);
        });
    }
    
    function switchToMainView() {
        if (window.activeSolarSystemRenderer) {
            elements.solarSystemContent.removeEventListener('click', _onSolarSystemCanvasClick);
            window.activeSolarSystemRenderer.dispose();
            window.activeSolarSystemRenderer = null;
        }
        if (currentGalaxyRenderer) {
            currentGalaxyRenderer.dispose();
            currentGalaxyRenderer = null;
        }
        focusedPlanetId = null;
        window.gameSessionData.activeGalaxyId = null;
        window.gameSessionData.activeSolarSystemId = null;
        callbacks.stopSolarSystemAnimation();
        setActiveScreen(elements.mainScreen);
        generateStarBackgroundCanvas(elements.mainScreen);
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
        focusedPlanetId = null;

        const galaxy = window.gameSessionData.galaxies.find(g => g.id === galaxyId);
        if (!galaxy) return switchToMainView();

        window.gameSessionData.activeGalaxyId = galaxyId;
        window.gameSessionData.activeSolarSystemId = null;
        callbacks.stopSolarSystemAnimation();

        if (!galaxy.layoutGenerated) {
            generateSolarSystemsForGalaxy(galaxy, elements.galaxyDetailScreen, callbacks.getCustomizationSettings().ssCountRange);
        }

        setActiveScreen(elements.galaxyDetailScreen);
        
        const onSystemClick = (solarSystemId) => {
            switchToSolarSystemView(solarSystemId);
        };

        // NEW: Pass custom generation parameters to GalaxyRenderer if they exist
        // If galaxy.generationParams.galaxyConfig is null, it means no custom config is saved for it,
        // so GalaxyRenderer will default to its internal GALAXY_CONFIG.
        const galaxyConfig = galaxy.generationParams?.galaxyConfig; 
        
        currentGalaxyRenderer = GalaxyRenderer;
        // Apply the galaxy's specific configuration before initializing
        if (galaxyConfig) {
            currentGalaxyRenderer.updateConfig(galaxyConfig);
        } else {
            // If no custom config for this galaxy, ensure renderer uses its default/last applied global config
            currentGalaxyRenderer.updateConfig(currentGalaxyRenderer.getCurrentConfig());
        }
        // The init call can stay simple now as updateConfig handles the heavy lifting of re-creating the scene
        currentGalaxyRenderer.init(elements.galaxyCanvas, galaxy, onSystemClick);
        
        const galaxyNumDisplay = galaxy.id.split('-').pop();
        if (elements.galaxyDetailTitleText) {
            elements.galaxyDetailTitleText.textContent = galaxy.customName || `Galaxy ${galaxyNumDisplay}`;
        }
        makeTitleEditable(elements.galaxyDetailTitleText, elements.galaxyDetailTitleInput, (newName) => {
            galaxy.customName = newName || null;
            callbacks.saveGameState();
            renderMainScreen(); 
            return galaxy.customName || `Galaxy ${galaxyNumDisplay}`;
        });
    }

    function switchToSolarSystemView(solarSystemId, planetToFocusId = null) {
       if (currentGalaxyRenderer) {
            currentGalaxyRenderer.dispose();
            currentGalaxyRenderer = null;
        }
        if (window.activeSolarSystemRenderer) {
            elements.solarSystemContent.removeEventListener('click', _onSolarSystemCanvasClick);
            window.activeSolarSystemRenderer.dispose();
            window.activeSolarSystemRenderer = null;
        }
        
        callbacks.stopSolarSystemAnimation();
        window.gameSessionData.activeSolarSystemId = solarSystemId;
        const activeGalaxy = window.gameSessionData.galaxies.find(g => solarSystemId.startsWith(g.id));
        const solarSystemObject = activeGalaxy?.solarSystems.find(s => s.id === solarSystemId);
        if (!solarSystemObject) return switchToMainView();
        if (!solarSystemObject.planets) callbacks.generatePlanetsForSystem(solarSystemObject);

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
        
        if (planetToFocusId) {
            if (window.activeSolarSystemRenderer.focusOnPlanet(planetToFocusId)) {
                focusedPlanetId = planetToFocusId;
            }
        } else {
            focusedPlanetId = null;
        }
        _renderPlanetSidebar(solarSystemObject.planets);

        makeTitleEditable(elements.solarSystemTitleText, elements.solarSystemTitleInput, (newName) => {
            solarSystemObject.customName = newName || null;
            callbacks.saveGameState();
            return solarSystemObject.customName || `System ${solarSystemId.split('-').pop()}`;
        });
    }

    function _onSolarSystemCanvasClick(event) {
        const renderer = window.activeSolarSystemRenderer;
        if (!renderer) return;

        const raycaster = renderer.getRaycaster();
        const mouse = renderer.getMouse();
        const camera = renderer.getCamera();
        const planetMeshes = renderer.getPlanetMeshes();
        
        if (!raycaster || !mouse || !camera || !planetMeshes) return;

        const rect = elements.solarSystemContent.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(planetMeshes);

        if (intersects.length > 0) {
            const clickedPlanetData = intersects[0].object.userData;
            const systemId = window.gameSessionData.activeSolarSystemId;
            const onBackCallback = () => switchToSolarSystemView(systemId, clickedPlanetData.id);
            
            switchToHexPlanetView(clickedPlanetData, onBackCallback);
        }
    }

    function switchToHexPlanetView(planetData, onBackCallback) {
        if (!planetData) return;
        if (window.activeSolarSystemRenderer) {
            elements.solarSystemContent.removeEventListener('click', _onSolarSystemCanvasClick);
        }
        setActiveScreen(elements.hexPlanetScreen);
        callbacks.stopSolarSystemAnimation();
        HexPlanetViewController.activate(planetData, onBackCallback);
    }

    // NEW: Galaxy Customization Functions
    function _getGalaxyElements() {
        galaxyCustomizationModal = document.getElementById('galaxy-customization-modal');
        galaxyCustomizeBtn = document.getElementById('customize-galaxy-btn');

        galaxyRadiusInput = document.getElementById('galaxy-radius');
        galaxyThicknessInput = document.getElementById('galaxy-thickness');
        galaxyCoreRadiusInput = document.getElementById('galaxy-core-radius');
        galaxyNumArmsInput = document.getElementById('galaxy-num-arms');
        galaxyArmRotationMultiplierInput = document.getElementById('galaxy-arm-rotation-multiplier');

        galaxyStarsDecorativeInput = document.getElementById('galaxy-stars-decorative');
        galaxyStarsCoreInput = document.getElementById('galaxy-stars-core');
        galaxyStarsDiskInput = document.getElementById('galaxy-stars-disk');
        galaxyStarsHaloInput = document.getElementById('galaxy-stars-halo');
        galaxyDecorativeStarMaxSizeInput = document.getElementById('galaxy-decorative-star-max-size');
        galaxyDecorativeStarMinSizeInput = document.getElementById('galaxy-decorative-star-min-size');

        galaxyDustCountInput = document.getElementById('galaxy-dust-count');
        galaxyDustSizeInput = document.getElementById('galaxy-dust-size');
        galaxyDustOpacityInput = document.getElementById('galaxy-dust-opacity');

        galaxyNebulaClusterCountInput = document.getElementById('galaxy-nebula-cluster-count');
        galaxyNebulaParticleCountPerClusterInput = document.getElementById('galaxy-nebula-particle-count-per-cluster');
        galaxyNebulaSizeInput = document.getElementById('galaxy-nebula-size');
        galaxyNebulaOpacityInput = document.getElementById('galaxy-nebula-opacity');

        galaxyDistantGalaxiesCountInput = document.getElementById('galaxy-distant-galaxies-count');
        galaxyDistantGalaxiesMinScaleInput = document.getElementById('galaxy-distant-galaxies-min-scale');
        galaxyDistantGalaxiesMaxScaleInput = document.getElementById('galaxy-distant-galaxies-max-scale');
        galaxyDistantGalaxiesMinOpacityInput = document.getElementById('galaxy-distant-galaxies-min-opacity');
        galaxyDistantGalaxiesMaxOpacityInput = document.getElementById('galaxy-distant-galaxies-max-opacity');
        galaxyDistantGalaxiesMinDistanceMultiplierInput = document.getElementById('galaxy-distant-galaxies-min-distance-multiplier');
        galaxyDistantGalaxiesMaxDistanceAdditionInput = document.getElementById('galaxy-distant-galaxies-max-distance-addition');

        galaxySisterStarCountInput = document.getElementById('galaxy-sister-star-count');
        galaxySisterRadiusMultiplierInput = document.getElementById('galaxy-sister-radius-multiplier');
        galaxySisterThicknessMultiplierInput = document.getElementById('galaxy-sister-thickness-multiplier');
        galaxySisterDisplacementMultiplierInput = document.getElementById('galaxy-sister-displacement-multiplier');
        galaxySisterParticleSizeInput = document.getElementById('galaxy-sister-particle-size');
        galaxySisterOpacityInput = document.getElementById('galaxy-sister-opacity');

        galaxyCameraFovInput = document.getElementById('galaxy-camera-fov');
        galaxyCameraNearInput = document.getElementById('galaxy-camera-near');
        galaxyCameraFarInput = document.getElementById('galaxy-camera-far');
        galaxyControlsDampingFactorInput = document.getElementById('galaxy-controls-damping-factor');
        galaxyControlsMinDistanceInput = document.getElementById('galaxy-controls-min-distance');
        galaxyControlsMaxDistanceMultiplierInput = document.getElementById('galaxy-controls-max-distance-multiplier');
        galaxyRotationSpeedInput = document.getElementById('galaxy-rotation-speed');

        galaxyColorStarTextureColorInput = document.getElementById('galaxy-color-star-texture-color');
        galaxyColorCoreGlowColorInput = document.getElementById('galaxy-color-core-glow-color');
        galaxyColorDustColorStop0Input = document.getElementById('galaxy-color-dust-color-stop-0');
        galaxyColorDustColorStop04Input = document.getElementById('galaxy-color-dust-color-stop-04');
        galaxyColorNebulaColorStop0Input = document.getElementById('galaxy-color-nebula-color-stop-0');
        galaxyColorNebulaColorStop04Input = document.getElementById('galaxy-color-nebula-color-stop-04');
        galaxyColorBackgroundStarColorInput = document.getElementById('galaxy-color-background-star-color');
        galaxyColorSkyboxColorInput = document.getElementById('galaxy-color-skybox-color');
        
        galaxyRandomizePaletteBtn = document.getElementById('galaxy-randomize-palette-btn');
        galaxyRandomizeAllBtn = document.getElementById('galaxy-randomize-all-btn');
        galaxySaveDesignBtn = document.getElementById('galaxy-save-design-btn');
        galaxyLoadDesignBtn = document.getElementById('galaxy-load-design-btn');
        galaxyCancelBtn = document.getElementById('galaxy-cancel-btn');
        galaxyApplyBtn = document.getElementById('galaxy-apply-btn');
        savedGalaxyDesignsUl = document.getElementById('saved-galaxy-designs-ul');
    }

    function _showGalaxyCustomizationModal() {
        if (!galaxyCustomizationModal) _getGalaxyElements();
        setActiveScreen(galaxyCustomizationModal);
        _populateGalaxyCustomizationUI(GalaxyRenderer.getCurrentConfig());
        _populateSavedGalaxyDesignsList();
    }

    function _hideGalaxyCustomizationModal() {
        galaxyCustomizationModal.classList.remove('visible');
        if (window.gameSessionData.activeGalaxyId) {
            // Re-activate galaxy detail screen if a galaxy is active
            setActiveScreen(elements.galaxyDetailScreen);
        } else {
            // Fallback to main screen if no galaxy is active (shouldn't happen from this modal directly)
            switchToMainView();
        }
    }
    
    // Helper to convert THREE.Color to hex string
    function _toHex(c) {
        const hex = Math.round(c * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }

    // Helper to convert THREE.Color object to #RRGGBB hex string
    function _rgbToHex(color) {
        if (color instanceof THREE.Color) {
            return `#${_toHex(color.r)}${_toHex(color.g)}${_toHex(color.b)}`;
        }
        // Assuming rgba(r,g,b,a) string if not THREE.Color, or a hex string directly.
        // Attempt to parse if it's an rgba string, otherwise return as is assuming it's already hex or valid.
        const parts = String(color).match(/\d+/g);
        if (parts && parts.length >= 3) {
            return `#${_toHex(parseInt(parts[0]) / 255)}${_toHex(parseInt(parts[1]) / 255)}${_toHex(parseInt(parts[2]) / 255)}`;
        }
        return color; // Return as is if format is not recognized or already hex
    }

    function _populateGalaxyCustomizationUI(config) {
        if (!config) return;

        // General Shape
        galaxyRadiusInput.value = config.RADIUS;
        galaxyThicknessInput.value = config.THICKNESS;
        galaxyCoreRadiusInput.value = config.CORE_RADIUS;
        galaxyNumArmsInput.value = config.NUM_ARMS;
        galaxyArmRotationMultiplierInput.value = config.ARM_ROTATION_MULTIPLIER.toFixed(2);

        // Star Counts
        galaxyStarsDecorativeInput.value = config.STAR_COUNTS.DECORATIVE;
        galaxyStarsCoreInput.value = config.STAR_COUNTS.CORE;
        galaxyStarsDiskInput.value = config.STAR_COUNTS.DISK;
        galaxyStarsHaloInput.value = config.STAR_COUNTS.HALO;
        galaxyDecorativeStarMaxSizeInput.value = config.STAR_COUNTS.DECORATIVE_STAR_MAX_SIZE;
        galaxyDecorativeStarMinSizeInput.value = config.STAR_COUNTS.DECORATIVE_STAR_MIN_SIZE;

        // Dust
        galaxyDustCountInput.value = config.DUST.COUNT;
        galaxyDustSizeInput.value = config.DUST.SIZE;
        galaxyDustOpacityInput.value = config.DUST.OPACITY;

        // Nebula
        galaxyNebulaClusterCountInput.value = config.NEBULA.CLUSTER_COUNT;
        galaxyNebulaParticleCountPerClusterInput.value = config.NEBULA.PARTICLE_COUNT_PER_CLUSTER;
        galaxyNebulaSizeInput.value = config.NEBULA.SIZE;
        galaxyNebulaOpacityInput.value = config.NEBULA.OPACITY;

        // Distant Galaxies
        galaxyDistantGalaxiesCountInput.value = config.DISTANT_GALAXIES.COUNT;
        galaxyDistantGalaxiesMinScaleInput.value = config.DISTANT_GALAXIES.MIN_SCALE;
        galaxyDistantGalaxiesMaxScaleInput.value = config.DISTANT_GALAXIES.MAX_SCALE;
        galaxyDistantGalaxiesMinOpacityInput.value = config.DISTANT_GALAXIES.MIN_OPACITY;
        galaxyDistantGalaxiesMaxOpacityInput.value = config.DISTANT_GALAXIES.MAX_OPACITY;
        galaxyDistantGalaxiesMinDistanceMultiplierInput.value = config.DISTANT_GALAXIES.MIN_DISTANCE_MULTIPLIER;
        galaxyDistantGalaxiesMaxDistanceAdditionInput.value = config.DISTANT_GALAXIES.MAX_DISTANCE_ADDITION;

        // Sister Galaxy
        galaxySisterStarCountInput.value = config.SISTER_GALAXY.STAR_COUNT;
        galaxySisterRadiusMultiplierInput.value = config.SISTER_GALAXY.RADIUS_MULTIPLIER;
        galaxySisterThicknessMultiplierInput.value = config.SISTER_GALAXY.THICKNESS_MULTIPLIER;
        galaxySisterDisplacementMultiplierInput.value = config.SISTER_GALAXY.DISPLACEMENT_MULTIPLIER;
        galaxySisterParticleSizeInput.value = config.SISTER_GALAXY.PARTICLE_SIZE;
        galaxySisterOpacityInput.value = config.SISTER_GALAXY.OPACITY;

        // Renderer
        galaxyCameraFovInput.value = config.RENDERER.CAMERA_FOV;
        galaxyCameraNearInput.value = config.RENDERER.CAMERA_NEAR;
        galaxyCameraFarInput.value = config.RENDERER.CAMERA_FAR;
        galaxyControlsDampingFactorInput.value = config.RENDERER.CONTROLS_DAMPING_FACTOR;
        galaxyControlsMinDistanceInput.value = config.RENDERER.CONTROLS_MIN_DISTANCE;
        galaxyControlsMaxDistanceMultiplierInput.value = config.RENDERER.CONTROLS_MAX_DISTANCE_MULTIPLIER;
        galaxyRotationSpeedInput.value = config.RENDERER.ROTATION_SPEED;

        // Colors
        galaxyColorStarTextureColorInput.value = _rgbToHex(config.COLORS.STAR_TEXTURE_COLOR);
        galaxyColorCoreGlowColorInput.value = _rgbToHex(config.COLORS.CORE_GLOW_COLOR);
        galaxyColorDustColorStop0Input.value = _rgbToHex(config.COLORS.DUST_COLOR_STOP_0);
        galaxyColorDustColorStop04Input.value = _rgbToHex(config.COLORS.DUST_COLOR_STOP_04);
        galaxyColorNebulaColorStop0Input.value = _rgbToHex(config.COLORS.NEBULA_COLOR_STOP_0);
        galaxyColorNebulaColorStop04Input.value = _rgbToHex(config.COLORS.NEBULA_COLOR_STOP_04);
        galaxyColorBackgroundStarColorInput.value = _rgbToHex(new THREE.Color(config.COLORS.BACKGROUND_STAR_COLOR));
        galaxyColorSkyboxColorInput.value = _rgbToHex(new THREE.Color(config.COLORS.SKYBOX_COLOR));
    }

    function _getGalaxyConfigFromUI() {
        return {
            RADIUS: parseFloat(galaxyRadiusInput.value),
            THICKNESS: parseFloat(galaxyThicknessInput.value),
            CORE_RADIUS: parseFloat(galaxyCoreRadiusInput.value),
            NUM_ARMS: parseInt(galaxyNumArmsInput.value),
            ARM_ROTATION_MULTIPLIER: parseFloat(galaxyArmRotationMultiplierInput.value),
            STAR_COUNTS: {
                DECORATIVE: parseInt(galaxyStarsDecorativeInput.value),
                CORE: parseInt(galaxyStarsCoreInput.value),
                DISK: parseInt(galaxyStarsDiskInput.value),
                HALO: parseInt(galaxyStarsHaloInput.value),
                DECORATIVE_STAR_MAX_SIZE: parseFloat(galaxyDecorativeStarMaxSizeInput.value),
                DECORATIVE_STAR_MIN_SIZE: parseFloat(galaxyDecorativeStarMinSizeInput.value),
            },
            DUST: {
                COUNT: parseInt(galaxyDustCountInput.value),
                SIZE: parseFloat(galaxyDustSizeInput.value),
                OPACITY: parseFloat(galaxyDustOpacityInput.value),
            },
            NEBULA: {
                CLUSTER_COUNT: parseInt(galaxyNebulaClusterCountInput.value),
                PARTICLE_COUNT_PER_CLUSTER: parseInt(galaxyNebulaParticleCountPerClusterInput.value),
                SIZE: parseFloat(galaxyNebulaSizeInput.value),
                OPACITY: parseFloat(galaxyNebulaOpacityInput.value),
            },
            DISTANT_GALAXIES: {
                COUNT: parseInt(galaxyDistantGalaxiesCountInput.value),
                MIN_SCALE: parseFloat(galaxyDistantGalaxiesMinScaleInput.value),
                MAX_SCALE: parseFloat(galaxyDistantGalaxiesMaxScaleInput.value),
                MIN_OPACITY: parseFloat(galaxyDistantGalaxiesMinOpacityInput.value),
                MAX_OPACITY: parseFloat(galaxyDistantGalaxiesMaxOpacityInput.value),
                MIN_DISTANCE_MULTIPLIER: parseFloat(galaxyDistantGalaxiesMinDistanceMultiplierInput.value),
                MAX_DISTANCE_ADDITION: parseFloat(galaxyDistantGalaxiesMaxDistanceAdditionInput.value),
            },
            SISTER_GALAXY: {
                STAR_COUNT: parseInt(galaxySisterStarCountInput.value),
                RADIUS_MULTIPLIER: parseFloat(galaxySisterRadiusMultiplierInput.value),
                THICKNESS_MULTIPLIER: parseFloat(galaxySisterThicknessMultiplierInput.value),
                DISPLACEMENT_MULTIPLIER: parseFloat(galaxySisterDisplacementMultiplierInput.value),
                PARTICLE_SIZE: parseFloat(galaxySisterParticleSizeInput.value),
                OPACITY: parseFloat(galaxySisterOpacityInput.value),
            },
            RENDERER: {
                CAMERA_FOV: parseFloat(galaxyCameraFovInput.value),
                CAMERA_NEAR: parseFloat(galaxyCameraNearInput.value),
                CAMERA_FAR: parseFloat(galaxyCameraFarInput.value),
                CONTROLS_DAMPING_FACTOR: parseFloat(galaxyControlsDampingFactorInput.value),
                CONTROLS_MIN_DISTANCE: parseFloat(galaxyControlsMinDistanceInput.value),
                CONTROLS_MAX_DISTANCE_MULTIPLIER: parseFloat(galaxyControlsMaxDistanceMultiplierInput.value),
                ROTATION_SPEED: parseFloat(galaxyRotationSpeedInput.value),
            },
            COLORS: {
                STAR_TEXTURE_COLOR: galaxyColorStarTextureColorInput.value,
                CORE_GLOW_COLOR: galaxyColorCoreGlowColorInput.value,
                DUST_COLOR_STOP_0: galaxyColorDustColorStop0Input.value,
                DUST_COLOR_STOP_04: galaxyColorDustColorStop04Input.value,
                NEBULA_COLOR_STOP_0: galaxyColorNebulaColorStop0Input.value,
                NEBULA_COLOR_STOP_04: galaxyColorNebulaColorStop04Input.value,
                BACKGROUND_STAR_COLOR: parseInt(galaxyColorBackgroundStarColorInput.value.replace('#', '0x')),
                SKYBOX_COLOR: parseInt(galaxyColorSkyboxColorInput.value.replace('#', '0x')),
            }
        };
    }

    function _applyGalaxySettings() {
        const newConfig = _getGalaxyConfigFromUI();
        const activeGalaxy = window.gameSessionData.galaxies.find(g => g.id === window.gameSessionData.activeGalaxyId);
        if (activeGalaxy) {
            if (!activeGalaxy.generationParams) activeGalaxy.generationParams = {};
            activeGalaxy.generationParams.galaxyConfig = newConfig; // Store config with the galaxy
            callbacks.saveGameState(); // Save game state to persist galaxy config
        }
        
        GalaxyRenderer.updateConfig(newConfig); // Apply config to renderer
        _hideGalaxyCustomizationModal();
    }

    function _randomizeAllGalaxySettings() {
        const randomConfig = {
            RADIUS: Math.floor(Math.random() * (3000 - 1000 + 1)) + 1000,
            THICKNESS: Math.floor(Math.random() * (200 - 50 + 1)) + 50,
            CORE_RADIUS: Math.floor(Math.random() * (500 - 100 + 1)) + 100,
            NUM_ARMS: Math.floor(Math.random() * (7 - 2 + 1)) + 2,
            ARM_ROTATION_MULTIPLIER: (Math.random() * (5.0 - 2.0) + 2.0).toFixed(2),
            STAR_COUNTS: {
                DECORATIVE: Math.floor(Math.random() * (100000 - 20000 + 1)) + 20000,
                CORE: Math.floor(Math.random() * (40000 - 10000 + 1)) + 10000,
                DISK: Math.floor(Math.random() * (800000 - 200000 + 1)) + 200000,
                HALO: Math.floor(Math.random() * (400000 - 100000 + 1)) + 100000,
                DECORATIVE_STAR_MAX_SIZE: Math.floor(Math.random() * (25 - 10 + 1)) + 10,
                DECORATIVE_STAR_MIN_SIZE: Math.floor(Math.random() * (8 - 2 + 1)) + 2,
            },
            DUST: {
                COUNT: Math.floor(Math.random() * (30000 - 5000 + 1)) + 5000,
                SIZE: Math.floor(Math.random() * (300 - 80 + 1)) + 80,
                OPACITY: (Math.random() * (0.9 - 0.3) + 0.3).toFixed(2),
            },
            NEBULA: {
                CLUSTER_COUNT: Math.floor(Math.random() * (100 - 20 + 1)) + 20,
                PARTICLE_COUNT_PER_CLUSTER: Math.floor(Math.random() * (20 - 5 + 1)) + 5,
                SIZE: Math.floor(Math.random() * (500 - 100 + 1)) + 100,
                OPACITY: (Math.random() * (0.6 - 0.1) + 0.1).toFixed(2),
            },
            DISTANT_GALAXIES: {
                COUNT: Math.floor(Math.random() * (300 - 50 + 1)) + 50,
                MIN_SCALE: Math.floor(Math.random() * (800 - 200 + 1)) + 200,
                MAX_SCALE: Math.floor(Math.random() * (1200 - 600 + 1)) + 600,
                MIN_OPACITY: (Math.random() * (0.3 - 0.05) + 0.05).toFixed(2),
                MAX_OPACITY: (Math.random() * (0.6 - 0.2) + 0.2).toFixed(2),
                MIN_DISTANCE_MULTIPLIER: (Math.random() * (10 - 3) + 3).toFixed(1),
                MAX_DISTANCE_ADDITION: Math.floor(Math.random() * (10000 - 2000 + 1)) + 2000,
            },
            SISTER_GALAXY: {
                STAR_COUNT: Math.floor(Math.random() * (150000 - 30000 + 1)) + 30000,
                RADIUS_MULTIPLIER: (Math.random() * (1.0 - 0.4) + 0.4).toFixed(2),
                THICKNESS_MULTIPLIER: (Math.random() * (0.8 - 0.2) + 0.2).toFixed(2),
                DISPLACEMENT_MULTIPLIER: (Math.random() * (0.8 - 0.2) + 0.2).toFixed(2),
                PARTICLE_SIZE: Math.floor(Math.random() * (30 - 10 + 1)) + 10,
                OPACITY: (Math.random() * (1.0 - 0.5) + 0.5).toFixed(2),
            },
            RENDERER: {
                CAMERA_FOV: Math.floor(Math.random() * (90 - 45 + 1)) + 45,
                CAMERA_NEAR: (Math.random() * (10 - 0.1) + 0.1).toFixed(1),
                CAMERA_FAR: Math.floor(Math.random() * (60000 - 20000 + 1)) + 20000,
                CONTROLS_DAMPING_FACTOR: (Math.random() * (0.1 - 0.02) + 0.02).toFixed(2),
                CONTROLS_MIN_DISTANCE: Math.floor(Math.random() * (200 - 50 + 1)) + 50,
                CONTROLS_MAX_DISTANCE_MULTIPLIER: (Math.random() * (7 - 2) + 2).toFixed(1),
                ROTATION_SPEED: (Math.random() * (0.0005 - 0.00005) + 0.00005).toPrecision(5),
            },
            COLORS: {
                STAR_TEXTURE_COLOR: '#' + (Math.random() * 0xFFFFFF | 0).toString(16).padStart(6, '0'),
                CORE_GLOW_COLOR: '#' + (Math.random() * 0xFFFFFF | 0).toString(16).padStart(6, '0'),
                DUST_COLOR_STOP_0: '#' + (Math.random() * 0xFFFFFF | 0).toString(16).padStart(6, '0'),
                DUST_COLOR_STOP_04: '#' + (Math.random() * 0xFFFFFF | 0).toString(16).padStart(6, '0'),
                NEBULA_COLOR_STOP_0: '#' + (Math.random() * 0xFFFFFF | 0).toString(16).padStart(6, '0'),
                NEBULA_COLOR_STOP_04: '#' + (Math.random() * 0xFFFFFF | 0).toString(16).padStart(6, '0'),
                BACKGROUND_STAR_COLOR: Math.random() * 0xFFFFFF,
                SKYBOX_COLOR: Math.random() * 0xFFFFFF,
                // Palettes are randomized separately via _randomizeGalaxyPalette
            }
        };
        // Apply random values to UI and then apply to galaxy
        _populateGalaxyCustomizationUI(randomConfig);
        _applyGalaxySettings();
    }

    function _randomizeGalaxyPalette() {
        const newPalette = [];
        for (let i = 0; i < 10; i++) { // Generate 10 random colors for the palette
            newPalette.push(new THREE.Color(Math.random(), Math.random(), Math.random()));
        }
        const currentConfig = GalaxyRenderer.getCurrentConfig();
        currentConfig.COLORS.PALETTE = newPalette;
        GalaxyRenderer.updateConfig(currentConfig); // Apply new palette to renderer
        // No UI update needed for palette directly as it's not exposed as individual inputs
    }

    function _generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      }

    function _saveGalaxyDesign() {
        const designName = prompt("Enter a name for this galaxy design:", "My Custom Galaxy");
        if (!designName) {
            console.log("Galaxy design save cancelled.");
            return;
        }

        if (!window.gameSessionData.customGalaxyDesigns) {
            window.gameSessionData.customGalaxyDesigns = [];
        }

        const newDesign = {
            designId: _generateUUID(),
            designName: designName,
            config: GalaxyRenderer.getCurrentConfig() // Save the current active config
        };

        window.gameSessionData.customGalaxyDesigns.push(newDesign);
        
        if (callbacks.saveGameState) {
            callbacks.saveGameState();
            console.log(`Galaxy design '${designName}' saved.`);
        } else {
            console.error("Could not find callbacks.saveGameState() function.");
        }
        
        _populateSavedGalaxyDesignsList();
    }

    function _loadGalaxyDesign(designId) {
        const designToLoad = window.gameSessionData?.customGalaxyDesigns?.find(d => d.designId === designId);
        if (designToLoad) {
            _populateGalaxyCustomizationUI(designToLoad.config); // Update UI inputs
            GalaxyRenderer.updateConfig(designToLoad.config); // Apply config to renderer
            console.log(`Galaxy design '${designToLoad.designName}' loaded.`);
            // No need to hide modal, user might want to tweak further
        }
    }

    function _deleteGalaxyDesign(designId) {
        if (!window.gameSessionData?.customGalaxyDesigns) return;

        const designIndex = window.gameSessionData.customGalaxyDesigns.findIndex(d => d.designId === designId);
        if (designIndex > -1) {
            const deletedDesignName = window.gameSessionData.customGalaxyDesigns[designIndex].designName;
            window.gameSessionData.customGalaxyDesigns.splice(designIndex, 1);
            
            if (callbacks.saveGameState) {
                callbacks.saveGameState();
                console.log(`Galaxy design '${deletedDesignName}' deleted.`);
            }
            
            _populateSavedGalaxyDesignsList();
        } else {
            console.warn(`Could not find galaxy design with ID '${designId}' to delete.`);
        }
    }

    function _populateSavedGalaxyDesignsList() {
        if (!savedGalaxyDesignsUl) return;
        
        savedGalaxyDesignsUl.innerHTML = '';

        if (!window.gameSessionData?.customGalaxyDesigns || window.gameSessionData.customGalaxyDesigns.length === 0) {
            const li = document.createElement('li');
            li.textContent = "No saved galaxy designs yet.";
            li.style.fontStyle = "italic";
            li.style.color = "#95a5a6";
            savedGalaxyDesignsUl.appendChild(li);
            return;
        }
        
        window.gameSessionData.customGalaxyDesigns.forEach(design => {
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
            window.switchToMainView = switchToMainView;
            window.switchToSolarSystemView = switchToSolarSystemView;
            window.switchToHexPlanetView = switchToHexPlanetView;

            elements.galaxyCanvas = document.getElementById('galaxy-canvas');
            
            elements.regenerateUniverseButton.addEventListener('click', () => {
                callbacks.regenerateUniverseState();
            });
            elements.createPlanetDesignButton.addEventListener('click', callbacks.switchToPlanetDesignerScreen);
            elements.backToMainButton.addEventListener('click', switchToMainView);
            elements.backToGalaxyButton.addEventListener('click', () => {
                if (window.activeSolarSystemRenderer) {
                    window.activeSolarSystemRenderer.unfocusPlanet();
                    elements.solarSystemContent.removeEventListener('click', _onSolarSystemCanvasClick);
                }
                focusedPlanetId = null;
                if (window.gameSessionData.activeGalaxyId) {
                    switchToGalaxyDetailView(window.gameSessionData.activeGalaxyId);
                } else {
                    switchToMainView();
                }
            });

            // NEW: Initialize galaxy customization elements and listeners
            _getGalaxyElements();
            galaxyCustomizeBtn?.addEventListener('click', _showGalaxyCustomizationModal);
            
            // Event Handlers for Galaxy Customization
            boundGalaxyApplyHandler = () => _applyGalaxySettings();
            boundGalaxyCancelHandler = () => _hideGalaxyCustomizationModal();
            boundGalaxyRandomizeAllHandler = () => _randomizeAllGalaxySettings();
            boundGalaxyRandomizePaletteHandler = () => _randomizeGalaxyPalette();
            boundGalaxySaveDesignHandler = () => _saveGalaxyDesign();
            boundGalaxyLoadDesignHandler = (e) => {
                const targetButton = e.target.closest('button');
                if (targetButton && targetButton.classList.contains('design-item-load')) {
                    _loadGalaxyDesign(targetButton.dataset.id);
                }
            };
            boundSavedGalaxyDesignsClickHandler = (e) => {
                const targetButton = e.target.closest('button');
                if (!targetButton) return;
                const id = targetButton.dataset.id;
                if (!id) return;

                if (targetButton.classList.contains('design-item-load')) {
                    _loadGalaxyDesign(id);
                } else if (targetButton.classList.contains('design-item-delete')) {
                    if (confirm("Are you sure you want to delete this galaxy design?")) {
                        _deleteGalaxyDesign(id);
                    }
                }
            };


            galaxyApplyBtn?.addEventListener('click', boundGalaxyApplyHandler);
            galaxyCancelBtn?.addEventListener('click', boundGalaxyCancelHandler);
            galaxyRandomizeAllBtn?.addEventListener('click', boundGalaxyRandomizeAllHandler);
            galaxyRandomizePaletteBtn?.addEventListener('click', boundGalaxyRandomizePaletteHandler);
            galaxySaveDesignBtn?.addEventListener('click', boundGalaxySaveDesignHandler);
            savedGalaxyDesignsUl?.addEventListener('click', boundSavedGalaxyDesignsClickHandler);

            // Optional: Live update for range sliders, or only apply on 'Apply' button
            document.querySelectorAll('#galaxy-customization-modal .galaxy-control[type="range"]').forEach(input => {
                input.addEventListener('input', (e) => {
                    // This could trigger a live update, but for performance, we'll only update on 'Apply'
                    // For now, just a visual update for the range value display if needed.
                });
            });
        },
        renderMainScreen: renderMainScreen,
        setActiveScreen: setActiveScreen,
    };
})();
