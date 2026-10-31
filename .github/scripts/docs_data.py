#!/usr/bin/env python3
"""Keeps the website's copy of Gazeora's docs in data/docs/, taken from the latest release.

The release is the one data/releases/windows/index.json calls latest: the newest stable
release, or the newest pre-release before there is one. Work on master stays off the site
until it's released, and a guide deleted in a release leaves the site with that release.

    docs_data.py [<repository>]   clone the release's tag and copy its docs into data/docs/
        <repository> defaults to https://github.com/Gazeora/Gazeora.git; a local clone works too

data/docs/ holds docs/<name>.md, the project files below, and index.json: the tag, then the
guides in sidebar order with their titles, and which project files the release has.
"""

import json
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

REPO = "Gazeora/Gazeora"
SOURCE = f"https://github.com/{REPO}.git"
RELEASES = pathlib.Path("data/releases/windows/index.json")
ROOT = pathlib.Path("data/docs")
SAFE_TAG = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._+-]{0,99}$")
SAFE_GUIDE = re.compile(r"^[a-z0-9][a-z0-9._-]*\.md$", re.I)
PROJECT_FILES = ["README.md", "CONTRIBUTING.md", "LICENSE", "NOTICE", "COMMERCIAL-LICENSE.md", "CLA.md",
                 "TRADEMARKS.md", "THIRD_PARTY_NOTICES.md"]
# Guides in this order first, then any others by title
ORDER = ["streaming", "vr-viewer", "hand-gestures", "game-controller", "command-line", "tools",
         "installer", "configuration", "stream-format", "development"]


def latest_tag():
    if not RELEASES.exists():
        return None
    latest = json.loads(RELEASES.read_text(encoding="utf-8")).get("latest")
    tag = latest and latest.get("tag_name")
    if tag and not SAFE_TAG.match(tag):
        sys.exit(f"::error::unusable tag {tag!r}")
    return tag


def title_of(text, key):
    for line in text.splitlines():
        m = re.match(r"^#\s+(.+?)\s*#*\s*$", line)
        if m:
            return m.group(1)
    words = re.sub(r"[-_]+", " ", key).strip()
    return words[:1].upper() + words[1:]


def sort_key(guide):
    key = guide["key"]
    return (ORDER.index(key), "") if key in ORDER else (len(ORDER), guide["title"].lower())


def copy(checkout, tag):
    if ROOT.exists():
        shutil.rmtree(ROOT)
    (ROOT / "docs").mkdir(parents=True)
    guides = []
    for path in sorted((checkout / "docs").glob("*.md")):
        if not path.is_file() or not SAFE_GUIDE.match(path.name):
            continue
        shutil.copyfile(path, ROOT / "docs" / path.name)
        key = path.stem
        guides.append({"key": key, "title": title_of(path.read_text(encoding="utf-8"), key), "path": f"docs/{path.name}"})
    project = []
    for name in PROJECT_FILES:
        if (checkout / name).is_file():
            shutil.copyfile(checkout / name, ROOT / name)
            project.append(name)
    index = {"repo": REPO, "tag": tag, "guides": sorted(guides, key=sort_key), "project": project}
    (ROOT / "index.json").write_text(json.dumps(index, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"docs: {len(guides)} guides and {len(project)} project files from {tag}")


def main(source):
    tag = latest_tag()
    if not tag:
        print("docs: no release yet, left as they are")
        return
    with tempfile.TemporaryDirectory() as tmp:
        checkout = pathlib.Path(tmp) / "gazeora"
        subprocess.run(["git", "clone", "--quiet", "--depth", "1", "--branch", tag, "--filter=blob:none",
                        "--no-checkout", source, str(checkout)], check=True)
        subprocess.run(["git", "-C", str(checkout), "sparse-checkout", "set", "--no-cone",
                        "/docs/*.md", *(f"/{name}" for name in PROJECT_FILES)], check=True)
        subprocess.run(["git", "-C", str(checkout), "checkout", "--quiet", tag], check=True)
        copy(checkout, tag)


if __name__ == "__main__":
    if len(sys.argv) > 2:
        sys.exit(__doc__)
    main(sys.argv[1] if len(sys.argv) == 2 else SOURCE)
