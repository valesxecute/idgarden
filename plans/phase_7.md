# Phase 7: 3D garden

Goal: the garden centerpiece becomes a real 3D scene (feedback: "middle should be more 3D").

## Options
| Option | Pros | Cons |
|---|---|---|
| Three.js (low-poly, orthographic/isometric camera) | real depth, orbit, lighting | bundle size, mobile performance, more code |
| CSS 3D / isometric SVG | light, matches the current code | limited, fake depth |
| Pre-made low-poly assets (glTF) | cute quickly | licensing, asset pipeline |

## Needs from the user
- Reference images / mood (cozy low-poly? isometric diorama? Animal Crossing-like?)
- Must it work on low-end phones? → fallback to the 2D SVG

Keep `Garden.render(state)` as the contract so the 2D version stays the fallback.
