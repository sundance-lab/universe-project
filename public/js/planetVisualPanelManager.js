// public/js/planetVisualPanelManager.js
import '../styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// --- Shader Definitions ---
// Vertex Shader: Will displace vertices based on a simple noise-like function
const planetVertexShader = `
  uniform float uTime;
  uniform float uMinTerrainHeight;
  uniform float uMaxTerrainHeight;
  uniform float uContinentSeed; // We'll use this to vary the "noise"

  varying vec3 vNormal;
  varying float vElevation; // Pass elevation (0 to 1) to fragment shader
  varying vec3 vWorldPosition;


  // Placeholder for a proper 3D noise function (e.g., Simplex or Perlin)
  // This is a VERY simple periodic function to simulate some bumps based on position and seed
  // REPLACE THIS with a real noise function for good results!
  float simpleNoise(vec3 pos, float seed) {
    // Use sine waves to create some patterning. Seed offsets it.
    float SinX = sin(pos.x * 2.0 + seed * 5.0);
    float SinY = sin(pos.y * 2.0 + seed * 6.0);
    float SinZ = sin(pos.z * 2.0 + seed * 7.0);
    return (SinX + SinY + SinZ) / 3.0; // Average, range -1 to 1
  }
  
  // A slightly more complex periodic pattern to create some variation
  float pseudoRandom(vec2 co){
      return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
  }

  float anotherSimpleNoise(vec3 pos, float seed) {
    // Combine multiple simple patterns
    float noise = 0.0;
    float frequency = 1.5;
    float amplitude = 0.5;
    for (int i = 0; i < 3; i++) { // 3 octaves
        noise += simpleNoise(pos * frequency + seed * float(i+1) * 0.5, seed) * amplitude;
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    // Add some small, sharp details based on pseudoRandom
    noise += (pseudoRandom(pos.xy + seed) - 0.5) * 0.1; 
    noise += (pseudoRandom(pos.yz + seed * 1.1) - 0.5) * 0.1;
    noise += (pseudoRandom(pos.xz + seed * 1.2) - 0.5) * 0.1;

    return clamp(noise, -1.0, 1.0); // Clamp to ensure it's within -1 to 1
}


  void main() {
    vNormal = normal;
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz; // For lighting in world space

    // Use the vertex position (normalized) as input for noise
    // Normalizing 'position' makes it independent of sphere radius for noise input
    // vec3 noisyPositionInput = normalize(position); // For noise based on direction from center
    vec3 noisyPositionInput = position * (1.0 + uContinentSeed*0.1); // Scale input by seed slightly to get different base patterns

    // Get a noise value (range -1 to 1 from our simpleNoise, usually 0 to 1 from Perlin)
    float noise = anotherSimpleNoise(noisyPositionInput * 2.0, uContinentSeed); // Scale input to noise for frequency

    // Normalize noise to 0-1 range if it's -1 to 1
    float normalizedNoise = (noise + 1.0) / 2.0; // Converts -1..1 to 0..1

    // Calculate elevation based on min/max terrain height
    // Here, we treat minTerrainHeight as 0 and maxTerrainHeight as the max displacement
    // A more direct interpretation:
    // float baseRadius = 1.0; // Assuming sphere base radius is 1 for displacement calc
    // float actualDisplacement = uMinTerrainHeight + normalizedNoise * (uMaxTerrainHeight - uMinTerrainHeight);
    // For a sphere of radius R, you'd scale normal by (R + actualDisplacement)
    // For simplicity here, let's say noise directly controls displacement from a base radius of 0.8
    
    float displacementRange = uMaxTerrainHeight - uMinTerrainHeight;
    float displacement = uMinTerrainHeight + normalizedNoise * displacementRange;
    
    // Make displacement a small factor for visual effect (e.g. 10% of radius)
    // This needs careful tuning with your min/max height values.
    // If uMin/MaxTerrainHeight are like 0.0 to 0.2, this could be direct 'displacement'
    // If they are 0-10, you need to scale it down massively
    float scaledDisplacement = displacement * 0.05; // Example: scale 'world unit' height to model displacement

    vec3 displacedPosition = position + normal * scaledDisplacement;
    
    vElevation = normalizedNoise; // Pass normalized noise (0-1) as elevation

    gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
  }
`;

const planetFragmentShader = `
  uniform vec3 uLandColor;
  uniform vec3 uWaterColor;
  uniform float uOceanHeightLevel; // Expected to be in the same scale/range as vElevation (e.g. 0-1)

  varying vec3 vNormal;
  varying float vElevation; // Normalized elevation (0 to 1) from vertex shader
  varying vec3 vWorldPosition;


  void main() {
    vec3 color;
    // uOceanHeightLevel needs to be scaled to the 0-1 range of vElevation
    // If your 'oceanHeightLevel' from planetData is, say, 2.0, and min/max terrain is 0-10,
    // then normalizedOceanHeight would be (2.0 - 0.0) / (10.0 - 0.0) = 0.2
    // For now, assume uOceanHeightLevel is already a 0-1 value for comparison with vElevation
    
    float normalizedOceanLevel = uOceanHeightLevel; // Assuming uOceanHeightLevel is already 0-1

    if (vElevation < normalizedOceanLevel) {
      color = uWaterColor;
    } else {
      // Simple gradient for land based on elevation
      float landElevationFactor = smoothstep(normalizedOceanLevel, 1.0, vElevation);
      color = mix(uLandColor, uLandColor * 0.6, landElevationFactor * 0.5); // Darken higher elevations a bit
      // Add some highlight for "peaks"
      if (vElevation > 0.9) {
        color = mix(color, vec3(1.0), smoothstep(0.9, 1.0, vElevation) * 0.5); // Mix with white for peaks
      }
    }

    // Basic directional lighting (world space)
    vec3 lightDir = normalize(vec3(5.0, 3.0, 5.0) - vWorldPosition); // Light position - fragment position
    float diffuse = max(dot(normalize(vNormal), lightDir), 0.0);
    vec3 ambient = vec3(0.2); // Ambient color

    gl_FragColor = vec4((ambient + diffuse) * color, 1.0);
  }
`;


export const PlanetVisualPanelManager = (() => {
  // ... (DOM Elements, most state variables as before) ...
  let currentPlanetData = null;
  let rotationQuat2D = [1, 0, 0, 0];
  // ... (other 2D preview state) ...
  let is360ViewActive = false;
  let threeScene, threeCamera, threeRenderer, threePlanetMesh, threeControls, threeAnimationId;
  let threeShaderMaterial; // Store the ShaderMaterial instance

  // --- THREE.JS 360 VIEW SETUP AND RENDERING ---
  function _initThreeJSView(planet) {
    if (!planet360CanvasElement || !planet) return;
    console.log("PVisualPanelManager: Initializing Three.js view for shader planet:", planet.planetName);

    // 1. Scene, Camera, Renderer, Lights (as before)
    threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color(0x050510);
    const aspectRatio = planet360CanvasElement.offsetWidth / planet360CanvasElement.offsetHeight;
    threeCamera = new THREE.PerspectiveCamera(70, aspectRatio, 0.1, 1000); // fov 70
    threeCamera.position.z = 2.0; // Adjusted slightly for sphere size

    threeRenderer = new THREE.WebGLRenderer({ canvas: planet360CanvasElement, antialias: true });
    threeRenderer.setSize(planet360CanvasElement.offsetWidth, planet360CanvasElement.offsetHeight);
    threeRenderer.setPixelRatio(window.devicePixelRatio);

    // const ambientLight = new THREE.AmbientLight(0xffffff, 0.3); // Now handled in shader
    // threeScene.add(ambientLight);
    // const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // Now handled in shader
    // directionalLight.position.set(5, 3, 5);
    // threeScene.add(directionalLight);

    // 2. Planet Geometry
    const geometry = new THREE.SphereGeometry(0.8, 64, 48); // Slightly more segments

    // 3. Shader Material
    // Normalize oceanHeightLevel based on the planet's min/max terrain range
    // This assumes planet.minTerrainHeight and planet.maxTerrainHeight define the full range of possible elevations
    // and planet.oceanHeightLevel is some value within that range.
    // The vElevation in shader will be 0-1 representing noise strength.
    // We need to map oceanHeightLevel to this 0-1 range.
    let normalizedOceanLevel = 0.3; // Default if values are missing
    const pMin = planet.minTerrainHeight ?? 0.0;
    const pMax = planet.maxTerrainHeight ?? 10.0;
    const pOcean = planet.oceanHeightLevel ?? 2.0;
    if (pMax > pMin) { // Avoid division by zero
      normalizedOceanLevel = (pOcean - pMin) / (pMax - pMin);
    }
    normalizedOceanLevel = Math.max(0.0, Math.min(1.0, normalizedOceanLevel)); // Clamp to 0-1


    const uniforms = {
      uLandColor: { value: new THREE.Color(planet.landColor || '#006400') },
      uWaterColor: { value: new THREE.Color(planet.waterColor || '#0000FF') },
      uOceanHeightLevel: { value: normalizedOceanLevel }, // Use normalized value
      uMinTerrainHeight: { value: planet.minTerrainHeight ?? 0.0 },     // Raw values for reference or complex calcs
      uMaxTerrainHeight: { value: planet.maxTerrainHeight ?? 10.0 },   // Raw values
      uContinentSeed: { value: planet.continentSeed ?? Math.random() },
      uTime: { value: 0.0 }
    };

    threeShaderMaterial = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: planetVertexShader,
      fragmentShader: planetFragmentShader,
      // lights: true, // If you need Three.js built-in lighting to interact with ShaderMaterial
      // For custom lighting in shader, 'lights: true' is less relevant unless using light uniforms
      // wireframe: true, // For debugging
    });

    threePlanetMesh = new THREE.Mesh(geometry, threeShaderMaterial);
    threeScene.add(threePlanetMesh);

    // 4. Controls (as before)
    threeControls = new OrbitControls(threeCamera, threeRenderer.domElement);
    threeControls.enableDamping = true;
    threeControls.dampingFactor = 0.05;
    threeControls.screenSpacePanning = false;
    threeControls.minDistance = 1.0; // Zoom closer
    threeControls.maxDistance = 4.0;
    threeControls.target.set(0, 0, 0);

    _animateThreeJSView();
    console.log("PVisualPanelManager: Three.js 360 view initialized with procedural shader uniforms.");
  }

  function _updateThreeJSPlanetAppearance(planet) {
    if (threeShaderMaterial && planet) {
      threeShaderMaterial.uniforms.uLandColor.value.set(planet.landColor || '#006400');
      threeShaderMaterial.uniforms.uWaterColor.value.set(planet.waterColor || '#0000FF');
      
      let normalizedOceanLevel = 0.3;
      const pMin = planet.minTerrainHeight ?? 0.0;
      const pMax = planet.maxTerrainHeight ?? 10.0;
      const pOcean = planet.oceanHeightLevel ?? 2.0;
      if (pMax > pMin) {
         normalizedOceanLevel = (pOcean - pMin) / (pMax - pMin);
      }
      normalizedOceanLevel = Math.max(0.0, Math.min(1.0, normalizedOceanLevel));

      threeShaderMaterial.uniforms.uOceanHeightLevel.value = normalizedOceanLevel;
      threeShaderMaterial.uniforms.uMinTerrainHeight.value = planet.minTerrainHeight ?? 0.0;
      threeShaderMaterial.uniforms.uMaxTerrainHeight.value = planet.maxTerrainHeight ?? 10.0;
      threeShaderMaterial.uniforms.uContinentSeed.value = planet.continentSeed ?? Math.random();
      console.log("PVisualPanelManager: Updated Three.js planet shader uniforms for:", planet.planetName);
    }
  }

  function _animateThreeJSView() {
    // ... (as before, uTime is updated) ...
    if (!is360ViewActive || !threeRenderer) return;
    threeAnimationId = requestAnimationFrame(_animateThreeJSView);

    if (threeShaderMaterial && threeShaderMaterial.uniforms.uTime) {
      threeShaderMaterial.uniforms.uTime.value += 0.01;
    }

    threeControls.update();
    threeRenderer.render(threeScene, threeCamera);
  }

  function _stopAndCleanupThreeJSView() {
    // ... (as before, ensure proper disposal of threeShaderMaterial and its potential textures if any) ...
    if (threeAnimationId) {
      cancelAnimationFrame(threeAnimationId);
      threeAnimationId = null;
    }
    if (threeControls) {
      threeControls.dispose();
      threeControls = null;
    }
    if (threePlanetMesh) {
      if(threePlanetMesh.geometry) threePlanetMesh.geometry.dispose();
      if(threeShaderMaterial) {
        // If shader material had textures, dispose them here:
        // Object.values(threeShaderMaterial.uniforms).forEach(uniform => {
        //   if (uniform.value instanceof THREE.Texture) {
        //     uniform.value.dispose();
        //   }
        // });
        threeShaderMaterial.dispose();
      }
      if(threeScene) threeScene.remove(threePlanetMesh);
      threePlanetMesh = null;
      threeShaderMaterial = null;
    }
     if (threeScene) { // Remove any other objects like lights if added explicitly
        const toRemove = [];
        threeScene.traverse(child => {
            if (child !== threeScene && child !== threeCamera ) { // Don't remove scene or camera itself
                 // if (child.isLight) toRemove.push(child); // If you add/remove lights dynamically
            }
        });
        toRemove.forEach(obj => threeScene.remove(obj));
    }
    if (threeRenderer) {
      threeRenderer.dispose();
      threeRenderer = null;
    }
    threeScene = null;
    threeCamera = null;
    console.log("PVisualPanelManager: Three.js 360 view cleaned up.");
  }

  // --- VIEW SWITCHING LOGIC ---
  function _switchTo360View() { // Calls _updateThreeJSPlanetAppearance after init
    if (!currentPlanetData) return;
    is360ViewActive = true;
    if (planetPreviewCanvasElement) planetPreviewCanvasElement.style.display = 'none';
    if (planet360CanvasElement) {
        planet360CanvasElement.style.display = 'block';
        if(planet360CanvasElement.offsetParent !== null){ // Ensure it's in DOM and visible for sizing
            planet360CanvasElement.width = planet360CanvasElement.offsetWidth;
            planet360CanvasElement.height = planet360CanvasElement.offsetHeight;
             _stopAndCleanupThreeJSView(); // Clean first
            _initThreeJSView(currentPlanetData); // Init with current planet data
        } else {
            console.warn("PVisualPanelManager: 360 canvas not visible for sizing on switch. Deferring Three.js init.");
            // Potentially set a flag to initialize when it becomes visible or use fixed dimensions.
            // For now, it might init with previous or default canvas buffer sizes.
        }
    }
    if (enter360ViewButton) enter360ViewButton.textContent = "Show 2D Preview";
  }
  
  // --- PUBLIC API --- (init, show, hide, handleWorkerMessage, etc., remain mostly the same structurally)
  // ... (Make sure _initThreeJSView and _updateThreeJSPlanetAppearance are called appropriately in show/switch) ...
  
  // ... (rest of the PlanetVisualPanelManager as it was, ensuring _initThreeJSView
  //      and _updateThreeJSPlanetAppearance are used. _switchTo360View now handles this)
  // Note: The _renderPreview, _onCanvasMouseDown (for 2D), and other 2D preview specific logic
  // remains unchanged unless you decide to unify more.

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

      window.addEventListener('resize', () => {
          if (is360ViewActive && panelElement?.classList.contains('visible') && threeRenderer && threeCamera && planet360CanvasElement) {
              const canvas = planet360CanvasElement;
              const newWidth = canvas.offsetWidth;
              const newHeight = canvas.offsetHeight;

              if (newWidth > 0 && newHeight > 0) {
                threeCamera.aspect = newWidth / newHeight;
                threeCamera.updateProjectionMatrix();
                threeRenderer.setSize(newWidth, newHeight);
              }
          } else if (!is360ViewActive && panelElement?.classList.contains('visible') && planetPreviewCanvasElement?.offsetParent !== null) {
              const prevCanvas = planetPreviewCanvasElement;
              const newWidth = prevCanvas.offsetWidth;
              const newHeight = prevCanvas.offsetHeight;
              if(prevCanvas.width !== newWidth)  prevCanvas.width = newWidth;
              if(prevCanvas.height !== newHeight) prevCanvas.height = newHeight;

              if(newWidth > 0 && newHeight > 0) {
                 _renderPreview();
              } else {
                 needsPreviewRerender = true;
              }
          }
      });

      window.addEventListener('mousemove', _onWindowMouseMove);
      window.addEventListener('mouseup', _onWindowMouseUp);

      setInterval(() => {
        if (needsPreviewRerender && !is360ViewActive && planetPreviewCanvasElement?.offsetParent !== null) {
            const canvas = planetPreviewCanvasElement;
            // Ensure canvas is sized correctly before rendering preview
            if (canvas.width !== canvas.offsetWidth || canvas.height !== canvas.offsetHeight) {
                canvas.width = canvas.offsetWidth;
                canvas.height = canvas.offsetHeight;
            }
            if(canvas.width > 0 && canvas.height > 0) {
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
      const isDifferentPlanet = !currentPlanetData || currentPlanetData.id !== planetData.id;
      currentPlanetData = planetData;
      
      if (isDifferentPlanet || !panelElement.classList.contains('visible')) {
          _switchToPreviewView(); // Reset to preview for new planet or if panel was hidden
      } else if (is360ViewActive) {
          // If already in 360 view and it's the same planet (e.g. data updated), update it
          // If it's a different planet, _switchToPreviewView will be called, then user can switch to 360
          _updateThreeJSPlanetAppearance(currentPlanetData);
      } else {
          // Already in preview view, update it
           if (planetPreviewCanvasElement && planetPreviewCanvasElement.offsetParent !== null) {
               _renderPreview(); // Trigger a rerender for the preview
           } else {
               needsPreviewRerender = true;
           }
      }


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
      
      // Initial render for preview is handled by _switchToPreviewView
      // or the logic block above if panel was already open.
    },

    hide: _closePanel,

    handleWorkerMessage: ({ renderedData, width, height, error, senderId }) => {
      if (senderId !== 'planet-visual-panel-preview-canvas') {
        if (needsPreviewRerender && !is360ViewActive && planetPreviewCanvasElement?.offsetParent !== null ) _renderPreview();
        return;
      }
      isRenderingPreview = false; // This specific worker request is done.

      if (error) {
        console.error("PVisualPanelManager: Worker reported an error for preview canvas:", error);
      } else if (planetPreviewCanvasElement && panelElement?.classList.contains('visible') && currentPlanetData && !is360ViewActive) {
        const ctx = planetPreviewCanvasElement.getContext('2d');
        if (ctx && renderedData) {
          try {
            // Ensure canvas has dimensions before drawing
            if (planetPreviewCanvasElement.width === 0 || planetPreviewCanvasElement.height === 0) {
                 planetPreviewCanvasElement.width = width > 0 ? width : 300; // Fallback
                 planetPreviewCanvasElement.height = height > 0 ? height : 300; // Fallback
            } else {
                 if(planetPreviewCanvasElement.width !== width) planetPreviewCanvasElement.width = width;
                 if(planetPreviewCanvasElement.height !== height) planetPreviewCanvasElement.height = height;
            }

            const clampedArray = new Uint8ClampedArray(renderedData);
            const imageDataObj = new ImageData(clampedArray, width, height);
            ctx.putImageData(imageDataObj, 0, 0);
          } catch (err) {
            console.error("PVisualPanelManager: Error putting ImageData on preview canvas:", err);
          }
        }
      }
      // If another preview render was requested while this was processing
      if (needsPreviewRerender && !is360ViewActive && planetPreviewCanvasElement?.offsetParent !== null) _renderPreview();
    },
    isVisible: () => panelElement?.classList.contains('visible'),
    getCurrentPlanetData: () => currentPlanetData,
    rerenderPreviewIfNeeded: _rerenderPreviewIfNeeded,
  };
})();
