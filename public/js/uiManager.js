// public/js/uiManager.js
import * as THREE from 'three';
import { GalaxyRenderer } from './galaxyRenderer.js';
import { generateSolarSystemsForGalaxy } from './universeGenerator.js';
import { SolarSystemRenderer } from './solarSystemRenderer.js';
import { HexPlanetViewController } from './hexPlanetViewController.js';
import GameStateManager from './gameStateManager.js';

export const UIManager = (() => {
    let elements = {};
    let callbacks = {};
    let currentStarfieldCleanup;
    let currentGalaxyRenderer = null;

    // --- Cached DOM elements ---
    let galaxyCustomizationModal;
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

    // --- Event handler references ---
    let boundGalaxyApplyHandler, boundGalaxyCancelHandler, boundGalaxyRandomizeAllHandler, boundGalaxyRandomizePaletteHandler, boundGalaxySaveDesignHandler, boundSavedGalaxyDesignsClickHandler;


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
            li.textContent = `Planet ${index + 1}`;
            li.title = `Click to focus on Planet ${index + 1}`;
            li.dataset.planetId = planet.id;

            elements.planetSidebarList.appendChild(li);
        });
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
            generateSolarSystemsForGalaxy(galaxy, elements.galaxyDetailScreen, callbacks.getCustomizationSettings().ssCountRange);
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
            GameStateManager.updateSolarSystemProperty(solarSystemObject.id, 'customName', newName);
            return newName || `System ${solarSystemId.split('-').pop()}`;
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
            // Clicking a planet does nothing. This could be a future feature.
        }
    }

    function switchToHexPlanetView(planetData, onBackCallback) {
        if (!planetData) return;
        if (window.activeSolarSystemRenderer) {
            elements.solarSystemContent.removeEventListener('click', _onSolarSystemCanvasClick);
        }
        setActiveScreen(elements.hexPlanetScreen);
        HexPlanetViewController.activate(planetData, onBackCallback);
    }

    // --- Galaxy Customization Functions ---
    function getGalaxyElements() {
        galaxyCustomizationModal = document.getElementById('galaxy-customization-modal');
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
    
    function _toHex(c) {
        const hex = Math.round(c * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }

    function _rgbToHex(color) {
        if (color instanceof THREE.Color) {
            return `#${_toHex(color.r)}${_toHex(color.g)}${_toHex(color.b)}`;
        }
        const parts = String(color).match(/\d+/g);
        if (parts && parts.length >= 3) {
            return `#${_toHex(parseInt(parts[0]) / 255)}${_toHex(parseInt(parts[1]) / 255)}${_toHex(parseInt(parts[2]) / 255)}`;
        }
        return color;
    }

    function populateGalaxyCustomizationUI(config) {
        try {
            if (!config) {
                console.warn("populateGalaxyCustomizationUI received null or undefined config.");
                return;
            }

            if (galaxyRadiusInput) galaxyRadiusInput.value = config.RADIUS;
            if (galaxyThicknessInput) galaxyThicknessInput.value = config.THICKNESS;
            if (galaxyCoreRadiusInput) galaxyCoreRadiusInput.value = config.CORE_RADIUS;
            if (galaxyNumArmsInput) galaxyNumArmsInput.value = config.NUM_ARMS;
            if (galaxyArmRotationMultiplierInput) galaxyArmRotationMultiplierInput.value = config.ARM_ROTATION_MULTIPLIER.toFixed(2);
            if (galaxyStarsDecorativeInput) galaxyStarsDecorativeInput.value = config.STAR_COUNTS.DECORATIVE;
            if (galaxyStarsCoreInput) galaxyStarsCoreInput.value = config.STAR_COUNTS.CORE;
            if (galaxyStarsDiskInput) galaxyStarsDiskInput.value = config.STAR_COUNTS.DISK;
            if (galaxyStarsHaloInput) galaxyStarsHaloInput.value = config.STAR_COUNTS.HALO;
            if (galaxyDecorativeStarMaxSizeInput) galaxyDecorativeStarMaxSizeInput.value = config.STAR_COUNTS.DECORATIVE_STAR_MAX_SIZE;
            if (galaxyDecorativeStarMinSizeInput) galaxyDecorativeStarMinSizeInput.value = config.STAR_COUNTS.DECORATIVE_STAR_MIN_SIZE;
            if (galaxyDustCountInput) galaxyDustCountInput.value = config.DUST.COUNT;
            if (galaxyDustSizeInput) galaxyDustSizeInput.value = config.DUST.SIZE;
            if (galaxyDustOpacityInput) galaxyDustOpacityInput.value = config.DUST.OPACITY;
            if (galaxyNebulaClusterCountInput) galaxyNebulaClusterCountInput.value = config.NEBULA.CLUSTER_COUNT;
            if (galaxyNebulaParticleCountPerClusterInput) galaxyNebulaParticleCountPerClusterInput.value = config.NEBULA.PARTICLE_COUNT_PER_CLUSTER;
            if (galaxyNebulaSizeInput) galaxyNebulaSizeInput.value = config.NEBULA.SIZE;
            if (galaxyNebulaOpacityInput) galaxyNebulaOpacityInput.value = config.NEBULA.OPACITY;
            if (galaxyDistantGalaxiesCountInput) galaxyDistantGalaxiesCountInput.value = config.DISTANT_GALAXIES.COUNT;
            if (galaxyDistantGalaxiesMinScaleInput) galaxyDistantGalaxiesMinScaleInput.value = config.DISTANT_GALAXIES.MIN_SCALE;
            if (galaxyDistantGalaxiesMaxScaleInput) galaxyDistantGalaxiesMaxScaleInput.value = config.DISTANT_GALAXIES.MAX_SCALE;
            if (galaxyDistantGalaxiesMinOpacityInput) galaxyDistantGalaxiesMinOpacityInput.value = config.DISTANT_GALAXIES.MIN_OPACITY;
            if (galaxyDistantGalaxiesMaxOpacityInput) galaxyDistantGalaxiesMaxOpacityInput.value = config.DISTANT_GALAXIES.MAX_OPACITY;
            if (galaxyDistantGalaxiesMinDistanceMultiplierInput) galaxyDistantGalaxiesMinDistanceMultiplierInput.value = config.DISTANT_GALAXIES.MIN_DISTANCE_MULTIPLIER;
            if (galaxyDistantGalaxiesMaxDistanceAdditionInput) galaxyDistantGalaxiesMaxDistanceAdditionInput.value = config.DISTANT_GALAXIES.MAX_DISTANCE_ADDITION;
            if (galaxySisterStarCountInput) galaxySisterStarCountInput.value = config.SISTER_GALAXY.STAR_COUNT;
            if (galaxySisterRadiusMultiplierInput) galaxySisterRadiusMultiplierInput.value = config.SISTER_GALAXY.RADIUS_MULTIPLIER;
            if (galaxySisterThicknessMultiplierInput) galaxySisterThicknessMultiplierInput.value = config.SISTER_GALAXY.THICKNESS_MULTIPLIER;
            if (galaxySisterDisplacementMultiplierInput) galaxySisterDisplacementMultiplierInput.value = config.SISTER_GALAXY.DISPLACEMENT_MULTIPLIER;
            if (galaxySisterParticleSizeInput) galaxySisterParticleSizeInput.value = config.SISTER_GALAXY.PARTICLE_SIZE;
            if (galaxySisterOpacityInput) galaxySisterOpacityInput.value = config.SISTER_GALAXY.OPACITY;
            if (galaxyCameraFovInput) galaxyCameraFovInput.value = config.RENDERER.CAMERA_FOV;
            if (galaxyCameraNearInput) galaxyCameraNearInput.value = config.RENDERER.CAMERA_NEAR;
            if (galaxyCameraFarInput) galaxyCameraFarInput.value = config.RENDERER.CAMERA_FAR;
            if (galaxyControlsDampingFactorInput) galaxyControlsDampingFactorInput.value = config.RENDERER.CONTROLS_DAMPING_FACTOR;
            if (galaxyControlsMinDistanceInput) galaxyControlsMinDistanceInput.value = config.RENDERER.CONTROLS_MIN_DISTANCE;
            if (galaxyControlsMaxDistanceMultiplierInput) galaxyControlsMaxDistanceMultiplierInput.value = config.RENDERER.CONTROLS_MAX_DISTANCE_MULTIPLIER;
            if (galaxyRotationSpeedInput) galaxyRotationSpeedInput.value = config.RENDERER.ROTATION_SPEED;
            if (galaxyColorStarTextureColorInput) galaxyColorStarTextureColorInput.value = _rgbToHex(config.COLORS.STAR_TEXTURE_COLOR);
            if (galaxyColorCoreGlowColorInput) galaxyColorCoreGlowColorInput.value = _rgbToHex(config.COLORS.CORE_GLOW_COLOR);
            if (galaxyColorDustColorStop0Input) galaxyColorDustColorStop0Input.value = _rgbToHex(config.COLORS.DUST_COLOR_STOP_0);
            if (galaxyColorDustColorStop04Input) galaxyColorDustColorStop04Input.value = _rgbToHex(config.COLORS.DUST_COLOR_STOP_04);
            if (galaxyColorNebulaColorStop0Input) galaxyColorNebulaColorStop0Input.value = _rgbToHex(config.COLORS.NEBULA_COLOR_STOP_0);
            if (galaxyColorNebulaColorStop04Input) galaxyColorNebulaColorStop04Input.value = _rgbToHex(config.COLORS.NEBULA_COLOR_STOP_04);
            if (galaxyColorBackgroundStarColorInput) galaxyColorBackgroundStarColorInput.value = _rgbToHex(new THREE.Color(config.COLORS.BACKGROUND_STAR_COLOR));
            if (galaxyColorSkyboxColorInput) galaxyColorSkyboxColorInput.value = _rgbToHex(new THREE.Color(config.COLORS.SKYBOX_COLOR));

        } catch (error) {
            console.error("Error populating galaxy customization UI:", error);
        }
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
        const activeGalaxy = GameStateManager.getActiveGalaxy();
        if (activeGalaxy) {
            const newGenerationParams = {
                ...(activeGalaxy.generationParams || {}),
                galaxyConfig: newConfig
            };
            GameStateManager.updateGalaxyProperty(activeGalaxy.id, 'generationParams', newGenerationParams);
        }
        
        GalaxyRenderer.updateConfig(newConfig);
        hideGalaxyCustomizationModal();
    }

    function _randomizeAllGalaxySettings() {
        console.log("Randomizing all galaxy settings...");
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
            }
        };
        populateGalaxyCustomizationUI(randomConfig);
        _applyGalaxySettings();
        console.log("Randomization complete.");
    }

    function _randomizeGalaxyPalette() {
        const newPalette = [];
        for (let i = 0; i < 10; i++) {
            newPalette.push(new THREE.Color(Math.random(), Math.random(), Math.random()));
        }
        const currentConfig = GalaxyRenderer.getCurrentConfig();
        currentConfig.COLORS.PALETTE = newPalette;
        GalaxyRenderer.updateConfig(currentConfig);
    }

    function _generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
    }

    function _saveGalaxyDesign() {
        const designName = `Custom Galaxy ${GameStateManager.getCustomGalaxyDesigns().length + 1}`;
        const newDesign = {
            designId: _generateUUID(),
            designName: designName,
            config: GalaxyRenderer.getCurrentConfig()
        };
        GameStateManager.addCustomGalaxyDesign(newDesign);
        console.log(`Galaxy design '${designName}' saved.`);
        populateSavedGalaxyDesignsList();
    }

    function _loadGalaxyDesign(designId) {
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
            galaxyRandomizeAllBtn?.addEventListener('click', boundGalaxyRandomizePaletteHandler);
            galaxyRandomizePaletteBtn?.addEventListener('click', boundGalaxyRandomizePaletteHandler);
            galaxySaveDesignBtn?.addEventListener('click', boundGalaxySaveDesignHandler);
            savedGalaxyDesignsUl?.addEventListener('click', boundSavedGalaxyDesignsClickHandler);
        },
        setActiveScreen: setActiveScreen,
        showGalaxyCustomizationModal: showGalaxyCustomizationModal,
    };
})();
