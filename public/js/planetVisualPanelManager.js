// public/js/planetVisualPanelManager.js
import '../styles.css';

export const PlanetVisualPanelManager = (() => {
  console.log("PVisualPanelManager: Script loaded.");

  // DOM Elements
  let panelElement, headerElement, titleElement, sizeElement,
      planetPreviewCanvasElement, // Renamed for clarity
      closeButton,
      enter360ViewButton,         // New button
      planet360CanvasElement;     // New canvas for 360 view

  // State
  let currentPlanetData = null;
  let rotationQuat = [1, 0, 0, 0]; // For preview canvas
  let startDragPlanetQuat = [1, 0, 0, 0]; // For preview canvas
  let startDragMouse = { x: 0, y: 0 }; // For preview canvas
  let isDraggingPlanet = false; // For preview canvas
  let isDraggingPanel = false;
  let panelOffset = { x: 0, y: 0 };
  let isRenderingPreview = false; // Renamed
  let needsPreviewRerender = false; // Renamed

  let is360ViewActive = false;
  let planet360AnimationId = null; // To control 360 animation loop

  // --- 360 VIEW RENDERING LOGIC (Placeholder - to be refined) ---
  function _renderPlanet360ViewInternal(planet) {
    if (!planet || !planet360CanvasElement || !is360ViewActive) {
      if (planet360AnimationId) {
        cancelAnimationFrame(planet360AnimationId);
        planet360AnimationId = null;
      }
      return;
    }

    const canvas = planet360CanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error("PVisualPanelManager: Could not get 2D context for 360 canvas.");
      return;
    }

    // Ensure canvas has dimensions (it might be hidden initially)
    if (canvas.offsetParent === null) { // If canvas not visible, defer
        planet360AnimationId = requestAnimationFrame(() => _renderPlanet360ViewInternal(planet));
        return;
    }
    if (canvas.width !== canvas.offsetWidth || canvas.height !== canvas.offsetHeight) {
        canvas.width = canvas.offsetWidth || 300; // Default size if offsetWidth is 0
        canvas.height = canvas.offsetHeight || 300;
    }
    if (canvas.width === 0 || canvas.height === 0) {
        planet360AnimationId = requestAnimationFrame(() => _renderPlanet360ViewInternal(planet));
        return;
    }


    let rotationAngle = parseFloat(canvas.dataset.rotationAngle || "0");

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const planetRadius = Math.min(canvas.width, canvas.height) / 3;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    ctx.beginPath();
    ctx.arc(centerX, centerY, planetRadius, 0, 2 * Math.PI);
    ctx.fillStyle = planet.waterColor || '#0000FF';
    ctx.fill();
    ctx.closePath();

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotationAngle);
    ctx.translate(-centerX, -centerY);
    ctx.fillStyle = planet.landColor || '#008000';
    ctx.fillRect(centerX - planetRadius / 2, centerY - planetRadius / 4, planetRadius, planetRadius / 2);
    ctx.restore();

    rotationAngle += 0.01;
    canvas.dataset.rotationAngle = rotationAngle.toString();

    planet360AnimationId = requestAnimationFrame(() => _renderPlanet360ViewInternal(planet));
  }

  function _stopPlanet360Animation() {
    if (planet360AnimationId) {
      cancelAnimationFrame(planet360AnimationId);
      planet360AnimationId = null;
      if(planet360CanvasElement) planet360CanvasElement.removeAttribute('data-rotation-angle');
    }
  }

  // --- PREVIEW RENDERING ---
  function _renderPreview() {
    if (isRenderingPreview || !window.planetVisualWorker || !currentPlanetData || !planetPreviewCanvasElement) {
      if (currentPlanetData) needsPreviewRerender = true;
      return;
    }
    if (planetPreviewCanvasElement.offsetParent === null) {
      needsPreviewRerender = true;
      return;
    }
    if (planetPreviewCanvasElement.width !== planetPreviewCanvasElement.offsetWidth || planetPreviewCanvasElement.height !== planetPreviewCanvasElement.offsetHeight) {
      planetPreviewCanvasElement.width = planetPreviewCanvasElement.offsetWidth;
      planetPreviewCanvasElement.height = planetPreviewCanvasElement.offsetHeight;
    }
    if (planetPreviewCanvasElement.width === 0 || planetPreviewCanvasElement.height === 0) {
      needsPreviewRerender = true;
      return;
    }
    isRenderingPreview = true;
    needsPreviewRerender = false;
    // Pass the specific ID of the preview canvas
    window.renderPlanetVisual(currentPlanetData, rotationQuat, planetPreviewCanvasElement, 'planet-visual-panel-preview-canvas');
  }

  function _rerenderPreviewIfNeeded() {
    if (panelElement?.classList.contains('visible') && currentPlanetData && !is360ViewActive) {
      _renderPreview();
    }
  }

  // --- VIEW SWITCHING LOGIC ---
  function _switchTo360View() {
    if (!currentPlanetData) return;
    is360ViewActive = true;
    if (planetPreviewCanvasElement) planetPreviewCanvasElement.style.display = 'none';
    if (planet360CanvasElement) planet360CanvasElement.style.display = 'block';
    if (enter360ViewButton) enter360ViewButton.textContent = "Show Preview"; // Toggle button text

    // Ensure planet 360 canvas is correctly sized before starting animation
    if (planet360CanvasElement && planet360CanvasElement.offsetParent !== null) {
        planet360CanvasElement.width = planet360CanvasElement.offsetWidth;
        planet360CanvasElement.height = planet360CanvasElement.offsetHeight;
    }

    _stopPlanet360Animation(); // Stop any previous animation
    _renderPlanet360ViewInternal(currentPlanetData);
    console.log("PVisualPanelManager: Switched to 360 view.");
  }

  function _switchToPreviewView() {
    is360ViewActive = false;
    _stopPlanet360Animation();
    if (planet360CanvasElement) planet360CanvasElement.style.display = 'none';
    if (planetPreviewCanvasElement) planetPreviewCanvasElement.style.display = 'block';
    if (enter360ViewButton) enter360ViewButton.textContent = "Enter 360° View"; // Toggle button text
    _renderPreview(); // Re-render the preview
    console.log("PVisualPanelManager: Switched to preview view.");
  }


  // --- MOUSE EVENT HANDLERS (for preview canvas) ---
  function _onCanvasMouseDown(e) {
    if (e.button !== 0 || !currentPlanetData || is360ViewActive) return; // Only for preview
    isDraggingPlanet = true;
    startDragMouse.x = e.clientX;
    startDragMouse.y = e.clientY;
    startDragPlanetQuat = [...rotationQuat];
    planetPreviewCanvasElement?.classList.add('dragging');
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
    } else if (isDraggingPlanet && planetPreviewCanvasElement && !is360ViewActive) { // Only for preview
      const rect = planetPreviewCanvasElement.getBoundingClientRect();
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
      _renderPreview();
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
      planetPreviewCanvasElement?.classList.remove('dragging');
    }
  }

  function _closePanel() {
    _switchToPreviewView(); // Ensure we reset to preview view
    _stopPlanet360Animation();
    panelElement?.classList.remove('visible');
    currentPlanetData = null;
    isRenderingPreview = false;
    needsPreviewRerender = false;
  }

  // PUBLIC API
  return {
    init: () => {
      console.log("PlanetVisualPanelManager: Init called.");
      panelElement = document.getElementById('planet-visual-panel');
      headerElement = document.getElementById('planet-visual-panel-header');
      titleElement = document.getElementById('planet-visual-title');
      sizeElement = document.getElementById('planet-visual-size');
      planetPreviewCanvasElement = document.getElementById('planet-visual-canvas'); // Existing canvas
      closeButton = document.getElementById('close-planet-visual-panel');

      // New elements for 360 view - IDs to be added in HTML
      planet360CanvasElement = document.getElementById('panel-planet-360-canvas');
      enter360ViewButton = document.getElementById('enter-360-view-button');

      if (typeof window.quat_identity === 'function') {
        rotationQuat = window.quat_identity();
      }

      closeButton?.addEventListener('click', _closePanel);
      headerElement?.addEventListener('mousedown', _onHeaderMouseDown);
      planetPreviewCanvasElement?.addEventListener('mousedown', _onCanvasMouseDown); // Only preview canvas is draggable for planet rotation
      
      enter360ViewButton?.addEventListener('click', () => {
        if (is360ViewActive) {
          _switchToPreviewView();
        } else {
          _switchTo360View();
        }
      });

      window.addEventListener('mousemove', _onWindowMouseMove);
      window.addEventListener('mouseup', _onWindowMouseUp);

      setInterval(() => {
        if (needsPreviewRerender && !is360ViewActive) _renderPreview();
      }, 250);
    },

    show: (planetData) => {
      if (!panelElement || !planetData) {
        return _closePanel();
      }

      console.log("PVisualPanelManager: Show called for planet:", planetData.planetName || planetData.id);
      currentPlanetData = planetData;
      _switchToPreviewView(); // Always start with the preview view

      if (titleElement) titleElement.textContent = planetData.planetName || 'Planet';
      if (sizeElement) sizeElement.textContent = planetData.size ? `${Math.round(planetData.size)} px (diameter)` : 'N/A';

      if (typeof window.quat_identity === 'function') {
        rotationQuat = window.quat_identity(); // Reset rotation for preview
      }

      panelElement.classList.add('visible');

      if (!panelElement.style.left && !panelElement.style.top) {
        panelElement.style.left = '50%';
        panelElement.style.top = '50%';
        panelElement.style.transform = 'translate(-50%, -50%)';
      }
      // Initial render of preview
      requestAnimationFrame(() => _renderPreview());
    },

    hide: _closePanel,

    handleWorkerMessage: ({ renderedData, width, height, error, senderId }) => {
      // Check if this message is for our preview canvas
      if (senderId !== 'planet-visual-panel-preview-canvas') {
        // If it's not for us, but we needed a preview rerender and are in preview mode, try again.
        if (needsPreviewRerender && !is360ViewActive) _renderPreview();
        return;
      }
      
      isRenderingPreview = false; // Mark preview rendering as complete for THIS request

      if (error) {
        console.error("PVisualPanelManager: Worker reported an error for preview canvas:", error);
      } else if (planetPreviewCanvasElement && panelElement?.classList.contains('visible') && currentPlanetData && !is360ViewActive) {
        // Only update if we are still in preview mode
        const ctx = planetPreviewCanvasElement.getContext('2d');
        if (ctx && renderedData) {
          try {
            // Ensure canvas dimensions match the data received from worker for preview
            if(planetPreviewCanvasElement.width !== width) planetPreviewCanvasElement.width = width;
            if(planetPreviewCanvasElement.height !== height) planetPreviewCanvasElement.height = height;

            const clampedArray = new Uint8ClampedArray(renderedData);
            const imageDataObj = new ImageData(clampedArray, width, height);
            ctx.clearRect(0, 0, width, height); // Clear before putting new image data
            ctx.putImageData(imageDataObj, 0, 0);
          } catch (err) {
            console.error("PVisualPanelManager: Error putting ImageData on preview canvas:", err);
          }
        }
      }
      // If another preview rerender was flagged while this one was in progress
      if (needsPreviewRerender && !is360ViewActive) _renderPreview();
    },

    isVisible: () => {
      return panelElement?.classList.contains('visible');
    },

    getCurrentPlanetData: () => {
      return currentPlanetData;
    },

    rerenderPreviewIfNeeded: _rerenderPreviewIfNeeded, // Keep this if other parts of app might trigger it
  };
})();
