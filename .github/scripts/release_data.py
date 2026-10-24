#!/usr/bin/env python3
"""Keeps the website's release lists in data/releases/<platform>/.

Each platform has index.json (totals, the latest release, which page holds each tag) and
page-1.json, page-2.json, ... with PAGE_SIZE releases each, newest first, so no single file
grows with the number of releases.

    release_data.py dispatch <payload.json>   apply a repository_dispatch payload
    release_data.py import <platform> <releases.json>   replace a platform's list (backfill):
        gh api --paginate --slurp "repos/Gazeora/Gazeora/releases?per_page=100" > releases.json
"""

import json
import pathlib
import re
import sys
from datetime import datetime, timezone

PLATFORMS = {"windows": "Gazeora/Gazeora", "android": "Gazeora/Gazeora-Android"}
PAGE_SIZE = 10
MAX_BODY = 30000
ROOT = pathlib.Path("data/releases")
SAFE_TAG = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._+-]{0,99}$")


class BadRelease(ValueError):
    pass


def text(value, field, limit=None):
    if value is None:
        return ""
    if not isinstance(value, str):
        raise BadRelease(f"{field} must be text")
    return value[:limit] if limit else value


def https_url(value, prefix, field):
    value = text(value, field)
    if not value.startswith(prefix):
        raise BadRelease(f"{field} must start with {prefix}")
    return value


def clean(release, repo):
    """Only the fields the site shows, checked: the payload comes from another repository."""
    if not isinstance(release, dict):
        raise BadRelease("release must be an object")
    tag = text(release.get("tag_name"), "tag_name")
    if not SAFE_TAG.match(tag):
        raise BadRelease(f"unusable tag {tag!r}")
    published = text(release.get("published_at"), "published_at")
    datetime.fromisoformat(published.replace("Z", "+00:00"))  # raises on a bad date
    assets = []
    for asset in release.get("assets") or []:
        size = asset.get("size")
        if not isinstance(size, int) or size < 0:
            raise BadRelease("asset size must be a whole number")
        digest = asset.get("digest")
        assets.append({
            "name": text(asset.get("name"), "asset name", 255),
            "size": size,
            "browser_download_url": https_url(
                asset.get("browser_download_url"), f"https://github.com/{repo}/releases/download/", "asset url"),
            "digest": digest if isinstance(digest, str) and re.match(r"^sha256:[0-9a-f]{64}$", digest) else None,
        })
    return {
        "tag_name": tag,
        "name": text(release.get("name"), "name", 200) or tag,
        "prerelease": bool(release.get("prerelease")),
        "published_at": published,
        "html_url": https_url(release.get("html_url"), f"https://github.com/{repo}/releases/", "html_url"),
        "body": text(release.get("body"), "body", MAX_BODY),
        "assets": assets,
    }


class ReleaseList:
    """One platform's releases, read from and written back to its paginated files."""

    def __init__(self, platform):
        if platform not in PLATFORMS:
            raise BadRelease(f"unknown platform {platform!r}")
        self.platform = platform
        self.repo = PLATFORMS[platform]
        self.folder = ROOT / platform
        self.releases = {}
        for page in sorted(self.folder.glob("page-*.json")):
            for release in json.loads(page.read_text(encoding="utf-8"))["releases"]:
                self.releases[release["tag_name"]] = release

    def upsert(self, release):
        release = clean(release, self.repo)
        self.releases[release["tag_name"]] = release

    def delete(self, tag):
        self.releases.pop(text(tag, "tag"), None)

    def replace(self, releases):
        self.releases = {}
        for release in releases:
            if not release.get("draft"):
                self.upsert(release)

    def save(self):
        ordered = sorted(self.releases.values(), key=lambda r: r["published_at"], reverse=True)
        pages = [ordered[i:i + PAGE_SIZE] for i in range(0, len(ordered), PAGE_SIZE)]
        self.folder.mkdir(parents=True, exist_ok=True)
        for old in self.folder.glob("page-*.json"):
            old.unlink()
        page_of = {}
        for number, releases in enumerate(pages, start=1):
            self._write(f"page-{number}.json", {"page": number, "pages": len(pages), "releases": releases})
            page_of.update({r["tag_name"]: number for r in releases})
        stable = [r for r in ordered if not r["prerelease"]]
        self._write("index.json", {
            "platform": self.platform,
            "repo": self.repo,
            "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "total": len(ordered),
            "stable": len(stable),
            "page_size": PAGE_SIZE,
            "pages": len(pages),
            # The newest stable release, or the newest of all before there is one
            "latest": (stable or ordered or [None])[0],
            "page_of": page_of,
        })

    def _write(self, name, data):
        (self.folder / name).write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


def dispatch(payload_path):
    payload = json.loads(pathlib.Path(payload_path).read_text(encoding="utf-8"))
    releases = ReleaseList(payload.get("platform"))
    if payload.get("repo") != releases.repo:
        raise BadRelease(f"{payload.get('repo')!r} doesn't publish {releases.platform} releases")
    action = payload.get("action")
    if action == "upsert":
        releases.upsert(payload.get("release"))
        print(f"{releases.platform}: saved {payload['release']['tag_name']}")
    elif action == "deleted":
        releases.delete(payload.get("tag"))
        print(f"{releases.platform}: removed {payload.get('tag')}")
    else:
        raise BadRelease(f"unknown action {action!r}")
    releases.save()


def import_all(platform, path):
    """Takes the API's release list, or the pages of it from `gh api --paginate --slurp`."""
    data = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    if data and all(isinstance(page, list) for page in data):
        data = [release for page in data for release in page]
    releases = ReleaseList(platform)
    releases.replace(data)
    releases.save()
    print(f"{platform}: {len(releases.releases)} releases")


if __name__ == "__main__":
    try:
        if sys.argv[1:2] == ["dispatch"] and len(sys.argv) == 3:
            dispatch(sys.argv[2])
        elif sys.argv[1:2] == ["import"] and len(sys.argv) == 4:
            import_all(sys.argv[2], sys.argv[3])
        else:
            sys.exit(__doc__)
    except BadRelease as err:
        sys.exit(f"::error::{err}")
