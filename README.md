# gazeora.github.io

The website for [Gazeora](https://github.com/Gazeora/Gazeora), served by GitHub Pages at
<https://gazeora.github.io>.

Plain HTML, CSS and JavaScript, with no build step. The **Releases** section reads
[Gazeora's releases](https://github.com/Gazeora/Gazeora/releases) from the GitHub API when the
page loads, so a published release appears here by itself, with its `-x64.msi` and `-x86.msi`
files as download buttons and its notes rendered from Markdown.

To preview locally:

```sh
python -m http.server 8000
```

Colors follow the launcher's theme (`apps/gazeora/src/ui/theme.h` in the Gazeora repository).
The logo and icon are copied from `apps/gazeora/resources`.

Copyright (C) 2026 Nithin Aashik. The Gazeora name and logo are covered by
[TRADEMARKS.md](https://github.com/Gazeora/Gazeora/blob/master/TRADEMARKS.md).
