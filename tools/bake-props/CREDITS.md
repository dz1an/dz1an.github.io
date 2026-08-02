# Third-party 3D assets

Two licences are in play here. **Read the CC-BY section before removing any credit
line from the site** — those are obligations, not courtesies.

## CC0 1.0 (public domain) — Kenney, <https://kenney.nl>

CC0 imposes no requirement to credit; the site credits Kenney anyway (creative-mode HUD).

| Pack | Models used | Baked into |
| --- | --- | --- |
| [Survival Kit](https://kenney.nl/assets/survival-kit) | `tent-canvas`, `campfire-pit`, `tree-log` | `models/props.js` |
| [Mini Forest](https://kenney.nl/assets/mini-forest) | `tree`, `tree-high`, `rocks-low`, `rocks-high`, `stones`, `plant`, `patch-grass` | `models/forest.js` |
| [Starter Kit: Basic Scene](https://github.com/KenneyNL/Starter-Kit-Basic-Scene) | `trophy` (the award cairn) | `models/forest.js` |

## CC BY 4.0 — attribution REQUIRED wherever these ship

| Model | Author | Baked into | Credited at |
| --- | --- | --- | --- |
| [camping buscraft ambience](https://sketchfab.com/3d-models/camping-buscraft-ambience-7b65e4df95c3492fbf4e0641e3b472c1) | Edgar_koh | `models/camp.js` + `models/camp-scene.glb` | index.html creative-mode credit line, main.html footer |
| [Forest Scene](https://sketchfab.com/3d-models/forest-scene-e5eb4867faba465d99deda487c56fbd6) | Dries Deryckere | `models/forest-scene.glb` | main.html footer credit line |

## CC BY-NC 4.0 — NOT shipped

[Forest House](https://sketchfab.com/3d-models/forest-house-52429e4ef7bf4deda1309364a2cda86f)
by peachyroyalty is **NonCommercial**. `forest_house.glb` and the `models/house.js`
bake exist in the repo but are wired into nothing. A portfolio that sells services
is arguably a commercial use, so this must not be put on a page without either
switching to a differently-licensed model or clearing the terms with the author.

## Baking

The `.glb` files and `colormap*.png` atlases in this directory are the unmodified
originals. The bakers sample each model's atlas per vertex, remap those colors to
the //dzian palette, and emit the runtime data files. Rerun any baker to regenerate
its output deterministically:

```
node tools/bake-props/bake.js                    # -> models/props.js
node tools/bake-props/bake-forest.js             # -> models/forest.js
node tools/bake-props/bake-camp.js               # -> models/camp.js
node tools/bake-props/prep-forest-scene-tex.js   # -> forest-scene-tex/ (gitignored)
node tools/bake-props/bake-forest-scene.js       # -> models/forest-scene.glb
node tools/bake-props/bake-camp-scene.js         # -> models/camp-scene.glb
```

`bake-forest-scene.js` is the odd one out: main.html renders through `<model-viewer>`,
so it emits a **GLB** (vertex-coloured, no textures) rather than a `window.DZ_*` data
file. It needs PNGs, and its source ships JPEG atlases, so run the `prep-` step first —
that extracts the embedded images and re-encodes them via Windows System.Drawing.

`models/pine.glb` is Kenney's `tree_pineRoundC` from the
[Nature Kit](https://kenney.nl/assets/nature-kit), recolored in-file. It is no longer
main.html's hero (the Forest Scene diorama replaced it) but is still used elsewhere.
