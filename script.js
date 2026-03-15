(() => {
  "use strict";

  const STORAGE_KEYS = {
    favorites: "aiTools:favorites",
    recent: "aiTools:recentViewed",
    theme: "aiTools:theme"
  };

  const state = {
    allTools: Array.isArray(window.tools) ? window.tools : [],
    filtered: [],
    listLimit: 24,
    page: document.body.dataset.page,
    favorites: loadNumberArray(STORAGE_KEYS.favorites),
    recent: loadNumberArray(STORAGE_KEYS.recent),
    theme: localStorage.getItem(STORAGE_KEYS.theme) || "light"
  };

  const $ = (sel, root = document) => root.querySelector(sel);

  function loadNumberArray(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(parsed) ? parsed.filter(Number.isFinite) : [];
    } catch {
      return [];
    }
  }

  function saveNumberArray(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  const escapeHtml = (value) => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const debounce = (fn, delay = 250) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  };

  function getHostname(link) {
    try {
      return new URL(link).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }

  function getLogoUrl(link, size = 128) {
    const host = getHostname(link);
    if (!host) return "";
    return `https://logo.clearbit.com/${host}?size=${size}`;
  }

  function getLogoFallbackUrl(link, size = 128) {
    const host = getHostname(link);
    if (!host) return "";
    return `https://www.google.com/s2/favicons?domain=${host}&sz=${size}`;
  }

  function routePath(page) {
    const hasHtmlInPath = location.pathname.endsWith(".html") || location.pathname === "/" || location.pathname === "";
    return hasHtmlInPath ? `${page}.html` : page;
  }

  function detailHref(id) {
    return `${routePath("detailed")}?id=${id}`;
  }

  function listHref(query = "") {
    return `${routePath("list")}${query}`;
  }

  function homeHref() {
    return routePath("index");
  }

  function categoryHref(category) {
    return `${routePath("category")}?name=${encodeURIComponent(category)}`;
  }

  function isFavorite(toolId) {
    return state.favorites.includes(toolId);
  }

  function toggleFavorite(toolId) {
    if (isFavorite(toolId)) {
      state.favorites = state.favorites.filter((id) => id !== toolId);
    } else {
      state.favorites = [toolId, ...state.favorites];
    }
    saveNumberArray(STORAGE_KEYS.favorites, state.favorites);
  }

  function markRecent(toolId) {
    state.recent = [toolId, ...state.recent.filter((id) => id !== toolId)].slice(0, 8);
    saveNumberArray(STORAGE_KEYS.recent, state.recent);
  }


  function applyTheme(theme) {
    state.theme = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", state.theme);
    localStorage.setItem(STORAGE_KEYS.theme, state.theme);

    const themeToggle = $("#themeToggle");
    if (themeToggle) {
      themeToggle.textContent = state.theme === "dark" ? "☀️" : "🌙";
      themeToggle.setAttribute("aria-label", state.theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
    }
  }

  function initTheme() {
    applyTheme(state.theme);
    const themeToggle = $("#themeToggle");
    if (themeToggle) {
      themeToggle.addEventListener("click", () => {
        applyTheme(state.theme === "dark" ? "light" : "dark");
      });
    }
  }

  function initGlobalUi() {
    const year = $("#year");
    if (year) year.textContent = new Date().getFullYear();

    const menuBtn = $("#menuToggle");
    const nav = $("#mainNav");
    if (menuBtn && nav) {
      menuBtn.addEventListener("click", () => {
        const open = nav.classList.toggle("open");
        menuBtn.setAttribute("aria-expanded", String(open));
      });
    }

    const progress = $("#scrollProgress");
    if (progress) {
      document.addEventListener("scroll", () => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const ratio = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
        progress.style.width = `${ratio}%`;
      }, { passive: true });
    }
  }

  function createCard(tool) {
    const logo = escapeHtml(getLogoUrl(tool.link, 96));
    const fallback = escapeHtml(getLogoFallbackUrl(tool.link, 96));
    const favoriteState = isFavorite(tool.id);

    return `
      <article class="tool-card">
        <div class="tool-card-top">
          <img class="tool-logo" src="${logo}" alt="${escapeHtml(tool.title)} logo" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="if(!this.dataset.fb){this.dataset.fb='1';this.src='${fallback}';}else{this.style.display='none';}">
          <div class="tool-card-meta">
            <a class="badge badge-link" href="${categoryHref(tool.category)}">${escapeHtml(tool.category)}</a>
            <button class="fav-btn ${favoriteState ? "is-active" : ""}" data-fav-id="${tool.id}" aria-label="Toggle favorite for ${escapeHtml(tool.title)}" title="Toggle favorite">★</button>
          </div>
        </div>
        <h3>${escapeHtml(tool.title)}</h3>
        <p class="description-2">${escapeHtml(tool.description)}</p>
        <div class="card-actions">
          <a class="btn btn-secondary" href="${detailHref(tool.id)}">View Details</a>
        </div>
      </article>
    `;
  }

  function bindFavoriteButtons(root, onChange) {
    root.querySelectorAll("[data-fav-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.getAttribute("data-fav-id"));
        if (!id) return;
        toggleFavorite(id);
        onChange();
      });
    });
  }

  function getCategoryMap() {
    return state.allTools.reduce((acc, tool) => {
      acc[tool.category] = (acc[tool.category] || 0) + 1;
      return acc;
    }, {});
  }

  function initIndexPage() {
    $("#totalTools").textContent = state.allTools.length.toLocaleString();

    const categoryMap = getCategoryMap();
    const categories = Object.keys(categoryMap).sort((a, b) => categoryMap[b] - categoryMap[a]);
    $("#totalCategories").textContent = categories.length;

    $("#trendingGrid").innerHTML = state.allTools.slice(0, 6).map(createCard).join("");

    const recentGrid = $("#recentGrid");
    if (recentGrid) {
      const recentTools = state.recent
        .map((id) => state.allTools.find((t) => t.id === id))
        .filter(Boolean)
        .slice(0, 6);
      recentGrid.innerHTML = recentTools.length
        ? recentTools.map(createCard).join("")
        : "<p class='muted'>No recent tools yet. Open a tool detail page to build your recent list.</p>";
      bindFavoriteButtons(recentGrid, initIndexPage);
    }

    const statsHtml = categories.map((category) => `
      <a class="category-pill category-link" href="${categoryHref(category)}">
        <span>${escapeHtml(category)}</span>
        <strong>${categoryMap[category]}</strong>
      </a>
    `).join("");
    $("#categoryStats").innerHTML = statsHtml;

    bindFavoriteButtons($("#trendingGrid"), initIndexPage);
  }

  function initListPage() {
    const searchInput = $("#searchInput");
    const categoryFilter = $("#categoryFilter");
    const sortFilter = $("#sortFilter");
    const favoritesOnly = $("#favoritesOnly");
    const toolsGrid = $("#toolsGrid");
    const emptyState = $("#emptyState");
    const resultsCount = $("#resultsCount");
    const listSentinel = $("#listSentinel");
    const infiniteLoader = $("#infiniteLoader");

    const categories = [...new Set(state.allTools.map((t) => t.category))].sort((a, b) => a.localeCompare(b));
    categoryFilter.innerHTML += categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");

    function sortTools(items, mode) {
      const sorted = [...items];
      if (mode === "title-desc") sorted.sort((a, b) => b.title.localeCompare(a.title));
      else if (mode === "id-asc") sorted.sort((a, b) => a.id - b.id);
      else if (mode === "id-desc") sorted.sort((a, b) => b.id - a.id);
      else sorted.sort((a, b) => a.title.localeCompare(b.title));
      return sorted;
    }

    function applyFilters() {
      const term = searchInput.value.trim().toLowerCase();
      const category = categoryFilter.value;
      const sortMode = sortFilter.value;
      const favOnly = favoritesOnly.checked;

      state.filtered = state.allTools.filter((tool) => {
        const titleMatch = tool.title.toLowerCase().includes(term);
        const categoryMatch = category === "all" || tool.category === category;
        const favoriteMatch = !favOnly || isFavorite(tool.id);
        return titleMatch && categoryMatch && favoriteMatch;
      });

      state.filtered = sortTools(state.filtered, sortMode);
      state.listLimit = 24;
      renderList();
    }

    function renderList() {
      const visible = state.filtered.slice(0, state.listLimit);
      toolsGrid.innerHTML = visible.map(createCard).join("");
      bindFavoriteButtons(toolsGrid, applyFilters);

      resultsCount.textContent = `${state.filtered.length} tools found · ${state.favorites.length} favorites saved`;
      emptyState.classList.toggle("hidden", state.filtered.length > 0);
      const hasMore = state.filtered.length > state.listLimit;
      if (infiniteLoader) infiniteLoader.classList.toggle("hidden", !hasMore);
    }

    const debouncedApply = debounce(applyFilters, 200);
    searchInput.addEventListener("input", debouncedApply);
    categoryFilter.addEventListener("change", applyFilters);
    sortFilter.addEventListener("change", applyFilters);
    favoritesOnly.addEventListener("change", applyFilters);



    if (listSentinel) {
      const observer = new IntersectionObserver((entries) => {
        const first = entries[0];
        if (!first || !first.isIntersecting) return;
        if (state.filtered.length <= state.listLimit) return;
        if (infiniteLoader) infiniteLoader.classList.remove("hidden");
        setTimeout(() => {
          state.listLimit += 24;
          renderList();
        }, 220);
      }, { rootMargin: "300px" });
      observer.observe(listSentinel);
    }

    const params = new URLSearchParams(location.search);
    const initialCategory = params.get("category");
    if (initialCategory && categories.includes(initialCategory)) categoryFilter.value = initialCategory;

    state.filtered = [...state.allTools];
    applyFilters();
  }


  function initCategoryPage() {
    const params = new URLSearchParams(location.search);
    const categoryName = params.get("name") || "";

    const titleEl = $("#categoryTitle");
    const countEl = $("#categoryCount");
    const searchInput = $("#categorySearch");
    const sortFilter = $("#categorySort");
    const favoritesOnly = $("#categoryFavOnly");
    const grid = $("#categoryGrid");
    const empty = $("#categoryEmpty");
    const sentinel = $("#categorySentinel");
    const loader = $("#categoryLoader");

    if (!categoryName) {
      titleEl.textContent = "Category not selected";
      countEl.textContent = "Choose a category from Home or Browse page.";
      empty.classList.remove("hidden");
      empty.innerHTML = `<h2>No category selected</h2><p>Please open a category first.</p><a class="btn btn-primary" href="${listHref()}">Browse all tools</a>`;
      return;
    }

    titleEl.textContent = `${categoryName} Tools`;

    function sortTools(items, mode) {
      const sorted = [...items];
      if (mode === "title-desc") sorted.sort((a, b) => b.title.localeCompare(a.title));
      else if (mode === "id-asc") sorted.sort((a, b) => a.id - b.id);
      else if (mode === "id-desc") sorted.sort((a, b) => b.id - a.id);
      else sorted.sort((a, b) => a.title.localeCompare(b.title));
      return sorted;
    }

    function applyFilters() {
      const term = searchInput.value.trim().toLowerCase();
      const sortMode = sortFilter.value;
      const favOnly = favoritesOnly.checked;

      state.filtered = state.allTools.filter((tool) => {
        const inCategory = tool.category === categoryName;
        const titleMatch = tool.title.toLowerCase().includes(term);
        const favoriteMatch = !favOnly || isFavorite(tool.id);
        return inCategory && titleMatch && favoriteMatch;
      });

      state.filtered = sortTools(state.filtered, sortMode);
      state.listLimit = 24;
      render();
    }

    function render() {
      const visible = state.filtered.slice(0, state.listLimit);
      grid.innerHTML = visible.map(createCard).join("");
      bindFavoriteButtons(grid, applyFilters);

      countEl.textContent = `${state.filtered.length} tools in ${categoryName}`;
      empty.classList.toggle("hidden", state.filtered.length > 0);
      const hasMore = state.filtered.length > state.listLimit;
      if (loader) loader.classList.toggle("hidden", !hasMore);
    }

    searchInput.addEventListener("input", debounce(applyFilters, 200));
    sortFilter.addEventListener("change", applyFilters);
    favoritesOnly.addEventListener("change", applyFilters);

    if (sentinel) {
      const observer = new IntersectionObserver((entries) => {
        const first = entries[0];
        if (!first || !first.isIntersecting) return;
        if (state.filtered.length <= state.listLimit) return;
        if (loader) loader.classList.remove("hidden");
        setTimeout(() => {
          state.listLimit += 24;
          render();
        }, 220);
      }, { rootMargin: "300px" });
      observer.observe(sentinel);
    }

    applyFilters();
  }

  function getDetailToolId() {
    const params = new URLSearchParams(location.search);
    const rawId = params.get("id") || params.get("tool") || "";
    const parsed = Number(rawId);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;

    const pathParts = location.pathname.split("/").filter(Boolean);
    const last = pathParts[pathParts.length - 1] || "";
    const pathId = Number(last);
    if (Number.isFinite(pathId) && pathId > 0) return pathId;

    return null;
  }

  function updateSeoForTool(tool) {
    const title = `${tool.title} – ${tool.category} AI Tool`;
    const description = tool.description.slice(0, 155);

    document.title = title;

    let descMeta = document.querySelector('meta[name="description"]');
    if (!descMeta) {
      descMeta = document.createElement("meta");
      descMeta.setAttribute("name", "description");
      document.head.appendChild(descMeta);
    }
    descMeta.setAttribute("content", description);

    const setOg = (property, content) => {
      let tag = document.querySelector(`meta[property="${property}"]`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("property", property);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
    };

    setOg("og:title", title);
    setOg("og:description", description);
    setOg("og:type", "article");
    setOg("og:url", `${location.origin}${location.pathname}?id=${tool.id}`);

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: tool.title,
      applicationCategory: tool.category,
      description: tool.description,
      url: tool.link
    };

    let schemaTag = $("#schemaOrg");
    if (!schemaTag) {
      schemaTag = document.createElement("script");
      schemaTag.type = "application/ld+json";
      schemaTag.id = "schemaOrg";
      document.head.appendChild(schemaTag);
    }
    schemaTag.textContent = JSON.stringify(jsonLd);
  }

  function initDetailedPage() {
    const id = getDetailToolId();
    const tool = id ? state.allTools.find((t) => t.id === id) : null;

    const article = $("#toolDetails");
    const notFound = $("#notFound");
    const relatedWrap = $("#relatedWrap");

    if (!tool) {
      article.classList.add("hidden");
      relatedWrap.classList.add("hidden");
      notFound.classList.remove("hidden");

      if (!id) {
        notFound.innerHTML = `
          <h1>Select a tool to view details</h1>
          <p>Use a URL like <code>/detailed?id=12</code> or open a tool from the browse page.</p>
          <div class="card-actions" style="justify-content:center; margin-top: 1rem;">
            <a href="${listHref()}" class="btn btn-primary">Browse tools</a>
            <a href="${homeHref()}" class="btn btn-secondary">Back home</a>
          </div>
        `;
      }
      return;
    }

    markRecent(tool.id);
    updateSeoForTool(tool);

    const currentIndex = state.allTools.findIndex((t) => t.id === tool.id);
    const prev = state.allTools[currentIndex - 1];
    const next = state.allTools[currentIndex + 1];

    $("#breadcrumb").innerHTML = `
      <a href="${homeHref()}">Home</a> &gt;
      <a href="${listHref(`?category=${encodeURIComponent(tool.category)}`)}">${escapeHtml(tool.category)}</a> &gt;
      <span>${escapeHtml(tool.title)}</span>
    `;

    const detailLogo = escapeHtml(getLogoUrl(tool.link, 128));
    const detailFallback = escapeHtml(getLogoFallbackUrl(tool.link, 128));
    const favoriteState = isFavorite(tool.id);

    article.innerHTML = `
      <div class="detail-head">
        <img class="tool-logo tool-logo-lg" src="${detailLogo}" alt="${escapeHtml(tool.title)} logo" loading="eager" decoding="async" referrerpolicy="no-referrer" onerror="if(!this.dataset.fb){this.dataset.fb='1';this.src='${detailFallback}';}else{this.style.display='none';}">
        <div>
          <h1>${escapeHtml(tool.title)}</h1>
          <a class="badge badge-link" href="${categoryHref(tool.category)}">${escapeHtml(tool.category)}</a>
        </div>
      </div>
      <p>${escapeHtml(tool.description)}</p>
      <div class="card-actions">
        <button class="btn btn-secondary ${favoriteState ? "fav-inline-active" : ""}" id="favoriteDetailBtn">${favoriteState ? "★ Favorited" : "☆ Add to favorites"}</button>
        <a class="btn btn-primary" href="${escapeHtml(tool.link)}" target="_blank" rel="noopener noreferrer">Visit Tool</a>
        <a class="btn btn-secondary" href="${listHref()}">Back to list</a>
      </div>
      <div class="tool-nav">
        ${prev ? `<a class="btn btn-secondary" href="${detailHref(prev.id)}">← ${escapeHtml(prev.title)}</a>` : ""}
        ${next ? `<a class="btn btn-secondary" href="${detailHref(next.id)}">${escapeHtml(next.title)} →</a>` : ""}
      </div>
    `;

    const favoriteDetailBtn = $("#favoriteDetailBtn");
    if (favoriteDetailBtn) {
      favoriteDetailBtn.addEventListener("click", () => {
        toggleFavorite(tool.id);
        initDetailedPage();
      });
    }

    const related = state.allTools.filter((t) => t.category === tool.category && t.id !== tool.id).slice(0, 4);
    $("#relatedTools").innerHTML = related.length ? related.map(createCard).join("") : "<p class='muted'>No related tools available.</p>";
    bindFavoriteButtons($("#relatedTools"), initDetailedPage);

    const topBtn = $("#scrollTopBtn");
    window.addEventListener("scroll", () => {
      topBtn.classList.toggle("hidden", window.scrollY < 400);
    }, { passive: true });
    topBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  initTheme();
  initGlobalUi();

  if (state.page === "index") initIndexPage();
  if (state.page === "list") initListPage();
  if (state.page === "detailed") initDetailedPage();
  if (state.page === "category") initCategoryPage();
})();
