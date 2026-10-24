// Lists Gazeora's GitHub releases, read live from the GitHub API, so publishing one needs no
// change here. Windows releases come from Gazeora/Gazeora and Android ones from
// Gazeora/Gazeora-Android. The home page shows the latest of each; download.html every version.
(function () {
  "use strict";

  // Each source is one repository's releases, and the files its download buttons look for
  const SOURCES = [
    {
      id: "windows",
      name: "Windows",
      repo: "Gazeora/Gazeora",
      platforms: [
        { suffix: "-x64.msi", label: "Windows x64", note: "64-bit games", kind: "Installer · x64", icon: "pc" },
        { suffix: "-x86.msi", label: "Windows x86", note: "32-bit games", kind: "Installer · x86", icon: "pc" },
      ],
    },
    {
      id: "android",
      name: "Android",
      repo: "Gazeora/Gazeora-Android",
      platforms: [
        { suffix: ".apk", label: "Android", note: "Android 10+", kind: "Android app", icon: "phone" },
      ],
    },
  ];

  const homeList = document.getElementById("release-list");
  const latestSlot = document.getElementById("latest");
  const allList = document.getElementById("all-releases");
  const heroDownloads = document.getElementById("hero-downloads");
  const heroMeta = document.getElementById("hero-meta");

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

  function releasesPage(source) {
    return `https://github.com/${source.repo}/releases`;
  }

  function platformOf(source, asset) {
    const name = asset.name.toLowerCase();
    return source.platforms.find((p) => name.endsWith(p.suffix));
  }

  function title(release) {
    return release.name || release.tag_name;
  }

  function cardId(source, release) {
    return `${source.id}-${release.tag_name}`;
  }

  // The newest stable release, or the newest of all when there's no stable one yet
  function latestOf(source) {
    return source.releases.find((r) => !r.prerelease) || source.releases[0] || null;
  }

  // The release notes are Markdown written on GitHub; sanitized because they become HTML here.
  function renderNotes(markdown) {
    const body = el("div", { class: "release-body" });
    if (!markdown || !markdown.trim()) return body;
    if (window.marked && window.DOMPurify) {
      body.innerHTML = DOMPurify.sanitize(marked.parse(markdown));
      body.querySelectorAll("a").forEach((a) => a.setAttribute("rel", "noopener"));
      // A wide table scrolls in its own box instead of being cut off by the card
      body.querySelectorAll("table").forEach((table) => {
        const box = el("div", { class: "table-scroll" });
        table.replaceWith(box);
        box.append(table);
      });
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

  /* Download buttons */

  // One button per platform, Windows x64 first and filled. Each comes from its own source's
  // latest release; a platform with no file there yet shows as "Coming soon", and one whose
  // releases couldn't be read links to its releases page instead.
  function platformButtons(className, compact) {
    const row = el("div", { class: className });
    let first = true;
    for (const source of SOURCES) {
      const release = latestOf(source);
      for (const platform of source.platforms) {
        const asset = release && release.assets.find((a) => platformOf(source, a) === platform);
        let small, node;
        if (asset) {
          small = compact ? platform.note : `${platform.note} · ${release.tag_name} · ${formatSize(asset.size)}`;
          node = el("a", { class: `btn ${first ? "btn-primary" : "btn-ghost"} download`, href: asset.browser_download_url });
        } else if (source.failed) {
          small = "On GitHub";
          node = el("a", { class: "btn btn-ghost download", href: releasesPage(source) });
        } else {
          small = "Coming soon";
          node = el("span", { class: "btn btn-ghost download is-disabled", "aria-disabled": "true" });
        }
        node.append(icon(platform.icon), el("span", { class: "download-text" }, [
          el("strong", { text: platform.label }),
          el("small", { text: small }),
        ]));
        row.append(node);
        first = false;
      }
    }
    return row;
  }

  // What's new in each platform's latest release, Windows open
  function latestNotes() {
    const out = [];
    for (const source of SOURCES) {
      const release = latestOf(source);
      if (!release) continue;
      const notes = renderNotes(release.body);
      if (!notes.childElementCount) continue;
      const details = el("details", { class: "notes-toggle" }, [
        el("summary", { text: `What's new in ${source.name} ${release.tag_name}` }),
        notes,
      ]);
      if (!out.length) details.open = true;
      out.push(details);
    }
    return out;
  }

  // Which version each platform's buttons download, and when it came out
  function latestMeta() {
    const parts = [];
    for (const source of SOURCES) {
      const release = latestOf(source);
      if (!release) continue;
      parts.push(el("span", {}, [
        el("a", { href: `download.html#${cardId(source, release)}`, text: `${source.name} ${release.tag_name}` }),
        ` · ${formatDate(release.published_at)}`,
      ]));
    }
    return el("div", { class: "release-meta" }, parts);
  }

  function latestCard() {
    return el("article", { class: "release latest" }, [
      el("div", { class: "release-head" }, [el("h3", { text: "Latest release" })]),
      platformButtons("downloads"),
      latestMeta(),
      ...latestNotes(),
    ]);
  }

  /* Every version */

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
  function fileTable(source, release) {
    const rows = release.assets.map((asset) => {
      const platform = platformOf(source, asset);
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
    const archive = `https://github.com/${source.repo}/archive/refs/tags/${encodeURIComponent(release.tag_name)}`;
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

  function versionCard(source, release, isLatest) {
    const id = cardId(source, release);
    const notes = renderNotes(release.body);
    const card = el("article", { class: `release version${isLatest ? " latest" : ""}`, id }, [
      el("div", { class: "release-head" }, [
        el("h3", {}, [el("a", { class: "anchor", href: `#${id}`, text: title(release) })]),
        ...badges(release, isLatest),
        dateOf(release),
      ]),
      fileTable(source, release),
    ]);
    if (notes.childElementCount) {
      card.append(el("details", { class: "notes-toggle" }, [el("summary", { text: "Release notes" }), notes]));
    }
    card.dataset.kind = release.prerelease ? "pre" : "stable";
    return card;
  }

  function versionPanel(source) {
    const panel = el("div", { class: "release-list", id: `panel-${source.id}`, role: "tabpanel", "aria-labelledby": `tab-${source.id}` });
    if (source.failed) {
      panel.append(el("div", { class: "release-empty" }, [
        el("h3", { text: `Couldn't load the ${source.name} releases` }),
        el("p", { text: "GitHub didn't answer just now. They're all on the releases page." }),
        el("a", { class: "btn btn-ghost", href: releasesPage(source), text: "Open GitHub Releases" }),
      ]));
    } else if (!source.releases.length) {
      panel.append(el("div", { class: "release-loading", text: `No ${source.name} versions yet.` }));
    } else {
      const latest = latestOf(source);
      panel.append(...source.releases.map((r) => versionCard(source, r, r === latest && !r.prerelease)));
    }
    return panel;
  }

  function selectTab(id) {
    for (const source of SOURCES) {
      const selected = source.id === id;
      document.getElementById(`tab-${source.id}`).setAttribute("aria-selected", String(selected));
      document.getElementById(`panel-${source.id}`).hidden = !selected;
    }
  }

  function renderVersions() {
    const tabs = el("div", { class: "tabs", role: "tablist", "aria-label": "Platform" }, SOURCES.map((source) => {
      const count = source.releases.length;
      const tab = el("button", { type: "button", class: "tab", role: "tab", id: `tab-${source.id}`, "aria-controls": `panel-${source.id}` }, [
        source.name,
        ...(count ? [el("span", { class: "tab-count", text: String(count) })] : []),
      ]);
      tab.addEventListener("click", () => selectTab(source.id));
      return tab;
    }));
    allList.replaceChildren(tabs, ...SOURCES.map(versionPanel));

    // A #windows-v1.2.3 link opens its platform's tab; the cards didn't exist when the browser
    // looked for the link's target
    const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    const panel = target && target.closest('[role="tabpanel"]');
    selectTab(panel ? panel.id.replace("panel-", "") : SOURCES[0].id);
    if (target) target.scrollIntoView({ behavior: "instant" });
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

  /* Page */

  function show() {
    const anyRelease = SOURCES.some((s) => s.releases.length);
    const allFailed = SOURCES.every((s) => s.failed);

    let card;
    if (allFailed) {
      card = el("div", { class: "release-empty" }, [
        el("h3", { text: "Couldn't load the releases" }),
        el("p", { text: "GitHub didn't answer just now. They're all on the releases page." }),
        el("a", { class: "btn btn-ghost", href: releasesPage(SOURCES[0]), text: "Open GitHub Releases" }),
      ]);
    } else if (!anyRelease && !SOURCES.some((s) => s.failed)) {
      card = el("div", { class: "release-empty" }, [
        el("h3", { text: "The first release is on its way" }),
        el("p", { text: "The downloads appear here as soon as it's out." }),
        platformButtons("downloads downloads-center"),
      ]);
    } else {
      card = latestCard();
    }
    const slot = homeList || latestSlot;
    if (slot) slot.replaceChildren(card);

    if (allList) {
      renderVersions();
      setupFilters();
    }

    if (heroDownloads) {
      heroDownloads.replaceChildren(...platformButtons("cta", true).children);
      const versions = SOURCES.map((s) => latestOf(s) && `${s.name} ${latestOf(s).tag_name}`).filter(Boolean);
      heroMeta.replaceChildren(
        versions.length ? `${versions.join(" · ")}. ` : "The first release is coming soon. ",
        ...(versions.length ? [el("a", { href: "download.html", text: "All versions" })] : [])
      );
    }
  }

  // A repository that isn't public yet (or has no releases) answers 404: no versions, not an error
  function load(source) {
    return fetch(`https://api.github.com/repos/${source.repo}/releases?per_page=100`, { headers: { Accept: "application/vnd.github+json" } })
      .then((res) => {
        if (res.status === 404) return [];
        return res.ok ? res.json() : Promise.reject(new Error(`${source.repo}: GitHub API ${res.status}`));
      })
      .then((releases) => {
        source.releases = releases.filter((r) => !r.draft);
        source.failed = false;
      })
      .catch((err) => {
        console.error(err);
        source.releases = [];
        source.failed = true;
      });
  }

  if (!homeList && !latestSlot && !allList) return;

  Promise.all(SOURCES.map(load)).then(show);
})();
