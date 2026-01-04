import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// ============================================================================
// SEEDED RNG - Mulberry32
// ============================================================================
function createSeededRNG(seed) {
  let hash = 0;
  const seedStr = String(seed);
  for (let i = 0; i < seedStr.length; i++) {
    hash = ((hash << 5) - hash) + seedStr.charCodeAt(i);
    hash = hash & hash;
  }
  let state = hash >>> 0;
  
  return {
    random() {
      state |= 0;
      state = state + 0x6D2B79F5 | 0;
      let t = Math.imul(state ^ state >>> 15, 1 | state);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    },
    range(min, max) { return min + this.random() * (max - min); },
    int(min, max) { return Math.floor(this.range(min, max + 1)); },
    pick(arr) { return arr[this.int(0, arr.length - 1)]; },
    chance(p = 0.5) { return this.random() < p; }
  };
}

// ============================================================================
// TESSELLATION CONFIG
// ============================================================================
// Detail levels: 1 = minimal (low-poly), 2 = medium, 3 = high detail
const getTessellation = (detail = 1) => ({
  box: Math.max(1, detail),
  cylinderRadial: 4 + detail * 4,  // 8, 12, 16
  cylinderHeight: detail,
  sphereWidth: 4 + detail * 4,     // 8, 12, 16
  sphereHeight: 3 + detail * 3,    // 6, 9, 12
  torusRadial: 4 + detail * 2,     // 6, 8, 10
  torusTubular: 8 + detail * 4,    // 12, 16, 20
  cone: 4 + detail * 4,            // 8, 12, 16
  edgeThreshold: detail === 1 ? 1 : (detail === 2 ? 15 : 25), // Show more/fewer edges
});

// ============================================================================
// WIREFRAME GEOMETRY HELPERS
// ============================================================================
function createWireframe(geometry, color, edgeThreshold = 15) {
  const edges = new THREE.EdgesGeometry(geometry, edgeThreshold);
  const material = new THREE.LineBasicMaterial({ color: new THREE.Color(color) });
  return new THREE.LineSegments(edges, material);
}

// Create solid mesh with flat shading (SVGA style)
function createSolidMesh(geometry, color, opacity = 0.85) {
  const col = new THREE.Color(color);
  // Darken slightly for solid faces
  col.multiplyScalar(0.7);
  const material = new THREE.MeshLambertMaterial({ 
    color: col,
    flatShading: true,
    transparent: opacity < 1,
    opacity: opacity,
    side: THREE.DoubleSide
  });
  return new THREE.Mesh(geometry, material);
}

function addToGroup(group, geometry, color, pos = [0,0,0], rot = [0,0,0], scale = [1,1,1], edgeThreshold = 15, showSolid = false) {
  const wrapper = new THREE.Group();
  
  // Add solid mesh first (renders behind wireframe)
  if (showSolid) {
    const solid = createSolidMesh(geometry, color);
    wrapper.add(solid);
  }
  
  // Add wireframe on top
  const wire = createWireframe(geometry, color, edgeThreshold);
  wrapper.add(wire);
  
  wrapper.position.set(...pos);
  wrapper.rotation.set(...rot);
  wrapper.scale.set(...(Array.isArray(scale) ? scale : [scale, scale, scale]));
  group.add(wrapper);
  return wrapper;
}

// Geometry factory with tessellation support
const createGeo = {
  box: (w, h, d, tess) => new THREE.BoxGeometry(w, h, d, tess.box, tess.box, tess.box),
  cylinder: (rt, rb, h, tess) => new THREE.CylinderGeometry(rt, rb, h, tess.cylinderRadial, tess.cylinderHeight),
  sphere: (r, tess) => new THREE.SphereGeometry(r, tess.sphereWidth, tess.sphereHeight),
  cone: (r, h, tess) => new THREE.ConeGeometry(r, h, tess.cone),
  torus: (r, tube, tess) => new THREE.TorusGeometry(r, tube, tess.torusRadial, tess.torusTubular),
  // Platonic solids with subdivision detail
  octahedron: (r, detail = 0) => new THREE.OctahedronGeometry(r, detail),
  tetrahedron: (r, detail = 0) => new THREE.TetrahedronGeometry(r, detail),
  icosahedron: (r, detail = 0) => new THREE.IcosahedronGeometry(r, detail),
  dodecahedron: (r, detail = 0) => new THREE.DodecahedronGeometry(r, detail),
};

// ============================================================================
// PART GENERATORS (with tessellation and solid mesh support)
// ============================================================================
const HeadGenerators = {
  cube: (group, size, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    addToGroup(group, createGeo.box(size, size * 0.8, size * 0.7, tess), color, [0,0,0], [0,0,0], [1,1,1], et, solid);
    const ah = rng.range(0.2, 0.5);
    addToGroup(group, createGeo.cylinder(0.02, 0.03, ah, tess), color, [size * 0.3, size * 0.4 + ah/2, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.octahedron(0.06, tess.box > 1 ? 1 : 0), color, [size * 0.3, size * 0.4 + ah + 0.06, 0], [0,0,0], [1,1,1], et, solid);
  },
  dome: (group, size, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    addToGroup(group, createGeo.cylinder(size * 0.5, size * 0.6, size * 0.4, tess), color, [0,0,0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.sphere(size * 0.45, tess), color, [0, size * 0.35, 0], [0,0,0], [1,1,1], et, solid);
    const sc = rng.int(2, 4);
    for (let i = 0; i < sc; i++) {
      const a = (i / sc) * Math.PI * 2;
      addToGroup(group, createGeo.cylinder(0.04, 0.04, 0.15, tess), color, 
        [Math.cos(a) * size * 0.35, size * 0.1, Math.sin(a) * size * 0.35],
        [Math.PI / 6 * Math.cos(a), 0, -Math.PI / 6 * Math.sin(a)], [1,1,1], et, solid);
    }
  },
  visor: (group, size, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    addToGroup(group, createGeo.box(size, size * 0.5, size * 0.6, tess), color, [0,0,0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.box(size * 1.1, size * 0.15, size * 0.2, tess), color, [0, size * 0.05, size * 0.35], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.box(size * 0.2, size * 0.3, size * 0.15, tess), color, [0, size * 0.4, 0], [0,0,0], [1,1,1], et, solid);
  },
  pyramid: (group, size, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    addToGroup(group, createGeo.box(size * 0.7, size * 0.2, size * 0.7, tess), color, [0, -size * 0.3, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cone(size * 0.5, size * 0.8, tess), color, [0, size * 0.2, 0], [0, Math.PI/4, 0], [1,1,1], et, solid);
  },
  turret: (group, size, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    addToGroup(group, createGeo.cylinder(size * 0.4, size * 0.5, size * 0.6, tess), color, [0,0,0], [0,0,0], [1,1,1], et, solid);
    const bc = rng.int(1, 3);
    for (let i = 0; i < bc; i++) {
      addToGroup(group, createGeo.cylinder(0.08, 0.08, size * 0.6, tess), color,
        [(i - (bc-1)/2) * 0.15, 0, size * 0.5], [Math.PI/2, 0, 0], [1,1,1], et, solid);
    }
  },
  cluster: (group, size, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    const sd = tess.box > 1 ? 1 : 0;
    addToGroup(group, createGeo.octahedron(size * 0.25, sd), color, [0, size * 0.15, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.box(size * 0.4, size * 0.3, size * 0.4, tess), color, [0, -size * 0.1, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.tetrahedron(size * 0.15, sd), color, [size * 0.25, size * 0.2, size * 0.1], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.tetrahedron(size * 0.15, sd), color, [-size * 0.25, size * 0.2, size * 0.1], [0,0,0], [1,1,1], et, solid);
  },
  // NEW: Cyclops eye head
  cyclops: (group, size, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    addToGroup(group, createGeo.sphere(size * 0.5, tess), color, [0, 0, 0], [0,0,0], [1, 0.8, 0.9], et, solid);
    addToGroup(group, createGeo.cylinder(size * 0.25, size * 0.25, size * 0.15, tess), color, [0, 0, size * 0.4], [Math.PI/2, 0, 0], [1,1,1], et, solid);
    addToGroup(group, createGeo.sphere(size * 0.18, tess), color, [0, 0, size * 0.5], [0,0,0], [1,1,1], et, solid);
  },
  // NEW: Flat wide scanner head
  scanner: (group, size, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    addToGroup(group, createGeo.box(size * 1.4, size * 0.25, size * 0.5, tess), color, [0,0,0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.box(size * 1.2, size * 0.08, size * 0.15, tess), color, [0, 0, size * 0.3], [0,0,0], [1,1,1], et, solid);
    const lc = rng.int(3, 5);
    for (let i = 0; i < lc; i++) {
      const x = (i - (lc-1)/2) * (size * 0.3);
      addToGroup(group, createGeo.box(size * 0.08, size * 0.12, size * 0.08, tess), color, [x, size * 0.18, 0], [0,0,0], [1,1,1], et, solid);
    }
  },
  // NEW: Insectoid compound head
  insect: (group, size, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    const sd = tess.box > 1 ? 1 : 0;
    addToGroup(group, createGeo.dodecahedron(size * 0.35, sd), color, [0, 0, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.sphere(size * 0.22, tess), color, [size * 0.28, size * 0.1, size * 0.15], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.sphere(size * 0.22, tess), color, [-size * 0.28, size * 0.1, size * 0.15], [0,0,0], [1,1,1], et, solid);
    // Mandibles
    addToGroup(group, createGeo.cone(size * 0.08, size * 0.3, tess), color, [size * 0.15, -size * 0.2, size * 0.2], [0.5, 0, 0.3], [1,1,1], et, solid);
    addToGroup(group, createGeo.cone(size * 0.08, size * 0.3, tess), color, [-size * 0.15, -size * 0.2, size * 0.2], [0.5, 0, -0.3], [1,1,1], et, solid);
  },
  // NEW: Blocky monitor head
  monitor: (group, size, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    addToGroup(group, createGeo.box(size * 0.9, size * 0.7, size * 0.5, tess), color, [0,0,0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.box(size * 0.7, size * 0.5, size * 0.05, tess), color, [0, 0, size * 0.26], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cylinder(size * 0.08, size * 0.12, size * 0.3, tess), color, [0, -size * 0.5, 0], [0,0,0], [1,1,1], et, solid);
  },
  // NEW: Horned demon head
  horned: (group, size, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    addToGroup(group, createGeo.box(size * 0.7, size * 0.6, size * 0.65, tess), color, [0,0,0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cone(size * 0.12, size * 0.5, tess), color, [size * 0.35, size * 0.4, -size * 0.1], [-0.3, 0, 0.4], [1,1,1], et, solid);
    addToGroup(group, createGeo.cone(size * 0.12, size * 0.5, tess), color, [-size * 0.35, size * 0.4, -size * 0.1], [-0.3, 0, -0.4], [1,1,1], et, solid);
    addToGroup(group, createGeo.box(size * 0.5, size * 0.1, size * 0.15, tess), color, [0, size * 0.05, size * 0.35], [0,0,0], [1,1,1], et, solid);
  },
};

const TorsoGenerators = {
  box: (group, w, h, d, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    addToGroup(group, createGeo.box(w, h, d, tess), color, [0,0,0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.box(w * 0.6, 0.15, d * 0.3, tess), color, [0, h * 0.3, d * 0.4], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.box(w * 0.4, h * 0.5, d * 0.15, tess), color, [0, -h * 0.1, d * 0.35], [0,0,0], [1,1,1], et, solid);
  },
  hex: (group, w, h, d, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    addToGroup(group, new THREE.CylinderGeometry(w * 0.5, w * 0.5, h, 6, tess.cylinderHeight), color, [0,0,0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, new THREE.CylinderGeometry(w * 0.55, w * 0.55, h * 0.1, 6, 1), color, [0, h * 0.55, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, new THREE.CylinderGeometry(w * 0.55, w * 0.55, h * 0.1, 6, 1), color, [0, -h * 0.55, 0], [0,0,0], [1,1,1], et, solid);
  },
  tapered: (group, w, h, d, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    addToGroup(group, createGeo.cylinder(w * 0.35, w * 0.55, h, tess), color, [0,0,0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.box(w * 1.3, h * 0.15, d * 0.8, tess), color, [0, h * 0.45, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.box(w * 0.5, h * 0.1, d * 0.4, tess), color, [0, -h * 0.45, 0], [0,0,0], [1,1,1], et, solid);
  },
  segmented: (group, w, h, d, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    const n = rng.int(3, 5);
    const sh = h / n;
    for (let i = 0; i < n; i++) {
      const y = (i - (n-1)/2) * sh;
      const s = 1 - Math.abs(i - (n-1)/2) * 0.1;
      addToGroup(group, createGeo.box(w * s, sh * 0.85, d * s, tess), color, [0, y, 0], [0,0,0], [1,1,1], et, solid);
    }
  },
  spheroid: (group, w, h, d, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    addToGroup(group, createGeo.sphere(w * 0.6, tess), color, [0, 0, 0], [0, 0, 0], [1, h/w * 0.8, d/w], et, solid);
    addToGroup(group, createGeo.torus(w * 0.35, 0.06, tess), color, [0, h * 0.35, 0], [Math.PI/2, 0, 0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cylinder(w * 0.25, w * 0.35, h * 0.2, tess), color, [0, -h * 0.45, 0], [0,0,0], [1,1,1], et, solid);
  },
  industrial: (group, w, h, d, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    addToGroup(group, createGeo.box(w, h * 0.7, d, tess), color, [0, -h * 0.1, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.box(w * 1.2, h * 0.25, d * 1.1, tess), color, [0, h * 0.35, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cylinder(0.06, 0.06, h * 0.4, tess), color, [w * 0.5, 0, d * 0.3], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cylinder(0.06, 0.06, h * 0.4, tess), color, [-w * 0.5, 0, d * 0.3], [0,0,0], [1,1,1], et, solid);
  },
  // NEW: Barrel/drum torso
  barrel: (group, w, h, d, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    addToGroup(group, createGeo.cylinder(w * 0.55, w * 0.55, h, tess), color, [0,0,0], [0,0,0], [1,1,1], et, solid);
    // Bands
    addToGroup(group, createGeo.torus(w * 0.58, 0.04, tess), color, [0, h * 0.35, 0], [Math.PI/2,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.torus(w * 0.58, 0.04, tess), color, [0, -h * 0.35, 0], [Math.PI/2,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.torus(w * 0.58, 0.04, tess), color, [0, 0, 0], [Math.PI/2,0,0], [1,1,1], et, solid);
  },
  // NEW: Angular stealth torso
  stealth: (group, w, h, d, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    // Main angular body
    addToGroup(group, createGeo.box(w, h * 0.5, d * 0.7, tess), color, [0, 0, 0], [0,0,0], [1,1,1], et, solid);
    // Angled top
    addToGroup(group, createGeo.box(w * 0.8, h * 0.3, d * 0.5, tess), color, [0, h * 0.35, d * 0.1], [0.2,0,0], [1,1,1], et, solid);
    // Angled bottom
    addToGroup(group, createGeo.box(w * 0.7, h * 0.25, d * 0.4, tess), color, [0, -h * 0.35, d * 0.05], [-0.15,0,0], [1,1,1], et, solid);
    // Side panels
    addToGroup(group, createGeo.box(w * 0.15, h * 0.6, d * 0.5, tess), color, [w * 0.55, 0, 0], [0,0,0.1], [1,1,1], et, solid);
    addToGroup(group, createGeo.box(w * 0.15, h * 0.6, d * 0.5, tess), color, [-w * 0.55, 0, 0], [0,0,-0.1], [1,1,1], et, solid);
  },
  // NEW: Spinal/vertebrae torso
  spinal: (group, w, h, d, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    const segments = rng.int(4, 7);
    const segH = h / segments;
    for (let i = 0; i < segments; i++) {
      const y = (i - (segments-1)/2) * segH;
      const scale = 0.7 + Math.sin((i / segments) * Math.PI) * 0.3;
      addToGroup(group, createGeo.octahedron(w * 0.35 * scale, 0), color, [0, y, 0], [0,0,0], [1, 0.6, 1], et, solid);
    }
    // Spine
    addToGroup(group, createGeo.cylinder(w * 0.08, w * 0.08, h * 0.9, tess), color, [0, 0, -d * 0.3], [0,0,0], [1,1,1], et, solid);
  },
  // NEW: Cage/skeletal torso
  cage: (group, w, h, d, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    // Top and bottom plates
    addToGroup(group, createGeo.box(w, h * 0.1, d, tess), color, [0, h * 0.45, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.box(w * 0.8, h * 0.1, d * 0.8, tess), color, [0, -h * 0.45, 0], [0,0,0], [1,1,1], et, solid);
    // Ribs
    const ribCount = rng.int(3, 5);
    for (let i = 0; i < ribCount; i++) {
      const y = h * 0.3 - i * (h * 0.6 / (ribCount - 1));
      addToGroup(group, createGeo.torus(w * 0.4, 0.03, tess), color, [0, y, d * 0.1], [0,0,0], [1, 0.6, 1], et, solid);
    }
    // Core
    addToGroup(group, createGeo.sphere(w * 0.2, tess), color, [0, 0, 0], [0,0,0], [1,1,1], et, solid);
  },
  // NEW: Layered/plated torso  
  plated: (group, w, h, d, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    addToGroup(group, createGeo.box(w * 0.6, h * 0.8, d * 0.5, tess), color, [0, 0, 0], [0,0,0], [1,1,1], et, solid);
    // Front plates
    addToGroup(group, createGeo.box(w * 0.9, h * 0.35, d * 0.15, tess), color, [0, h * 0.2, d * 0.35], [0.1,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.box(w * 0.85, h * 0.35, d * 0.15, tess), color, [0, -h * 0.2, d * 0.3], [-0.1,0,0], [1,1,1], et, solid);
    // Side plates
    addToGroup(group, createGeo.box(w * 0.15, h * 0.7, d * 0.6, tess), color, [w * 0.45, 0, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.box(w * 0.15, h * 0.7, d * 0.6, tess), color, [-w * 0.45, 0, 0], [0,0,0], [1,1,1], et, solid);
  },
};

const ArmGenerators = {
  standard: (group, len, thick, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    addToGroup(group, createGeo.sphere(thick * 1.2, tess), color, [0,0,0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cylinder(thick, thick * 0.9, len, tess), color, [0, -len * 0.5, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.sphere(thick * 0.96, tess), color, [0, -len, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cylinder(thick * 0.8, thick * 0.7, len * 0.9, tess), color, [0, -len * 1.45, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.box(thick * 1.5, thick * 0.8, thick * 1.2, tess), color, [0, -len * 1.95, 0], [0,0,0], [1,1,1], et, solid);
  },
  armored: (group, len, thick, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    addToGroup(group, createGeo.box(thick * 2.5, thick * 1.5, thick * 2, tess), color, [0,0,0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.box(thick * 2, len, thick * 1.5, tess), color, [0, -len * 0.55, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.octahedron(thick * 0.8, tess.box > 1 ? 1 : 0), color, [0, -len * 1.05, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.box(thick * 1.6, len * 0.9, thick * 1.3, tess), color, [0, -len * 1.5, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.box(thick * 2, thick * 1.2, thick * 1.8, tess), color, [0, -len * 2, 0], [0,0,0], [1,1,1], et, solid);
  },
  skeletal: (group, len, thick, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    const sd = tess.box > 1 ? 1 : 0;
    addToGroup(group, createGeo.icosahedron(thick * 0.8, sd), color, [0,0,0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cylinder(thick * 0.35, thick * 0.35, len * 0.6, tess), color, [0, -len * 0.55, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.sphere(thick * 0.4, tess), color, [0, -len * 0.25, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.sphere(thick * 0.4, tess), color, [0, -len * 0.85, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.icosahedron(thick * 0.56, sd), color, [0, -len, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cylinder(thick * 0.3, thick * 0.3, len * 0.5, tess), color, [0, -len * 1.45, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.sphere(thick * 0.35, tess), color, [0, -len * 1.2, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.sphere(thick * 0.35, tess), color, [0, -len * 1.7, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.tetrahedron(thick * 0.8, sd), color, [0, -len * 1.9, 0], [0,0,0], [1,1,1], et, solid);
  },
  hydraulic: (group, len, thick, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    addToGroup(group, createGeo.cylinder(thick * 1.2, thick * 1.2, thick * 0.8, tess), color, [0, 0, 0], [Math.PI/2, 0, 0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cylinder(thick, thick, len * 0.45, tess), color, [0, -len * 0.3, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cylinder(thick * 0.5, thick * 0.5, len * 0.6, tess), color, [thick * 0.5, -len * 0.5, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cylinder(thick * 0.96, thick * 0.96, thick * 0.64, tess), color, [0, -len * 0.7, 0], [Math.PI/2, 0, 0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cylinder(thick * 0.9, thick * 0.9, len * 0.45, tess), color, [0, -len * 1.15, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.box(thick * 1.8, thick, thick * 1.4, tess), color, [0, -len * 1.75, 0], [0,0,0], [1,1,1], et, solid);
  },
  tentacle: (group, len, thick, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    const sd = tess.box > 1 ? 1 : 0;
    const n = rng.int(5, 8);
    const sl = len * 2 / n;
    for (let i = 0; i < n; i++) {
      const s = 1 - (i / n) * 0.5;
      addToGroup(group, createGeo.octahedron(thick * s, sd), color, [0, -i * sl, 0], [0,0,0], [1,1,1], et, solid);
      if (i < n - 1) {
        const ns = 1 - ((i + 1) / n) * 0.5;
        addToGroup(group, new THREE.CylinderGeometry(thick * 0.3 * s, thick * 0.3 * ns, sl * 0.7, tess.cylinderRadial), color, [0, -i * sl - sl * 0.5, 0], [0,0,0], [1,1,1], et, solid);
      }
    }
  },
  // NEW: Claw arm
  claw: (group, len, thick, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    addToGroup(group, createGeo.sphere(thick * 1.1, tess), color, [0,0,0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cylinder(thick * 0.9, thick * 0.7, len, tess), color, [0, -len * 0.5, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.sphere(thick * 0.8, tess), color, [0, -len, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cylinder(thick * 0.6, thick * 0.5, len * 0.7, tess), color, [0, -len * 1.4, 0], [0,0,0], [1,1,1], et, solid);
    // Claw fingers
    const clawCount = 3;
    for (let i = 0; i < clawCount; i++) {
      const angle = (i / clawCount) * Math.PI * 2 - Math.PI / 2;
      addToGroup(group, createGeo.cone(thick * 0.25, len * 0.4, tess), color, 
        [Math.cos(angle) * thick * 0.4, -len * 1.9, Math.sin(angle) * thick * 0.4], 
        [0.4 * Math.sin(angle), 0, -0.4 * Math.cos(angle)], [1,1,1], et, solid);
    }
  },
  // NEW: Blade arm
  blade: (group, len, thick, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    addToGroup(group, createGeo.box(thick * 2, thick * 1.5, thick * 1.5, tess), color, [0,0,0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.box(thick * 1.2, len, thick, tess), color, [0, -len * 0.5, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.box(thick * 1.4, thick * 0.8, thick * 1.2, tess), color, [0, -len * 1.05, 0], [0,0,0], [1,1,1], et, solid);
    // Blade
    addToGroup(group, createGeo.box(thick * 0.15, len * 1.2, thick * 2, tess), color, [0, -len * 1.7, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cone(thick * 0.1, len * 0.3, tess), color, [0, -len * 2.4, 0], [Math.PI, 0, 0], [1, 1, thick * 12], et, solid);
  },
  // NEW: Cannon arm
  cannon: (group, len, thick, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    addToGroup(group, createGeo.cylinder(thick * 1.3, thick * 1.3, thick, tess), color, [0,0,0], [Math.PI/2,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cylinder(thick * 1.1, thick * 0.9, len * 0.6, tess), color, [0, -len * 0.35, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cylinder(thick * 1.0, thick * 1.0, thick * 0.5, tess), color, [0, -len * 0.7, 0], [0,0,0], [1,1,1], et, solid);
    // Barrel
    addToGroup(group, createGeo.cylinder(thick * 0.7, thick * 0.7, len * 1.2, tess), color, [0, -len * 1.35, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.torus(thick * 0.75, thick * 0.15, tess), color, [0, -len * 0.9, 0], [Math.PI/2,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.torus(thick * 0.75, thick * 0.1, tess), color, [0, -len * 1.9, 0], [Math.PI/2,0,0], [1,1,1], et, solid);
  },
  // NEW: Shield arm
  shield: (group, len, thick, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    addToGroup(group, createGeo.sphere(thick * 1.0, tess), color, [0,0,0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cylinder(thick * 0.8, thick * 0.7, len * 0.8, tess), color, [0, -len * 0.45, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.sphere(thick * 0.75, tess), color, [0, -len * 0.9, 0], [0,0,0], [1,1,1], et, solid);
    // Shield plate
    addToGroup(group, createGeo.box(thick * 4, len * 1.0, thick * 0.3, tess), color, [0, -len * 1.4, thick * 1.5], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cylinder(thick * 0.3, thick * 0.3, thick * 1.2, tess), color, [0, -len * 1.2, thick * 0.6], [Math.PI/2,0,0], [1,1,1], et, solid);
  },
};

const LegGenerators = {
  standard: (group, len, thick, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    addToGroup(group, createGeo.sphere(thick * 1.1, tess), color, [0,0,0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cylinder(thick, thick * 0.85, len, tess), color, [0, -len * 0.5, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.sphere(thick * 0.99, tess), color, [0, -len, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cylinder(thick * 0.8, thick * 0.6, len * 0.95, tess), color, [0, -len * 1.5, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.sphere(thick * 0.7, tess), color, [0, -len * 2, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.box(thick * 2, thick * 0.6, thick * 3, tess), color, [0, -len * 2.15, thick * 0.5], [0,0,0], [1,1,1], et, solid);
  },
  digitigrade: (group, len, thick, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    const sd = tess.box > 1 ? 1 : 0;
    addToGroup(group, createGeo.sphere(thick * 1.1, tess), color, [0,0,0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cylinder(thick, thick * 0.8, len * 0.7, tess), color, [0, -len * 0.35, thick * 0.2], [-0.2, 0, 0], [1,1,1], et, solid);
    addToGroup(group, createGeo.icosahedron(thick * 0.8, sd), color, [0, -len * 0.75, thick * 0.35], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cylinder(thick * 0.7, thick * 0.5, len * 0.8, tess), color, [0, -len * 1.2, -thick * 0.1], [0.4, 0, 0], [1,1,1], et, solid);
    addToGroup(group, createGeo.sphere(thick * 0.6, tess), color, [0, -len * 1.65, -thick * 0.4], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cylinder(thick * 0.4, thick * 0.6, len * 0.5, tess), color, [0, -len * 1.9, -thick * 0.1], [0.8, 0, 0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cone(thick * 0.4, thick * 1.2, tess), color, [0, -len * 2.05, thick * 0.4], [Math.PI/2, 0, 0], [1,1,1], et, solid);
  },
  armored: (group, len, thick, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    addToGroup(group, createGeo.box(thick * 2, thick * 1.2, thick * 2, tess), color, [0,0,0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.box(thick * 2.2, len, thick * 1.8, tess), color, [0, -len * 0.55, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.box(thick * 2.5, thick * 1.5, thick * 2.2, tess), color, [0, -len * 1.1, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.box(thick * 2, len * 0.95, thick * 1.6, tess), color, [0, -len * 1.6, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.box(thick * 2.5, thick * 0.8, thick * 3.5, tess), color, [0, -len * 2.15, thick * 0.3], [0,0,0], [1,1,1], et, solid);
  },
  piston: (group, len, thick, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    addToGroup(group, createGeo.cylinder(thick * 1.4, thick * 1.4, thick * 0.8, tess), color, [0, 0, 0], [0, 0, Math.PI/2], [1,1,1], et, solid);
    addToGroup(group, createGeo.cylinder(thick * 1.2, thick * 1.2, len * 0.5, tess), color, [0, -len * 0.3, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cylinder(thick * 0.8, thick * 0.8, len * 0.7, tess), color, [0, -len * 0.85, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cylinder(thick * 0.3, thick * 0.3, len * 0.8, tess), color, [thick * 0.8, -len * 0.6, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cylinder(thick * 0.3, thick * 0.3, len * 0.8, tess), color, [-thick * 0.8, -len * 0.6, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cylinder(thick * 1.1, thick * 0.9, thick * 0.6, tess), color, [0, -len * 1.35, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cylinder(thick * 0.7, thick * 0.5, len * 0.6, tess), color, [0, -len * 1.7, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.box(thick * 2.2, thick * 0.5, thick * 3, tess), color, [0, -len * 2.05, thick * 0.4], [0,0,0], [1,1,1], et, solid);
  },
  // NEW: Spider/multi-jointed leg
  spider: (group, len, thick, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    addToGroup(group, createGeo.sphere(thick * 1.0, tess), color, [0,0,0], [0,0,0], [1,1,1], et, solid);
    // First segment - goes outward
    addToGroup(group, createGeo.cylinder(thick * 0.6, thick * 0.5, len * 0.5, tess), color, [0, -len * 0.15, thick * 0.3], [-0.8, 0, 0], [1,1,1], et, solid);
    addToGroup(group, createGeo.sphere(thick * 0.55, tess), color, [0, -len * 0.35, thick * 0.55], [0,0,0], [1,1,1], et, solid);
    // Second segment - goes down
    addToGroup(group, createGeo.cylinder(thick * 0.45, thick * 0.35, len * 0.8, tess), color, [0, -len * 0.8, thick * 0.4], [0.3, 0, 0], [1,1,1], et, solid);
    addToGroup(group, createGeo.sphere(thick * 0.4, tess), color, [0, -len * 1.25, thick * 0.2], [0,0,0], [1,1,1], et, solid);
    // Third segment - tip
    addToGroup(group, createGeo.cylinder(thick * 0.3, thick * 0.15, len * 0.6, tess), color, [0, -len * 1.6, thick * 0.1], [0.1, 0, 0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cone(thick * 0.2, thick * 0.4, tess), color, [0, -len * 1.95, thick * 0.05], [Math.PI, 0, 0], [1,1,1], et, solid);
  },
  // NEW: Hooved/animal leg
  hooved: (group, len, thick, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    addToGroup(group, createGeo.sphere(thick * 1.2, tess), color, [0,0,0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cylinder(thick * 1.0, thick * 0.7, len * 0.6, tess), color, [0, -len * 0.35, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.sphere(thick * 0.75, tess), color, [0, -len * 0.7, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cylinder(thick * 0.5, thick * 0.4, len * 0.9, tess), color, [0, -len * 1.2, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.sphere(thick * 0.45, tess), color, [0, -len * 1.7, 0], [0,0,0], [1,1,1], et, solid);
    // Hoof
    addToGroup(group, createGeo.cylinder(thick * 0.6, thick * 0.8, thick * 0.5, tess), color, [0, -len * 2.0, 0], [0,0,0], [1,1,1], et, solid);
  },
  // NEW: Blocky/chunky leg
  blocky: (group, len, thick, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    addToGroup(group, createGeo.box(thick * 1.8, thick * 1.0, thick * 1.6, tess), color, [0,0,0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.box(thick * 1.5, len * 0.9, thick * 1.4, tess), color, [0, -len * 0.5, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.box(thick * 1.8, thick * 0.8, thick * 1.6, tess), color, [0, -len * 1.0, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.box(thick * 1.4, len * 0.85, thick * 1.3, tess), color, [0, -len * 1.5, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.box(thick * 2.0, thick * 0.6, thick * 2.8, tess), color, [0, -len * 2.0, thick * 0.3], [0,0,0], [1,1,1], et, solid);
  },
  // NEW: Stilts/thin leg
  stilts: (group, len, thick, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    addToGroup(group, createGeo.cylinder(thick * 1.0, thick * 0.8, thick * 0.6, tess), color, [0,0,0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cylinder(thick * 0.4, thick * 0.35, len * 1.3, tess), color, [0, -len * 0.7, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.sphere(thick * 0.5, tess), color, [0, -len * 1.35, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cylinder(thick * 0.3, thick * 0.25, len * 0.8, tess), color, [0, -len * 1.8, 0], [0,0,0], [1,1,1], et, solid);
    // Pointed foot
    addToGroup(group, createGeo.cone(thick * 0.5, thick * 0.8, tess), color, [0, -len * 2.3, 0], [Math.PI, 0, 0], [1,1,1], et, solid);
  },
};

const TrackGenerators = {
  tank: (group, w, len, h, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    const wc = rng.int(3, 5);
    const ws = len / (wc - 1);
    addToGroup(group, createGeo.box(w, h * 0.15, len, tess), color, [0, h * 0.4, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.box(w, h * 0.15, len, tess), color, [0, -h * 0.4, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.box(w * 0.1, h, len, tess), color, [w * 0.45, 0, 0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.box(w * 0.1, h, len, tess), color, [-w * 0.45, 0, 0], [0,0,0], [1,1,1], et, solid);
    for (let i = 0; i < wc; i++) {
      addToGroup(group, createGeo.cylinder(h * 0.45, h * 0.45, w * 0.9, tess), color, [0, 0, -len/2 + i * ws], [0, 0, Math.PI/2], [1,1,1], et, solid);
    }
    addToGroup(group, createGeo.cylinder(h * 0.5, h * 0.5, w, tess), color, [0, 0, len/2], [Math.PI/2, 0, 0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cylinder(h * 0.5, h * 0.5, w, tess), color, [0, 0, -len/2], [Math.PI/2, 0, 0], [1,1,1], et, solid);
  },
  wheel: (group, radius, width, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    addToGroup(group, createGeo.torus(radius * 0.85, radius * 0.15, tess), color, [0, 0, 0], [0, 0, Math.PI/2], [1,1,1], et, solid);
    addToGroup(group, createGeo.cylinder(radius * 0.3, radius * 0.3, width, tess), color, [0, 0, 0], [0, 0, Math.PI/2], [1,1,1], et, solid);
    const sc = rng.int(4, 8);
    for (let i = 0; i < sc; i++) {
      const a = (i / sc) * Math.PI * 2;
      addToGroup(group, createGeo.cylinder(radius * 0.05, radius * 0.05, radius * 0.6, tess), color,
        [0, Math.cos(a) * radius * 0.4, Math.sin(a) * radius * 0.4], [0, 0, a + Math.PI/2], [1,1,1], et, solid);
    }
  },
  hover: (group, size, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    addToGroup(group, createGeo.cylinder(size * 0.5, size * 0.6, size * 0.3, tess), color, [0,0,0], [0,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.torus(size * 0.45, size * 0.08, tess), color, [0, -size * 0.1, 0], [0,0,0], [1,1,1], et, solid);
    const vc = rng.int(4, 8);
    for (let i = 0; i < vc; i++) {
      const a = (i / vc) * Math.PI * 2;
      addToGroup(group, createGeo.box(size * 0.15, size * 0.25, size * 0.08, tess), color,
        [Math.cos(a) * size * 0.35, 0, Math.sin(a) * size * 0.35], [0, -a, 0], [1,1,1], et, solid);
    }
  },
  // NEW: Ball/sphere locomotion
  ball: (group, size, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    addToGroup(group, createGeo.sphere(size * 0.5, tess), color, [0,0,0], [0,0,0], [1,1,1], et, solid);
    // Housing
    addToGroup(group, createGeo.torus(size * 0.35, size * 0.08, tess), color, [0, size * 0.25, 0], [Math.PI/2,0,0], [1,1,1], et, solid);
    addToGroup(group, createGeo.cylinder(size * 0.4, size * 0.5, size * 0.15, tess), color, [0, size * 0.35, 0], [0,0,0], [1,1,1], et, solid);
  },
  // NEW: Tri-wheel cluster
  triwheel: (group, size, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    const wheelR = size * 0.3;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
      const x = Math.cos(a) * size * 0.35;
      const y = Math.sin(a) * size * 0.35;
      addToGroup(group, createGeo.cylinder(wheelR, wheelR, size * 0.15, tess), color, [x, y, 0], [0,0,Math.PI/2], [1,1,1], et, solid);
    }
    // Center hub
    addToGroup(group, createGeo.cylinder(size * 0.15, size * 0.15, size * 0.2, tess), color, [0,0,0], [0,0,Math.PI/2], [1,1,1], et, solid);
  },
};

// ============================================================================
// ROBOT GENERATOR
// ============================================================================
function generateRobot(seed, detail = 1, showSolid = false) {
  const rng = createSeededRNG(seed);
  const tess = getTessellation(detail);
  const robot = new THREE.Group();
  
  // Colors
  const hue = rng.range(0, 1);
  const color1 = new THREE.Color().setHSL(hue, rng.range(0.6, 1), rng.range(0.45, 0.65));
  const color2 = new THREE.Color().setHSL((hue + rng.range(0.08, 0.17)) % 1, rng.range(0.6, 1), rng.range(0.5, 0.7));
  const c1 = '#' + color1.getHexString();
  const c2 = '#' + color2.getHexString();
  
  // Size
  const scale = rng.range(0.7, 1.3);
  
  // Torso
  const torsoTypes = Object.keys(TorsoGenerators);
  const torsoType = rng.pick(torsoTypes);
  const tw = 0.8 * scale * rng.range(0.8, 1.3);
  const th = 1.2 * scale * rng.range(0.8, 1.2);
  const td = 0.5 * scale * rng.range(0.8, 1.2);
  const torso = new THREE.Group();
  TorsoGenerators[torsoType](torso, tw, th, td, c1, rng, tess, showSolid);
  robot.add(torso);
  
  // Head
  const headTypes = Object.keys(HeadGenerators);
  const headType = rng.pick(headTypes);
  const hs = 0.6 * scale * rng.range(0.8, 1.2);
  const head = new THREE.Group();
  HeadGenerators[headType](head, hs, c2, rng, tess, showSolid);
  head.position.y = th * 0.5 + hs * 0.4;
  robot.add(head);
  
  // Arms
  const hasArms = rng.chance(0.85);
  if (hasArms) {
    const armTypes = Object.keys(ArmGenerators);
    const armType = rng.pick(armTypes);
    const al = 0.6 * scale * rng.range(0.8, 1.2);
    const at = 0.12 * scale * rng.range(0.8, 1.3);
    
    const leftArm = new THREE.Group();
    ArmGenerators[armType](leftArm, al, at, c1, rng, tess, showSolid);
    leftArm.position.set(tw * 0.55 + at, th * 0.35, 0);
    leftArm.rotation.z = 0.1;
    robot.add(leftArm);
    
    const rightArm = new THREE.Group();
    ArmGenerators[armType](rightArm, al, at, c1, rng, tess, showSolid);
    rightArm.position.set(-(tw * 0.55 + at), th * 0.35, 0);
    rightArm.rotation.z = -0.1;
    robot.add(rightArm);
  }
  
  // Locomotion
  const locoTypes = ['bipedal', 'bipedal', 'bipedal', 'tracked', 'wheeled', 'hover'];
  const locoType = rng.pick(locoTypes);
  
  if (locoType === 'bipedal') {
    const legTypes = Object.keys(LegGenerators);
    const legType = rng.pick(legTypes);
    const ll = 0.8 * scale * rng.range(0.8, 1.2);
    const lt = 0.15 * scale * rng.range(0.8, 1.2);
    
    const leftLeg = new THREE.Group();
    LegGenerators[legType](leftLeg, ll, lt, c1, rng, tess, showSolid);
    leftLeg.position.set(tw * 0.3, -th * 0.5, 0);
    robot.add(leftLeg);
    
    const rightLeg = new THREE.Group();
    LegGenerators[legType](rightLeg, ll, lt, c1, rng, tess, showSolid);
    rightLeg.position.set(-tw * 0.3, -th * 0.5, 0);
    robot.add(rightLeg);
  } else if (locoType === 'tracked') {
    const trackW = 0.4 * scale;
    const trackL = 1.5 * scale;
    const trackH = 0.5 * scale;
    
    const leftTrack = new THREE.Group();
    TrackGenerators.tank(leftTrack, trackW, trackL, trackH, c1, rng, tess, showSolid);
    leftTrack.position.set(tw * 0.5 + trackW * 0.5, -th * 0.5 - 0.1, 0);
    robot.add(leftTrack);
    
    const rightTrack = new THREE.Group();
    TrackGenerators.tank(rightTrack, trackW, trackL, trackH, c1, rng, tess, showSolid);
    rightTrack.position.set(-(tw * 0.5 + trackW * 0.5), -th * 0.5 - 0.1, 0);
    robot.add(rightTrack);
  } else if (locoType === 'wheeled') {
    const wr = 0.35 * scale;
    const ww = 0.15 * scale;
    const positions = [
      [tw * 0.6, -th * 0.5 - wr * 0.5, td * 0.8],
      [-tw * 0.6, -th * 0.5 - wr * 0.5, td * 0.8],
      [tw * 0.6, -th * 0.5 - wr * 0.5, -td * 0.8],
      [-tw * 0.6, -th * 0.5 - wr * 0.5, -td * 0.8]
    ];
    positions.forEach(pos => {
      const wheel = new THREE.Group();
      TrackGenerators.wheel(wheel, wr, ww, c1, rng, tess, showSolid);
      wheel.position.set(...pos);
      robot.add(wheel);
    });
  } else if (locoType === 'hover') {
    const hovSize = 0.5 * scale;
    const positions = [
      [tw * 0.35, -th * 0.5 - 0.15, td * 0.5],
      [-tw * 0.35, -th * 0.5 - 0.15, td * 0.5],
      [tw * 0.35, -th * 0.5 - 0.15, -td * 0.5],
      [-tw * 0.35, -th * 0.5 - 0.15, -td * 0.5]
    ];
    positions.forEach(pos => {
      const hover = new THREE.Group();
      TrackGenerators.hover(hover, hovSize, c1, rng, tess, showSolid);
      hover.position.set(...pos);
      robot.add(hover);
    });
  }
  
  // Accessories
  const et = tess.edgeThreshold;
  if (rng.chance(0.4)) {
    const antenna = new THREE.Group();
    const ah = rng.range(0.3, 0.6);
    addToGroup(antenna, createGeo.cylinder(0.02, 0.015, ah, tess), c2, [0, ah/2, 0], [0,0,0], [1,1,1], et, showSolid);
    addToGroup(antenna, createGeo.sphere(0.04, tess), c2, [0, ah + 0.04, 0], [0,0,0], [1,1,1], et, showSolid);
    antenna.position.set(rng.range(-0.2, 0.2), th * 0.5 + hs * 0.8, 0);
    robot.add(antenna);
  }
  
  if (rng.chance(0.35)) {
    const backpack = new THREE.Group();
    const bw = tw * 0.6, bh = th * 0.5, bd = 0.25 * scale;
    addToGroup(backpack, createGeo.box(bw, bh, bd, tess), c1, [0,0,0], [0,0,0], [1,1,1], et, showSolid);
    addToGroup(backpack, createGeo.box(bw * 0.3, bh * 0.15, bd * 0.3, tess), c2, [bw * 0.25, bh * 0.3, bd * 0.4], [0,0,0], [1,1,1], et, showSolid);
    addToGroup(backpack, createGeo.box(bw * 0.3, bh * 0.15, bd * 0.3, tess), c2, [-bw * 0.25, bh * 0.3, bd * 0.4], [0,0,0], [1,1,1], et, showSolid);
    backpack.position.set(0, 0, -td * 0.5 - bd * 0.5 - 0.05);
    robot.add(backpack);
  }
  
  return robot;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function WireframeRobotDemo() {
  const containerRef = useRef(null);
  const [seed, setSeed] = useState('robot-001');
  const [seedInput, setSeedInput] = useState('robot-001');
  const [detail, setDetail] = useState(1);
  const [showSolid, setShowSolid] = useState(false);
  const stateRef = useRef({
    renderer: null,
    scene: null,
    robots: [],
    animationId: null,
    camera: null,
    controls: { rotY: 0, rotX: 0.3, zoom: 18, isDragging: false, prevX: 0, prevY: 0 }
  });
  
  // Sync seed input when seed changes externally
  useEffect(() => {
    setSeedInput(seed);
  }, [seed]);
  
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const state = stateRef.current;
    
    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0a0a0f');
    state.scene = scene;
    
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(10, 8, 14);
    camera.lookAt(0, 0, 0);
    state.camera = camera;
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    state.renderer = renderer;
    
    // Lighting for solid meshes
    const ambientLight = new THREE.AmbientLight(0x404050, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    scene.add(directionalLight);
    
    const directionalLight2 = new THREE.DirectionalLight(0x4488ff, 0.4);
    directionalLight2.position.set(-10, 10, -10);
    scene.add(directionalLight2);
    
    const pointLight = new THREE.PointLight(0x00ffaa, 0.3, 50);
    pointLight.position.set(0, 5, 0);
    scene.add(pointLight);
    
    // Grid
    const grid = new THREE.GridHelper(24, 24, 0x333333, 0x222222);
    grid.position.y = -2.5;
    scene.add(grid);
    
    // Generate robots
    const cols = 4, rows = 3, spacing = 5;
    state.robots = [];
    
    for (let i = 0; i < cols * rows; i++) {
      const x = (i % cols - (cols - 1) / 2) * spacing;
      const z = (Math.floor(i / cols) - (rows - 1) / 2) * spacing;
      const robotSeed = `${seed}-${i}`;
      const robot = generateRobot(robotSeed, detail, showSolid);
      robot.position.set(x, 0, z);
      robot.userData = { bobOffset: i * 0.3, bobSpeed: 0.8 + i * 0.05 };
      scene.add(robot);
      state.robots.push(robot);
    }
    
    // Mouse controls
    const ctrl = state.controls;
    
    const onMouseDown = (e) => { ctrl.isDragging = true; ctrl.prevX = e.clientX; ctrl.prevY = e.clientY; };
    const onMouseUp = () => { ctrl.isDragging = false; };
    const onMouseMove = (e) => {
      if (!ctrl.isDragging) return;
      ctrl.rotY += (e.clientX - ctrl.prevX) * 0.005;
      ctrl.rotX += (e.clientY - ctrl.prevY) * 0.005;
      ctrl.rotX = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, ctrl.rotX));
      ctrl.prevX = e.clientX;
      ctrl.prevY = e.clientY;
    };
    const onWheel = (e) => {
      ctrl.zoom += e.deltaY * 0.01;
      ctrl.zoom = Math.max(8, Math.min(35, ctrl.zoom));
    };
    
    const canvas = renderer.domElement;
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('wheel', onWheel);
    
    // Animation loop
    let isRunning = true;
    const animate = (time) => {
      if (!isRunning) return;
      state.animationId = requestAnimationFrame(animate);
      
      const t = time * 0.001;
      
      // Update camera
      camera.position.x = Math.sin(ctrl.rotY) * Math.cos(ctrl.rotX) * ctrl.zoom;
      camera.position.y = Math.sin(ctrl.rotX) * ctrl.zoom + 3;
      camera.position.z = Math.cos(ctrl.rotY) * Math.cos(ctrl.rotX) * ctrl.zoom;
      camera.lookAt(0, 0, 0);
      
      // Animate robots
      state.robots.forEach((robot) => {
        const { bobOffset, bobSpeed } = robot.userData;
        robot.position.y = Math.sin(t * bobSpeed + bobOffset) * 0.08;
        robot.rotation.y += 0.002;
      });
      
      renderer.render(scene, camera);
    };
    animate(0);
    
    // Resize handler
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);
    
    // Cleanup function
    return () => {
      isRunning = false;
      if (state.animationId) {
        cancelAnimationFrame(state.animationId);
      }
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseUp);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('wheel', onWheel);
      
      // Safe DOM removal
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
      
      // Dispose Three.js resources
      state.robots.forEach(robot => {
        robot.traverse(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
      });
      renderer.dispose();
      
      // Clear refs
      state.renderer = null;
      state.scene = null;
      state.robots = [];
    };
  }, [seed, detail, showSolid]);
  
  const regenerate = () => {
    setSeed(`robot-${Date.now()}`);
  };
  
  const applySeed = () => {
    setSeed(seedInput);
  };
  
  const handleSeedKeyDown = (e) => {
    if (e.key === 'Enter') {
      applySeed();
    }
  };
  
  const detailLabels = ['LOW', 'MED', 'HIGH'];
  
  const inputStyle = {
    background: 'rgba(0,255,170,0.1)',
    border: '1px solid rgba(0,255,170,0.4)',
    color: '#00ffaa',
    padding: '6px 10px',
    borderRadius: 4,
    fontFamily: 'inherit',
    fontSize: 12,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box'
  };
  
  const buttonStyle = {
    background: 'transparent',
    border: '1px solid #00ffaa',
    color: '#00ffaa',
    padding: '8px 16px',
    borderRadius: 4,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 11,
    letterSpacing: '0.08em',
    transition: 'all 0.2s ease'
  };
  
  const toggleStyle = (active) => ({
    background: active ? '#00ffaa' : 'transparent',
    border: '1px solid #00ffaa',
    color: active ? '#0a0a0f' : '#00ffaa',
    padding: '6px 12px',
    borderRadius: 4,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 10,
    letterSpacing: '0.08em',
    transition: 'all 0.15s ease',
    flex: 1
  });
  
  return (
    <div style={{ width: '100%', height: '100vh', background: '#0a0a0f', position: 'relative', overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      
      {/* UI Panel */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        color: '#00ffaa',
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace',
        fontSize: 12,
        background: 'rgba(0,0,0,0.9)',
        padding: '16px 20px',
        borderRadius: 6,
        border: '1px solid rgba(0,255,170,0.25)',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 4px 30px rgba(0,255,170,0.1)',
        width: 220
      }}>
        <div style={{ fontSize: 14, marginBottom: 14, fontWeight: 600, letterSpacing: '0.05em' }}>
          WIREFRAME ROBOTS
        </div>
        
        {/* Seed Input */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', opacity: 0.6, marginBottom: 6, fontSize: 10, letterSpacing: '0.1em' }}>
            SEED
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              onKeyDown={handleSeedKeyDown}
              style={{ ...inputStyle, flex: 1 }}
              spellCheck={false}
            />
            <button
              onClick={applySeed}
              style={{ ...buttonStyle, padding: '6px 10px' }}
              onMouseEnter={(e) => { e.target.style.background = '#00ffaa'; e.target.style.color = '#0a0a0f'; }}
              onMouseLeave={(e) => { e.target.style.background = 'transparent'; e.target.style.color = '#00ffaa'; }}
            >
              GO
            </button>
          </div>
        </div>
        
        {/* Detail Level */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', opacity: 0.6, marginBottom: 6, fontSize: 10, letterSpacing: '0.1em' }}>
            TESSELLATION
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="range"
              min="1"
              max="3"
              value={detail}
              onChange={(e) => setDetail(parseInt(e.target.value))}
              style={{
                flex: 1,
                accentColor: '#00ffaa',
                cursor: 'pointer'
              }}
            />
            <span style={{ 
              minWidth: 40, 
              textAlign: 'right', 
              fontSize: 11,
              opacity: 0.8
            }}>
              {detailLabels[detail - 1]}
            </span>
          </div>
        </div>
        
        {/* Render Mode Toggle */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', opacity: 0.6, marginBottom: 6, fontSize: 10, letterSpacing: '0.1em' }}>
            RENDER MODE
          </label>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => setShowSolid(false)}
              style={toggleStyle(!showSolid)}
            >
              WIREFRAME
            </button>
            <button
              onClick={() => setShowSolid(true)}
              style={toggleStyle(showSolid)}
            >
              SOLID
            </button>
          </div>
        </div>
        
        {/* Regenerate Button */}
        <button 
          onClick={regenerate}
          style={{ ...buttonStyle, width: '100%' }}
          onMouseEnter={(e) => { e.target.style.background = '#00ffaa'; e.target.style.color = '#0a0a0f'; }}
          onMouseLeave={(e) => { e.target.style.background = 'transparent'; e.target.style.color = '#00ffaa'; }}
        >
          RANDOMIZE
        </button>
        
        {/* Instructions */}
        <div style={{ opacity: 0.4, fontSize: 10, marginTop: 12, lineHeight: 1.5 }}>
          Drag to rotate • Scroll to zoom<br/>
          Same seed = same robots
        </div>
      </div>
      
      {/* Stats */}
      <div style={{
        position: 'absolute',
        bottom: 20,
        right: 20,
        color: '#00ffaa',
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace',
        fontSize: 10,
        opacity: 0.5,
        textAlign: 'right'
      }}>
        {showSolid ? 'SOLID + WIRE' : 'WIREFRAME'} | {detailLabels[detail - 1]}<br/>
        SEED: {seed}
      </div>
    </div>
  );
}
