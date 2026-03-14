(() => {
  "use strict";

  const state = {
    allTools: Array.isArray(window.tools) ? window.tools : [],
    filtered: [],
    listLimit: 24,
    page: document.body.dataset.page
  };

  const $ = (sel, root = document) => root.querySelector(sel);

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
    return `
      <article class="tool-card">
        <span class="badge">${escapeHtml(tool.category)}</span>
        <h3>${escapeHtml(tool.title)}</h3>
        <p class="description-2">${escapeHtml(tool.description)}</p>
        <div class="card-actions">
          <a class="btn btn-secondary" href="detailed.html?id=${tool.id}">View Details</a>
          <a class="btn btn-primary" href="${escapeHtml(tool.link)}" target="_blank" rel="noopener noreferrer">Visit Tool</a>
        </div>
      </article>
    `;
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

    const trending = state.allTools.slice(0, 6);
    $("#trendingGrid").innerHTML = trending.map(createCard).join("");

    const statsHtml = categories.map((category) => `
      <div class="category-pill">
        <span>${escapeHtml(category)}</span>
        <strong>${categoryMap[category]}</strong>
      </div>
    `).join("");

    $("#categoryStats").innerHTML = statsHtml;
  }

  function initListPage() {
    const searchInput = $("#searchInput");
    const categoryFilter = $("#categoryFilter");
    const toolsGrid = $("#toolsGrid");
    const emptyState = $("#emptyState");
    const resultsCount = $("#resultsCount");
    const loadMoreBtn = $("#loadMoreBtn");

    const categories = [...new Set(state.allTools.map((t) => t.category))].sort((a, b) => a.localeCompare(b));
    categoryFilter.innerHTML += categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");

    function applyFilters() {
      const term = searchInput.value.trim().toLowerCase();
      const category = categoryFilter.value;

      for (const option of categoryFilter.options) {
        option.selected = option.value === category;
      }

      state.filtered = state.allTools.filter((tool) => {
        const titleMatch = tool.title.toLowerCase().includes(term);
        const categoryMatch = category === "all" || tool.category === category;
        return titleMatch && categoryMatch;
      });

      state.listLimit = 24;
      renderList();
    }

    function renderList() {
      const visible = state.filtered.slice(0, state.listLimit);
      const fragment = document.createDocumentFragment();
      const wrapper = document.createElement("div");
      wrapper.innerHTML = visible.map(createCard).join("");
      while (wrapper.firstElementChild) fragment.appendChild(wrapper.firstElementChild);

      toolsGrid.innerHTML = "";
      toolsGrid.appendChild(fragment);

      resultsCount.textContent = `${state.filtered.length} tools found`;
      emptyState.classList.toggle("hidden", state.filtered.length > 0);
      loadMoreBtn.classList.toggle("hidden", state.filtered.length <= state.listLimit);
    }

    const debouncedApply = debounce(applyFilters, 200);
    searchInput.addEventListener("input", debouncedApply);
    categoryFilter.addEventListener("change", applyFilters);
    loadMoreBtn.addEventListener("click", () => {
      state.listLimit += 24;
      renderList();
    });

    const initialCategory = new URLSearchParams(location.search).get("category");
    if (initialCategory && categories.includes(initialCategory)) {
      categoryFilter.value = initialCategory;
    }

    state.filtered = [...state.allTools];
    applyFilters();
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
    const params = new URLSearchParams(location.search);
    const id = Number(params.get("id"));
    const tool = state.allTools.find((t) => t.id === id);

    const article = $("#toolDetails");
    const notFound = $("#notFound");
    const relatedWrap = $("#relatedWrap");

    if (!tool) {
      article.classList.add("hidden");
      relatedWrap.classList.add("hidden");
      notFound.classList.remove("hidden");
      return;
    }

    updateSeoForTool(tool);

    const currentIndex = state.allTools.findIndex((t) => t.id === tool.id);
    const prev = state.allTools[currentIndex - 1];
    const next = state.allTools[currentIndex + 1];

    $("#breadcrumb").innerHTML = `
      <a href="index.html">Home</a> &gt;
      <a href="list.html?category=${encodeURIComponent(tool.category)}">${escapeHtml(tool.category)}</a> &gt;
      <span>${escapeHtml(tool.title)}</span>
    `;

    article.innerHTML = `
      <h1>${escapeHtml(tool.title)}</h1>
      <span class="badge">${escapeHtml(tool.category)}</span>
      <p>${escapeHtml(tool.description)}</p>
      <div class="card-actions">
        <a class="btn btn-primary" href="${escapeHtml(tool.link)}" target="_blank" rel="noopener noreferrer">Visit Tool</a>
        <a class="btn btn-secondary" href="list.html">Back to list</a>
      </div>
      <div class="tool-nav">
        ${prev ? `<a class="btn btn-secondary" href="detailed.html?id=${prev.id}">← ${escapeHtml(prev.title)}</a>` : ""}
        ${next ? `<a class="btn btn-secondary" href="detailed.html?id=${next.id}">${escapeHtml(next.title)} →</a>` : ""}
      </div>
    `;

    const related = state.allTools.filter((t) => t.category === tool.category && t.id !== tool.id).slice(0, 4);
    $("#relatedTools").innerHTML = related.length ? related.map(createCard).join("") : "<p class='muted'>No related tools available.</p>";

    const topBtn = $("#scrollTopBtn");
    window.addEventListener("scroll", () => {
      topBtn.classList.toggle("hidden", window.scrollY < 400);
    }, { passive: true });
    topBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  initGlobalUi();

  if (state.page === "index") initIndexPage();
  if (state.page === "list") initListPage();
  if (state.page === "detailed") initDetailedPage();
})();
