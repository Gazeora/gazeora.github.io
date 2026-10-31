# gazeora.github.io

The website for [Gazeora](https://github.com/Gazeora/Gazeora), served by GitHub Pages at
<https://gazeora.github.io>.

Plain HTML, CSS and JavaScript, with no build step. Visitors never call the GitHub API: the
releases come from files in `data/releases/`, which change only when a release does.

## How releases get here

1. A release is published, edited or deleted in
   [Gazeora/Gazeora](https://github.com/Gazeora/Gazeora/releases) (Windows) or
   [Gazeora/Gazeora-Android](https://github.com/Gazeora/Gazeora-Android/releases) (Android).
2. That repository's workflow runs the action in this repository,
   [`.github/actions/publish-release`](.github/actions/publish-release/action.yml). It reads the
   release back from GitHub, files and all, and sends it here as a `repository_dispatch` event.
3. The [Pages workflow](.github/workflows/pages.yml) saves it with
   [`release_data.py`](.github/scripts/release_data.py), commits `data/releases/`, and deploys.

Each platform's folder holds `index.json` (totals, the latest release, and which page holds each
tag) and `page-1.json`, `page-2.json` and so on, 10 releases each, newest first, so no file grows
with the number of releases. The download page loads one page at a time.

The source repositories need a secret named `GAZEORA_SITE_TOKEN`: a fine-grained token for the
Gazeora organization with access to this repository only and **Contents: Read and write**, which
is what sending a `repository_dispatch` event needs. To fill the lists from scratch (for releases
made before this was set up):

```sh
gh api --paginate --slurp "repos/Gazeora/Gazeora/releases?per_page=100" > windows.json
python .github/scripts/release_data.py import windows windows.json
```

Each page:

- `index.html` shows a download button per platform, each from its repository's latest stable
  release, with the release notes.
- `download.html` shows the same, then every release of each repository in a Windows and an
  Android tab, with all the files attached to each, their sizes, download counts and SHA-256
  checksums, and the source archives. `download.html#windows-v1.0.0` and
  `download.html#android-v1.0.0` link to one version.
- `docs.html?doc=<name>` shows Gazeora's guides (`docs/<name>.md`), README, CONTRIBUTING,
  LICENSE, NOTICE, TRADEMARKS and THIRD_PARTY_NOTICES as they are in the latest Windows release
  (the newest stable one, or the newest pre-release before there is one). Links between them
  stay on the site. LICENSE and NOTICE are plain text and are reflowed into paragraphs.

## How the docs get here

When a Windows release arrives, the Pages workflow also runs
[`docs_data.py`](.github/scripts/docs_data.py). It clones Gazeora/Gazeora at the latest release's
tag and replaces `data/docs/` with that tag's docs and an `index.json` listing them, which is
committed with the release lists. So work on `master` reaches the site only once it's released,
and a guide added or deleted in a release appears or disappears with it. The sidebar order is the
`ORDER` list in that script; guides it doesn't name follow, by title. To refresh by hand:

```sh
python .github/scripts/docs_data.py
```

To preview locally:

```sh
python -m http.server 8000
```

Locally there's no `data/releases/`, so the page reads the releases from the GitHub API. Without
`data/docs/`, the docs page reads `master` instead.

Colors follow the launcher's theme (`apps/gazeora/src/ui/theme.h` in the Gazeora repository).
The logo and icon are copied from `apps/gazeora/resources`.

Copyright (C) 2026 Nithin Aashik. The Gazeora name and logo are covered by
[TRADEMARKS.md](https://github.com/Gazeora/Gazeora/blob/master/TRADEMARKS.md).
