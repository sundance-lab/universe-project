// public/js/hexPlanetViewController.js

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { getHexPlanetShaders } from './shaders.js';
import { LOD } from 'three/examples/jsm/objects/LOD.js';

export const HexPlanetViewController = (() => {
  let screen, canvas, backButton;
  let scene, camera, renderer, controls, lod, material, animationId;

  // This function adds the special 'barycentric' data to our geometry,
  // which is essential for the hexagon stroke shader to work.
  const addBarycentricCoordinates = (geometry) => {
    const count = geometry.attributes.position.count;
    const barycentric = [];

    for (let i = 0; i < count; i++) {
        // For each of the 3 vertices in a triangle, we set one of the
        // barycentric coordinates to 1 and the others to 0.
        barycentric.push(
            i % 3 === 0 ? 1 : 0,
            i % 3 === 1 ? 1 : 0,
            i % 3 === 2 ? 1 : 0
        );
    }

    const barycentricAttribute = new THREE.Float32BufferAttribute(barycentric, 3);
    geometry.setAttribute('barycentric', barycentricAttribute);
  };
  
  const _init = () => {
    screen = document.getElementById('planet-surface-screen'); // We reuse the existing screen
    canvas = document.getElementById('planet-surface-canvas');
    backButton = document.getElementById('back-from-surface');

    backButton?.addEventListener('click', _deactivate);
  };

 const _animate = () => {
  animationId = requestAnimationFrame(_animate);
  
  lod.update(camera); 
   
  controls.update();
  renderer.render(scene, camera);
 };

  const _activate = (planetBasis) => {
  if (!canvas) return;
   
  // --- Basic Scene Setup (same as before) ---
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050510);
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 2.5;
   
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
   
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
   
  const { vertexShader, fragmentShader } = getHexPlanetShaders();
  const pMin = planetBasis.minTerrainHeight;
  const pMax = planetBasis.maxTerrainHeight;
  const pOcean = planetBasis.oceanHeightLevel;
  const normalizedOceanLevel = (pOcean - pMin) / ((pMax - pMin) || 1.0);
  const displacementAmount = ((pMax - pMin) || 1.0) * 0.005;

  material = new THREE.ShaderMaterial({
   vertexShader,
   fragmentShader,
   uniforms: {
    uContinentSeed: { value: planetBasis.continentSeed },
    uSphereRadius: { value: 1.0 },
    uDisplacementAmount: { value: displacementAmount },
    uLandColor: { value: new THREE.Color(planetBasis.landColor) },
    uWaterColor: { value: new THREE.Color(planetBasis.waterColor) },
    uOceanHeightLevel: { value: normalizedOceanLevel - 0.5 },
    uForestDensity: { value: planetBasis.forestDensity },
    uRiverBasin: { value: planetBasis.riverBasin ?? 0.05 },
   }
  });

  // --- LEVEL OF DETAIL (LOD) IMPLEMENTATION ---
  lod = new LOD();
  scene.add(lod); // Add the LOD object to the scene instead of a single mesh

  // Define the detail levels and the distance at which they should appear.
  // You can tweak these values to your liking.
  const levels = [
   { distance: 0,   detail: 32 }, // Highest detail, for distances 0 to 3
   { distance: 3,   detail: 16 }, // Medium detail, for distances 3 to 8
   { distance: 8,   detail: 8  }, // Low detail, for distances 8 to infinity
  ];

  // Loop through our defined levels to create each mesh
  for (const level of levels) {
   // 1. Create the geometry with the specified detail
   const geometry = new THREE.IcosahedronGeometry(1, level.detail);
   // 2. Add the barycentric coordinates needed for the hex shader
   addBarycentricCoordinates(geometry);
   // 3. Create a mesh using the geometry and the *same shared material*
   const mesh = new THREE.Mesh(geometry, material);
   // 4. Add the mesh to the LOD object at the specified distance
   lod.addLevel(mesh, level.distance);
  }
  
  if (window.setActiveScreen) window.setActiveScreen(screen);
  _animate();
 };

 const _deactivate = () => {
  cancelAnimationFrame(animationId);

  if (controls) controls.dispose();
  if (renderer) renderer.dispose();
  if (material) material.dispose();
  
   if (lod) {
   lod.traverse(object => {
    if (object.isMesh) {
     object.geometry.dispose();
    }
   });
  }

  animationId = null;
  renderer = null;
  controls = null;
  scene = null;
   lod = null; // Clear the lod reference too
   
   // Get the designer screen element
   const designerScreen = document.getElementById('planet-designer-screen');

   // Explicitly switch the active screen back to the Planet Designer
   if (window.setActiveScreen && designerScreen) {
     window.setActiveScreen(designerScreen);
   }

   // Now, tell the PlanetDesigner module to re-initialize its own WebGL scene
   if (window.PlanetDesigner?.activate) {
     window.PlanetDesigner.activate();
   }
   // =========================================================
 };

 return {
  init: _init,
  activate: _activate
 };
})();
