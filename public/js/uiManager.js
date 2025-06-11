// uiManager.js
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
        const screens = [elements.mainScreen, elements.galaxyDetailScreen, elements.solarSystemScreen, elements.planetDesignerScreen, elements.hexPlanetScreen].filter(s => s);
        screens.forEach(s => s.classList.remove('active', 'panning-active'));
        if (screenToShow) screenToShow.classList.add('active');
        if (elements.planetSidebar) elements.planetSidebar.style.display = (screenToShow === elements.solarSystemScreen) ? 'block' : 'none';
        const isOnOverlayScreen = (screenToShow === elements.planetDesignerScreen || screenToShow === elements.hexPlanetScreen);
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
        // Cleanup any existing renderers
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
            // Use galaxyDetailScreen as a proxy for viewport size.
            generateSolarSystemsForGalaxy(galaxy, elements.galaxyDetailScreen, callbacks.getCustomizationSettings().ssCountRange);
        }

        setActiveScreen(elements.galaxyDetailScreen);
        
        const onSystemClick = (solarSystemId) => {
            // This callback is passed to the renderer to handle clicks
            switchToSolarSystemView(solarSystemId);
        };
        
        // Initialize the new 3D renderer
        currentGalaxyRenderer = GalaxyRenderer;
        currentGalaxyRenderer.init(elements.galaxyCanvas, galaxy, onSystemClick);
        
        const galaxyNumDisplay = galaxy.id.split('-').pop();
        if (elements.galaxyDetailTitleText) {
            elements.galaxyDetailTitleText.textContent = galaxy.customName || `Galaxy ${galaxyNumDisplay}`;
        }
        makeTitleEditable(elements.galaxyDetailTitleText, elements.galaxyDetailTitleInput, (newName) => {
            galaxy.customName = newName || null;
            callbacks.saveGameState();
            // We need to re-render the main screen to update galaxy icon titles
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
            // The old renderGalaxyDetailScreen() call is removed as it no longer exists.
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
        },
        renderMainScreen: renderMainScreen,
        setActiveScreen: setActiveScreen,
    };
})();
