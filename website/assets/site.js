// StackPad website: points the download buttons at the right file for the
// visitor's system, fills in the latest version from GitHub, and shows what
// to do after the download starts.

(() => {
  // ---- Settings to update for each release ----
  const VERSION = "2.2.0"; // fallback when GitHub can't be reached
  const REPO = "arafatanam/StackPad";
  // Microsoft Store listing (live since 2026-11-13).
  const STORE_URL = "https://apps.microsoft.com/detail/9NBDRFL8LM3D";

  const RELEASES = `https://github.com/${REPO}/releases`;

  const assets = {
    exe: { url: fallbackUrl("exe"), name: `StackPad.v${VERSION}.exe`, size: 0 },
    appimage: { url: fallbackUrl("AppImage"), name: `StackPad.v${VERSION}.AppImage`, size: 0 },
    deb: { url: fallbackUrl("deb"), name: `StackPad.v${VERSION}.deb`, size: 0 },
  };
  let version = VERSION;

  function fallbackUrl(ext) {
    return `${RELEASES}/download/v${VERSION}/StackPad.v${VERSION}.${ext}`;
  }

  // ---- Which system is this? ----

  function detectPlatform() {
    const ua = navigator.userAgent || "";
    const hint = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
    const text = `${hint} ${ua}`;
    if (/android|iphone|ipad|ipod/i.test(text)) return "mobile";
    if (/win/i.test(text)) return "windows";
    if (/mac/i.test(text)) return "mac";
    if (/linux|x11|cros/i.test(text)) return "linux";
    return "unknown";
  }

  const platform = detectPlatform();

  function formatSize(bytes) {
    return bytes ? `${Math.round(bytes / (1024 * 1024))} MB` : "";
  }

  // ---- Rendering ----

  function render() {
    document.querySelectorAll("[data-version]").forEach((el) => {
      el.textContent = version;
    });

    document.querySelectorAll("[data-asset]").forEach((link) => {
      link.href = assets[link.dataset.asset].url;
    });

    const exeMeta = document.querySelector('[data-meta="exe"]');
    if (exeMeta) {
      exeMeta.textContent = [assets.exe.name, formatSize(assets.exe.size)].filter(Boolean).join(" · ");
    }

    let label = "Download StackPad";
    let href = "#download";
    let meta = `Version ${version} · Windows 10 & 11 · Linux`;

    if (platform === "windows") {
      label = "Download for Windows";
      href = assets.exe.url;
      meta = [`Version ${version}`, "Windows 10 & 11", formatSize(assets.exe.size)].filter(Boolean).join(" · ");
    } else if (platform === "linux") {
      label = "Download for Linux";
      href = assets.appimage.url;
      meta = [`Version ${version}`, "AppImage", formatSize(assets.appimage.size)].filter(Boolean).join(" · ");
    } else if (platform === "mac" || platform === "mobile") {
      label = "Get StackPad for your PC";
      meta = `StackPad runs on Windows and Linux. Version ${version}.`;
    }

    document.querySelectorAll("[data-primary-download]").forEach((link) => {
      link.href = href;
      link.dataset.kind = href === "#download" ? "" : platform === "linux" ? "appimage" : "exe";
      link.querySelector("[data-primary-label]").textContent = label;
    });

    const primaryMeta = document.querySelector("[data-primary-meta]");
    if (primaryMeta) primaryMeta.textContent = meta;

    const detectedCard = document.querySelector(`.download-card[data-platform="${platform}"]`);
    if (detectedCard) detectedCard.classList.add("is-detected");
  }

  // ---- Latest release from GitHub ----

  async function loadLatestRelease() {
    const cacheKey = "stackpad-latest-release";
    let release = null;

    try {
      const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
      if (cached && Date.now() - cached.time < 30 * 60 * 1000) release = cached.release;
    } catch (e) {
      // Storage unavailable (private window); just fetch.
    }

    if (!release) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
          headers: { Accept: "application/vnd.github+json" },
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = await response.json();
        release = {
          tag: data.tag_name,
          assets: (data.assets || []).map((a) => ({
            name: a.name,
            url: a.browser_download_url,
            size: a.size,
          })),
        };
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({ time: Date.now(), release }));
        } catch (e) {
          // Not important.
        }
      } catch (e) {
        return; // offline or rate-limited: the fallback links still work
      } finally {
        clearTimeout(timer);
      }
    }

    const find = (pattern) => release.assets.find((a) => pattern.test(a.name));
    const matches = {
      exe: find(/\.exe$/i),
      appimage: find(/\.AppImage$/i),
      deb: find(/\.deb$/i),
    };

    Object.entries(matches).forEach(([key, asset]) => {
      if (asset) assets[key] = { url: asset.url, name: asset.name, size: asset.size };
    });
    if (release.tag) version = release.tag.replace(/^v/, "");
    render();
  }

  // ---- After a download starts ----

  function showNextSteps(kind) {
    const panel = document.querySelector("[data-next-steps]");
    if (!panel || !kind) return;
    panel.querySelectorAll("ol").forEach((list) => {
      list.hidden = !list.hasAttribute(`data-steps-${kind === "exe" ? "windows" : kind}`);
    });
    panel.hidden = false;

    const downloadSection = document.getElementById("download");
    const rect = panel.getBoundingClientRect();
    if (rect.top > window.innerHeight || rect.bottom < 0) {
      downloadSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    panel.focus({ preventScroll: true });
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest("[data-asset], [data-primary-download]");
    if (!link) return;
    const kind = link.dataset.asset || link.dataset.kind;
    if (kind) setTimeout(() => showNextSteps(kind), 400);
  });

  // ---- Tab rail demo (hover on desktop, button everywhere) ----

  const railToggle = document.querySelector("[data-rail-toggle]");
  const rail = document.getElementById("demo-rail");
  if (railToggle && rail) {
    railToggle.addEventListener("click", () => {
      const open = !rail.classList.contains("is-open");
      rail.classList.toggle("is-open", open);
      railToggle.setAttribute("aria-expanded", String(open));
      railToggle.textContent = open ? "Close the rail" : "Open the rail";
    });
  }

  // ---- Store link, signing, footer year ----

  const storeLink = document.querySelector("[data-store-link]");
  if (storeLink && STORE_URL) {
    storeLink.href = STORE_URL;
    storeLink.hidden = false;
  }

  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });

  // "Why?" next to the Windows download opens the matching FAQ answer.
  document.querySelectorAll("[data-open-faq]").forEach((link) => {
    link.addEventListener("click", () => {
      const target = document.querySelector(link.getAttribute("href"));
      if (target && target.tagName === "DETAILS") target.open = true;
    });
  });

  render();
  loadLatestRelease();
  setUpMotion();

  // ---- Motion ----
  // Sections rise into view as you scroll, and the header gains a shadow once
  // the page has scrolled. Skipped entirely for people who prefer less motion.

  function setUpMotion() {
    const header = document.querySelector(".site-header");
    if (header) {
      const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }

    if (!("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const groups = [
      ".section-head",
      ".compare-demo > *",
      ".checklist > li",
      ".features > li",
      ".wide-shot",
      ".table-scroll",
      ".privacy-inner > *",
      ".shortcut-columns > *",
      ".downloads > .download-card",
      ".faq details",
      ".final-inner > *",
    ];

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          el.classList.add("is-in");
          observer.unobserve(el);
          // Hand the element back to its normal styles (so hover effects
          // aren't delayed) once the reveal has finished.
          const done = () => {
            el.removeAttribute("data-reveal");
            el.classList.remove("is-in");
            el.style.removeProperty("--i");
          };
          setTimeout(done, 1400);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );

    groups.forEach((selector) => {
      const counts = new Map();
      document.querySelectorAll(selector).forEach((el) => {
        // Only animate what starts below the fold, so nothing already on
        // screen blinks out and back in.
        if (el.getBoundingClientRect().top < window.innerHeight) return;
        const parent = el.parentElement;
        const i = counts.get(parent) || 0;
        counts.set(parent, i + 1);
        el.style.setProperty("--i", String(Math.min(i, 5)));
        el.setAttribute("data-reveal", "");
        observer.observe(el);
      });
    });
  }
})();
