# gazeora.github.io

The website for [Gazeora](https://github.com/Gazeora/Gazeora), served by GitHub Pages at
<https://gazeora.github.io>.

Plain HTML, CSS and JavaScript, with no build step. Both pages read
[Gazeora's releases](https://github.com/Gazeora/Gazeora/releases) from the GitHub API when they
load, so a published release appears here by itself:

- `index.html` shows the latest stable release, with its `-x64.msi` and `-x86.msi` files as
  download buttons and its notes rendered from Markdown.
- `download.html` shows every release, newest first, with all the files attached to each, their
  sizes, download counts and SHA-256 checksums, and the source archives. `download.html#v1.0.0`
  links to one version.
- `docs.html?doc=<name>` shows Gazeora's guides (`docs/<name>.md`), README, CONTRIBUTING,
  LICENSE, NOTICE, TRADEMARKS and THIRD_PARTY_NOTICES, fetched from the `master` branch each time
  the page opens. Links between them stay on the site, and a new file in `docs/` gets a sidebar
  entry by itself. LICENSE and NOTICE are plain text and are reflowed into paragraphs.

To preview locally:

```sh
python -m http.server 8000
```

Colors follow the launcher's theme (`apps/gazeora/src/ui/theme.h` in the Gazeora repository).
The logo and icon are copied from `apps/gazeora/resources`.

Copyright (C) 2026 Nithin Aashik. The Gazeora name and logo are covered by
[TRADEMARKS.md](https://github.com/Gazeora/Gazeora/blob/master/TRADEMARKS.md).
