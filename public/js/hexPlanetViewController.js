// hexPlanetViewController.js

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { LOD } from 'three';
import { getHexPlanetShaders } from './shaders.js';

export const HexPlanetViewController = (() => {
  let scene, camera, renderer, controls, lod;
  let animationId = null;
  // REMOVE the single shaderMaterial variable, as we now have many
  
  let backButton = null;
  const boundDeactivate = deactivate.bind(this);

  const SPHERE_BASE_RADIUS = 1.0;
  const DISPLACEMENT_SCALING_FACTOR = 0.005;

  function addBarycentricCoordinates(geometry) {
    const positions = geometry.attributes.position.array;
    const vertexCount = positions.length / 3;
    const barycentric = new Float32Array(vertexCount * 3);
    
    for (let i = 0; i < vertexCount; i += 3) {
      barycentric[i * 3] = 1; barycentric[i * 3 + 1] = 0; barycentric[i * 3 + 2] = 0;
      barycentric[(i + 1) * 3] = 0; barycentric[(i + 1) * 3 + 1] = 1; barycentric[(i + 1) * 3 + 2] = 0;
      barycentric[(i + 2) * 3] = 0; barycentric[(i + 2) * 3 + 1] = 0; barycentric[(i + 2) * 3 + 2] = 1;
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
    controls.maxDistance = 40.0;
    controls.enablePan = false;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI;

    const { vertexShader, fragmentShader } = getHexPlanetShaders();

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
              uOceanHeightLevel: { value: 0.0 },
              uContinentOctaves: { value: 5 },
              uMountainOctaves: { value: 6 },
              uIslandOctaves: { value: 7 },
              uMountainScale: { value: 8.0 }
          }
      ]),
      vertexShader,
      fragmentShader,
      lights: true
    });

    const terrainRange = Math.max(0.1, planetBasis.maxTerrainHeight - planetBasis.minTerrainHeight);
    const normalizedOceanLevel = (planetBasis.oceanHeightLevel - planetBasis.minTerrainHeight) / terrainRange;
    baseMaterial.uniforms.uOceanHeightLevel.value = normalizedOceanLevel - 0.5;
    baseMaterial.uniforms.uDisplacementAmount.value = terrainRange * DISPLACEMENT_SCALING_FACTOR;

    lod = new LOD();
    scene.add(lod);

    // --- SMOOTHED OUT LOD ARRAY ---
    const detailLevels = [
      // Note: octaves [continent, mountain, island]
      { subdivision: 256, distance: 0,   octaves: [6, 7, 8], mountainScale: 14.0 },
      { subdivision: 224, distance: 1.1, octaves: [6, 7, 7], mountainScale: 13.0 }, // Smaller step
      { subdivision: 192, distance: 1.3, octaves: [5, 6, 7], mountainScale: 12.0 },
      { subdivision: 160, distance: 1.5, octaves: [5, 6, 6], mountainScale: 11.0 },
      { subdivision: 128, distance: 1.7, octaves: [5, 5, 5], mountainScale: 10.0 }, // Smoother octave drop
      { subdivision: 96,  distance: 1.9, octaves: [4, 5, 4], mountainScale: 9.0  },
      { subdivision: 72,  distance: 2.1, octaves: [4, 4, 3], mountainScale: 8.5  }, //Smoother island drop
      { subdivision: 56,  distance: 2.3, octaves: [4, 4, 1], mountainScale: 8.0  },
      { subdivision: 48,  distance: 2.4, octaves: [4, 3, 0], mountainScale: 8.0  }, // Start level
      { subdivision: 36,  distance: 3.5, octaves: [3, 3, 0], mountainScale: 7.0  },
      { subdivision: 24,  distance: 5.0, octaves: [3, 2, 0], mountainScale: 7.0  },
      { subdivision: 12,  distance: 10.0,octaves: [3, 0, 0], mountainScale: 6.0  },
      { subdivision: 6,   distance: 18.0,octaves: [2, 0, 0], mountainScale: 5.0  },
      { subdivision: 3,   distance: 30.0,octaves: [1, 0, 0], mountainScale: 4.0  }
    ];

    detailLevels.forEach(level => {
      const geometry = new THREE.IcosahedronGeometry(SPHERE_BASE_RADIUS, level.subdivision);
      addBarycentricCoordinates(geometry);
      const materialForLevel = baseMaterial.clone();
      materialForLevel.uniforms.uContinentOctaves.value = level.octaves[0];
      materialForLevel.uniforms.uMountainOctaves.value = level.octaves[1];
      materialForLevel.uniforms.uIslandOctaves.value = level.octaves[2];
      materialForLevel.uniforms.uMountainScale.value = level.mountainScale;
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
    
  function animate(now) { // Pass 'now' for time
    animationId = requestAnimationFrame(animate);
    
    // --- CORRECTED TIME UPDATE ---
    // We must update the time on every material used in the LOD
    if (lod) {
        lod.children.forEach(mesh => {
            if (mesh.material && mesh.material.uniforms.uTime) {
                mesh.material.uniforms.uTime.value = now / 1000; // Use consistent time
            }
        });
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
      // Correctly dispose of unique materials
      lod.traverse((object) => {
        if (object.isMesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
              object.material.forEach(m => m.dispose());
          } else if (object.material) {
              object.material.dispose();
          }
        }
      });
      scene.remove(lod);
      lod = null;
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
        console.error("HexPlanetViewController: Missing required elements...");
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
