# gazeora.github.io

The website for [Gazeora](https://github.com/Gazeora/Gazeora), served by GitHub Pages at
<https://gazeora.github.io>.

Plain HTML, CSS and JavaScript, with no build step. The Pages workflow
(`.github/workflows/pages.yml`) publishes the site with both repositories' release lists in
`data/releases/`, refreshed every 15 minutes and on every push, so a published release appears
here by itself and visitors never call the GitHub API, which allows each network only 60
requests an hour. If a list is missing or more than 6 hours old, the page asks the API itself.
The releases come from:

- Windows: [Gazeora/Gazeora](https://github.com/Gazeora/Gazeora/releases), its `-x64.msi` and
  `-x86.msi` files.
- Android: Gazeora/Gazeora-Android, its `.apk` file. The repository has to be public for this:
  GitHub hides a private repository's releases from visitors, and the site then shows the
  Android button as "Coming soon".

Each page:

- `index.html` shows a download button per platform, each from its repository's latest stable
  release, with the release notes.
- `download.html` shows the same, then every release of each repository in a Windows and an
  Android tab, with all the files attached to each, their sizes, download counts and SHA-256
  checksums, and the source archives. `download.html#windows-v1.0.0` and
  `download.html#android-v1.0.0` link to one version.
- `docs.html?doc=<name>` shows Gazeora's guides (`docs/<name>.md`), README, CONTRIBUTING,
  LICENSE, NOTICE, TRADEMARKS and THIRD_PARTY_NOTICES, fetched from the `master` branch each time
  the page opens. Links between them stay on the site, and a new file in `docs/` gets a sidebar
  entry by itself. LICENSE and NOTICE are plain text and are reflowed into paragraphs.

To preview locally:

```sh
python -m http.server 8000
```

Locally there's no `data/releases/`, so the page reads the releases from the GitHub API.

Colors follow the launcher's theme (`apps/gazeora/src/ui/theme.h` in the Gazeora repository).
The logo and icon are copied from `apps/gazeora/resources`.

Copyright (C) 2026 Nithin Aashik. The Gazeora name and logo are covered by
[TRADEMARKS.md](https://github.com/Gazeora/Gazeora/blob/master/TRADEMARKS.md).
