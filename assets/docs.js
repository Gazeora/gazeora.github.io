// Shows Gazeora's Markdown docs, LICENSE and NOTICE inside the site. They're the latest
// release's, copied into data/docs/ when it's published (see .github/scripts/docs_data.py), so
// work on master shows here only once it's released. Locally, with no data/docs/, they're
// fetched from master instead.
(function () {
  "use strict";

  const REPO = "Gazeora/Gazeora";
  const SNAPSHOT = "data/docs/";

  // Where the files come from: the release's copy on this site, or master on GitHub
  let ref = "master";
  let files = `https://raw.githubusercontent.com/${REPO}/master/`;
  let released = false;
  const raw = () => `https://raw.githubusercontent.com/${REPO}/${ref}/`;
  const blob = () => `https://github.com/${REPO}/blob/${ref}/`;
  const tree = () => `https://github.com/${REPO}/tree/${ref}/`;

  // The sidebar. Guides are docs/<key>.md, listed by data/docs/index.json in order.
  const PROJECT = [
    { key: "readme", title: "Overview", path: "README.md" },
    { key: "contributing", title: "Contributing", path: "CONTRIBUTING.md" },
    { key: "license", title: "License (GPL v3)", path: "LICENSE", plain: true },
    { key: "notice", title: "Notice", path: "NOTICE", plain: true },
    { key: "trademarks", title: "Name and logo", path: "TRADEMARKS.md" },
    { key: "third-party", title: "Third-party notices", path: "THIRD_PARTY_NOTICES.md" },
  ];
  const SECTIONS = [
    { title: "Guides", pages: [] },
    { title: "Project", pages: PROJECT.slice() },
  ];
  const DEFAULT_KEY = "readme";

  const docEl = document.getElementById("doc");
  const navEl = document.getElementById("docs-nav");
  const tocEl = document.getElementById("toc");
  const footEl = document.getElementById("doc-foot");
  const sourceEl = document.getElementById("doc-source");
  const menuEl = document.getElementById("docs-menu");
  const menuCurrent = document.getElementById("docs-menu-current");
  const versionEl = document.getElementById("doc-version");

  let current = null;
  let tocObserver = null;
  const cache = new Map();

  function allPages() {
    return SECTIONS.flatMap((s) => s.pages);
  }

  function pageByKey(key) {
    const known = allPages().find((p) => p.key === key);
    if (known || released) return known || null;  // a release's copy has every page it shows
    // Any other docs/<name>.md, such as one linked from a guide before the sidebar knows it
    if (/^[a-z0-9][a-z0-9._-]*$/i.test(key)) return { key, title: titleFromKey(key), path: `docs/${key}.md` };
    return null;
  }

  function pageByPath(path) {
    const known = allPages().find((p) => p.path.toLowerCase() === path.toLowerCase());
    if (known) return known;
    const m = /^docs\/([^/]+)\.md$/i.exec(path);
    return m ? pageByKey(m[1]) : null;
  }

  function titleFromKey(key) {
    const words = key.replace(/[-_]+/g, " ").trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
  }

  function docHref(page, hash) {
    return `docs.html?doc=${encodeURIComponent(page.key)}${hash ? `#${hash}` : ""}`;
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (key === "text") node.textContent = value;
      else node.setAttribute(key, value);
    }
    for (const child of children || []) node.append(child);
    return node;
  }

  /* Sidebar */

  function renderNav() {
    navEl.replaceChildren(...SECTIONS.map((section) => el("div", { class: "docs-nav-group" }, [
      el("p", { class: "docs-nav-title", text: section.title }),
      el("ul", {}, section.pages.map((page) => el("li", {}, [
        el("a", { href: docHref(page), "data-key": page.key, text: page.title }),
      ]))),
    ])));
  }

  function markActive(page) {
    navEl.querySelectorAll("a").forEach((a) => {
      if (a.dataset.key === page.key) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    menuCurrent.textContent = page.title;
  }

  // The latest release's copy of the docs, from data/docs/index.json
  function useRelease(index) {
    released = true;
    ref = index.tag;
    files = SNAPSHOT;
    SECTIONS[0].pages = index.guides.map((g) => ({ key: g.key, title: g.title, path: g.path }));
    SECTIONS[1].pages = PROJECT.filter((p) => index.project.includes(p.path));
    versionEl.replaceChildren("Shown from ", el("a", {
      href: `https://github.com/${REPO}/releases/tag/${encodeURIComponent(index.tag)}`, text: `Gazeora ${index.tag}`,
    }), ", the latest release.");
  }

  // Without a release's copy (a local preview), lists docs/ on master. The API allows 60
  // requests an hour per visitor.
  function listMasterGuides() {
    return fetch(`https://api.github.com/repos/${REPO}/contents/docs?ref=master`, { headers: { Accept: "application/vnd.github+json" } })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`GitHub API ${res.status}`))))
      .then((list) => {
        SECTIONS[0].pages = list
          .filter((file) => file.type === "file" && /\.md$/i.test(file.name))
          .map((file) => {
            const key = file.name.replace(/\.md$/i, "");
            return { key, title: titleFromKey(key), path: file.path };
          });
      })
      .catch((err) => console.error(err));
  }

  /* Rendering */

  // GitHub's heading ids (github-slugger), so links like streaming.md#usb-setup land the same here
  function slugger() {
    const seen = new Map();
    return (text) => {
      const base = text.trim().toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, "").replace(/ /g, "-");
      const count = seen.get(base) || 0;
      seen.set(base, count + 1);
      return count ? `${base}-${count}` : base;
    };
  }

  // Resolves a link in the file at fromPath the way GitHub does, then keeps it on this site
  // when it points at a page the site shows
  function rewriteLink(href, fromPath) {
    if (!href || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) return null;  // absolute: leave
    if (href.startsWith("#")) return href;
    const url = new URL(href, `https://repo.invalid/${fromPath}`);
    const path = decodeURIComponent(url.pathname.slice(1));
    const hash = url.hash.slice(1);
    if (path === fromPath) return hash ? `#${hash}` : docHref(pageByPath(path));
    const page = pageByPath(path);
    if (page) return docHref(page, hash);
    return (path.endsWith("/") || !/\.[^/]+$/.test(path) ? tree() : blob()) + path + url.hash;
  }

  function rewriteImage(src, fromPath) {
    if (!src || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(src)) return null;
    return raw() + new URL(src, `https://repo.invalid/${fromPath}`).pathname.slice(1);
  }

  // > [!NOTE] blocks, as GitHub draws them
  function renderAlerts(root) {
    root.querySelectorAll("blockquote").forEach((quote) => {
      const first = quote.firstElementChild;
      const m = first && /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i.exec(first.innerHTML);
      if (!m) return;
      const kind = m[1].toLowerCase();
      first.innerHTML = first.innerHTML.slice(m[0].length);
      if (!first.textContent.trim() && !first.children.length) first.remove();
      quote.classList.add("alert", `alert-${kind}`);
      quote.prepend(el("p", { class: "alert-title", text: kind.charAt(0).toUpperCase() + kind.slice(1) }));
    });
  }

  function copyButton(getText) {
    const button = el("button", { type: "button", class: "copy code-copy", text: "Copy" });
    button.addEventListener("click", () => {
      navigator.clipboard.writeText(getText()).then(() => {
        button.textContent = "Copied";
        setTimeout(() => (button.textContent = "Copy"), 1500);
      });
    });
    return button;
  }

  function enhance(root, page) {
    const slug = slugger();
    root.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((h) => {
      h.id = slug(h.textContent);
      h.append(el("a", { class: "heading-anchor", href: `#${h.id}`, "aria-label": `Link to ${h.textContent}`, text: "#" }));
    });
    root.querySelectorAll("a[href]").forEach((a) => {
      if (a.classList.contains("heading-anchor")) return;
      const href = rewriteLink(a.getAttribute("href"), page.path);
      if (href) a.setAttribute("href", href);
      if (/^https?:/i.test(a.getAttribute("href"))) a.setAttribute("rel", "noopener");
    });
    root.querySelectorAll("img[src]").forEach((img) => {
      const src = rewriteImage(img.getAttribute("src"), page.path);
      if (src) img.setAttribute("src", src);
      img.setAttribute("loading", "lazy");
    });
    // Wide tables and code scroll inside their own box, never the page
    root.querySelectorAll("table").forEach((table) => {
      const box = el("div", { class: "table-scroll" });
      table.replaceWith(box);
      box.append(table);
    });
    root.querySelectorAll("pre").forEach((pre) => {
      const box = el("div", { class: "code-box" });
      pre.replaceWith(box);
      box.append(pre, copyButton(() => pre.textContent));
    });
    root.querySelectorAll('input[type="checkbox"]').forEach((box) => box.setAttribute("disabled", ""));
    renderAlerts(root);
  }

  function renderMarkdown(text, page) {
    const body = el("div", { class: "md-body" });
    body.innerHTML = DOMPurify.sanitize(marked.parse(text, { gfm: true }));
    enhance(body, page);
    return body;
  }

  /* Plain text (LICENSE, NOTICE) */

  const LIST_MARKER = /^(?:\d{1,2}|[a-z])[.)]\s/;

  function indentOf(line) {
    return line.length - line.trimStart().length;
  }

  // Text with its URLs as links
  function linkified(text) {
    const parts = text.split(/(https?:\/\/[^\s<>()]+[^\s<>().,;:])/g);
    return parts.map((part, i) => (i % 2 ? el("a", { href: part, rel: "noopener", text: part }) : document.createTextNode(part)));
  }

  // Splits a hard-wrapped block into paragraphs and list items. An item starts at a list marker
  // ("1.", "a)"), or where the text steps back out of a list item; other lines continue the item.
  function segments(lines) {
    const out = [];
    let inList = false;
    for (const line of lines) {
      const trimmed = line.trim();
      const last = out[out.length - 1];
      const marker = LIST_MARKER.test(trimmed);
      const dedent = last && inList && indentOf(line) < last.lastIndent - 1;
      if (!last || marker || dedent) {
        out.push({ first: indentOf(line), cont: null, lastIndent: indentOf(line), marker, words: [trimmed] });
        inList = inList || marker;
      } else {
        if (last.cont === null) last.cont = indentOf(line);
        last.lastIndent = indentOf(line);
        last.words.push(trimmed);
      }
    }
    return out;
  }

  // Hard-wrapped text drawn as the site's own paragraphs and headings, so it reads well at any
  // width: centered and capitalized lines become headings, "0. Definitions." lines subheadings,
  // and blocks indented throughout (sample notices) stay preformatted.
  function renderPlainBlocks(text, body) {
    const blocks = text.replace(/\r\n/g, "\n").split(/\n[ \t]*\n/).map((b) => b.replace(/\s+$/, "")).filter((b) => b.trim());
    blocks.forEach((block, index) => {
      const lines = block.split("\n").filter((l) => l.trim());
      const single = lines.length === 1;
      const trimmed = lines[0].trim();
      const centered = lines.every((l) => indentOf(l) >= 8);
      if (centered && (!single || index === 0)) {
        body.append(el("p", { class: "plain-center" }, lines.flatMap((l, i) => [...(i ? [el("br")] : []), ...linkified(l.trim())])));
      } else if (single && (centered || /^[A-Z][A-Z ]{3,}\b/.test(trimmed)) && trimmed.length < 90 && !/[.:]$/.test(trimmed)) {
        body.append(el("h2", {}, linkified(trimmed)));
      } else if (single && /^\d{1,2}\.\s+\S.{0,60}\.$/.test(trimmed) && !/\.\s+\S/.test(trimmed.replace(/^\d+\.\s+/, ""))) {
        body.append(el("h3", { text: trimmed }));
      } else if (lines.every((l) => indentOf(l) >= 4) && !LIST_MARKER.test(trimmed)) {
        const shift = Math.min(...lines.map(indentOf));
        body.append(el("pre", {}, [el("code", { text: lines.map((l) => l.slice(shift)).join("\n") })]));
      } else if (lines.every((l) => l.trim().length < 45)) {
        body.append(el("p", {}, lines.flatMap((l, i) => [...(i ? [el("br")] : []), ...linkified(l.trim())])));
      } else {
        for (const seg of segments(lines)) {
          const indent = seg.marker || seg.cont === null ? (seg.marker || seg.first >= 3 ? seg.first : 0) : seg.cont;
          const p = el("p", { class: seg.marker ? "plain-item" : "" }, linkified(seg.words.join(" ")));
          if (indent >= 3) p.style.paddingLeft = `${indent * 0.5}em`;
          body.append(p);
        }
      }
    });
  }

  function renderPlain(text, page) {
    const body = el("div", { class: "md-body plain-body" }, [el("h1", { text: page.title })]);
    renderPlainBlocks(text, body);
    enhance(body, page);
    return body;
  }

  function renderToc(body) {
    if (tocObserver) tocObserver.disconnect();
    const headings = [...body.querySelectorAll("h2, h3")];
    if (headings.length < 2) {
      tocEl.replaceChildren();
      return;
    }
    const links = new Map();
    const list = el("ul", {}, headings.map((h) => {
      const label = h.cloneNode(true);
      label.querySelector(".heading-anchor")?.remove();
      const a = el("a", { href: `#${h.id}`, text: label.textContent.trim() });
      links.set(h, a);
      return el("li", { class: h.tagName === "H3" ? "toc-sub" : "" }, [a]);
    }));
    tocEl.replaceChildren(el("p", { class: "docs-nav-title", text: "On this page" }), list);

    // Highlights the section being read
    tocObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        links.forEach((a) => a.removeAttribute("aria-current"));
        links.get(entry.target).setAttribute("aria-current", "true");
      }
    }, { rootMargin: "-80px 0px -70% 0px" });
    headings.forEach((h) => tocObserver.observe(h));
  }

  function showError(page) {
    docEl.replaceChildren(el("div", { class: "release-empty" }, [
      el("h3", { text: "Couldn't load this page" }),
      el("p", { text: "GitHub didn't answer just now, or the page has moved." }),
      el("a", { class: "btn btn-ghost", href: blob() + page.path, text: "Open it on GitHub" }),
    ]));
    tocEl.replaceChildren();
    footEl.hidden = true;
  }

  function fetchText(page) {
    if (cache.has(page.path)) return Promise.resolve(cache.get(page.path));
    // no-cache: always ask whether the file changed, so a new release's docs show up
    return fetch(files + page.path, { cache: "no-cache" })
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(`${page.path}: ${res.status}`))))
      .then((text) => {
        cache.set(page.path, text);
        return text;
      });
  }

  function scrollToHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    const target = id && document.getElementById(id);
    // Instant, not the page's smooth scrolling: the article was just swapped in
    if (target) target.scrollIntoView({ behavior: "instant" });
    else window.scrollTo({ top: 0, behavior: "instant" });
  }

  function load(page) {
    current = page;
    markActive(page);
    sourceEl.href = blob() + page.path;
    return fetchText(page)
      .then((text) => {
        if (current !== page) return;  // another page was picked meanwhile
        const body = page.plain ? renderPlain(text, page) : renderMarkdown(text, page);
        docEl.replaceChildren(body);
        const h1 = body.querySelector("h1");
        const heading = h1 && h1.cloneNode(true);
        heading?.querySelector(".heading-anchor")?.remove();
        document.title = `${heading ? heading.textContent.trim() : page.title} · Gazeora docs`;
        renderToc(body);
        footEl.hidden = false;
        scrollToHash();
      })
      .catch((err) => {
        console.error(err);
        if (current === page) showError(page);
      });
  }

  function pageFromLocation() {
    const key = new URLSearchParams(location.search).get("doc") || DEFAULT_KEY;
    return pageByKey(key) || pageByKey(DEFAULT_KEY);
  }

  // Moving between docs swaps the article in place instead of reloading the page
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const a = event.target.closest("a[href]");
    if (!a) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !url.pathname.endsWith("/docs.html") || !url.searchParams.has("doc")) return;
    const page = pageByKey(url.searchParams.get("doc"));
    if (!page) return;
    event.preventDefault();
    if (phone.matches) menuEl.open = false;
    if (current && page.key === current.key) {
      history.pushState(null, "", url);
      scrollToHash();
      return;
    }
    history.pushState(null, "", url);
    load(page);
  });

  window.addEventListener("popstate", () => {
    const page = pageFromLocation();
    if (current && page.key === current.key) scrollToHash();
    else load(page);
  });

  // The menu is always open as the desktop sidebar, and starts closed on phones
  const phone = window.matchMedia("(max-width: 860px)");
  menuEl.open = !phone.matches;
  phone.addEventListener("change", () => (menuEl.open = !phone.matches));

  fetch(SNAPSHOT + "index.json", { cache: "no-cache" })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`${SNAPSHOT}index.json: ${res.status}`))))
    .then(useRelease, () => listMasterGuides())
    .then(() => {
      renderNav();
      load(pageFromLocation());
    });
})();
