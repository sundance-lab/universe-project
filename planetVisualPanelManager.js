// planetVisualPanelManager.js

const PlanetVisualPanelManager = (() => {
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
    // e.g., window.renderPlanetVisual, window.quat_identity etc.

    function _render() {
        if (!canvasElement) {
            console.warn("PVisualPanelManager: _render called but canvasElement is null.");
            return;
        }
        if (isRendering || !window.planetVisualWorker || !currentPlanetData) {
            if (currentPlanetData) { // Only set needsRerender if there's actually data to render
                console.log("PVisualPanelManager: _render bailed. isRendering:", isRendering, "Worker?", !!window.planetVisualWorker, "Data?", !!currentPlanetData, "Marking needsRerender.");
                needsRerender = true;
            }
            return;
        }
        if (canvasElement.width === 0 || canvasElement.height === 0) {
            console.warn("PVisualPanelManager: Canvas has 0 dimensions. Aborting render. Will try after rAF.");
            needsRerender = true; // Mark and try later
            requestAnimationFrame(() => { // Attempt to resize/re-check dimensions
                if(canvasElement.offsetWidth > 0 && canvasElement.offsetHeight > 0) {
                    if (canvasElement.width !== canvasElement.offsetWidth) canvasElement.width = canvasElement.offsetWidth;
                    if (canvasElement.height !== canvasElement.offsetHeight) canvasElement.height = canvasElement.offsetHeight;
                    if (needsRerender) _render(); // Retry if still needed
                }
            });
            return;
        }

        console.log("PVisualPanelManager: Calling window.renderPlanetVisual for panel canvas.");
        isRendering = true;
        needsRerender = false; // Clear the flag as we are attempting a render
        // Ensure planetVisualWorker is used for this specific panel's canvas
        window.renderPlanetVisual(currentPlanetData, rotationQuat, canvasElement);
    }

    function _onCanvasMouseDown(e) {
        if (e.button !== 0 || !currentPlanetData) return;
        isDraggingPlanet = true;
        startDragMouse.x = e.clientX;
        startDragMouse.y = e.clientY;
        startDragPlanetQuat = [...rotationQuat];
        if (canvasElement) canvasElement.classList.add('dragging');
        e.preventDefault();
    }

    function _onHeaderMouseDown(e) {
        if (e.button !== 0 || !panelElement) return;
        isDraggingPanel = true;
        if (headerElement) headerElement.classList.add('dragging');
        panelElement.style.transition = 'none';
        const rect = panelElement.getBoundingClientRect();
        panelOffset.x = e.clientX - rect.left;
        panelOffset.y = e.clientY - rect.top;
        // Update position directly based on mouse, without relying on transform for dragging
        panelElement.style.left = `${e.clientX - panelOffset.x}px`;
        panelElement.style.top = `${e.clientY - panelOffset.y}px`;
        panelElement.style.transform = 'none'; // Clear transform if it was used for centering
        panelElement.style.right = 'auto'; // Prevent these from interfering with left/top
        panelElement.style.bottom = 'auto';
        e.preventDefault();
    }

    function _onWindowMouseMove(e) {
        if (isDraggingPanel && panelElement) {
            panelElement.style.left = `${e.clientX - panelOffset.x}px`;
            panelElement.style.top = `${e.clientY - panelOffset.y}px`;
        } else if (isDraggingPlanet && currentPlanetData && canvasElement && panelElement.classList.contains('visible')) {
            const rect = canvasElement.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return; // Avoid division by zero
            const canvasWidth = rect.width;
            const canvasHeight = rect.height;
            const deltaX = e.clientX - startDragMouse.x;
            const deltaY = e.clientY - startDragMouse.y;

            const rotationAroundX = (deltaY / canvasHeight) * Math.PI * (window.PLANET_ROTATION_SENSITIVITY || 0.75);
            const rotationAroundY = (deltaX / canvasWidth) * (2 * Math.PI) * (window.PLANET_ROTATION_SENSITIVITY || 0.75);

            const xAxisRotationQuat = window.quat_from_axis_angle([1, 0, 0], -rotationAroundX);
            const yAxisRotationQuat = window.quat_from_axis_angle([0, 1, 0], rotationAroundY);
            const incrementalRotationQuat = window.quat_multiply(yAxisRotationQuat, xAxisRotationQuat);
            rotationQuat = window.quat_normalize(window.quat_multiply(incrementalRotationQuat, startDragPlanetQuat));
            _render(); // Request render
        }
    }

    function _onWindowMouseUp() {
        if (isDraggingPanel && panelElement) {
            isDraggingPanel = false;
            if (headerElement) headerElement.classList.remove('dragging');
            panelElement.style.transition = ''; // Re-enable CSS transitions if any
        }
        if (isDraggingPlanet && canvasElement) {
            isDraggingPlanet = false;
            canvasElement.classList.remove('dragging');
        }
    }

    function _closePanel() {
        if (panelElement) panelElement.classList.remove('visible');
        currentPlanetData = null; // Clear data when panel is closed
        // Potentially cancel any ongoing rendering for this panel if the worker allows targeted cancellation
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
                return; // Abort init if essential elements are missing
            }

            // Initialize quaternions using global math util function
            if (typeof window.quat_identity === 'function') {
                rotationQuat = window.quat_identity();
                startDragPlanetQuat = window.quat_identity();
            } else {
                console.error("PVisualPanelManager: quat_identity function not found on window object!");
                // Fallback to default array if quat_identity is missing, though this indicates a setup issue
                rotationQuat = [1,0,0,0];
                startDragPlanetQuat = [1,0,0,0];
            }


            closeButton.addEventListener('click', _closePanel);
            headerElement.addEventListener('mousedown', _onHeaderMouseDown);
            canvasElement.addEventListener('mousedown', _onCanvasMouseDown);

            // These global listeners are now managed by this module for its specific dragging needs.
            // Ensure they don't conflict if other modules also try to use global mouse listeners without coordination.
            window.addEventListener('mousemove', _onWindowMouseMove);
            window.addEventListener('mouseup', _onWindowMouseUp);
            console.log("PlanetVisualPanelManager: Init completed and listeners attached.");
        },
        show: (planetData) => {
             if (!panelElement || !titleElement || !sizeElement || !canvasElement) {
                 console.error("PVisualPanelManager: Cannot show - DOM elements uninitialized or missing.");
                 return;
             }
            console.log("PVisualPanelManager: Show called for planet:", planetData ? planetData.planetName : "N/A");
            currentPlanetData = planetData;
            titleElement.textContent = planetData.planetName || 'Planet';
            sizeElement.textContent = Math.round(planetData.size);

            const wasVisible = panelElement.classList.contains('visible');
            panelElement.classList.add('visible');

            if (!wasVisible) {
                panelElement.style.left = '50%';
                panelElement.style.top = '50%';
                panelElement.style.transform = 'translate(-50%, -50%)';
                panelElement.style.transition = '';
            } else {
                // If already visible, don't mess with transition if user is dragging it
                panelElement.style.transition = isDraggingPanel ? 'none' : '';
            }

            if (typeof window.quat_identity === 'function') {
                 rotationQuat = window.quat_identity(); // Reset rotation
            } else {
                 rotationQuat = [1,0,0,0]; // Fallback
            }
            _render();
        },
        hide: _closePanel,
        handleWorkerMessage: ({ renderedData, width, height }) => {
            console.log("PVisualPanelManager: handleWorkerMessage received.");
            if (canvasElement && panelElement.classList.contains('visible') && currentPlanetData) {
                const ctx = canvasElement.getContext('2d');
                if (!ctx) {
                    console.error("PVisualPanelManager: Failed to get 2D context from canvas in worker message handler.");
                    isRendering = false; // Reset flag on error
                    return;
                }
                ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
                if (renderedData && width && height) {
                     try {
                        const clampedArray = new Uint8ClampedArray(renderedData);
                        const imageDataObj = new ImageData(clampedArray, width, height);
                        ctx.putImageData(imageDataObj, 0, 0);
                        // canvasElement.style.transform = ""; // Potentially remove if not needed for loading state
                        console.log("PVisualPanelManager: Image data put on visual panel canvas.");
                    } catch (err) {
                        console.error("PVisualPanelManager: Error putting ImageData on visual panel canvas:", err);
                    }
                }
            }
            isRendering = false; // Reset flag after processing
            console.log("PVisualPanelManager: Set isRendering = false.");
            if (needsRerender) { // A render was requested while busy
                console.log("PVisualPanelManager: Processing queued rerender.");
                _render();
            }
        },
        isVisible : () => {
            return panelElement && panelElement.classList.contains('visible');
        },
        getCurrentPlanetData: () => {
            return currentPlanetData;
        },
        // getCurrentRotation: () => {  // Not strictly needed externally for now
        //     return rotationQuat;
        // },
        rerenderIfNeeded: () => { // To be called on events like window resize
            if (panelElement && panelElement.classList.contains('visible') && currentPlanetData && canvasElement) {
                 console.log("PVisualPanelManager: rerenderIfNeeded triggered.");
                 // Optional: resize canvas here if its display size might have changed
                 // e.g., if its CSS is % based and parent resized
                 const displayWidth = canvasElement.offsetWidth;
                 const displayHeight = canvasElement.offsetHeight;
                 if (canvasElement.width !== displayWidth && displayWidth > 0) canvasElement.width = displayWidth;
                 if (canvasElement.height !== displayHeight && displayHeight > 0) canvasElement.height = displayHeight;
                 _render();
            }
        }
    };
})();
