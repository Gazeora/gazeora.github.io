// Lists Gazeora's GitHub releases, newest first, with their MSIs as download buttons.
// Releases are read live from the GitHub API, so publishing one needs no change here.
(function () {
  "use strict";

  const REPO = "Gazeora/Gazeora";
  const API = `https://api.github.com/repos/${REPO}/releases?per_page=50`;
  const RELEASES_PAGE = `https://github.com/${REPO}/releases`;

  const list = document.getElementById("release-list");
  const heroLink = document.getElementById("hero-download");
  const heroLabel = document.getElementById("hero-download-label");
  const heroMeta = document.getElementById("hero-meta");

  const ARCHES = [
    { suffix: "-x64.msi", label: "Windows x64", note: "64-bit games" },
    { suffix: "-x86.msi", label: "Windows x86", note: "32-bit games" },
  ];

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

  function downloadButtons(release, primary) {
    const row = el("div", { class: "downloads" });
    const msis = release.assets.filter((a) => a.name.toLowerCase().endsWith(".msi"));
    for (const arch of ARCHES) {
      const asset = msis.find((a) => a.name.toLowerCase().endsWith(arch.suffix));
      if (!asset) continue;
      row.append(el("a", { class: `btn ${primary ? "btn-primary" : "btn-ghost"} download`, href: asset.browser_download_url }, [
        `${arch.label} `,
        el("small", { text: `· ${arch.note} · ${formatSize(asset.size)}` }),
      ]));
    }
    // Anything else attached (or a release without MSIs yet) is on the release page
    const others = release.assets.length - row.childElementCount;
    if (others > 0 || row.childElementCount === 0) {
      row.append(el("a", { class: "btn btn-ghost", href: release.html_url, text: row.childElementCount ? "Other files" : "View on GitHub" }));
    }
    return row;
  }

  function badges(release, isLatest) {
    const out = [];
    if (isLatest) out.push(el("span", { class: "badge badge-latest", text: "Latest" }));
    if (release.prerelease) out.push(el("span", { class: "badge badge-pre", text: "Pre-release" }));
    return out;
  }

  function title(release) {
    return release.name || release.tag_name;
  }

  function latestCard(release) {
    return el("article", { class: "release latest", id: release.tag_name }, [
      el("div", { class: "release-head" }, [
        el("h3", { text: title(release) }),
        ...badges(release, !release.prerelease),
        el("time", { class: "release-date", datetime: release.published_at, text: formatDate(release.published_at) }),
      ]),
      downloadButtons(release, true),
      renderNotes(release.body),
    ]);
  }

  function olderCard(release) {
    return el("details", { class: "release", id: release.tag_name }, [
      el("summary", {}, [
        el("h3", { text: title(release) }),
        ...badges(release, false),
        el("time", { class: "release-date", datetime: release.published_at, text: formatDate(release.published_at) }),
      ]),
      downloadButtons(release, false),
      renderNotes(release.body),
    ]);
  }

  function showEmpty() {
    list.replaceChildren(el("div", { class: "release-empty" }, [
      el("h3", { text: "The first release is on its way" }),
      el("p", { text: "Watch the repository on GitHub to hear when it's out, or build Gazeora from source today." }),
      el("a", { class: "btn btn-ghost", href: `https://github.com/${REPO}#building`, text: "Build from source" }),
    ]));
    heroLabel.textContent = "Get Gazeora";
    heroLink.href = "#releases";
    heroMeta.textContent = "Releases are coming soon. Build from source on GitHub today.";
  }

  function showError() {
    list.replaceChildren(el("div", { class: "release-empty" }, [
      el("h3", { text: "Couldn't load the releases" }),
      el("p", { text: "GitHub didn't answer just now. They're all on the releases page." }),
      el("a", { class: "btn btn-ghost", href: RELEASES_PAGE, text: "Open GitHub Releases" }),
    ]));
  }

  function show(releases) {
    releases = releases.filter((r) => !r.draft);
    if (releases.length === 0) return showEmpty();

    // The highlighted release is the newest stable one; a newer pre-release is listed below it
    const latest = releases.find((r) => !r.prerelease) || releases[0];
    const rest = releases.filter((r) => r !== latest);
    list.replaceChildren(latestCard(latest), ...rest.map(olderCard));

    const x64 = latest.assets.find((a) => a.name.toLowerCase().endsWith("-x64.msi"));
    heroLink.href = x64 ? x64.browser_download_url : "#releases";
    heroLabel.textContent = `Download ${latest.tag_name} for Windows`;
    heroMeta.innerHTML = "";
    heroMeta.append(
      `x64 installer, released ${formatDate(latest.published_at)}. Need 32-bit games? `,
      el("a", { href: "#releases", text: "Get x86" }),
      "."
    );
  }

  fetch(API, { headers: { Accept: "application/vnd.github+json" } })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`GitHub API ${res.status}`))))
    .then(show)
    .catch((err) => {
      console.error(err);
      showError();
    });
})();
