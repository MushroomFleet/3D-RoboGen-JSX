# 3D-RoboGen-JSX

Procedural 3D wireframe robot mesh generator built as a JSX component for React Three Fiber and Three.js. Generate over 43,000 unique deterministic robot models from a simple seed string, with modular body parts including heads, torsos, arms, legs, and locomotion systems.

## Features

- **Seed-Based Deterministic Generation** -- same seed always produces the same robot, ideal for multiplayer sync
- **43,560+ Unique Combinations** -- 11 head types, 11 torso types, 9 arm types, 8 leg types, and 5 locomotion modes
- **Dual Render Modes** -- wireframe-only or solid+wireframe (SVGA style)
- **Adjustable Tessellation** -- three detail levels (LOW / MED / HIGH) for LOD control
- **Framework Flexible** -- works with vanilla Three.js or React Three Fiber (R3F)
- **Zero External Assets** -- all geometry is procedurally generated at runtime

## Usage

```jsx
import { generateRobot } from './robogen';

// Generate a robot from a seed string
const robot = generateRobot('my-unique-seed', 2, true);
// Parameters: seed, detail level (1-3), show solid faces (boolean)

scene.add(robot);
```

### React Three Fiber

```jsx
function Robot({ seed }) {
  const group = useMemo(() => generateRobot(seed, 2, true), [seed]);
  return <primitive object={group} />;
}
```

## Part Types

| Category    | Count | Examples                                              |
|-------------|-------|-------------------------------------------------------|
| Heads       | 11    | cube, dome, visor, pyramid, turret, cyclops, monitor  |
| Torsos      | 11    | box, hex, tapered, barrel, stealth, cage, plated      |
| Arms        | 9     | standard, hydraulic, tentacle, claw, blade, cannon    |
| Legs        | 8     | standard, digitigrade, spider, piston, stilts         |
| Locomotion  | 5     | bipedal, tracked, wheeled, hover, ball                |

## Requirements

- Three.js r128+ (r150+ recommended)
- React 16.8+ and @react-three/fiber 8.x (for R3F usage)

## Files

- `Wireframerobotdemo.jsx` -- main generator component
- `demo.html` -- standalone browser demo
- `RoboGen-integration.md` -- detailed integration guide with patterns for vanilla Three.js, R3F, ECS, and multiplayer

## Support This Project

If you find this useful, please consider starring the repository.

[![Star on GitHub](https://img.shields.io/github/stars/MushroomFleet/3D-RoboGen-JSX?style=social)](https://github.com/MushroomFleet/3D-RoboGen-JSX)
