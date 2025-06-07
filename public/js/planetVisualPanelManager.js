// public/js/planetVisualPanelManager.js
import '../styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// --- SHADER DEFINITIONS ---

const glslRandom2to1 = `
float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}
`;

const glslSimpleValueNoise3D = `
$

float valueNoise(vec3 p, float seed) {
  vec3 i = floor(p + seed * 0.123);
  vec3 f = fract(p + seed * 0.123);
  f = f * f * (3.0 - 2.0 * f);

  float c000 = random(i.xy + i.z * 0.37);
  float c100 = random(i.xy + vec2(1.0, 0.0) + i.z * 0.37);
  float c010 = random(i.xy + vec2(0.0, 1.0) + i.z * 0.37);
  float c110 = random(i.xy + vec2(1.0, 1.0) + i.z * 0.37);
  float c001 = random(i.xy + (i.z + 1.0) * 0.37);
  float c101 = random(i.xy + vec2(1.0, 0.0) + (i.z + 1.0) * 0.37);
  float c011 = random(i.xy + vec2(0.0, 1.0) + (i.z + 1.0) * 0.37);
  float c111 = random(i.xy + vec2(1.0, 1.0) + (i.z + 1.0) * 0.37);

  float u00 = mix(c000, c100, f.x);
  float u01 = mix(c001, c101, f.x);
  float u10 = mix(c010, c110, f.x);
  float u11 = mix(c011, c111, f.x);
  float v0 = mix(u00, u10, f.y);
  float v1 = mix(u01, u11, f.y);
  return mix(v0, v1, f.z);
}
`;

const planetVertexShader = `
uniform float uTime;
uniform float uContinentSeed;
uniform float uSphereRadius;
uniform float uDisplacementAmount;
uniform float uContinentSharpness;

varying vec3 vNormal;
varying float vElevation;
varying vec3 vWorldPosition;
varying float vRiverValue;

$

float layeredNoise(vec3 p, float seed, int octaves, float persistence, float lacunarity, float scale) {
  float total = 0.0;
  float frequency = scale;
  float amplitude = 1.0;
  float maxValue = 0.0;

  for (int i = 0; i < octaves; i++) {
   total += valueNoise(p * frequency + seed * float(i) * 1.712, seed * 12.345 * float(i+1) * 0.931) * amplitude;
   maxValue += amplitude;
   amplitude *= persistence;
   frequency *= lacunarity;
  }
  if (maxValue == 0.0) return 0.0;
  return total / maxValue;
}

float warpedRiverNoise(vec3 p, float seed) {
    vec3 warp_octave1 = vec3(
        valueNoise(p * 2.0, seed * 1.7),
        valueNoise(p * 2.0 + 5.2, seed * 2.1),
        valueNoise(p * 2.0 - 3.1, seed * 3.3)
    ) * 2.0 - 1.0;

    vec3 warp_octave2 = vec3(
        valueNoise(p * 8.0 + warp_octave1 * 0.3, seed * 4.9),
        valueNoise(p * 8.0 + warp_octave1 * 0.3 + 1.2, seed * 5.3),
        valueNoise(p * 8.0 + warp_octave1 * 0.3 - 4.1, seed * 6.7)
    ) * 2.0 - 1.0;

    return layeredNoise(p + warp_octave2 * 0.1, seed, 4, 0.5, 2.0, 32.0);
}

void main() {
    vec3 p = position;
    vec3 noiseInputPosition = (p / uSphereRadius) + (uContinentSeed * 10.0);

    float continentNoise = (layeredNoise(noiseInputPosition, uContinentSeed, 5, 0.5, 2.0, 1.5) + 1.0) * 0.5;
    continentNoise = pow(continentNoise, uContinentSharpness);
    
    float riverRaw = warpedRiverNoise(noiseInputPosition * 0.5, uContinentSeed * 5.0);
    float riverBed = smoothstep(0.4, 0.5, riverRaw) * (1.0 - smoothstep(0.5, 0.6, riverRaw));
    float riverMask = smoothstep(0.5, 0.52, continentNoise) * (1.0 - smoothstep(0.75, 0.8, continentNoise));
    vRiverValue = riverBed * riverMask;

    float mountainNoise = (layeredNoise(noiseInputPosition, uContinentSeed * 2.0, 6, 0.45, 2.2, 8.0) + 1.0) * 0.5;
    float continentMask = smoothstep(0.48, 0.52, continentNoise);
    float islandNoise = (layeredNoise(noiseInputPosition, uContinentSeed * 3.0, 7, 0.5, 2.5, 18.0) + 1.0) * 0.5;
    float oceanMask = 1.0 - continentMask;

    float finalElevation = continentNoise 
                           + (mountainNoise * continentMask * 0.3) 
                           + (islandNoise * oceanMask * 0.1);
    
    finalElevation -= vRiverValue * 0.04;

    vElevation = clamp(finalElevation, 0.0, 1.0);
    float displacement = vElevation * uDisplacementAmount;
    vec3 displacedPosition = p + normal * displacement;

    vNormal = normal;
    vWorldPosition = (modelMatrix * vec4(displacedPosition, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
}
`;

const planetFragmentShader = `
uniform vec3 uLandColor;
uniform vec3 uWaterColor;
uniform float uOceanHeightLevel;
uniform float uContinentSeed;

varying vec3 vNormal;
varying float vElevation;
varying vec3 vWorldPosition;
varying float vRiverValue;

$

vec3 calculateLighting(vec3 surfaceColor, vec3 normalVec, vec3 viewDir) {
  vec3 lightColor = vec3(1.0, 1.0, 0.95);
  float ambientStrength = 0.25;
  float diffuseStrength = 0.7;
  float specularStrength = 0.3;
  float shininess = 16.0;

  vec3 lightDirection = normalize(vec3(0.8, 0.6, 1.0));
  vec3 ambient = ambientStrength * lightColor;
  vec3 norm = normalize(normalVec);
  float diff = max(dot(norm, lightDirection), 0.0);
  vec3 diffuse = diffuseStrength * diff * lightColor;
  vec3 reflectDir = reflect(-lightDirection, norm);
  float spec = pow(max(dot(viewDir, reflectDir), 0.0), shininess);
  vec3 specular = specularStrength * spec * lightColor;
  return (ambient + diffuse + specular) * surfaceColor;
}

void main() {
  vec3 finalColor;

  vec3 deepWaterColor = uWaterColor * 0.5;
  vec3 shallowWaterColor = uWaterColor;
  vec3 beachColor = vec3(0.86, 0.78, 0.59);
  vec3 plainsColor = uLandColor;
  vec3 forestColor = uLandColor * 0.65;
  vec3 mountainColor = uLandColor * 0.7 + vec3(0.4);
  vec3 snowColor = vec3(0.95, 0.95, 1.0);

  float seaLevel = uOceanHeightLevel;
  float beachLevel = seaLevel + 0.02;
  float forestLine = seaLevel + 0.35;
  float mountainLine = seaLevel + 0.45;
  float snowLine = seaLevel + 0.60;

  if (vElevation < seaLevel) {
      finalColor = mix(deepWaterColor, shallowWaterColor, smoothstep(seaLevel - 0.2, seaLevel, vElevation));
  } else if (vElevation < beachLevel) {
      finalColor = mix(shallowWaterColor, beachColor, smoothstep(seaLevel, beachLevel, vElevation));
  } else if (vElevation < forestLine) {
      finalColor = mix(beachColor, plainsColor, smoothstep(beachLevel, forestLine, vElevation));
  } else if (vElevation < mountainLine) {
      finalColor = mix(plainsColor, mountainColor, smoothstep(forestLine, mountainLine, vElevation));
  } else {
      finalColor = mix(mountainColor, snowColor, smoothstep(mountainLine, snowLine, vElevation));
  }

  if (vElevation > beachLevel && vElevation < mountainLine) {
    float forestNoise = valueNoise(vWorldPosition * 25.0, uContinentSeed * 4.0);
    float forestMask = smoothstep(0.4, 0.6, forestNoise);
    finalColor = mix(finalColor, forestColor, forestMask);
  }

  if (vRiverValue > 0.1) {
      finalColor = mix(finalColor, shallowWaterColor * 0.8, vRiverValue);
  }

  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
  gl_FragColor = vec4(calculateLighting(finalColor, vNormal, viewDirection), 1.0);
}
`;


export const PlanetVisualPanelManager = (() => {
  let panelElement, headerElement, titleElement, sizeElement, closeButton, planet360CanvasElement;
  let currentPlanetData = null;
  let isDraggingPanel = false;
  let panelOffset = { x: 0, y: 0 };
  let is360ViewActive = false;
  let threeScene, threeCamera, threeRenderer, threeLOD, threeControls, threeAnimationId, threeShaderMaterial;

  const SPHERE_BASE_RADIUS = 0.8;
  const DISPLACEMENT_SCALING_FACTOR = 0.005;

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

  function init() {
    panelElement = document.getElementById('planet-visual-panel');
    headerElement = document.getElementById('planet-visual-panel-header');
    titleElement = document.getElementById('planet-visual-title');
    sizeElement = document.getElementById('planet-visual-size');
    closeButton = document.getElementById('close-planet-visual-panel');
    planet360CanvasElement = document.getElementById('panel-planet-360-canvas');
    if (!planet360CanvasElement) console.error("PVisualPanelManager: CRITICAL - 360 Canvas not found in DOM!");
    closeButton?.addEventListener('click', _closePanel);
    headerElement?.addEventListener('mousedown', _onHeaderMouseDown);
    window.addEventListener('mousemove', _onWindowMouseMove);
    window.addEventListener('mouseup', _onWindowMouseUp);
    window.addEventListener('resize', () => {
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
    });
    console.log("PVisualPanelManager: Init complete.");
  }

  function show(planetData) {
    if (panelElement) {
      panelElement.classList.add('visible');
      panelElement.style.left = '50%';
      panelElement.style.top = '50%';
      panelElement.style.transform = 'translate(-50%, -50%)';
    }
    if (planetData) {
      currentPlanetData = planetData;
      if (titleElement) titleElement.textContent = planetData.planetName || 'Planet';
      if (sizeElement) sizeElement.textContent = `${Number(planetData.size).toFixed(2)} units`;
      _switchTo360View();
    }
  }

  function _switchTo360View() {
    if (!currentPlanetData) return;
    is360ViewActive = true;
    _stopAndCleanupThreeJSView();
    if (planet360CanvasElement) {
      planet360CanvasElement.style.display = 'block';
      requestAnimationFrame(() => {
        if (planet360CanvasElement.offsetParent !== null) {
          const newWidth = planet360CanvasElement.offsetWidth;
          const newHeight = planet360CanvasElement.offsetHeight;
          if (newWidth > 0 && newHeight > 0) {
            planet360CanvasElement.width = newWidth;
            planet360CanvasElement.height = newHeight;
            _initThreeJSView(currentPlanetData);
          }
        }
      });
    }
  }

  function _initThreeJSView(planet) {
    const noiseFunctions = glslSimpleValueNoise3D.replace('$', glslRandom2to1);
    const finalVertexShader = planetVertexShader.replace('$', noiseFunctions);
    const finalFragmentShader = planetFragmentShader.replace('$', noiseFunctions);

    threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color(0x050510);
    const aspectRatio = planet360CanvasElement.offsetWidth / planet360CanvasElement.offsetHeight;
    threeCamera = new THREE.PerspectiveCamera(60, aspectRatio, 0.001, 1000);
    threeCamera.position.z = 2.5;

    threeRenderer = new THREE.WebGLRenderer({ canvas: planet360CanvasElement, antialias: true });
    threeRenderer.setSize(planet360CanvasElement.offsetWidth, planet360CanvasElement.offsetHeight);
    threeRenderer.setPixelRatio(window.devicePixelRatio);

    let normalizedOceanLevel = 0.5;
    const pMin = planet.minTerrainHeight ?? 0.0;
    const pMax = planet.maxTerrainHeight ?? (pMin + 10.0);
    const pOcean = planet.oceanHeightLevel ?? (pMin + (pMax - pMin) * 0.3);
    if (pMax > pMin) {
      normalizedOceanLevel = (pOcean - pMin) / (pMax - pMin);
    }
    normalizedOceanLevel = Math.max(0.2, Math.min(0.8, normalizedOceanLevel));
    const conceptualRange = Math.max(0, pMax - pMin);
    const displacementAmount = conceptualRange * DISPLACEMENT_SCALING_FACTOR;

    const uniforms = {
        uLandColor: { value: new THREE.Color(planet.landColor || '#556B2F') },
        uWaterColor: { value: new THREE.Color(planet.waterColor || '#1E90FF') },
        uOceanHeightLevel: { value: normalizedOceanLevel },
        uContinentSeed: { value: planet.continentSeed ?? Math.random() },
        uContinentSharpness: { value: planet.continentSharpness ?? 1.8 },
        uTime: { value: 0.0 },
        uSphereRadius: { value: SPHERE_BASE_RADIUS },
        uDisplacementAmount: { value: displacementAmount }
    };
    
    threeShaderMaterial = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: finalVertexShader,
      fragmentShader: finalFragmentShader,
    });

    threeLOD = new THREE.LOD();
    const lodLevels = [
        { distance: 4.0, segments: [128, 64] },
        { distance: 1.5, segments: [256, 128] },
        { distance: 0.0, segments: [1024, 512] }
    ];

    lodLevels.forEach(level => {
        const geometry = new THREE.SphereGeometry(SPHERE_BASE_RADIUS, level.segments[0], level.segments[1]);
        const mesh = new THREE.Mesh(geometry, threeShaderMaterial);
        threeLOD.addLevel(mesh, level.distance);
    });
    threeScene.add(threeLOD);

    threeControls = new OrbitControls(threeCamera, threeRenderer.domElement);
    threeControls.enableDamping = true;
    threeControls.dampingFactor = 0.05;
    threeControls.screenSpacePanning = false;
    threeControls.rotateSpeed = 0.5;
    threeControls.minDistance = 0.9;
    threeControls.maxDistance = SPHERE_BASE_RADIUS * 7;
    threeControls.target.set(0, 0, 0);

    _animateThreeJSView();
  }

  function _animateThreeJSView() {
    if (!is360ViewActive || !threeRenderer) return;
    threeAnimationId = requestAnimationFrame(_animateThreeJSView);
    if (threeShaderMaterial?.uniforms.uTime) {
      threeShaderMaterial.uniforms.uTime.value += 0.005;
    }
    if(threeLOD) threeLOD.update(threeCamera);
    if (threeControls) threeControls.update();
    if (threeRenderer && threeScene && threeCamera) threeRenderer.render(threeScene, threeCamera);
  }

  function _stopAndCleanupThreeJSView() {
    if (threeAnimationId) cancelAnimationFrame(threeAnimationId);
    if (threeControls) threeControls.dispose();
    if (threeShaderMaterial) threeShaderMaterial.dispose();
    if (threeLOD) {
        threeLOD.traverse((object) => {
            if (object.isMesh) {
                if (object.geometry) object.geometry.dispose();
            }
        });
        if(threeScene) threeScene.remove(threeLOD);
    }
    if (threeRenderer) threeRenderer.dispose();
    threeAnimationId = null;
    threeControls = null;
    threeShaderMaterial = null;
    threeLOD = null;
    threeScene = null;
    threeCamera = null;
  }

  function _closePanel() {
    if (panelElement) panelElement.classList.remove('visible');
    is360ViewActive = false;
    _stopAndCleanupThreeJSView();
    if (planet360CanvasElement) planet360CanvasElement.style.display = 'none';
  }

  return {
    init,
    show,
    hide: _closePanel,
    isVisible: () => panelElement?.classList.contains('visible'),
    getCurrentPlanetData: () => currentPlanetData,
  };
})();
