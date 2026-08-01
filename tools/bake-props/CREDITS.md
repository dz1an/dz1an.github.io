# Third-party 3D assets

All source models here are **CC0 1.0 (public domain)** by **Kenney** — <https://kenney.nl>.
CC0 imposes no requirement to credit; the site credits Kenney anyway (creative-mode HUD).

| Pack | Models used | Baked into |
| --- | --- | --- |
| [Survival Kit](https://kenney.nl/assets/survival-kit) | `tent-canvas`, `campfire-pit`, `tree-log` | `models/props.js` |
| [Mini Forest](https://kenney.nl/assets/mini-forest) | `tree`, `tree-high`, `rocks-low`, `rocks-high`, `stones`, `plant`, `patch-grass` | `models/forest.js` |
| [Starter Kit: Basic Scene](https://github.com/KenneyNL/Starter-Kit-Basic-Scene) | `trophy` (the award cairn) | `models/forest.js` |

The `.glb` files and `colormap*.png` atlases in this directory are the unmodified
originals. The bakers (`bake.js`, `bake-forest.js`) sample each model's atlas per
vertex, remap those colors to the //dzian palette, and emit the runtime data files.
Rerun either baker to regenerate its output deterministically:

```
node tools/bake-props/bake.js         # -> models/props.js
node tools/bake-props/bake-forest.js  # -> models/forest.js
```

`models/pine.glb` (used by main.html's hero) is Kenney's `tree_pineRoundC` from the
[Nature Kit](https://kenney.nl/assets/nature-kit), recolored in-file.
