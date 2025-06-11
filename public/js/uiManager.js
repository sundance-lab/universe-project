import { stopSolarSystemAnimation } from './animationController.js';
import { generateSolarSystemsForGalaxy } from './universeGenerator.js';
import { SolarSystemRenderer } from './solarSystemRenderer.js'; // Ensure this import is correct
import { HexPlanetViewController } from './hexPlanetViewController.js';

export const UIManager = (() => {
    let elements = {};
    let callbacks = {};
    let galaxyIconCache = {};
    let linesCtx;
    let currentStarfieldCleanup;
    let focusedPlanetId = null; // Track the currently focused planet ID

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

            // Highlight if currently focused
            if (planet.id === focusedPlanetId) {
                li.classList.add('active-focus'); // Add a class for styling
            } else {
                li.classList.remove('active-focus');
            }

            // Updated click listener to toggle focus
            li.addEventListener('click', () => {
                togglePlanetFocus(planet.id);
            });
            elements.planetSidebarList.appendChild(li);
        });
    }

    // New function to toggle planet focus
    function togglePlanetFocus(planetId) {
        if (focusedPlanetId === planetId) {
            // If already focused on this planet, unfocus it
            if (window.activeSolarSystemRenderer && typeof window.activeSolarSystemRenderer.unfocusPlanet === 'function') {
                window.activeSolarSystemRenderer.unfocusPlanet();
            }
            focusedPlanetId = null;
        } else {
            // If not focused or focusing on a different planet, focus on the new one
            if (window.activeSolarSystemRenderer && typeof window.activeSolarSystemRenderer.focusOnPlanet === 'function') {
                if (window.activeSolarSystemRenderer.focusOnPlanet(planetId)) {
                    focusedPlanetId = planetId;
                }
            }
        }
        // Re-render sidebar to update active state
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
                inputElement.value = titleTextElement.textContent; // Corrected from `input.value` to `inputElement.value`
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
        if (elements.zoomControlsElement) elements.zoomControlsElement.classList.toggle('visible', screenToShow === elements.galaxyDetailScreen);
        if (elements.planetSidebar) elements.planetSidebar.style.display = (screenToShow === elements.solarSystemScreen) ? 'block' : 'none';
        const isOnOverlayScreen = (screenToShow === elements.planetDesignerScreen || screenToShow === elements.hexPlanetScreen);
        if(elements.regenerateUniverseButton) elements.regenerateUniverseButton.style.display = isOnOverlayScreen ? 'none' : 'block';
        if(elements.createPlanetDesignButton) elements.createPlanetDesignButton.style.display = isOnOverlayScreen ? 'none' : 'block';
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

    function drawGalaxyLines(galaxy) {
        if (!elements.solarSystemLinesCanvasEl || !elements.galaxyZoomContent) return;
        const galaxyContentDiameter = parseFloat(elements.galaxyZoomContent.style.width);
        if (elements.solarSystemLinesCanvasEl.width !== galaxyContentDiameter) {
            elements.solarSystemLinesCanvasEl.width = galaxyContentDiameter;
            elements.solarSystemLinesCanvasEl.height = galaxyContentDiameter;
        }
        if (!linesCtx) linesCtx = elements.solarSystemLinesCanvasEl.getContext('2d');
        if (!linesCtx) return;
        linesCtx.clearRect(0, 0, elements.solarSystemLinesCanvasEl.width, elements.solarSystemLinesCanvasEl.height);
        if (!galaxy?.lineConnections?.length) return;
        linesCtx.strokeStyle = 'rgba(128, 128, 255, 0.4)';
        linesCtx.lineWidth = 0.5;
        linesCtx.setLineDash([]);
        const systemPositions = Object.fromEntries(galaxy.solarSystems.map(ss => [ss.id, { x: ss.x + ss.iconSize / 2, y: ss.y + ss.iconSize / 2 }]));
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

    function renderGalaxyDetailScreen(isInteractivePanOrZoom = false) {
        const galaxy = window.gameSessionData.galaxies.find(g => g.id === window.gameSessionData.activeGalaxyId);
        if (!galaxy) return switchToMainView();
        const { galaxyViewport, galaxyZoomContent, solarSystemLinesCanvasEl, galaxyDetailTitleText } = elements;
        if (!galaxyViewport || !galaxyZoomContent) return;
        const galaxyContentDiameter = window.gameSessionData.universe.diameter || 500;
        galaxyViewport.style.width = `${galaxyContentDiameter}px`;
        galaxyViewport.style.height = `${galaxyContentDiameter}px`;
        galaxyZoomContent.style.width = `${galaxyContentDiameter}px`;
        galaxyZoomContent.style.height = `${galaxyContentDiameter}px`;
        solarSystemLinesCanvasEl.style.width = `${galaxyContentDiameter}px`;
        solarSystemLinesCanvasEl.style.height = `${galaxyContentDiameter}px`;
        if (!galaxyIconCache[galaxy.id]) {
            galaxyZoomContent.innerHTML = '';
            const fragment = document.createDocumentFragment();
            galaxy.solarSystems.forEach(ss => {
                const solarSystemElement = document.createElement('div');
                solarSystemElement.className = 'solar-system-icon';
                solarSystemElement.style.width = `${ss.iconSize}px`;
                solarSystemElement.style.height = `${ss.iconSize}px`;
                solarSystemElement.style.left = `${ss.x}px`;
                solarSystemElement.style.top = `${ss.y}px`;
                solarSystemElement.dataset.solarSystemId = ss.id;
                if (ss.customName) solarSystemElement.title = ss.customName;
                solarSystemElement.addEventListener('click', (e) => { e.stopPropagation(); switchToSolarSystemView(ss.id); });
                fragment.appendChild(solarSystemElement);
            });
            galaxyZoomContent.appendChild(solarSystemLinesCanvasEl);
            galaxyZoomContent.appendChild(fragment);
            galaxyIconCache[galaxy.id] = true;
        }
        drawGalaxyLines(galaxy);
        galaxyZoomContent.style.transition = isInteractivePanOrZoom ? 'none' : 'transform 0.1s ease-out';
        galaxyZoomContent.style.transform = `translate(${galaxy.currentPanX}px, ${galaxy.currentPanY}px) scale(${galaxy.currentZoom})`;
        if (galaxyDetailTitleText) {
            const galaxyNumDisplay = galaxy.id.split('-').pop();
            galaxyDetailTitleText.textContent = galaxy.customName || `Galaxy ${galaxyNumDisplay}`;
        }
    }
    
    function switchToMainView() {
        if (window.activeSolarSystemRenderer) {
            // Remove previous click listener before disposing
            if (elements.solarSystemContent) {
                elements.solarSystemContent.removeEventListener('click', _onSolarSystemCanvasClick);
            }
            window.activeSolarSystemRenderer.dispose();
            window.activeSolarSystemRenderer = null;
        }
        focusedPlanetId = null; // Clear focused planet
        window.gameSessionData.activeGalaxyId = null;
        window.gameSessionData.activeSolarSystemId = null;
        callbacks.stopSolarSystemAnimation();
        setActiveScreen(elements.mainScreen);
        generateStarBackgroundCanvas(elements.mainScreen);
    }

    function switchToGalaxyDetailView(galaxyId) {
        if (window.activeSolarSystemRenderer) {
            // Remove previous click listener before disposing
            if (elements.solarSystemContent) {
                elements.solarSystemContent.removeEventListener('click', _onSolarSystemCanvasClick);
            }
            window.activeSolarSystemRenderer.dispose();
            window.activeSolarSystemRenderer = null;
        }
        focusedPlanetId = null; // Clear focused planet
        const galaxy = window.gameSessionData.galaxies.find(g => g.id === galaxyId);
        if (!galaxy) return switchToMainView();
        window.gameSessionData.activeGalaxyId = galaxyId;
        const galaxyNumDisplay = galaxy.id.split('-').pop();
        if (elements.backToGalaxyButton) elements.backToGalaxyButton.textContent = galaxy.customName ? `← ${galaxy.customName}` : `← Galaxy ${galaxyNumDisplay}`;
        window.gameSessionData.activeSolarSystemId = null;
        callbacks.stopSolarSystemAnimation();
        if (!galaxy.layoutGenerated) generateSolarSystemsForGalaxy(galaxy, elements.galaxyViewport, callbacks.getCustomizationSettings().ssCountRange);
        setActiveScreen(elements.galaxyDetailScreen);
        generateStarBackgroundCanvas(elements.galaxyDetailScreen);
        renderGalaxyDetailScreen(false);
        makeTitleEditable(elements.galaxyDetailTitleText, elements.galaxyDetailTitleInput, (newName) => {
            galaxy.customName = newName || null;
            callbacks.saveGameState();
            renderMainScreen();
            return galaxy.customName || `Galaxy ${galaxyNumDisplay}`;
        });
    }

    function switchToSolarSystemView(solarSystemId) {
        if (window.activeSolarSystemRenderer) {
            // Ensure previous click listener is removed before disposing renderer for a new one
            if (elements.solarSystemContent) {
                elements.solarSystemContent.removeEventListener('click', _onSolarSystemCanvasClick);
            }
            window.activeSolarSystemRenderer.dispose();
            window.activeSolarSystemRenderer = null;
        }
        focusedPlanetId = null; // Clear focused planet when changing solar systems
        callbacks.stopSolarSystemAnimation();
        window.gameSessionData.activeSolarSystemId = solarSystemId;
        const activeGalaxy = window.gameSessionData.galaxies.find(g => solarSystemId.startsWith(g.id));
        const solarSystemObject = activeGalaxy?.solarSystems.find(s => s.id === solarSystemId);
        if (!solarSystemObject) return switchToMainView();
        if (!solarSystemObject.planets) callbacks.generatePlanetsForSystem(solarSystemObject);
        console.log(`[DEBUG] Rendering system ${solarSystemId} with ${solarSystemObject.planets.length} planets.`);
        _renderPlanetSidebar(solarSystemObject.planets);

        const solarSystemDataForRenderer = {
            id: solarSystemObject.id,
            sun: { size: solarSystemObject.sunSizeFactor, type: Math.floor(Math.random() * 5) },
            planets: solarSystemObject.planets.map(p => ({ ...p }))
        };
        setActiveScreen(elements.solarSystemScreen);
        SolarSystemRenderer.init(solarSystemDataForRenderer);
        window.activeSolarSystemRenderer = SolarSystemRenderer;
        callbacks.startSolarSystemAnimation(); // This function does nothing, but kept for compatibility.

        // Add click listener to the solar system content for 3D object interaction
        elements.solarSystemContent.addEventListener('click', _onSolarSystemCanvasClick);

        makeTitleEditable(elements.solarSystemTitleText, elements.solarSystemTitleInput, (newName) => {
            solarSystemObject.customName = newName || null;
            callbacks.saveGameState();
            renderGalaxyDetailScreen();
            return solarSystemObject.customName || `System ${solarSystemId.split('-').pop()}`;
        });
    }

    // New function to handle clicks on the 3D solar system canvas
    function _onSolarSystemCanvasClick(event) {
        if (!window.activeSolarSystemRenderer) return;

        const raycaster = window.activeSolarSystemRenderer.getRaycaster();
        const mouse = window.activeSolarSystemRenderer.getMouse();
        const camera = window.activeSolarSystemRenderer.getCamera();
        const planetMeshes = window.activeSolarSystemRenderer.getPlanetMeshes();
        
        if (!raycaster || !mouse || !camera || !planetMeshes || planetMeshes.length === 0) return;

        const rect = elements.solarSystemContent.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(planetMeshes);

        if (intersects.length > 0) {
            const clickedPlanetData = intersects[0].object.userData;
            const systemId = window.gameSessionData.activeSolarSystemId;
            const onBackCallback = () => window.switchToSolarSystemView(systemId);
            
            // Clicking a 3D planet will always transition to Hex Planet View
            window.switchToHexPlanetView(clickedPlanetData, onBackCallback);
            
        }
    }


    function switchToHexPlanetView(planetData, onBackCallback) {
        if (!planetData) return;
        if (window.activeSolarSystemRenderer) {
            window.activeSolarSystemRenderer.unfocusPlanet(); // Unfocus if currently focused on a planet
             // Remove the 3D canvas click listener when leaving solar system view
            if (elements.solarSystemContent) {
                elements.solarSystemContent.removeEventListener('click', _onSolarSystemCanvasClick);
            }
        }
        focusedPlanetId = null; // Clear focused planet
        setActiveScreen(elements.hexPlanetScreen);
        callbacks.stopSolarSystemAnimation();
        HexPlanetViewController.activate(planetData, onBackCallback);
    }
    
    function clampGalaxyPan(galaxyDataObject) {
        const GALAXY_VIEW_MIN_ZOOM = 1.0;
        const { galaxyViewport } = elements;
        if (!galaxyDataObject || !galaxyViewport) return;
        const zoom = galaxyDataObject.currentZoom;
        if (zoom <= GALAXY_VIEW_MIN_ZOOM) {
            galaxyDataObject.currentPanX = 0;
            galaxyDataObject.currentPanY = 0;
        } else {
            const contentDiameter = window.gameSessionData.universe.diameter || 500;
            const scaledContentWidth = contentDiameter * zoom;
            const scaledContentHeight = contentDiameter * zoom;
            const maxPanX = Math.max(0, (scaledContentWidth - galaxyViewport.offsetWidth) / 2);
            const maxPanY = Math.max(0, (scaledContentHeight - galaxyViewport.offsetHeight) / 2);
            galaxyDataObject.currentPanX = Math.max(-maxPanX, Math.min(maxPanX, galaxyDataObject.currentPanX));
            galaxyDataObject.currentPanY = Math.max(-maxPanY, Math.min(maxPanY, galaxyDataObject.currentPanY));
        }
    }
    
    function handleZoom(direction, mouseEvent = null) {
        const GALAXY_VIEW_MIN_ZOOM = 1.0;
        const GALAXY_VIEW_MAX_ZOOM = 5.0;
        const ZOOM_STEP = 0.2;
        const galaxy = window.gameSessionData.galaxies.find(g => g.id === window.gameSessionData.activeGalaxyId);
        if (!galaxy) return;
        const oldZoom = galaxy.currentZoom;
        let newZoom = oldZoom * (1 + (direction === 'in' ? ZOOM_STEP : -ZOOM_STEP));
        newZoom = Math.max(GALAXY_VIEW_MIN_ZOOM, Math.min(GALAXY_VIEW_MAX_ZOOM, newZoom));
        if (Math.abs(oldZoom - newZoom) < 0.0001) return;
        if (mouseEvent && elements.galaxyViewport) {
            const rect = elements.galaxyViewport.getBoundingClientRect();
            const mouseX = mouseEvent.clientX - rect.left;
            const mouseY = mouseEvent.clientY - rect.top;
            const mouseRelX = mouseX - elements.galaxyViewport.offsetWidth / 2;
            const mouseRelY = mouseY - elements.galaxyViewport.offsetHeight / 2;
            const worldX = (mouseRelX - galaxy.currentPanX) / oldZoom;
            const worldY = (mouseRelY - galaxy.currentPanY) / oldZoom;
            galaxy.currentPanX = mouseRelX - (worldX * newZoom);
            galaxy.currentPanY = mouseRelY - (worldY * newZoom);
        }
        galaxy.currentZoom = newZoom;
        clampGalaxyPan(galaxy);
        renderGalaxyDetailScreen(true);
    }
    
    function startPan(event) {
        if (event.button !== 0 || event.target.closest('button, .solar-system-icon, .planet-icon')) return;
        const p = window.gameSessionData.panning;
        const galaxy = window.gameSessionData.galaxies.find(g => g.id === window.gameSessionData.activeGalaxyId);
        if(!galaxy) return;
        p.isActive = true;
        p.startX = event.clientX;
        p.startY = event.clientY;
        p.initialPanX = galaxy.currentPanX || 0;
        p.initialPanY = galaxy.initialPanY || 0;
        elements.galaxyViewport.classList.add('dragging');
        elements.galaxyZoomContent.style.transition = 'none';
        event.preventDefault();
    }
    
    function panMouseMove(event) {
        const p = window.gameSessionData.panning;
        if (!p.isActive) return;
        const galaxy = window.gameSessionData.galaxies.find(g => g.id === window.gameSessionData.activeGalaxyId);
        if(!galaxy) return;
        const deltaX = event.clientX - p.startX;
        const deltaY = event.clientY - p.startY;
        galaxy.currentPanX = p.initialPanX + deltaX;
        galaxy.currentPanY = p.initialPanY + deltaY;
        clampGalaxyPan(galaxy);
        renderGalaxyDetailScreen(true);
    }
    
    function panMouseUp() {
        const p = window.gameSessionData.panning;
        if (!p.isActive) return;
        if(elements.galaxyViewport) elements.galaxyViewport.classList.remove('dragging');
        if(elements.galaxyZoomContent) elements.galaxyZoomContent.style.transition = '';
        p.isActive = false;
    }

    return {
        init: (domElements, appCallbacks) => {
            elements = domElements;
            callbacks = appCallbacks;
            window.switchToMainView = switchToMainView;
            window.switchToSolarSystemView = switchToSolarSystemView;
            window.switchToHexPlanetView = switchToHexPlanetView;
            elements.regenerateUniverseButton.addEventListener('click', () => {
                callbacks.regenerateUniverseState();
                galaxyIconCache = {};
            });
            elements.createPlanetDesignButton.addEventListener('click', callbacks.switchToPlanetDesignerScreen);
            elements.backToMainButton.addEventListener('click', switchToMainView);
            elements.backToGalaxyButton.addEventListener('click', () => {
                // When going back to galaxy, unfocus any planet
                if (window.activeSolarSystemRenderer && typeof window.activeSolarSystemRenderer.unfocusPlanet === 'function') {
                    window.activeSolarSystemRenderer.unfocusPlanet();
                }
                focusedPlanetId = null; // Clear focused planet
                // Remove the 3D canvas click listener when leaving solar system view
                if (elements.solarSystemContent) {
                    elements.solarSystemContent.removeEventListener('click', _onSolarSystemCanvasClick);
                }
                if (window.gameSessionData.activeGalaxyId) switchToGalaxyDetailView(window.gameSessionData.activeGalaxyId);
                else switchToMainView();
            });
            elements.zoomInButton.addEventListener('click', () => handleZoom('in'));
            elements.zoomOutButton.addEventListener('click', () => handleZoom('out'));
            elements.galaxyViewport.addEventListener('mousedown', startPan);
            elements.galaxyDetailScreen.addEventListener('wheel', e => {
                e.preventDefault();
                handleZoom(e.deltaY < 0 ? 'in' : 'out', e);
            }, { passive: false });
            window.addEventListener('mousemove', panMouseMove);
            window.addEventListener('mouseup', panMouseUp);
        },
        renderMainScreen: renderMainScreen,
        setActiveScreen: setActiveScreen,
        // Expose togglePlanetFocus for the sidebar click handler
        togglePlanetFocus: togglePlanetFocus,
    };
})();
