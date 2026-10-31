#!/usr/bin/env python3
"""Keeps the website's copy of a platform's docs in data/docs/<platform>/, from its latest release.

The release is the one data/releases/<platform>/index.json calls latest: the newest stable
release, or the newest pre-release before there is one. Work on master stays off the site
until it's released, and a guide deleted in a release leaves the site with that release.

    docs_data.py <platform> [<repository>]   clone the release's tag and copy its docs
        <platform> is windows (Gazeora/Gazeora) or android (Gazeora/Gazeora-Android);
        <repository> defaults to the platform's GitHub repository; a local clone works too

data/docs/<platform>/ holds docs/<name>.md, the project files below, and index.json: the
repository and tag, then the guides in sidebar order with their titles, and which project
files the release has.
"""

import json
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

# Guides in each list's order first, then any others by title
PLATFORMS = {
    "windows": {
        "repo": "Gazeora/Gazeora",
        "order": ["getting-started", "streaming", "vr-viewer", "hand-gestures", "game-controller",
                  "command-line", "tools", "installer", "configuration", "troubleshooting",
                  "stream-format", "architecture", "development"],
    },
    "android": {
        "repo": "Gazeora/Gazeora-Android",
        "order": ["user-guide", "permissions", "troubleshooting", "architecture", "development"],
    },
}
DOCS = pathlib.Path("data/docs")
SAFE_TAG = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._+-]{0,99}$")
SAFE_GUIDE = re.compile(r"^[a-z0-9][a-z0-9._-]*\.md$", re.I)
PROJECT_FILES = ["README.md", "CONTRIBUTING.md", "LICENSE", "NOTICE", "COMMERCIAL-LICENSE.md", "CLA.md",
                 "TRADEMARKS.md", "THIRD_PARTY_NOTICES.md"]


def latest_tag(platform):
    releases = pathlib.Path("data/releases") / platform / "index.json"
    if not releases.exists():
        return None
    latest = json.loads(releases.read_text(encoding="utf-8")).get("latest")
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


def sort_key(guide, order):
    key = guide["key"]
    return (order.index(key), "") if key in order else (len(order), guide["title"].lower())


def copy(checkout, platform, tag):
    config = PLATFORMS[platform]
    root = DOCS / platform
    if root.exists():
        shutil.rmtree(root)
    (root / "docs").mkdir(parents=True)
    guides = []
    for path in sorted((checkout / "docs").glob("*.md")):
        if not path.is_file() or not SAFE_GUIDE.match(path.name):
            continue
        shutil.copyfile(path, root / "docs" / path.name)
        key = path.stem
        guides.append({"key": key, "title": title_of(path.read_text(encoding="utf-8"), key), "path": f"docs/{path.name}"})
    project = []
    for name in PROJECT_FILES:
        if (checkout / name).is_file():
            shutil.copyfile(checkout / name, root / name)
            project.append(name)
    guides.sort(key=lambda guide: sort_key(guide, config["order"]))
    index = {"platform": platform, "repo": config["repo"], "tag": tag, "guides": guides, "project": project}
    (root / "index.json").write_text(json.dumps(index, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"docs: {len(guides)} {platform} guides and {len(project)} project files from {tag}")


def main(platform, source):
    tag = latest_tag(platform)
    if not tag:
        print(f"docs: no {platform} release yet, left as they are")
        return
    with tempfile.TemporaryDirectory() as tmp:
        checkout = pathlib.Path(tmp) / "repo"
        subprocess.run(["git", "clone", "--quiet", "--depth", "1", "--branch", tag, "--filter=blob:none",
                        "--no-checkout", source, str(checkout)], check=True)
        subprocess.run(["git", "-C", str(checkout), "sparse-checkout", "set", "--no-cone",
                        "/docs/*.md", *(f"/{name}" for name in PROJECT_FILES)], check=True)
        subprocess.run(["git", "-C", str(checkout), "checkout", "--quiet", tag], check=True)
        copy(checkout, platform, tag)


if __name__ == "__main__":
    if not 2 <= len(sys.argv) <= 3 or sys.argv[1] not in PLATFORMS:
        sys.exit(__doc__)
    name = sys.argv[1]
    main(name, sys.argv[2] if len(sys.argv) == 3 else f"https://github.com/{PLATFORMS[name]['repo']}.git")
