// public/js/planetVisualPanelManager.js

import '../styles.css';

export const PlanetVisualPanelManager = (() => {  // Make it immediately accessible as `PlanetVisualPanelManager`

console.log("PVisualPanelManager: Script loaded."); 
  
window.PlanetVisualPanelManager = (() => {
  // DOM Elements - will be fetched in init
  let panelElement, headerElement, titleElement, sizeElement, canvasElement, closeButton;

  // State specific to the Planet Visual Panel
  let currentPlanetData = null;
  let rotationQuat = [1, 0, 0, 0]; // Will be initialized by quat_identity
  let startDragPlanetQuat = [1, 0, 0, 0];
  let startDragMouse = { x: 0, y: 0 };
  let isDraggingPlanet = false; // For dragging the planet inside the panel
  let isDraggingPanel = false;  // For dragging the panel itself
  let panelOffset = { x: 0, y: 0 };
  let isRendering = false;      // Flag for worker rendering state for THIS panel's canvas
  let needsRerender = false;

  // Shared function references will be accessed via window global scope

  function _render() {
    if (!canvasElement) {
      console.warn("PVisualPanelManager: _render called but canvasElement is null.");
      return;
    }
    // If another render call for this panel is already in progress with the worker
    if (isRendering) {
      // console.log("PVisualPanelManager: _render bailed. isRendering is true. Marking needsRerender."); // Verbose
      if (currentPlanetData) needsRerender = true; // Only mark if there's something to render
      return;
    }
    if (!window.planetVisualWorker) {
        console.warn("PVisualPanelManager: _render bailed. window.planetVisualWorker not available.");
        if (currentPlanetData) needsRerender = true;
        return;
    }
    if (!currentPlanetData) {
        // console.log("PVisualPanelManager: _render bailed. currentPlanetData is null."); // Can be verbose
        return; // No need to set needsRerender if there's no data.
    }

    // Ensure canvas has valid dimensions before attempting to render
    let canvasHasValidDimensions = (canvasElement.width > 0 && canvasElement.height > 0);
    if (!canvasHasValidDimensions) { // Check if internal dimensions are zero
        // Attempt to resize from offset dimensions if internal are zero
        if (canvasElement.offsetWidth > 0 && canvasElement.offsetHeight > 0) {
            canvasElement.width = canvasElement.offsetWidth;
            canvasElement.height = canvasElement.offsetHeight;
            console.log(`PVisualPanelManager: Canvas resized from offset to ${canvasElement.width}x${canvasElement.height} in _render.`);
            canvasHasValidDimensions = (canvasElement.width > 0 && canvasElement.height > 0);
        }
    }

    if (!canvasHasValidDimensions) {
      console.warn("PVisualPanelManager: Canvas has 0 dimensions. Attempting resize and will retry _render via rAF.");
      needsRerender = true; // Mark and try later
      requestAnimationFrame(() => {
        // Attempt to resize based on current offsetWidth/Height
        if (canvasElement.offsetWidth > 0 && canvasElement.offsetHeight > 0) {
          if (canvasElement.width !== canvasElement.offsetWidth) canvasElement.width = canvasElement.offsetWidth;
          if (canvasElement.height !== canvasElement.offsetHeight) canvasElement.height = canvasElement.offsetHeight;
          
          if (canvasElement.width > 0 && canvasElement.height > 0) { 
            console.log(`PVisualPanelManager: Canvas resized to ${canvasElement.width}x${canvasElement.height}, retrying _render from rAF.`);
            if (needsRerender) _render(); // Retry if still needed and dimensions are now good
          } else {
            console.warn("PVisualPanelManager: Canvas still 0-dim after resize attempt in rAF.");
          }
        } else {
            console.warn("PVisualPanelManager: Canvas offsetWidth/Height still 0 in rAF. Render will be skipped for this frame.");
            // needsRerender remains true, will retry on next explicit call to _render or rerenderIfNeeded
        }
      });
      return;
    }

    // console.log("PVisualPanelManager: Calling window.renderPlanetVisual for panel canvas."); // Verbose
    isRendering = true;
    needsRerender = false; // Clear the flag as we are attempting a render
    window.renderPlanetVisual(currentPlanetData, rotationQuat, canvasElement);
  }

  function _onCanvasMouseDown(e) {
    if (e.button !== 0 || !currentPlanetData) return;
    isDraggingPlanet = true;
    startDragMouse.x = e.clientX;
    startDragMouse.y = e.clientY;
    startDragPlanetQuat = [...rotationQuat]; 
    if (canvasElement) canvasElement.classList.add('dragging');
    e.preventDefault(); // Prevent text selection or other default drag behaviors
  }

  function _onHeaderMouseDown(e) {
    if (e.button !== 0 || !panelElement) return;
    isDraggingPanel = true;
    if (headerElement) headerElement.classList.add('dragging');
    panelElement.style.transition = 'none'; 
    
    const rect = panelElement.getBoundingClientRect();
    panelOffset.x = e.clientX - rect.left;
    panelOffset.y = e.clientY - rect.top;
    
    panelElement.style.transform = 'none'; 
    panelElement.style.right = 'auto'; 
    panelElement.style.bottom = 'auto';
    e.preventDefault(); // Prevent text selection or other default drag behaviors
  }

  function _onWindowMouseMove(e) {
    if (isDraggingPanel && panelElement) {
      panelElement.style.left = `${e.clientX - panelOffset.x}px`;
      panelElement.style.top = `${e.clientY - panelOffset.y}px`;
    } else if (isDraggingPlanet && currentPlanetData && canvasElement && panelElement.classList.contains('visible')) {
      const rect = canvasElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const canvasEffectiveWidth = (canvasElement.width > 0 ? canvasElement.width : rect.width) || 1;
      const canvasEffectiveHeight = (canvasElement.height > 0 ? canvasElement.height : rect.height) || 1;
      const deltaX = e.clientX - startDragMouse.x;
      const deltaY = e.clientY - startDragMouse.y;

      if (typeof window.quat_from_axis_angle !== 'function' ||
          typeof window.quat_multiply !== 'function' ||
          typeof window.quat_normalize !== 'function') {
          console.error("PVisualPanelManager: Quaternion math functions not found on window!");
          isDraggingPlanet = false; 
          if (canvasElement) canvasElement.classList.remove('dragging');
          return;
      }

      const rotationSensitivity = typeof window.PLANET_ROTATION_SENSITIVITY === 'number' ? window.PLANET_ROTATION_SENSITIVITY : 0.75;
      const rotationAroundX = (deltaY / canvasEffectiveHeight) * Math.PI * rotationSensitivity; 
      const rotationAroundY = (deltaX / canvasEffectiveWidth) * (2 * Math.PI) * rotationSensitivity;

      const xAxisRotationQuat = window.quat_from_axis_angle([1, 0, 0], -rotationAroundX); 
      const yAxisRotationQuat = window.quat_from_axis_angle([0, 1, 0], rotationAroundY);  
      
      const incrementalRotationQuat = window.quat_multiply(yAxisRotationQuat, xAxisRotationQuat); 
      rotationQuat = window.quat_normalize(window.quat_multiply(incrementalRotationQuat, startDragPlanetQuat));
      
      _render(); 
    }
  }

  function _onWindowMouseUp() {
    if (isDraggingPanel && panelElement) {
      isDraggingPanel = false;
      if (headerElement) headerElement.classList.remove('dragging');
      panelElement.style.transition = ''; 
    }
    if (isDraggingPlanet && canvasElement) {
      isDraggingPlanet = false;
      canvasElement.classList.remove('dragging');
    }
  }

  function _closePanel() {
    if (panelElement) panelElement.classList.remove('visible');
    currentPlanetData = null; 
    isRendering = false; 
    needsRerender = false; 
  }

  // Public API
  return {
    init: () => {
      console.log("PlanetVisualPanelManager: Init called.");
      panelElement = document.getElementById('planet-visual-panel');
      headerElement = document.getElementById('planet-visual-panel-header');
      titleElement = document.getElementById('planet-visual-title');
      sizeElement = document.getElementById('planet-visual-size');
      canvasElement = document.getElementById('planet-visual-canvas');
      closeButton = document.getElementById('close-planet-visual-panel');

      if (!panelElement || !headerElement || !titleElement || !sizeElement || !canvasElement || !closeButton) {
        console.error("PVisualPanelManager: One or more DOM elements not found during init!");
        return; 
      }

      if (typeof window.quat_identity === 'function') {
        rotationQuat = window.quat_identity();
        startDragPlanetQuat = window.quat_identity();
      } else {
        console.error("PVisualPanelManager: quat_identity function not found on window object! Using fallback.");
        rotationQuat = [1,0,0,0];
        startDragPlanetQuat = [1,0,0,0];
      }

      closeButton.addEventListener('click', _closePanel);
      headerElement.addEventListener('mousedown', _onHeaderMouseDown);
      canvasElement.addEventListener('mousedown', _onCanvasMouseDown);

      window.addEventListener('mousemove', _onWindowMouseMove); // { passive: false } // Not strictly needed here as _onWindowMouseMove doesn't call preventDefault
      window.addEventListener('mouseup', _onWindowMouseUp);
      console.log("PlanetVisualPanelManager: Init completed and listeners attached.");
    },
    show: (planetData) => {
      if (!panelElement || !titleElement || !sizeElement || !canvasElement) {
        console.error("PVisualPanelManager: Cannot show - DOM elements uninitialized or missing.");
        return;
      }
      console.log("PVisualPanelManager: Show called for planet:", planetData ? (planetData.planetName || planetData.id || 'N/A') : "N/A");
      currentPlanetData = planetData;

      if (!currentPlanetData) {
          console.warn("PVisualPanelManager: Show called with null planetData. Hiding panel.");
          _closePanel();
          return;
      }

      titleElement.textContent = currentPlanetData.planetName || 'Planet'; 
      sizeElement.textContent = currentPlanetData.size ? Math.round(currentPlanetData.size) : 'N/A';

      const wasVisible = panelElement.classList.contains('visible');
      panelElement.classList.add('visible');

      if (!wasVisible || (panelElement.style.left === '' && panelElement.style.top === '')) { 
        panelElement.style.left = '50%';
        panelElement.style.top = '50%';
        panelElement.style.transform = 'translate(-50%, -50%)';
        panelElement.style.transition = ''; 
      } else {
        // If already visible and position is set, respect it
        // isDraggingPanel check prevents transition from being re-enabled mid-drag
        panelElement.style.transition = isDraggingPanel ? 'none' : ''; 
      }

      if (typeof window.quat_identity === 'function') {
        rotationQuat = window.quat_identity();
      } else {
        rotationQuat = [1,0,0,0]; 
      }
      
      // Ensure canvas has up-to-date dimensions before initial render if it's visible
      if (canvasElement.offsetWidth > 0 && canvasElement.offsetHeight > 0) {
        if (canvasElement.width !== canvasElement.offsetWidth) canvasElement.width = canvasElement.offsetWidth;
        if (canvasElement.height !== canvasElement.offsetHeight) canvasElement.height = canvasElement.offsetHeight;
      }
      // _render function will perform more robust checks and retries if dimensions are still 0

      _render(); 
    },
    hide: _closePanel,
    handleWorkerMessage: ({ renderedData, width, height, error, senderId }) => { // Added senderId to params
      isRendering = false; 
      // console.log(`PVisualPanelManager: handleWorkerMessage received. Sender ID: ${senderId}. isRendering set to false.`);

      // Crucially, ensure this message is for THIS panel's canvas
      if (senderId !== 'planet-visual-canvas') {
          // console.log("PVisualPanelManager: Worker message ignored, senderId mismatch.");
          // If it wasn't for this panel, and this panel needs a rerender, re-evaluate
          if (needsRerender && currentPlanetData) {
            // console.log("PVisualPanelManager: Processing queued rerender after an unrelated worker message.");
            _render();
          }
          return; 
      }
      
      if (error) {
          console.error("PVisualPanelManager: Worker reported an error for planet-visual-canvas:", error);
          if (canvasElement) {
              const ctx = canvasElement.getContext('2d');
              if (ctx) {
                ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
                ctx.fillStyle = 'rgba(100, 0, 0, 0.7)'; // Dark red error background
                ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);
                ctx.fillStyle = 'white';
                ctx.font = '16px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('Render Error', canvasElement.width / 2, canvasElement.height / 2);
              }
          }
      } else if (canvasElement && panelElement.classList.contains('visible') && currentPlanetData) {
        const ctx = canvasElement.getContext('2d');
        if (!ctx) {
          console.error("PVisualPanelManager: Failed to get 2D context from canvas in worker message handler.");
          return;
        }
        
        // Ensure canvas bitmap matches received image data dimensions
        if (canvasElement.width !== width && width > 0) canvasElement.width = width;
        if (canvasElement.height !== height && height > 0) canvasElement.height = height;

        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        if (renderedData && width && height) {
          try {
            const clampedArray = new Uint8ClampedArray(renderedData);
            const imageDataObj = new ImageData(clampedArray, width, height);
            ctx.putImageData(imageDataObj, 0, 0);
            // console.log("PVisualPanelManager: Image data put on visual panel canvas.");
          } catch (err) {
            console.error("PVisualPanelManager: Error putting ImageData on visual panel canvas:", err);
          }
        }
      }
      
      if (needsRerender && currentPlanetData) { // Only rerender if there is still data
        // console.log("PVisualPanelManager: Processing queued rerender after worker completion for planet-visual-canvas.");
        _render(); 
      }
    },
    isVisible : () => {
      return panelElement && panelElement.classList.contains('visible');
    },
    getCurrentPlanetData: () => {
      return currentPlanetData;
    },
    rerenderIfNeeded: () => {
      if (panelElement && panelElement.classList.contains('visible') && currentPlanetData && canvasElement) {
        console.log("PVisualPanelManager: rerenderIfNeeded triggered.");
        const displayWidth = canvasElement.offsetWidth;
        const displayHeight = canvasElement.offsetHeight;
        let resized = false;
        if (displayWidth > 0 && canvasElement.width !== displayWidth) {
            canvasElement.width = displayWidth;
            resized = true;
        }
        if (displayHeight > 0 && canvasElement.height !== displayHeight) {
            canvasElement.height = displayHeight;
            resized = true;
        }
        if (resized) {
            console.log(`PVisualPanelManager: Canvas resized in rerenderIfNeeded to ${canvasElement.width}x${canvasElement.height}`);
        }
        _render(); 
      }
    }
  };
})();
