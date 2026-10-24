// Lists Gazeora's GitHub releases, read live from the GitHub API, so publishing one needs no
// change here. The home page shows the latest one; download.html shows every version and file.
(function () {
  "use strict";

  const REPO = "Gazeora/Gazeora";
  const API = `https://api.github.com/repos/${REPO}/releases?per_page=100`;
  const RELEASES_PAGE = `https://github.com/${REPO}/releases`;

  const homeList = document.getElementById("release-list");
  const latestSlot = document.getElementById("latest");
  const allList = document.getElementById("all-releases");
  const heroDownloads = document.getElementById("hero-downloads");
  const heroMeta = document.getElementById("hero-meta");

  // What each download button looks for among a release's files. The APK is attached to the
  // same release as the MSIs.
  const PLATFORMS = [
    { suffix: "-x64.msi", label: "Windows x64", note: "64-bit games", kind: "Installer · x64", icon: "pc" },
    { suffix: "-x86.msi", label: "Windows x86", note: "32-bit games", kind: "Installer · x86", icon: "pc" },
    { suffix: ".apk", label: "Android", note: "Android 10+", kind: "Android app", icon: "phone" },
  ];

  const ICONS = {
    pc: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
  };

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (key === "text") node.textContent = value;
      else node.setAttribute(key, value);
    }
    for (const child of children || []) node.append(child);
    return node;
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  }

  function formatSize(bytes) {
    return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
  }

  function platformOf(asset) {
    const name = asset.name.toLowerCase();
    return PLATFORMS.find((p) => name.endsWith(p.suffix));
  }

  function title(release) {
    return release.name || release.tag_name;
  }

  // The release notes are Markdown written on GitHub; sanitized because they become HTML here.
  function renderNotes(markdown) {
    const body = el("div", { class: "release-body" });
    if (!markdown || !markdown.trim()) return body;
    if (window.marked && window.DOMPurify) {
      body.innerHTML = DOMPurify.sanitize(marked.parse(markdown));
      body.querySelectorAll("a").forEach((a) => a.setAttribute("rel", "noopener"));
    } else {
      body.append(el("p", { text: markdown }));
    }
    return body;
  }

  function badges(release, isLatest) {
    const out = [];
    if (isLatest) out.push(el("span", { class: "badge badge-latest", text: "Latest" }));
    if (release.prerelease) out.push(el("span", { class: "badge badge-pre", text: "Pre-release" }));
    return out;
  }

  function dateOf(release) {
    return el("time", { class: "release-date", datetime: release.published_at, text: formatDate(release.published_at) });
  }

  function icon(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = ICONS[name];
    return svg;
  }

  // One button per platform, Windows x64 first and filled. A platform the release has no file
  // for (or every platform, before the first release) shows as "Coming soon".
  function platformButtons(release, className, compact) {
    const row = el("div", { class: className });
    PLATFORMS.forEach((platform, i) => {
      const asset = release && release.assets.find((a) => platformOf(a) === platform);
      const style = i === 0 && asset ? "btn-primary" : "btn-ghost";
      const label = el("span", { class: "download-text" }, [
        el("strong", { text: platform.label }),
        el("small", { text: !asset ? "Coming soon" : compact ? platform.note : `${platform.note} · ${formatSize(asset.size)}` }),
      ]);
      row.append(asset
        ? el("a", { class: `btn ${style} download`, href: asset.browser_download_url }, [icon(platform.icon), label])
        : el("span", { class: "btn btn-ghost download is-disabled", "aria-disabled": "true" }, [icon(platform.icon), label]));
    });
    return row;
  }

  function latestCard(release, isLatest) {
    return el("article", { class: "release latest" }, [
      el("div", { class: "release-head" }, [el("h3", { text: title(release) }), ...badges(release, isLatest), dateOf(release)]),
      platformButtons(release, "downloads"),
      renderNotes(release.body),
    ]);
  }

  function copyButton(text) {
    const button = el("button", { type: "button", class: "copy", title: "Copy SHA-256", text: "Copy" });
    button.addEventListener("click", () => {
      navigator.clipboard.writeText(text).then(() => {
        button.textContent = "Copied";
        setTimeout(() => (button.textContent = "Copy"), 1500);
      });
    });
    return button;
  }

  // One row per file: attached assets first, then the source archives GitHub makes for every tag
  function fileTable(release) {
    const rows = release.assets.map((asset) => {
      const platform = platformOf(asset);
      const kind = platform ? platform.kind : asset.name.split(".").pop().toUpperCase();
      const sha = asset.digest && asset.digest.startsWith("sha256:") ? asset.digest.slice(7) : "";
      return el("div", { class: "file" }, [
        el("a", { class: "file-name", href: asset.browser_download_url, text: asset.name }),
        el("span", { class: "file-kind", text: kind }),
        el("span", { class: "file-size", text: formatSize(asset.size) }),
        el("span", { class: "file-count", text: `${asset.download_count.toLocaleString()} downloads` }),
        sha
          ? el("span", { class: "file-sha" }, [el("code", { title: sha, text: `${sha.slice(0, 12)}…` }), copyButton(sha)])
          : el("span", { class: "file-sha" }),
      ]);
    });
    const archive = `https://github.com/${REPO}/archive/refs/tags/${encodeURIComponent(release.tag_name)}`;
    for (const ext of ["zip", "tar.gz"]) {
      rows.push(el("div", { class: "file file-source" }, [
        el("a", { class: "file-name", href: `${archive}.${ext}`, text: `Source code (${ext})` }),
        el("span", { class: "file-kind", text: "Source" }),
        el("span", { class: "file-size" }),
        el("span", { class: "file-count" }),
        el("span", { class: "file-sha" }),
      ]));
    }
    return el("div", { class: "files" }, rows);
  }

  function versionCard(release, isLatest) {
    const notes = renderNotes(release.body);
    const card = el("article", { class: `release version${isLatest ? " latest" : ""}`, id: release.tag_name }, [
      el("div", { class: "release-head" }, [
        el("h3", {}, [el("a", { class: "anchor", href: `#${release.tag_name}`, text: title(release) })]),
        ...badges(release, isLatest),
        dateOf(release),
      ]),
      fileTable(release),
    ]);
    if (notes.childElementCount) {
      card.append(el("details", { class: "notes-toggle" }, [el("summary", { text: "Release notes" }), notes]));
    }
    card.dataset.kind = release.prerelease ? "pre" : "stable";
    return card;
  }

  function showEmpty() {
    const empty = () => el("div", { class: "release-empty" }, [
      el("h3", { text: "The first release is on its way" }),
      el("p", { text: "The downloads appear here as soon as it's out." }),
      platformButtons(null, "downloads downloads-center"),
    ]);
    for (const slot of [homeList, latestSlot]) slot && slot.replaceChildren(empty());
    if (allList) allList.replaceChildren(el("div", { class: "release-loading", text: "No versions yet." }));
    if (heroDownloads) {
      heroDownloads.replaceChildren(...platformButtons(null, "cta", true).children);
      heroMeta.textContent = "The first release is coming soon.";
    }
  }

  function showError() {
    const error = () => el("div", { class: "release-empty" }, [
      el("h3", { text: "Couldn't load the releases" }),
      el("p", { text: "GitHub didn't answer just now. They're all on the releases page." }),
      el("a", { class: "btn btn-ghost", href: RELEASES_PAGE, text: "Open GitHub Releases" }),
    ]);
    for (const slot of [homeList, latestSlot, allList]) slot && slot.replaceChildren(error());
  }

  function setupFilters() {
    const chips = document.querySelectorAll(".chip[data-filter]");
    chips.forEach((chip) => chip.addEventListener("click", () => {
      chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
      const filter = chip.dataset.filter;
      allList.querySelectorAll(".version").forEach((card) => {
        card.hidden = filter !== "all" && card.dataset.kind !== filter;
      });
    }));
  }

  function show(releases) {
    releases = releases.filter((r) => !r.draft);
    if (releases.length === 0) return showEmpty();

    // The highlighted release is the newest stable one; a newer pre-release is listed below it
    const latest = releases.find((r) => !r.prerelease) || releases[0];
    const isStable = !latest.prerelease;

    for (const slot of [homeList, latestSlot]) slot && slot.replaceChildren(latestCard(latest, isStable));

    if (allList) {
      allList.replaceChildren(...releases.map((r) => versionCard(r, r === latest && isStable)));
      setupFilters();
      // The cards didn't exist when the browser looked for a #v1.2.3 link's target
      const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) target.scrollIntoView();
    }

    if (heroDownloads) {
      heroDownloads.replaceChildren(...platformButtons(latest, "cta", true).children);
      heroMeta.replaceChildren(
        `${latest.tag_name}, released ${formatDate(latest.published_at)}. `,
        el("a", { href: "download.html", text: "All versions" })
      );
    }
  }

  if (!homeList && !latestSlot && !allList) return;

  fetch(API, { headers: { Accept: "application/vnd.github+json" } })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`GitHub API ${res.status}`))))
    .then(show)
    .catch((err) => {
      console.error(err);
      showError();
    });
})();
