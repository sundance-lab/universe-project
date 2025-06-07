// public/js/planetVisualPanelManager.js

import '../styles.css';

// FIXED: Restructured to use a single, standard IIFE pattern.
// This resolves the "Unexpected end of file" syntax error.
export const PlanetVisualPanelManager = (() => {
  console.log("PVisualPanelManager: Script loaded.");

  // DOM Elements
  let panelElement, headerElement, titleElement, sizeElement, canvasElement, closeButton;

  // State
  let currentPlanetData = null;
  let rotationQuat = [1, 0, 0, 0];
  let startDragPlanetQuat = [1, 0, 0, 0];
  let startDragMouse = { x: 0, y: 0 };
  let isDraggingPlanet = false;
  let isDraggingPanel = false;
  let panelOffset = { x: 0, y: 0 };
  let isRendering = false;
  let needsRerender = false;

  function _render() {
    if (isRendering || !window.planetVisualWorker || !currentPlanetData || !canvasElement) {
      if (currentPlanetData) needsRerender = true;
      return;
    }

    // Defer rendering if the canvas isn't actually visible yet
    if (canvasElement.offsetParent === null) {
      needsRerender = true;
      return;
    }

    // Resize canvas if its display size has changed
    if (canvasElement.width !== canvasElement.offsetWidth || canvasElement.height !== canvasElement.offsetHeight) {
      canvasElement.width = canvasElement.offsetWidth;
      canvasElement.height = canvasElement.offsetHeight;
    }

    // Don't render on a 0-sized canvas
    if (canvasElement.width === 0 || canvasElement.height === 0) {
        needsRerender = true;
        return;
    }

    isRendering = true;
    needsRerender = false;
    window.renderPlanetVisual(currentPlanetData, rotationQuat, canvasElement);
  }
  
  function _rerenderIfNeeded() {
      if (panelElement?.classList.contains('visible') && currentPlanetData) {
          _render();
      }
  }

  function _onCanvasMouseDown(e) {
    if (e.button !== 0 || !currentPlanetData) return;
    isDraggingPlanet = true;
    startDragMouse.x = e.clientX;
    startDragMouse.y = e.clientY;
    startDragPlanetQuat = [...rotationQuat];
    canvasElement?.classList.add('dragging');
    e.preventDefault();
  }

  function _onHeaderMouseDown(e) {
    if (e.button !== 0 || !panelElement) return;
    isDraggingPanel = true;
    headerElement?.classList.add('dragging');
    panelElement.style.transition = 'none';

    const rect = panelElement.getBoundingClientRect();
    panelOffset.x = e.clientX - rect.left;
    panelOffset.y = e.clientY - rect.top;

    panelElement.style.transform = 'none';
    panelElement.style.left = `${e.clientX - panelOffset.x}px`;
    panelElement.style.top = `${e.clientY - panelOffset.y}px`;
    e.preventDefault();
  }

  function _onWindowMouseMove(e) {
    if (isDraggingPanel && panelElement) {
      panelElement.style.left = `${e.clientX - panelOffset.x}px`;
      panelElement.style.top = `${e.clientY - panelOffset.y}px`;
    } else if (isDraggingPlanet && canvasElement) {
      const rect = canvasElement.getBoundingClientRect();
      if (rect.width === 0) return;

      const deltaX = e.clientX - startDragMouse.x;
      const deltaY = e.clientY - startDragMouse.y;
      const sensitivity = window.PLANET_ROTATION_SENSITIVITY || 0.75;
      
      const rotX = (deltaY / rect.width) * Math.PI * sensitivity;
      const rotY = (deltaX / rect.width) * (2 * Math.PI) * sensitivity;

      const rotQuatX = window.quat_from_axis_angle([1, 0, 0], -rotX);
      const rotQuatY = window.quat_from_axis_angle([0, 1, 0], rotY);
      const incrRotQuat = window.quat_multiply(rotQuatY, rotQuatX);
      
      rotationQuat = window.quat_normalize(window.quat_multiply(incrRotQuat, startDragPlanetQuat));
      _render();
    }
  }

  function _onWindowMouseUp() {
    if (isDraggingPanel) {
      isDraggingPanel = false;
      headerElement?.classList.remove('dragging');
      panelElement?.style.removeProperty('transition');
    }
    if (isDraggingPlanet) {
      isDraggingPlanet = false;
      canvasElement?.classList.remove('dragging');
    }
  }

  function _closePanel() {
    panelElement?.classList.remove('visible');
    currentPlanetData = null;
    isRendering = false;
    needsRerender = false;
  }

  // PUBLIC API
  return {
    init: () => {
      console.log("PlanetVisualPanelManager: Init called.");
      panelElement = document.getElementById('planet-visual-panel');
      headerElement = document.getElementById('planet-visual-panel-header');
      titleElement = document.getElementById('planet-visual-title');
      sizeElement = document.getElementById('planet-visual-size');
      canvasElement = document.getElementById('planet-visual-canvas');
      closeButton = document.getElementById('close-planet-visual-panel');

      if (typeof window.quat_identity === 'function') {
        rotationQuat = window.quat_identity();
      }

      closeButton?.addEventListener('click', _closePanel);
      headerElement?.addEventListener('mousedown', _onHeaderMouseDown);
      canvasElement?.addEventListener('mousedown', _onCanvasMouseDown);
      window.addEventListener('mousemove', _onWindowMouseMove);
      window.addEventListener('mouseup', _onWindowMouseUp);
      
      // Periodically check if a rerender is needed (e.g. after panel becomes visible)
      setInterval(() => {
          if(needsRerender) _render();
      }, 250);
    },

    show: (planetData) => {
      if (!panelElement || !planetData) {
        return _closePanel();
      }
      
      console.log("PVisualPanelManager: Show called for planet:", planetData.planetName || planetData.id);
      currentPlanetData = planetData;

      if (titleElement) titleElement.textContent = planetData.planetName || 'Planet';
      if (sizeElement) sizeElement.textContent = planetData.size ? Math.round(planetData.size) : 'N/A';

      if (typeof window.quat_identity === 'function') {
        rotationQuat = window.quat_identity();
      }
      
      panelElement.classList.add('visible');
      
      // Center the panel if it's the first time showing
      if (!panelElement.style.left && !panelElement.style.top) {
        panelElement.style.left = '50%';
        panelElement.style.top = '50%';
        panelElement.style.transform = 'translate(-50%, -50%)';
      }

      _render();
    },

    hide: _closePanel,

    handleWorkerMessage: ({ renderedData, width, height, error, senderId }) => {
      isRendering = false;
      if (senderId !== 'planet-visual-canvas') {
        if (needsRerender) _render();
        return;
      }
      
      if (error) {
        console.error("PVisualPanelManager: Worker reported an error:", error);
      } else if (canvasElement && panelElement?.classList.contains('visible') && currentPlanetData) {
        const ctx = canvasElement.getContext('2d');
        if (ctx && renderedData) {
           try {
            canvasElement.width = width;
            canvasElement.height = height;
            const clampedArray = new Uint8ClampedArray(renderedData);
            const imageDataObj = new ImageData(clampedArray, width, height);
            ctx.putImageData(imageDataObj, 0, 0);
          } catch(err) {
            console.error("PVisualPanelManager: Error putting ImageData on canvas:", err);
          }
        }
      }

      if (needsRerender) _render();
    },

    isVisible: () => {
      return panelElement?.classList.contains('visible');
    },
    
    getCurrentPlanetData: () => {
      return currentPlanetData;
    },
    
    rerenderIfNeeded: _rerenderIfNeeded,
  };
})();
