// hexPlanetViewController.js

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { LOD } from 'three';
import { getHexPlanetShaders } from './shaders.js';

export const HexPlanetViewController = (() => {
  let scene, camera, renderer, controls, lod;
  let animationId = null;
  let shaderMaterial;
  
  const SPHERE_BASE_RADIUS = 1.0;
  const DISPLACEMENT_SCALING_FACTOR = 0.005;

  function addBarycentricCoordinates(geometry) {
    const positions = geometry.attributes.position.array;
    const vertexCount = positions.length / 3;
    const barycentric = new Float32Array(vertexCount * 3);
    
    for (let i = 0; i < vertexCount; i += 3) {
      // First vertex of the triangle
      barycentric[i * 3] = 1;
      barycentric[i * 3 + 1] = 0;
      barycentric[i * 3 + 2] = 0;
      
      // Second vertex of the triangle
      barycentric[(i + 1) * 3] = 0;
      barycentric[(i + 1) * 3 + 1] = 1;
      barycentric[(i + 1) * 3 + 2] = 0;
      
      // Third vertex of the triangle
      barycentric[(i + 2) * 3] = 0;
      barycentric[(i + 2) * 3 + 1] = 0;
      barycentric[(i + 2) * 3 + 2] = 1;
    }
    
    geometry.setAttribute('barycentric', new THREE.BufferAttribute(barycentric, 3));
  }

  function initScene(canvas, planetBasis) {
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Camera setup
    camera = new THREE.PerspectiveCamera(60, canvas.offsetWidth / canvas.offsetHeight, 0.1, 1000);
    camera.position.z = 2.5;

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Controls setup
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.5;
    controls.minDistance = 1.2;
    controls.maxDistance = 4.0;
    controls.enablePan = false;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI;

    // Shader material setup
    const { vertexShader, fragmentShader } = getHexPlanetShaders();
    const uniforms = {
      uWaterColor: { value: new THREE.Color(planetBasis.waterColor) },
      uLandColor: { value: new THREE.Color(planetBasis.landColor) },
      uContinentSeed: { value: planetBasis.continentSeed },
      uRiverBasin: { value: planetBasis.riverBasin },
      uForestDensity: { value: planetBasis.forestDensity },
      uTime: { value: 0.0 },
      uSphereRadius: { value: SPHERE_BASE_RADIUS },
      uDisplacementAmount: { value: 0.0 }
    };

    const terrainRange = Math.max(0.1, planetBasis.maxTerrainHeight - planetBasis.minTerrainHeight);
    const normalizedOceanLevel = (planetBasis.oceanHeightLevel - planetBasis.minTerrainHeight) / terrainRange;
    uniforms.uOceanHeightLevel = { value: normalizedOceanLevel - 0.5 };
    uniforms.uDisplacementAmount.value = terrainRange * DISPLACEMENT_SCALING_FACTOR;

    shaderMaterial = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader
    });

    // LOD setup
    lod = new LOD();
    scene.add(lod);

    // Create different detail levels
    const detailLevels = [
      { subdivision: 64, distance: 0 },    // Ultra detail for very close
      { subdivision: 32, distance: 1.5 },  // High detail for medium distance
      { subdivision: 16, distance: 2.5 }   // Normal detail for far view
    ];

    detailLevels.forEach(level => {
      const geometry = new THREE.IcosahedronGeometry(SPHERE_BASE_RADIUS, level.subdivision);
      addBarycentricCoordinates(geometry);
      const mesh = new THREE.Mesh(geometry, shaderMaterial);
      lod.addLevel(mesh, level.distance);
    });

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Start animation
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

  return {
    init: () => {
      // Initialize any DOM elements or event listeners that need to be set up once
      console.log("HexPlanetViewController initialized");
    },

    activate: (planetBasis) => {
      const canvas = document.getElementById('hex-planet-canvas');
      if (!canvas) return;
      
      cleanup();
      initScene(canvas, planetBasis);
      
      window.addEventListener('resize', onResize);
      
      // Show the hex planet view
      document.getElementById('hex-planet-screen')?.classList.add('active');
    },

    deactivate: () => {
      cleanup();
      window.removeEventListener('resize', onResize);
      document.getElementById('hex-planet-screen')?.classList.remove('active');
    }
  };
})();
