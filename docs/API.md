# API reference

## Core

`createCalculator(config)` returns synchronous/asynchronous calculation, batch,
comparison and sensitivity methods. Results contain score, grade, breakdown,
human explanation and warnings.

## Dataset tools

`rank`, `top`, `statistics`, `normalizeDataset`, `simulateWeights` and
`scoreStream` operate on explicit datasets only.

## Extensions

Import `defineExtension` and `installExtension` from `lou-nutriscore/sdk`.
Extensions expose only a named preset and optional public `ScorePlugin` list.

## UI and browser use

`createScoreViewModel(result)` from `lou-nutriscore/ui` is framework-neutral.
The ESM build can be imported directly in modern browsers:

```html
<script type="module">
  import { createCalculator } from "https://unpkg.com/lou-nutriscore@0.5.0/dist/index.js";
</script>
```

The Lou layer remains separate at `dist/lou.js` and is an unofficial fan/parody
presentation only.
