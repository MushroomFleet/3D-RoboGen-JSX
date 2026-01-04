# RoboGen Integration Guide

Procedural Wireframe Robot Generator for React/Three.js Applications

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites Assessment](#prerequisites-assessment)
3. [Compatibility Matrix](#compatibility-matrix)
4. [Installation Steps](#installation-steps)
5. [Integration Patterns](#integration-patterns)
6. [API Reference](#api-reference)
7. [Usage Examples](#usage-examples)
8. [Customization](#customization)
9. [Performance Considerations](#performance-considerations)
10. [Troubleshooting](#troubleshooting)

---

## Overview

RoboGen is a procedural robot mesh generator that creates deterministic, low-poly wireframe robots from seed strings. It supports:

- **Deterministic generation**: Same seed always produces identical robots
- **Modular architecture**: Interchangeable heads, torsos, arms, legs, and locomotion systems
- **Dual render modes**: Wireframe-only or solid+wireframe (SVGA style)
- **Tessellation control**: Adjustable polygon density (LOW/MED/HIGH)
- **Framework agnostic core**: Works with vanilla Three.js or React Three Fiber

### Part Counts

| Category | Types | Examples |
|----------|-------|----------|
| Heads | 11 | cube, dome, visor, pyramid, turret, cluster, cyclops, scanner, insect, monitor, horned |
| Torsos | 11 | box, hex, tapered, segmented, spheroid, industrial, barrel, stealth, spinal, cage, plated |
| Arms | 9 | standard, armored, skeletal, hydraulic, tentacle, claw, blade, cannon, shield |
| Legs | 8 | standard, digitigrade, armored, piston, spider, hooved, blocky, stilts |
| Locomotion | 5 | bipedal, tracked (tank), wheeled, hover, ball, triwheel |

**Total unique combinations**: 11 × 11 × 9 × 8 × 5 = **43,560** base configurations

---

## Prerequisites Assessment

Before integration, assess your target codebase against these requirements:

### 1. Framework Check

```bash
# Check package.json for Three.js version
cat package.json | grep three

# Expected output patterns:
# "three": "^0.128.0"    ← Minimum supported
# "three": "^0.150.0"    ← Recommended
# "@react-three/fiber"   ← R3F integration available
```

### 2. Codebase Assessment Checklist

Run through this checklist to determine integration complexity:

```markdown
## Target Codebase Assessment

### Core Dependencies
- [ ] Three.js version: __________ (minimum: r128)
- [ ] React version: __________ (if applicable, minimum: 16.8+)
- [ ] @react-three/fiber version: __________ (if using R3F)
- [ ] @react-three/drei version: __________ (optional)

### Architecture
- [ ] Using vanilla Three.js scene management
- [ ] Using React Three Fiber declarative approach
- [ ] Using custom scene graph wrapper
- [ ] Using ECS (Entity Component System)

### Rendering Pipeline
- [ ] Standard WebGLRenderer
- [ ] Post-processing pipeline (EffectComposer)
- [ ] Custom shaders in use
- [ ] Shadow mapping enabled

### Asset Management
- [ ] Using GLTF/GLB loader
- [ ] Using custom geometry loaders
- [ ] Procedural geometry generation exists
- [ ] Texture atlas system in use

### State Management (React)
- [ ] Local React state
- [ ] Redux/Zustand/Jotai
- [ ] Context API
- [ ] Custom state solution
```

### 3. File Structure Analysis

Identify where robot generation should live:

```
your-project/
├── src/
│   ├── components/
│   │   └── three/           ← R3F components
│   ├── lib/
│   │   └── generators/      ← Procedural generation (RECOMMENDED)
│   ├── utils/
│   │   └── three/           ← Three.js utilities
│   └── scenes/              ← Scene definitions
```

---

## Compatibility Matrix

### Three.js Version Compatibility

| Three.js Version | Status | Notes |
|------------------|--------|-------|
| < r128 | ❌ Not Supported | Missing required geometry types |
| r128 - r132 | ✅ Full Support | CapsuleGeometry polyfilled |
| r133+ | ✅ Full Support | Native CapsuleGeometry available |
| r150+ | ✅ Recommended | Best performance |

### React Three Fiber Compatibility

| @react-three/fiber | Three.js | Status |
|--------------------|----------|--------|
| v7.x | r128-r138 | ✅ Supported |
| v8.x | r139+ | ✅ Recommended |

### Browser Support

| Browser | Status | Notes |
|---------|--------|-------|
| Chrome 80+ | ✅ Full | WebGL2 recommended |
| Firefox 75+ | ✅ Full | |
| Safari 14+ | ✅ Full | WebGL2 on macOS 11+ |
| Edge 80+ | ✅ Full | Chromium-based |
| Mobile Chrome | ⚠️ Partial | Reduce tessellation |
| Mobile Safari | ⚠️ Partial | Reduce tessellation |

---

## Installation Steps

### Step 1: Copy Core Module

Extract the generation system into a standalone module:

```javascript
// src/lib/generators/robogen/index.js

// Export structure:
export { createSeededRNG } from './rng';
export { getTessellation, createGeo } from './geometry';
export { 
  HeadGenerators,
  TorsoGenerators,
  ArmGenerators,
  LegGenerators,
  TrackGenerators 
} from './parts';
export { generateRobot } from './generator';
```

### Step 2: Module Breakdown

Split the monolithic file into focused modules:

```
src/lib/generators/robogen/
├── index.js           # Public exports
├── rng.js             # Seeded RNG (Mulberry32)
├── geometry.js        # Geometry helpers & tessellation
├── wireframe.js       # Wireframe/solid mesh creation
├── parts/
│   ├── index.js       # Part generator exports
│   ├── heads.js       # HeadGenerators
│   ├── torsos.js      # TorsoGenerators
│   ├── arms.js        # ArmGenerators
│   ├── legs.js        # LegGenerators
│   └── tracks.js      # TrackGenerators
└── generator.js       # Main generateRobot function
```

### Step 3: Dependency Injection

Modify imports to use your project's Three.js instance:

```javascript
// robogen/geometry.js

// BEFORE (bundled Three.js)
import * as THREE from 'three';

// AFTER (dependency injection)
let THREE;

export function initRobogen(threeInstance) {
  THREE = threeInstance;
}

// Or use dynamic import
export async function initRobogenAsync() {
  THREE = await import('three');
}
```

### Step 4: TypeScript Definitions (Optional)

```typescript
// robogen/types.ts

export interface RobogenConfig {
  seed: string;
  detail?: 1 | 2 | 3;
  showSolid?: boolean;
}

export interface TessellationConfig {
  box: number;
  cylinderRadial: number;
  cylinderHeight: number;
  sphereWidth: number;
  sphereHeight: number;
  torusRadial: number;
  torusTubular: number;
  cone: number;
  edgeThreshold: number;
}

export interface SeededRNG {
  random(): number;
  range(min: number, max: number): number;
  int(min: number, max: number): number;
  pick<T>(arr: T[]): T;
  chance(probability?: number): boolean;
}

export type HeadType = 'cube' | 'dome' | 'visor' | 'pyramid' | 'turret' | 
                       'cluster' | 'cyclops' | 'scanner' | 'insect' | 
                       'monitor' | 'horned';

export type TorsoType = 'box' | 'hex' | 'tapered' | 'segmented' | 'spheroid' |
                        'industrial' | 'barrel' | 'stealth' | 'spinal' | 
                        'cage' | 'plated';

export type ArmType = 'standard' | 'armored' | 'skeletal' | 'hydraulic' |
                      'tentacle' | 'claw' | 'blade' | 'cannon' | 'shield';

export type LegType = 'standard' | 'digitigrade' | 'armored' | 'piston' |
                      'spider' | 'hooved' | 'blocky' | 'stilts';

export type LocomotionType = 'bipedal' | 'tracked' | 'wheeled' | 'hover';

export function generateRobot(
  seed: string, 
  detail?: number, 
  showSolid?: boolean
): THREE.Group;
```

---

## Integration Patterns

### Pattern A: Vanilla Three.js

```javascript
// scene-setup.js
import * as THREE from 'three';
import { generateRobot } from './lib/generators/robogen';

class GameScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.robots = new Map();
  }

  spawnRobot(id, position, seed = null) {
    const robotSeed = seed || `robot-${id}-${Date.now()}`;
    const robot = generateRobot(robotSeed, 2, true);
    
    robot.position.copy(position);
    robot.userData = {
      id,
      seed: robotSeed,
      spawnTime: Date.now()
    };
    
    this.scene.add(robot);
    this.robots.set(id, robot);
    
    return robot;
  }

  removeRobot(id) {
    const robot = this.robots.get(id);
    if (robot) {
      // Dispose geometries and materials
      robot.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      this.scene.remove(robot);
      this.robots.delete(id);
    }
  }

  updateRobots(deltaTime) {
    this.robots.forEach(robot => {
      // Custom animation logic
      robot.rotation.y += deltaTime * 0.5;
    });
  }
}
```

### Pattern B: React Three Fiber (Declarative)

```jsx
// components/Robot.jsx
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { generateRobot } from '../lib/generators/robogen';

export function Robot({ 
  seed, 
  position = [0, 0, 0], 
  detail = 2, 
  solid = false,
  animate = true 
}) {
  const groupRef = useRef();
  
  // Memoize robot generation - only regenerate when seed/detail/solid changes
  const robotGroup = useMemo(() => {
    return generateRobot(seed, detail, solid);
  }, [seed, detail, solid]);

  // Animation
  useFrame((state, delta) => {
    if (animate && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3;
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime) * 0.1;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <primitive object={robotGroup} />
    </group>
  );
}

// Usage in scene
function Scene() {
  return (
    <Canvas>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} />
      
      <Robot seed="hero-unit" position={[0, 0, 0]} solid />
      <Robot seed="enemy-001" position={[3, 0, 0]} />
      <Robot seed="enemy-002" position={[-3, 0, 0]} />
    </Canvas>
  );
}
```

### Pattern C: React Three Fiber (Imperative with Refs)

```jsx
// For complex scenes with many robots
import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { generateRobot } from '../lib/generators/robogen';

export function RobotArmy({ seeds, detail = 1, solid = false }) {
  const { scene } = useThree();
  const robotsRef = useRef([]);

  useEffect(() => {
    // Clear existing robots
    robotsRef.current.forEach(robot => {
      robot.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      scene.remove(robot);
    });
    robotsRef.current = [];

    // Generate new robots
    seeds.forEach((seed, index) => {
      const robot = generateRobot(seed, detail, solid);
      const cols = Math.ceil(Math.sqrt(seeds.length));
      const x = (index % cols - cols / 2) * 3;
      const z = (Math.floor(index / cols) - cols / 2) * 3;
      robot.position.set(x, 0, z);
      scene.add(robot);
      robotsRef.current.push(robot);
    });

    return () => {
      robotsRef.current.forEach(robot => {
        robot.traverse(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
        scene.remove(robot);
      });
    };
  }, [seeds, detail, solid, scene]);

  return null;
}
```

### Pattern D: ECS Integration (bitECS/miniplex)

```javascript
// systems/robotSpawnSystem.js
import { defineComponent, defineQuery, enterQuery } from 'bitecs';
import { generateRobot } from '../lib/generators/robogen';

// Components
export const RobotSpawn = defineComponent({
  seed: Types.ui32,  // Store seed hash
  detail: Types.ui8,
  solid: Types.ui8
});

export const ThreeMesh = defineComponent({
  meshId: Types.ui32
});

// System
const spawnQuery = defineQuery([RobotSpawn]);
const spawnEnter = enterQuery(spawnQuery);

const meshStore = new Map();
let meshIdCounter = 0;

export function robotSpawnSystem(world, scene) {
  const entered = spawnEnter(world);
  
  for (const eid of entered) {
    const seedHash = RobotSpawn.seed[eid];
    const detail = RobotSpawn.detail[eid];
    const solid = RobotSpawn.solid[eid];
    
    const robot = generateRobot(`eid-${seedHash}`, detail, !!solid);
    const meshId = meshIdCounter++;
    
    meshStore.set(meshId, robot);
    scene.add(robot);
    
    addComponent(world, ThreeMesh, eid);
    ThreeMesh.meshId[eid] = meshId;
  }
  
  return world;
}
```

---

## API Reference

### `createSeededRNG(seed: string): SeededRNG`

Creates a deterministic random number generator.

```javascript
const rng = createSeededRNG('my-seed');

rng.random();        // 0.0 - 1.0
rng.range(5, 10);    // 5.0 - 10.0
rng.int(1, 6);       // 1, 2, 3, 4, 5, or 6
rng.pick(['a','b']); // 'a' or 'b'
rng.chance(0.3);     // true 30% of the time
```

### `getTessellation(detail: number): TessellationConfig`

Returns tessellation parameters for geometry creation.

| Detail | Cylinder Segments | Sphere Segments | Edge Threshold |
|--------|-------------------|-----------------|----------------|
| 1 (LOW) | 8 | 8×6 | 1° |
| 2 (MED) | 12 | 12×9 | 15° |
| 3 (HIGH) | 16 | 16×12 | 25° |

### `generateRobot(seed, detail?, showSolid?): THREE.Group`

Main generation function.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| seed | string | required | Deterministic seed string |
| detail | number | 1 | Tessellation level (1-3) |
| showSolid | boolean | false | Enable solid face rendering |

**Returns**: `THREE.Group` containing all robot meshes

```javascript
// Basic usage
const robot = generateRobot('unit-alpha');

// With options
const detailedRobot = generateRobot('unit-beta', 3, true);

// Access generated structure
robot.traverse(child => {
  console.log(child.type); // 'Group', 'LineSegments', 'Mesh'
});
```

### Part Generator Signatures

All part generators follow this signature:

```javascript
function partGenerator(
  group: THREE.Group,     // Parent group to add meshes to
  ...dimensions,          // Part-specific dimensions
  color: string,          // Hex color string
  rng: SeededRNG,         // Random number generator
  tess: TessellationConfig,
  showSolid: boolean
): void
```

---

## Usage Examples

### Example 1: Squad Generation

```javascript
function generateSquad(squadId, unitCount = 5) {
  const squad = new THREE.Group();
  
  for (let i = 0; i < unitCount; i++) {
    const seed = `${squadId}-unit-${i}`;
    const robot = generateRobot(seed, 2, true);
    
    // Formation: line
    robot.position.set(i * 2 - (unitCount - 1), 0, 0);
    robot.userData.unitId = i;
    
    squad.add(robot);
  }
  
  squad.userData = { squadId, unitCount };
  return squad;
}

// Usage
const alphaSquad = generateSquad('alpha', 5);
scene.add(alphaSquad);
```

### Example 2: Seed-Based Variants

```javascript
// Same base seed with modifiers for variants
function generateRobotVariants(baseSeed) {
  return {
    scout: generateRobot(`${baseSeed}-scout`, 1, false),
    soldier: generateRobot(`${baseSeed}-soldier`, 2, true),
    heavy: generateRobot(`${baseSeed}-heavy`, 3, true),
  };
}
```

### Example 3: Level-of-Detail System

```javascript
class RobotLOD {
  constructor(seed) {
    this.seed = seed;
    this.lodLevels = [
      { distance: 0, detail: 3, solid: true },
      { distance: 20, detail: 2, solid: true },
      { distance: 50, detail: 1, solid: false },
    ];
    this.currentLOD = null;
    this.group = new THREE.Group();
  }

  update(cameraPosition) {
    const distance = this.group.position.distanceTo(cameraPosition);
    
    let targetLOD = this.lodLevels[0];
    for (const lod of this.lodLevels) {
      if (distance >= lod.distance) {
        targetLOD = lod;
      }
    }

    if (this.currentLOD !== targetLOD) {
      // Clear existing
      while (this.group.children.length) {
        const child = this.group.children[0];
        child.traverse(c => {
          if (c.geometry) c.geometry.dispose();
          if (c.material) c.material.dispose();
        });
        this.group.remove(child);
      }

      // Generate new LOD
      const robot = generateRobot(this.seed, targetLOD.detail, targetLOD.solid);
      this.group.add(robot);
      this.currentLOD = targetLOD;
    }
  }
}
```

### Example 4: Networked Multiplayer

```javascript
// Server: Send only seed
socket.emit('spawnRobot', {
  id: 'robot-123',
  seed: 'player-456-robot',
  position: { x: 10, y: 0, z: 5 }
});

// Client: Regenerate identical robot from seed
socket.on('spawnRobot', (data) => {
  const robot = generateRobot(data.seed, 2, true);
  robot.position.set(data.position.x, data.position.y, data.position.z);
  robot.userData.networkId = data.id;
  scene.add(robot);
  networkRobots.set(data.id, robot);
});
```

---

## Customization

### Adding New Part Types

```javascript
// parts/heads.js

// Add to HeadGenerators object
export const HeadGenerators = {
  // ... existing types ...
  
  // NEW: Antenna array head
  antennaArray: (group, size, color, rng, tess, solid) => {
    const et = tess.edgeThreshold;
    
    // Base
    addToGroup(group, createGeo.box(size * 0.8, size * 0.3, size * 0.6, tess), 
      color, [0, 0, 0], [0,0,0], [1,1,1], et, solid);
    
    // Antenna array
    const antennaCount = rng.int(3, 6);
    for (let i = 0; i < antennaCount; i++) {
      const x = (i - (antennaCount - 1) / 2) * (size * 0.2);
      const height = rng.range(size * 0.4, size * 0.8);
      addToGroup(group, createGeo.cylinder(0.02, 0.015, height, tess),
        color, [x, height / 2 + size * 0.15, 0], [0,0,0], [1,1,1], et, solid);
      addToGroup(group, createGeo.sphere(0.04, tess),
        color, [x, height + size * 0.15, 0], [0,0,0], [1,1,1], et, solid);
    }
  },
};
```

### Custom Color Schemes

```javascript
// Override color generation in generateRobot
function generateRobotWithTheme(seed, detail, solid, theme) {
  const rng = createSeededRNG(seed);
  const tess = getTessellation(detail);
  const robot = new THREE.Group();
  
  // Theme-based colors instead of random
  const themes = {
    military: { primary: '#4a5d23', secondary: '#8b9a5b' },
    corporate: { primary: '#2c3e50', secondary: '#3498db' },
    danger: { primary: '#c0392b', secondary: '#e74c3c' },
    stealth: { primary: '#1a1a2e', secondary: '#16213e' },
  };
  
  const { primary, secondary } = themes[theme] || themes.military;
  
  // Use theme colors instead of random HSL
  // ... rest of generation logic with primary/secondary
}
```

### Weighted Part Selection

```javascript
// Custom weighted random selection
function weightedPick(rng, options) {
  const totalWeight = options.reduce((sum, opt) => sum + opt.weight, 0);
  let random = rng.random() * totalWeight;
  
  for (const option of options) {
    random -= option.weight;
    if (random <= 0) return option.value;
  }
  return options[options.length - 1].value;
}

// Usage in generator
const headOptions = [
  { value: 'turret', weight: 3 },   // 3x more likely
  { value: 'dome', weight: 2 },
  { value: 'cube', weight: 1 },
  { value: 'insect', weight: 0.5 }, // Rare
];

const headType = weightedPick(rng, headOptions);
```

---

## Performance Considerations

### Geometry Instancing (Many Identical Robots)

```javascript
// For scenes with many robots sharing the same seed
import { InstancedMesh } from 'three';

function createRobotInstances(seed, count, positions) {
  const template = generateRobot(seed, 1, true);
  const instances = [];
  
  template.traverse(child => {
    if (child.isMesh) {
      const instanced = new InstancedMesh(
        child.geometry,
        child.material,
        count
      );
      
      const matrix = new THREE.Matrix4();
      positions.forEach((pos, i) => {
        matrix.setPosition(pos.x, pos.y, pos.z);
        instanced.setMatrixAt(i, matrix);
      });
      
      instanced.instanceMatrix.needsUpdate = true;
      instances.push(instanced);
    }
  });
  
  return instances;
}
```

### Object Pooling

```javascript
class RobotPool {
  constructor(poolSize = 50) {
    this.available = [];
    this.inUse = new Set();
    
    // Pre-generate pool
    for (let i = 0; i < poolSize; i++) {
      const robot = generateRobot(`pool-${i}`, 1, false);
      robot.visible = false;
      this.available.push(robot);
    }
  }

  acquire(seed, position) {
    let robot = this.available.pop();
    
    if (!robot) {
      // Pool exhausted, create new
      robot = generateRobot(seed, 1, false);
    }
    
    robot.position.copy(position);
    robot.visible = true;
    robot.userData.seed = seed;
    this.inUse.add(robot);
    
    return robot;
  }

  release(robot) {
    robot.visible = false;
    robot.position.set(0, -1000, 0); // Move off-screen
    this.inUse.delete(robot);
    this.available.push(robot);
  }
}
```

### Memory Management

```javascript
// Proper disposal when removing robots
function disposeRobot(robot, scene) {
  scene.remove(robot);
  
  robot.traverse(child => {
    if (child.geometry) {
      child.geometry.dispose();
    }
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach(mat => mat.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
}
```

---

## Troubleshooting

### Issue: Robots appear identical despite different seeds

**Cause**: RNG state not properly isolated between calls.

**Solution**: Ensure each `generateRobot` call creates a fresh RNG instance.

```javascript
// ✓ Correct - new RNG per robot
const robot1 = generateRobot('seed-a');
const robot2 = generateRobot('seed-b');

// ✗ Incorrect - shared RNG
const sharedRng = createSeededRNG('shared');
// Don't pass this to multiple generators
```

### Issue: Missing edges in wireframe mode

**Cause**: Edge threshold too high for geometry.

**Solution**: Lower the edge threshold in tessellation config.

```javascript
const customTess = getTessellation(detail);
customTess.edgeThreshold = 1; // Show all edges
```

### Issue: Z-fighting between solid and wireframe

**Cause**: Wireframe and solid mesh at exact same position.

**Solution**: Apply polygon offset to solid material.

```javascript
// In createSolidMesh function
const material = new THREE.MeshLambertMaterial({
  // ... existing props
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1
});
```

### Issue: Performance drops with many robots

**Solutions**:
1. Reduce tessellation level to 1 (LOW)
2. Disable solid rendering
3. Implement LOD system
4. Use object pooling
5. Consider instancing for identical robots

### Issue: TypeScript type errors

**Solution**: Create declaration file or use type assertions.

```typescript
// robogen.d.ts
declare module 'robogen' {
  export function generateRobot(
    seed: string,
    detail?: number,
    showSolid?: boolean
  ): THREE.Group;
}
```

---

## Changelog

### v1.0.0
- Initial release
- 11 head types, 11 torso types, 9 arm types, 8 leg types
- Wireframe and solid render modes
- 3-level tessellation control
- Seeded deterministic generation

---

## License

MIT License - Free for commercial and non-commercial use.

---

## Contributing

To add new part types:

1. Create generator function following existing signature
2. Add to appropriate `*Generators` object
3. Test with multiple seeds to ensure variation
4. Update part count in documentation
5. Submit PR with examples

---

*Generated for RoboGen Wireframe Robot Generator*
