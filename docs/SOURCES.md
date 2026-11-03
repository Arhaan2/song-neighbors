# Primary Sources

Checked November 2, 2026. Links ground platform capabilities and source constraints; the architecture, phase sequence, ranking heuristic, and scope targets are engineering recommendations.

1. GitHub Pages overview: <https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages>. Static website hosting and repository project URLs.
2. Vite static deployment: <https://vite.dev/guide/static-deploy.html#github-pages>. Correct repository base path, local production preview, and Pages Actions configuration.
3. GitHub custom Pages workflows: <https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages>. Build/deploy artifact flow, environment, and deployment permissions. Resolve current supported Action versions during implementation.
4. GitHub Pages limits: <https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits>. Use this for current hosting limits; this project is scoped as a public personal/research demo.
5. LAION music CLAP model card: <https://huggingface.co/laion/larger_clap_music>. Music checkpoint, feature extraction, CPU/GPU examples, and checkpoint license metadata. Pin an actual immutable revision during implementation.
6. LAION CLAP repository: <https://github.com/LAION-AI/CLAP>. Original implementation and checkpoint documentation.
7. FMA official dataset repository: <https://github.com/mdeff/fma>. Source archives, published checksums, individual audio licensing, and separate metadata/code licensing. Download accessibility and allowlisted counts remain implementation checks.
8. Scikit-learn nearest neighbors: <https://scikit-learn.org/stable/modules/neighbors.html>. General unsupervised neighbor-retrieval reference; the browser engine can implement a small exact scan directly.

No claim is made that this packet has run model inference, evaluated personal musical preferences, verified a new repository, or deployed a website.

## Phase 0 implementation references (checked November 3, 2026)

- [React from scratch](https://react.dev/learn/build-a-react-app-from-scratch): official Vite React/TypeScript setup.
- [Vite getting started](https://vite.dev/guide/): current `create-vite` template and runtime requirements.
- [Vite project deployment base](https://vite.dev/guide/static-deploy.html#github-pages): repository subpath asset configuration; deployment deferred.
- [Vitest](https://vitest.dev/guide/): current Vite and Node compatibility.
- [Oxlint](https://oxc.rs/docs/guide/usage/linter.html): template's dedicated JS/TS lint tool.
- [TypeScript strict checking](https://www.typescriptlang.org/docs/handbook/2/basic-types.html): explicit strict compilation.
- [uv projects](https://docs.astral.sh/uv/guides/projects/): isolated environment and committed lockfile.
- [actions/checkout](https://github.com/actions/checkout), [actions/setup-node](https://github.com/actions/setup-node), [astral-sh/setup-uv](https://github.com/astral-sh/setup-uv): official CI actions, pinned to resolved immutable commits.

Dependency versions come from the current official template and package registry, then are fixed by `package-lock.json` and `tools/catalog/uv.lock`; none are inferred from this planning pack's age.
