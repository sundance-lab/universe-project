// public/js/planetVisualPanelManager.js
import '../styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'OrbitControls';
import { getPlanetShaders } from './shaders.js';

export const PlanetVisualPanelManager = (() => {
  // --- MODULE STATE ---
  let panelElement, headerElement, titleElement, sizeElement, closeButton, planet360CanvasElement;
  let boundResizeHandler;
  let currentPlanetData = null;
  let isDraggingPanel = false;
  let panelOffset = { x: 0, y: 0 };
  let is360ViewActive = false;
  let threeScene, threeCamera, threeRenderer, threePlanetMesh, threeControls, threeAnimationId, threeShaderMaterial;

  const SPHERE_BASE_RADIUS = 0.8;
  const DISPLACEMENT_SCALING_FACTOR = 0.005;

  // --- PRIVATE METHODS ---

  function _onHeaderMouseDown(e) {
    if (e.target.closest('button')) return;
    isDraggingPanel = true;
    panelElement.classList.add('dragging');
    const panelRect = panelElement.getBoundingClientRect();
    panelOffset = { x: e.clientX - panelRect.left, y: e.clientY - panelRect.top };
    e.preventDefault();
  }

  function _onWindowMouseMove(e) {
    if (!isDraggingPanel) return;
    const newX = e.clientX - panelOffset.x;
    const newY = e.clientY - panelOffset.y;

    panelElement.style.left = `${newX}px`;
    panelElement.style.top = `${newY}px`;
    if (panelElement.style.transform !== 'none') {
      panelElement.style.transform = 'none';
    }
  }

  function _onWindowMouseUp() {
    if (isDraggingPanel) {
      isDraggingPanel = false;
      panelElement.classList.remove('dragging');
    }
  }
  
  function _onPanelResize() {
    const panelIsVisible = panelElement?.classList.contains('visible');
    if (is360ViewActive && panelIsVisible && threeRenderer && threeCamera && planet360CanvasElement?.offsetParent !== null) {
      const canvas = planet360CanvasElement;
      const newWidth = canvas.offsetWidth;
      const newHeight = canvas.offsetHeight;
      if (newWidth > 0 && newHeight > 0) {
        threeCamera.aspect = newWidth / newHeight;
        threeCamera.updateProjectionMatrix();
        threeRenderer.setSize(newWidth, newHeight);
      }
    }
  }

  function _initThreeJSView(planet) {
    const { vertexShader, fragmentShader } = getPlanetShaders();

    threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color(0x050510);
    const aspectRatio = planet360CanvasElement.offsetWidth / planet360CanvasElement.offsetHeight;
    threeCamera = new THREE.PerspectiveCamera(60, aspectRatio, 0.001, 1000);
    threeCamera.position.z = 2.5;

    threeRenderer = new THREE.WebGLRenderer({ canvas: planet360CanvasElement, antialias: true });
    threeRenderer.setSize(planet360CanvasElement.offsetWidth, planet360CanvasElement.offsetHeight);
    threeRenderer.setPixelRatio(window.devicePixelRatio);

    const geometry = new THREE.SphereGeometry(SPHERE_BASE_RADIUS, 128, 64); // Reduced poly count for performance

    let normalizedOceanLevel = 0.5;
    const pMin = planet.minTerrainHeight ?? 0.0;
    const pMax = planet.maxTerrainHeight ?? (pMin + 10.0);
    const pOcean = planet.oceanHeightLevel ?? (pMin + (pMax - pMin) * 0.3);
    if (pMax > pMin) {
      normalizedOceanLevel = (pOcean - pMin) / (pMax - pMin);
    }
    const conceptualRange = Math.max(0.1, pMax - pMin);
    const displacementAmount = conceptualRange * DISPLACEMENT_SCALING_FACTOR;

    const uniforms = {
      uLandColor: { value: new THREE.Color(planet.landColor || '#556B2F') },
      uWaterColor: { value: new THREE.Color(planet.waterColor || '#1E90FF') },
      uOceanHeightLevel: { value: normalizedOceanLevel },
      uContinentSeed: { value: planet.continentSeed ?? Math.random() },
      uRiverBasin: { value: planet.riverBasin ?? 0.05 },
      uForestDensity: { value: planet.forestDensity ?? 0.5 },
      uSphereRadius: { value: SPHERE_BASE_RADIUS },
      uDisplacementAmount: { value: displacementAmount }
    };
    
    threeShaderMaterial = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,  
      fragmentShader,
    });

    threePlanetMesh = new THREE.Mesh(geometry, threeShaderMaterial);
    threeScene.add(threePlanetMesh);

    threeControls = new OrbitControls(threeCamera, threeRenderer.domElement);
    threeControls.enableDamping = true;
    threeControls.dampingFactor = 0.05;
    threeControls.rotateSpeed = 0.5;
    threeControls.minDistance = 0.9;
    threeControls.maxDistance = SPHERE_BASE_RADIUS * 7;
    threeControls.target.set(0, 0, 0);

    _animateThreeJSView();
  }

  function _animateThreeJSView() {
    if (!is360ViewActive || !threeRenderer) return;
    threeAnimationId = requestAnimationFrame(_animateThreeJSView);
    if (threeControls) threeControls.update();
    threeRenderer.render(threeScene, threeCamera);
  }

  function _stopAndCleanupThreeJSView() {
    if (threeAnimationId) cancelAnimationFrame(threeAnimationId);
    if (threeControls) threeControls.dispose();
    if (threeShaderMaterial) threeShaderMaterial.dispose();
    if (threePlanetMesh) {
      if(threePlanetMesh.geometry) threePlanetMesh.geometry.dispose();
      if(threeScene) threeScene.remove(threePlanetMesh);
    }
    if (threeRenderer) threeRenderer.dispose();
    threeAnimationId = null;
    threeControls = null;
    threeShaderMaterial = null;
    threePlanetMesh = null;
    threeScene = null;
    threeCamera = null;
  }

  function _closePanel() {
    if (panelElement) panelElement.classList.remove('visible');
    is360ViewActive = false;
    _stopAndCleanupThreeJSView();
    if (planet360CanvasElement) planet360CanvasElement.style.display = 'none';
  }

  function _showPanel(planetData) {
    if (!panelElement) return;

    panelElement.classList.add('visible');
    // Reset to center position
    panelElement.style.left = '50%';
    panelElement.style.top = '50%';
    panelElement.style.transform = 'translate(-50%, -50%)';
    
    if (planetData) {
      currentPlanetData = planetData;
      titleElement.textContent = planetData.planetName || 'Planet';
      sizeElement.textContent = `${Number(planetData.size).toFixed(2)} units`;
      
      // Initialize the 3D view for the new planet
      is360ViewActive = true;
      _stopAndCleanupThreeJSView(); // Clean up previous instance
      if (planet360CanvasElement) {
        planet360CanvasElement.style.display = 'block';
        requestAnimationFrame(() => { 
          if (planet360CanvasElement.offsetParent !== null) {
            _initThreeJSView(currentPlanetData);
          }
        });
      }
    }
  }

  // --- PUBLIC API ---

  return {
    init: () => {
      panelElement = document.getElementById('planet-visual-panel');
      headerElement = document.getElementById('planet-visual-panel-header');
      titleElement = document.getElementById('planet-visual-title');
      sizeElement = document.getElementById('planet-visual-size');
      closeButton = document.getElementById('close-planet-visual-panel');
      planet360CanvasElement = document.getElementById('panel-planet-360-canvas');
      
      if (!panelElement || !planet360CanvasElement) {
          console.error("PlanetVisualPanelManager: Panel or Canvas element not found in DOM!");
          return;
      }

      // Attach event listeners
      closeButton.addEventListener('click', _closePanel);
      headerElement.addEventListener('mousedown', _onHeaderMouseDown);
      window.addEventListener('mousemove', _onWindowMouseMove, { passive: true });
      window.addEventListener('mouseup', _onWindowMouseUp);

      // Bind the resize handler once and store the reference to prevent leaks
      boundResizeHandler = _onPanelResize.bind(this);
      window.addEventListener('resize', boundResizeHandler);
      
      console.log("PVisualPanelManager: Init complete.");
    },

    show: _showPanel,
    hide: _closePanel,
    isVisible: () => panelElement?.classList.contains('visible'),
    
    destroy: () => {
        console.log("PlanetVisualPanelManager: Destroying global listeners.");
        _stopAndCleanupThreeJSView();
        window.removeEventListener('mousemove', _onWindowMouseMove);
        window.removeEventListener('mouseup', _onWindowMouseUp);
        if (boundResizeHandler) {
            window.removeEventListener('resize', boundResizeHandler);
            boundResizeHandler = null; // Clear the reference
        }
    }
  };
})();
