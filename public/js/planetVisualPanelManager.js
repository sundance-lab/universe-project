// public/js/planetVisualPanelManager.js
import '../styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// --- Basic Shader Definitions ---
const planetVertexShader = `
  varying vec3 vNormal;
  varying vec2 vUv; // If you plan to use textures later

  void main() {
    vNormal = normal;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const planetFragmentShader = `
  uniform vec3 uDisplayColor; // The color passed from JavaScript
  uniform float uTime; // Example for potential animation later
  varying vec3 vNormal; // For basic lighting effect
  varying vec2 vUv;

  void main() {
    // Simple diffuse lighting approximation
    vec3 lightDirection = normalize(vec3(1.0, 1.0, 1.0)); // Example light direction
    float lightIntensity = max(0.0, dot(normalize(vNormal), lightDirection)) * 0.7 + 0.3; // Ambient + Diffuse

    gl_FragColor = vec4(uDisplayColor * lightIntensity, 1.0);
  }
`;


export const PlanetVisualPanelManager = (() => {
  console.log("PVisualPanelManager: Script loaded.");

  // DOM Elements (as before)
  let panelElement, headerElement, titleElement, sizeElement,
      planetPreviewCanvasElement,
      closeButton,
      enter360ViewButton,
      planet360CanvasElement;

  // State (as before, with 2D vars renamed)
  let currentPlanetData = null;
  let rotationQuat2D = [1, 0, 0, 0];
  let startDragPlanetQuat2D = [1, 0, 0, 0];
  let startDragMouse2D = { x: 0, y: 0 };
  let isDraggingPlanet2D = false;
  let isDraggingPanel = false;
  let panelOffset = { x: 0, y: 0 };
  let isRenderingPreview = false;
  let needsPreviewRerender = false;

  let is360ViewActive = false;
  let threeScene, threeCamera, threeRenderer, threePlanetMesh, threeControls, threeAnimationId;
  let threeShaderMaterial; // To hold our ShaderMaterial

  // --- THREE.JS 360 VIEW SETUP AND RENDERING ---
  function _initThreeJSView(planet) {
    if (!planet360CanvasElement || !planet) return;
    console.log("PVisualPanelManager: Initializing Three.js view for planet:", planet.planetName);

    // 1. Scene
    threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color(0x050510);

    // 2. Camera
    const aspectRatio = planet360CanvasElement.offsetWidth / planet360CanvasElement.offsetHeight;
    threeCamera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
    threeCamera.position.z = 1.8; // Adjusted for potentially unit sphere

    // 3. Renderer
    threeRenderer = new THREE.WebGLRenderer({ canvas: planet360CanvasElement, antialias: true });
    threeRenderer.setSize(planet360CanvasElement.offsetWidth, planet360CanvasElement.offsetHeight);
    threeRenderer.setPixelRatio(window.devicePixelRatio);

    // 4. Lights (kept for the basic lighting in the simple shader)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    threeScene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 3, 5);
    threeScene.add(directionalLight);

    // 5. Planet Geometry
    const geometry = new THREE.SphereGeometry(0.8, 64, 32); // Radius 0.8, good detail

    // 6. Shader Material
    const uniforms = {
      // Use landColor from the currentPlanetData
      uDisplayColor: { value: new THREE.Color(planet.landColor || '#006400') },
      uTime: { value: 0.0 } // Example uniform for time-based effects later
      // TODO: Add more uniforms for waterColor, continentSeed, terrainParams etc.
      // uWaterColor: { value: new THREE.Color(planet.waterColor || '#0000FF') },
      // uOceanHeight: { value: planet.oceanHeightLevel || 2.0 },
      // uContinentSeed: { value: planet.continentSeed || Math.random() },
      // uMinTerrainHeight: { value: planet.minTerrainHeight || 0.0 },
      // uMaxTerrainHeight: { value: planet.maxTerrainHeight || 10.0 },
    };

    threeShaderMaterial = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: planetVertexShader,
      fragmentShader: planetFragmentShader,
      // wireframe: true, // Useful for debugging geometry
    });

    threePlanetMesh = new THREE.Mesh(geometry, threeShaderMaterial);
    threeScene.add(threePlanetMesh);

    // 7. Controls
    threeControls = new OrbitControls(threeCamera, threeRenderer.domElement);
    threeControls.enableDamping = true;
    threeControls.dampingFactor = 0.05;
    threeControls.screenSpacePanning = false;
    threeControls.minDistance = 1.1;
    threeControls.maxDistance = 5;
    threeControls.target.set(0, 0, 0);

    _animateThreeJSView();
    console.log("PVisualPanelManager: Three.js 360 view initialized with ShaderMaterial.");
  }

  function _updateThreeJSPlanetAppearance(planet) {
    if (threeShaderMaterial && threeShaderMaterial.uniforms.uDisplayColor && planet) {
        threeShaderMaterial.uniforms.uDisplayColor.value.set(planet.landColor || '#006400');
        // When you add more uniforms, update them here:
        // threeShaderMaterial.uniforms.uWaterColor.value.set(planet.waterColor || '#0000FF');
        // threeShaderMaterial.uniforms.uContinentSeed.value = planet.continentSeed || Math.random();
        console.log("PVisualPanelManager: Updated Three.js planet shader uniforms for:", planet.planetName);
    } else if (threePlanetMesh && threePlanetMesh.material.isMeshStandardMaterial && planet) { // Fallback if still using standard material
        threePlanetMesh.material.color.set(planet.landColor || '#006400');
    }
  }


  function _animateThreeJSView() {
    if (!is360ViewActive || !threeRenderer) return;
    threeAnimationId = requestAnimationFrame(_animateThreeJSView);

    if (threeShaderMaterial && threeShaderMaterial.uniforms.uTime) {
      threeShaderMaterial.uniforms.uTime.value += 0.01; // Increment time for shaders
    }

    threeControls.update();
    threeRenderer.render(threeScene, threeCamera);
  }

  function _stopAndCleanupThreeJSView() {
    if (threeAnimationId) {
      cancelAnimationFrame(threeAnimationId);
      threeAnimationId = null;
    }
    if (threeControls) {
      threeControls.dispose();
      threeControls = null;
    }
    if (threePlanetMesh) {
      if (threePlanetMesh.geometry) threePlanetMesh.geometry.dispose();
      // ShaderMaterial is disposed automatically by the renderer when it's no longer used by any mesh in the scene
      // However, if you created textures for your shader material, you'd dispose of them here:
      // if (threeShaderMaterial.uniforms.myTexture && threeShaderMaterial.uniforms.myTexture.value) {
      //   threeShaderMaterial.uniforms.myTexture.value.dispose();
      // }
      if(threeShaderMaterial) threeShaderMaterial.dispose(); // Explicitly dispose ShaderMaterial

      if (threeScene) threeScene.remove(threePlanetMesh); // Remove from scene before nullifying
      threePlanetMesh = null;
      threeShaderMaterial = null;
    }

    if (threeScene) {
        // Remove lights (or any other persistent objects)
        const toRemove = [];
        threeScene.traverse(child => {
            if (child.isLight) {
                toRemove.push(child);
            }
            // if (child.isMesh) { // Already handling threePlanetMesh
            //     if(child.geometry) child.geometry.dispose();
            //     if(child.material) child.material.dispose();
            //     toRemove.push(child);
            // }
        });
        toRemove.forEach(obj => threeScene.remove(obj));
    }


    if (threeRenderer) {
      threeRenderer.dispose();
      threeRenderer = null;
    }
    threeScene = null; // Nullify scene after disposing renderer and removing objects
    threeCamera = null;

    console.log("PVisualPanelManager: Three.js 360 view cleaned up.");
  }

  // --- PREVIEW RENDERING (2D Canvas) --- (as before)
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
        needsPreviewRerender = true; //Prevent worker call on 0-size canvas
        return;
    }
    isRenderingPreview = true;
    needsPreviewRerender = false;
    window.renderPlanetVisual(currentPlanetData, rotationQuat2D, planetPreviewCanvasElement, 'planet-visual-panel-preview-canvas');
  }

  //_rerenderPreviewIfNeeded, _onCanvasMouseDown, _onHeaderMouseDown, _onWindowMouseMove, _onWindowMouseUp, _closePanel (as before)
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
        // It's good practice to ensure the canvas has its display style set to 'block'
        // *before* trying to get offsetWidth/offsetHeight for Three.js initialization.
        // And ensure parent is visible.
        if(planet360CanvasElement.offsetParent !== null){
            planet360CanvasElement.width = planet360CanvasElement.offsetWidth;
            planet360CanvasElement.height = planet360CanvasElement.offsetHeight;
        } else {
            // If canvas is not in DOM/visible, Three.js might init with 0x0 or default.
            // This scenario should be handled (e.g. by CSS ensuring visibility, or deferring init)
            console.warn("PVisualPanelManager: 360 canvas not fully visible during switch, may affect Three.js size.");
        }
    }
    if (enter360ViewButton) enter360ViewButton.textContent = "Show 2D Preview";

    _stopAndCleanupThreeJSView();
    _initThreeJSView(currentPlanetData);
  }

  function _switchToPreviewView() {
    is360ViewActive = false;
    _stopAndCleanupThreeJSView();
    if (planet360CanvasElement) planet360CanvasElement.style.display = 'none';
    if (planetPreviewCanvasElement) planetPreviewCanvasElement.style.display = 'block';
    if (enter360ViewButton) enter360ViewButton.textContent = "Enter 360° View";

    if (planetPreviewCanvasElement && currentPlanetData) {
        requestAnimationFrame(() => {
            if (planetPreviewCanvasElement.offsetParent !== null) {
                 // Ensure preview canvas is also correctly sized
                 if (planetPreviewCanvasElement.width !== planetPreviewCanvasElement.offsetWidth || planetPreviewCanvasElement.height !== planetPreviewCanvasElement.offsetHeight) {
                    planetPreviewCanvasElement.width = planetPreviewCanvasElement.offsetWidth;
                    planetPreviewCanvasElement.height = planetPreviewCanvasElement.offsetHeight;
                 }
                 if(planetPreviewCanvasElement.width > 0 && planetPreviewCanvasElement.height > 0){
                    _renderPreview();
                 } else {
                    needsPreviewRerender = true;
                 }
            } else {
                needsPreviewRerender = true;
            }
        });
    }
    console.log("PVisualPanelManager: Switched to 2D preview view.");
  }


  // --- MOUSE EVENT HANDLERS ---
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
    _switchToPreviewView();
    panelElement?.classList.remove('visible');
    currentPlanetData = null;
    isRenderingPreview = false;
    needsPreviewRerender = false;
  }

  // PUBLIC API (as before)
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

      window.addEventListener('resize', () => {
          if (is360ViewActive && panelElement?.classList.contains('visible') && threeRenderer && threeCamera && planet360CanvasElement) {
              const canvas = planet360CanvasElement;
              // Let CSS drive responsive dimensions based on aspect-ratio
              // Re-calculate actual pixel dimensions
              const newWidth = canvas.offsetWidth;
              const newHeight = canvas.offsetHeight;

              if (newWidth > 0 && newHeight > 0) {
                threeCamera.aspect = newWidth / newHeight;
                threeCamera.updateProjectionMatrix();
                threeRenderer.setSize(newWidth, newHeight);
              }
          } else if (!is360ViewActive && panelElement?.classList.contains('visible') && planetPreviewCanvasElement && planetPreviewCanvasElement.offsetParent !== null) {
              // Optionally, resize and rerender 2D preview canvas on window resize
              planetPreviewCanvasElement.width = planetPreviewCanvasElement.offsetWidth;
              planetPreviewCanvasElement.height = planetPreviewCanvasElement.offsetHeight;
              if(planetPreviewCanvasElement.width > 0 && planetPreviewCanvasElement.height > 0) {
                 _renderPreview();
              } else {
                 needsPreviewRerender = true;
              }
          }
      });

      window.addEventListener('mousemove', _onWindowMouseMove);
      window.addEventListener('mouseup', _onWindowMouseUp);

      setInterval(() => {
        if (needsPreviewRerender && !is360ViewActive && planetPreviewCanvasElement && planetPreviewCanvasElement.offsetParent !== null) {
            if(planetPreviewCanvasElement.width > 0 && planetPreviewCanvasElement.height > 0) {
                 _renderPreview();
            }
        }
      }, 250);
    },

    show: (planetData) => {
      if (!panelElement || !planetData) {
        _closePanel();
        return;
      }

      console.log("PVisualPanelManager: Show called for planet:", planetData.planetName || planetData.id);
      currentPlanetData = planetData;
      _switchToPreviewView(); // Always start with the 2D preview view

      if (titleElement) titleElement.textContent = planetData.planetName || 'Planet';
      if (sizeElement) sizeElement.textContent = planetData.size ? `${Math.round(planetData.size)} px (diameter)` : 'N/A';

      if (typeof window.quat_identity === 'function') {
        rotationQuat2D = window.quat_identity();
      }

      panelElement.classList.add('visible');

      if (!panelElement.style.left || panelElement.style.left === '0px') {
        panelElement.style.left = '50%';
        panelElement.style.top = '50%';
        panelElement.style.transform = 'translate(-50%, -50%)';
      }
      
      requestAnimationFrame(() => {
          if (planetPreviewCanvasElement && planetPreviewCanvasElement.offsetParent !== null && !is360ViewActive) {
               const currentWidth = planetPreviewCanvasElement.offsetWidth;
               const currentHeight = planetPreviewCanvasElement.offsetHeight;
               if(planetPreviewCanvasElement.width !== currentWidth) planetPreviewCanvasElement.width = currentWidth;
               if(planetPreviewCanvasElement.height !== currentHeight) planetPreviewCanvasElement.height = currentHeight;
               if(currentWidth > 0 && currentHeight > 0){
                   _renderPreview();
               } else {
                  needsPreviewRerender = true;
               }
          } else if (!is360ViewActive) {
              needsPreviewRerender = true;
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
      if (needsPreviewRerender && !is360ViewActive && planetPreviewCanvasElement.offsetParent !== null) _renderPreview();
    },
    isVisible: () => panelElement?.classList.contains('visible'),
    getCurrentPlanetData: () => currentPlanetData,
    rerenderPreviewIfNeeded: _rerenderPreviewIfNeeded,
  };
})();
