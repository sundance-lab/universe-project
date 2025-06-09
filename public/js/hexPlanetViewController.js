// hexPlanetViewController.js

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { LOD } from 'three';
import { getHexPlanetShaders } from './shaders.js';

export const HexPlanetViewController = (() => {
  let scene, camera, renderer, controls, lod;
  let animationId = null;
  let shaderMaterial;
  
  let backButton = null;
  const boundDeactivate = deactivate.bind(this); // Bind the deactivate function once

  const SPHERE_BASE_RADIUS = 1.0;
  const DISPLACEMENT_SCALING_FACTOR = 0.005;

  function addBarycentricCoordinates(geometry) {
    // ... (no changes in this function)
    const positions = geometry.attributes.position.array;
    const vertexCount = positions.length / 3;
    const barycentric = new Float32Array(vertexCount * 3);
    
    for (let i = 0; i < vertexCount; i += 3) {
      barycentric[i * 3] = 1;
      barycentric[i * 3 + 1] = 0;
      barycentric[i * 3 + 2] = 0;
      
      barycentric[(i + 1) * 3] = 0;
      barycentric[(i + 1) * 3 + 1] = 1;
      barycentric[(i + 1) * 3 + 2] = 0;
      
      barycentric[(i + 2) * 3] = 0;
      barycentric[(i + 2) * 3 + 1] = 0;
      barycentric[(i + 2) * 3 + 2] = 1;
    }
    
    geometry.setAttribute('barycentric', new THREE.BufferAttribute(barycentric, 3));
  }

function initScene(canvas, planetBasis) {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  camera = new THREE.PerspectiveCamera(60, canvas.offsetWidth / canvas.offsetHeight, 0.1, 1000);
  camera.position.z = 2.4;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
  renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.04;
  controls.dollySpeed = 0.5;
  controls.rotateSpeed = 0.5;
  controls.minDistance = 1.2;
  controls.maxDistance = 30.0;
  controls.enablePan = false;
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = Math.PI;

  const { vertexShader, fragmentShader } = getHexPlanetShaders();

  // Create a BASE material. We will clone this for each LOD level.
  const baseMaterial = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.common,
        THREE.UniformsLib.lights,
        {
            uWaterColor: { value: new THREE.Color(planetBasis.waterColor) },
            uLandColor: { value: new THREE.Color(planetBasis.landColor) },
            uContinentSeed: { value: planetBasis.continentSeed },
            uRiverBasin: { value: planetBasis.riverBasin },
            uForestDensity: { value: planetBasis.forestDensity },
            uTime: { value: 0.0 },
            uSphereRadius: { value: SPHERE_BASE_RADIUS },
            uDisplacementAmount: { value: 0.0 },
            uShowStrokes: { value: false },
            
            // --- START: ADD THE MISSING UNIFORM HERE ---
            uOceanHeightLevel: { value: 0.0 }, // Add a default placeholder
            // --- END: ADDITION ---

            // Placeholders for our new noise uniforms
            uContinentOctaves: { value: 5 },
            uMountainOctaves: { value: 6 },
            uIslandOctaves: { value: 7 },
        }
    ]),
    vertexShader,
    fragmentShader,
    lights: true // Tell Three.js this material uses lights
  });

  const terrainRange = Math.max(0.1, planetBasis.maxTerrainHeight - planetBasis.minTerrainHeight);
  const normalizedOceanLevel = (planetBasis.oceanHeightLevel - planetBasis.minTerrainHeight) / terrainRange;
  
  // Now this line will work because the uniform exists!
  baseMaterial.uniforms.uOceanHeightLevel.value = normalizedOceanLevel - 0.5; 
  baseMaterial.uniforms.uDisplacementAmount.value = terrainRange * DISPLACEMENT_SCALING_FACTOR;

  lod = new LOD();
  scene.add(lod);

  const detailLevels = [
    { subdivision: 256, distance: 0, octaves: [5, 6, 7] },
    { subdivision: 192, distance: 1.1, octaves: [5, 6, 6] },
    { subdivision: 128, distance: 1.5, octaves: [5, 5, 5] },
    { subdivision: 80,  distance: 2.0, octaves: [4, 4, 4] },
    { subdivision: 48,  distance: 2.4, octaves: [4, 3, 0] },
    { subdivision: 24,  distance: 5.0, octaves: [3, 2, 0] },
    { subdivision: 12,  distance: 10.0, octaves: [3, 0, 0] },
    { subdivision: 6,   distance: 18.0, octaves: [2, 0, 0] }
  ];

  detailLevels.forEach(level => {
    const geometry = new THREE.IcosahedronGeometry(SPHERE_BASE_RADIUS, level.subdivision);
    addBarycentricCoordinates(geometry);
    const materialForLevel = baseMaterial.clone();
    materialForLevel.uniforms.uContinentOctaves.value = level.octaves[0];
    materialForLevel.uniforms.uMountainOctaves.value = level.octaves[1];
    materialForLevel.uniforms.uIslandOctaves.value = level.octaves[2];
    const mesh = new THREE.Mesh(geometry, materialForLevel);
    lod.addLevel(mesh, level.distance);
  });

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
  directionalLight.position.set(5, 5, 5);
  scene.add(directionalLight);

  animate();
}
  
  function animate() {
    animationId = requestAnimationFrame(animate);
    if (shaderMaterial?.uniforms.uTime) {
      shaderMaterial.uniforms.uTime.value += 0.015;
    }
    if (controls) controls.update();
    if (lod) lod.update(camera);
    if (scene && camera) renderer.render(scene, camera);
  }

  function cleanup() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    if (controls) {
      controls.dispose();
      controls = null;
    }
    if (lod) {
      lod.traverse((object) => {
        if (object.isMesh) {
          object.geometry.dispose();
          if (object.material) object.material.dispose();
        }
      });
      scene.remove(lod);
      lod = null;
    }
    if (shaderMaterial) {
      shaderMaterial.dispose();
      shaderMaterial = null;
    }
    if (renderer) {
      renderer.dispose();
      renderer = null;
    }
    scene = null;
    camera = null;
  }

  function onResize() {
    if (!renderer || !camera) return;
    const canvas = renderer.domElement;
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    if (width > 0 && height > 0) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }
  }
  
  function deactivate() {
    cleanup();
    window.removeEventListener('resize', onResize);
    document.getElementById('hex-planet-screen')?.classList.remove('active');
    
    if (backButton) {
      backButton.removeEventListener('click', boundDeactivate);
      backButton = null;
    }
  }

  return {
    init: () => {
      console.log("HexPlanetViewController initialized");
    },

    activate: (planetBasis) => {
      const canvas = document.getElementById('hex-planet-canvas');
      const screen = document.getElementById('hex-planet-screen');
      backButton = document.getElementById('back-from-hex-view');

      if (!canvas || !screen || !backButton) {
        console.error("HexPlanetViewController: Missing required elements (canvas, screen, or back button). Cannot activate.");
        return;
      }
      
      cleanup();
      initScene(canvas, planetBasis);
      
      window.addEventListener('resize', onResize);
      
      backButton.addEventListener('click', boundDeactivate);
      
      screen.classList.add('active');
    },

    deactivate: deactivate
  };
})();
