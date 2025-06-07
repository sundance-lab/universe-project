// public/js/planetVisualPanelManager.js
import '../styles.css';
import * as THREE from 'three'; // Import Three.js
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'; // Import OrbitControls

export const PlanetVisualPanelManager = (() => {
  console.log("PVisualPanelManager: Script loaded.");

  // DOM Elements
  let panelElement, headerElement, titleElement, sizeElement,
      planetPreviewCanvasElement,
      closeButton,
      enter360ViewButton,
      planet360CanvasElement; // This is where Three.js will render

  // State
  let currentPlanetData = null;
  // For 2D Preview
  let rotationQuat2D = [1, 0, 0, 0]; // Renamed to avoid confusion
  let startDragPlanetQuat2D = [1, 0, 0, 0];
  let startDragMouse2D = { x: 0, y: 0 };
  let isDraggingPlanet2D = false;
  // For Panel Dragging
  let isDraggingPanel = false;
  let panelOffset = { x: 0, y: 0 };
  // For 2D Preview Rendering
  let isRenderingPreview = false;
  let needsPreviewRerender = false;

  // For 360 View (Three.js)
  let is360ViewActive = false;
  let threeScene, threeCamera, threeRenderer, threePlanetMesh, threeControls, threeAnimationId;

  // --- THREE.JS 360 VIEW SETUP AND RENDERING ---
  function _initThreeJSView(planet) {
    if (!planet360CanvasElement || !planet) return;

    // 1. Scene
    threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color(0x050510); // Dark space background

    // 2. Camera
    const aspectRatio = planet360CanvasElement.offsetWidth / planet360CanvasElement.offsetHeight;
    threeCamera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
    threeCamera.position.z = 2; // Adjust as needed for initial zoom

    // 3. Renderer
    threeRenderer = new THREE.WebGLRenderer({ canvas: planet360CanvasElement, antialias: true });
    threeRenderer.setSize(planet360CanvasElement.offsetWidth, planet360CanvasElement.offsetHeight);
    threeRenderer.setPixelRatio(window.devicePixelRatio);

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Soft white light
    threeScene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 3, 5);
    threeScene.add(directionalLight);

    // 5. Planet Mesh
    const geometry = new THREE.SphereGeometry(0.8, 64, 32); // Radius, widthSegments, heightSegments

    // Initial Material (simple, using planet's landColor)
    // We will improve this to be more dynamic and use more planetData later
    const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(planet.landColor || '#006400'), // Use landColor
        roughness: 0.8,
        metalness: 0.1
    });
    // TODO: Create a more advanced material/shader that uses continentSeed, waterColor, terrain heights etc.
    // For now, if you want to see water, you might layer another slightly larger sphere or use custom shaders.
    // Example: A simple water sphere (could be more sophisticated)
    // const waterGeometry = new THREE.SphereGeometry(0.82, 32, 32); // Slightly larger for "water"
    // const waterMaterial = new THREE.MeshPhongMaterial({
    //   color: new THREE.Color(planet.waterColor || '#0000FF'),
    //   transparent: true,
    //   opacity: 0.6,
    //   shininess: 60
    // });
    // const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
    // threeScene.add(waterMesh);


    threePlanetMesh = new THREE.Mesh(geometry, material);
    threeScene.add(threePlanetMesh);

    // 6. Controls
    threeControls = new OrbitControls(threeCamera, threeRenderer.domElement);
    threeControls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
    threeControls.dampingFactor = 0.05;
    threeControls.screenSpacePanning = false;
    threeControls.minDistance = 1.2; // Zoom in limit
    threeControls.maxDistance = 5;   // Zoom out limit
    threeControls.target.set(0, 0, 0); // Look at the center of the scene

    // Start animation loop
    _animateThreeJSView();
    console.log("PVisualPanelManager: Three.js 360 view initialized.");
  }

  function _updateThreeJSPlanetMaterial(planet) {
    if (threePlanetMesh && planet) {
        // Update existing material properties
        threePlanetMesh.material.color.set(planet.landColor || '#006400');
        // If you add uniforms for shaders, update them here:
        // threePlanetMesh.material.uniforms.uWaterColor.value.set(planet.waterColor);
        // threePlanetMesh.material.uniforms.uContinentSeed.value = planet.continentSeed;
        // ... etc.
        console.log("PVisualPanelManager: Updated Three.js planet material for:", planet.planetName);
    }
  }


  function _animateThreeJSView() {
    if (!is360ViewActive || !threeRenderer) return; // Stop if not active

    threeAnimationId = requestAnimationFrame(_animateThreeJSView);

    // Example: Simple auto-rotation if no user interaction
    // if (threePlanetMesh && !threeControls.active) {
    //   threePlanetMesh.rotation.y += 0.005;
    // }
    if (threeControls) threeControls.update(); // only required if controls.enableDamping or controls.autoRotate are set to true
    if (threeRenderer && threeScene && threeCamera) {
        threeRenderer.render(threeScene, threeCamera);
    }
  }

  function _stopAndCleanupThreeJSView() {
    if (threeAnimationId) {
      cancelAnimationFrame(threeAnimationId);
      threeAnimationId = null;
    }
    if (threeControls) {
      threeControls.dispose(); // Important for removing event listeners
      threeControls = null;
    }
    if (threePlanetMesh) {
      if (threePlanetMesh.geometry) threePlanetMesh.geometry.dispose();
      if (threePlanetMesh.material) {
        if (Array.isArray(threePlanetMesh.material)) {
            threePlanetMesh.material.forEach(m => m.dispose());
        } else {
            threePlanetMesh.material.dispose();
        }
      }
      threeScene.remove(threePlanetMesh); // Remove from scene
      threePlanetMesh = null;
    }
    // Dispose of other scene objects if you added more (e.g., waterMesh light helpers)
    if (threeScene) {
        // Dispose of other lights, etc.
        const objectsToRemove = [];
        threeScene.traverse(object => {
            if (object.isLight) { // Example for lights
                // If lights have disposable things like shadow maps, dispose them
            }
            if (!object.isScene) { // Don't remove the scene itself here
                 objectsToRemove.push(object);
            }
        });
        objectsToRemove.forEach(object => {
            if(object.parent) object.parent.remove(object);
            // Also check for geometry/material disposal if these are unique objects
        });
    }


    if (threeRenderer) {
      threeRenderer.dispose(); // Releases WebGL context and resources
      threeRenderer = null;
    }
    threeScene = null;
    threeCamera = null;

    console.log("PVisualPanelManager: Three.js 360 view cleaned up.");
  }

  // --- PREVIEW RENDERING (2D Canvas) ---
  function _renderPreview() {
    if (isRenderingPreview || !window.planetVisualWorker || !currentPlanetData || !planetPreviewCanvasElement) {
      if (currentPlanetData) needsPreviewRerender = true;
      return;
    }
    // ... (rest of _renderPreview as before, ensure it uses unique senderId for worker)
    isRenderingPreview = true;
    needsPreviewRerender = false;
    window.renderPlanetVisual(currentPlanetData, rotationQuat2D, planetPreviewCanvasElement, 'planet-visual-panel-preview-canvas');
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
    if (planet360CanvasElement) {
        planet360CanvasElement.style.display = 'block';
        // Ensure canvas is sized correctly for Three.js before init
        // This should ideally be handled by CSS, but a JS check helps
        planet360CanvasElement.width = planet360CanvasElement.offsetWidth;
        planet360CanvasElement.height = planet360CanvasElement.offsetHeight;
    }
    if (enter360ViewButton) enter360ViewButton.textContent = "Show 2D Preview";

    _stopAndCleanupThreeJSView(); // Clean up any previous instance first
    _initThreeJSView(currentPlanetData);
  }

  function _switchToPreviewView() {
    is360ViewActive = false;
    _stopAndCleanupThreeJSView(); // Stop and clean up Three.js view
    if (planet360CanvasElement) planet360CanvasElement.style.display = 'none';
    if (planetPreviewCanvasElement) planetPreviewCanvasElement.style.display = 'block';
    if (enter360ViewButton) enter360ViewButton.textContent = "Enter 360° View";
     // Make sure the preview is sized and rendered
    if (planetPreviewCanvasElement && currentPlanetData) {
        requestAnimationFrame(() => { // Defer to ensure DOM is updated
            if (planetPreviewCanvasElement.offsetParent !== null) { // Check if visible
                 planetPreviewCanvasElement.width = planetPreviewCanvasElement.offsetWidth;
                 planetPreviewCanvasElement.height = planetPreviewCanvasElement.offsetHeight;
                 _renderPreview(); // Re-render the preview
            } else {
                needsPreviewRerender = true; // Flag for later render
            }
        });
    }
    console.log("PVisualPanelManager: Switched to 2D preview view.");
  }

  // --- MOUSE EVENT HANDLERS (for 2D preview canvas dragging) ---
  function _onCanvasMouseDown(e) {
    if (e.button !== 0 || !currentPlanetData || is360ViewActive) return; // Only for 2D preview drag
    isDraggingPlanet2D = true;
    startDragMouse2D.x = e.clientX;
    startDragMouse2D.y = e.clientY;
    startDragPlanetQuat2D = [...rotationQuat2D];
    planetPreviewCanvasElement?.classList.add('dragging');
    e.preventDefault();
  }

  function _onHeaderMouseDown(e) {
    // ... (as before)
    if (e.button !== 0 || !panelElement) return;
    isDraggingPanel = true;
    headerElement?.classList.add('dragging');
    panelElement.style.transition = 'none';
    const rect = panelElement.getBoundingClientRect();
    panelOffset.x = e.clientX - rect.left;
    panelOffset.y = e.clientY - rect.top;
    panelElement.style.transform = 'none'; // Clear transform if set by centering
    panelElement.style.left = `${e.clientX - panelOffset.x}px`;
    panelElement.style.top = `${e.clientY - panelOffset.y}px`;
    e.preventDefault();
  }

  function _onWindowMouseMove(e) {
    if (isDraggingPanel && panelElement) {
      panelElement.style.left = `${e.clientX - panelOffset.x}px`;
      panelElement.style.top = `${e.clientY - panelOffset.y}px`;
    } else if (isDraggingPlanet2D && planetPreviewCanvasElement && !is360ViewActive) {
      const rect = planetPreviewCanvasElement.getBoundingClientRect();
      if (rect.width === 0) return;
      const deltaX = e.clientX - startDragMouse2D.x;
      const deltaY = e.clientY - startDragMouse2D.y;
      const sensitivity = window.PLANET_ROTATION_SENSITIVITY || 0.75;

      const rotX = (deltaY / rect.width) * Math.PI * sensitivity;
      const rotY = (deltaX / rect.width) * (2 * Math.PI) * sensitivity;
      const rotQuatX = window.quat_from_axis_angle([1, 0, 0], -rotX);
      const rotQuatY = window.quat_from_axis_angle([0, 1, 0], rotY);
      const incrRotQuat = window.quat_multiply(rotQuatY, rotQuatX);

      rotationQuat2D = window.quat_normalize(window.quat_multiply(incrRotQuat, startDragPlanetQuat2D));
      _renderPreview();
    }
  }

  function _onWindowMouseUp() {
    if (isDraggingPanel) {
      isDraggingPanel = false;
      headerElement?.classList.remove('dragging');
      panelElement?.style.removeProperty('transition');
    }
    if (isDraggingPlanet2D) {
      isDraggingPlanet2D = false;
      planetPreviewCanvasElement?.classList.remove('dragging');
    }
  }

  function _closePanel() {
    _switchToPreviewView(); // Reset to 2D preview view
    // _stopAndCleanupThreeJSView(); // Already called by _switchToPreviewView
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
      planetPreviewCanvasElement = document.getElementById('planet-visual-canvas');
      closeButton = document.getElementById('close-planet-visual-panel');
      planet360CanvasElement = document.getElementById('panel-planet-360-canvas');
      enter360ViewButton = document.getElementById('enter-360-view-button');

      if (typeof window.quat_identity === 'function') {
        rotationQuat2D = window.quat_identity();
      }

      closeButton?.addEventListener('click', _closePanel);
      headerElement?.addEventListener('mousedown', _onHeaderMouseDown);
      planetPreviewCanvasElement?.addEventListener('mousedown', _onCanvasMouseDown);

      enter360ViewButton?.addEventListener('click', () => {
        if (is360ViewActive) {
          _switchToPreviewView();
        } else {
          _switchTo360View();
        }
      });

      // Add resize listener for Three.js camera and renderer if panel is visible and in 360 mode
      window.addEventListener('resize', () => {
          if (is360ViewActive && panelElement?.classList.contains('visible') && threeRenderer && threeCamera && planet360CanvasElement) {
              const canvas = planet360CanvasElement;
              canvas.style.width = '100%'; // Let CSS handle responsive width set in styles.css
              canvas.style.height = 'auto'; // Let CSS handle responsive height (aspect-ratio)

              // Update canvas actual buffer size
              const newWidth = canvas.offsetWidth;
              const newHeight = canvas.offsetHeight;

              threeCamera.aspect = newWidth / newHeight;
              threeCamera.updateProjectionMatrix();
              threeRenderer.setSize(newWidth, newHeight);
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
        _closePanel(); // Call closePanel to ensure proper cleanup if called with invalid data
        return;
      }

      console.log("PVisualPanelManager: Show called for planet:", planetData.planetName || planetData.id);
      currentPlanetData = planetData;
      _switchToPreviewView(); // Always start with the 2D preview view

      if (titleElement) titleElement.textContent = planetData.planetName || 'Planet';
      if (sizeElement) sizeElement.textContent = planetData.size ? `${Math.round(planetData.size)} px (diameter)` : 'N/A';

      if (typeof window.quat_identity === 'function') {
        rotationQuat2D = window.quat_identity(); // Reset rotation for 2D preview
      }

      panelElement.classList.add('visible');

      // Center the panel if it's the first time or if its position was reset
      if (!panelElement.style.left || panelElement.style.left === '0px') { // more robust check
        panelElement.style.left = '50%';
        panelElement.style.top = '50%';
        panelElement.style.transform = 'translate(-50%, -50%)';
      }
      
      // Initial render of preview. Defer sizing to ensure offsetWidth/Height are available
      requestAnimationFrame(() => {
          if (planetPreviewCanvasElement && planetPreviewCanvasElement.offsetParent !== null && !is360ViewActive) {
               planetPreviewCanvasElement.width = planetPreviewCanvasElement.offsetWidth;
               planetPreviewCanvasElement.height = planetPreviewCanvasElement.offsetHeight;
               _renderPreview();
          } else if (!is360ViewActive) {
              needsPreviewRerender = true; // Flag if not yet visible
          }
      });
    },

    hide: _closePanel,

    handleWorkerMessage: ({ renderedData, width, height, error, senderId }) => {
      if (senderId !== 'planet-visual-panel-preview-canvas') {
        if (needsPreviewRerender && !is360ViewActive) _renderPreview();
        return;
      }
      isRenderingPreview = false;

      if (error) {
        console.error("PVisualPanelManager: Worker reported an error for preview canvas:", error);
      } else if (planetPreviewCanvasElement && panelElement?.classList.contains('visible') && currentPlanetData && !is360ViewActive) {
        const ctx = planetPreviewCanvasElement.getContext('2d');
        if (ctx && renderedData) {
          try {
            if(planetPreviewCanvasElement.width !== width) planetPreviewCanvasElement.width = width;
            if(planetPreviewCanvasElement.height !== height) planetPreviewCanvasElement.height = height;
            const clampedArray = new Uint8ClampedArray(renderedData);
            const imageDataObj = new ImageData(clampedArray, width, height);
            ctx.clearRect(0, 0, width, height);
            ctx.putImageData(imageDataObj, 0, 0);
          } catch (err) {
            console.error("PVisualPanelManager: Error putting ImageData on preview canvas:", err);
          }
        }
      }
      if (needsPreviewRerender && !is360ViewActive) _renderPreview();
    },
    isVisible: () => panelElement?.classList.contains('visible'),
    getCurrentPlanetData: () => currentPlanetData,
    rerenderPreviewIfNeeded: _rerenderPreviewIfNeeded,
  };
})();
