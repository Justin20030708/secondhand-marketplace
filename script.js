const PRODUCTS_API_URL = "/api/products";
const HOT_PRODUCTS_API_URL = "/api/products/hot?limit=5";
const FAVORITES_API_URL = "/api/favorites";
const PROFILE_KEY = "sellerProfile";
const SOCCER_RAIN_KEY = "soccerRainEnabled";
const SOCCER_RAIN_MAX_ACTIVE = 18;

let products = [];

const gridElement = document.getElementById("product-grid");
const emptyStateElement = document.getElementById("empty-state");
const countElement = document.getElementById("product-count");
const navToggleElement = document.getElementById("nav-toggle");
const primaryNavElement = document.getElementById("primary-nav");
const layoutButtonElements = document.querySelectorAll(".layout-btn");
const filterButtonElements = document.querySelectorAll(".filter-btn");
const sortSelectElement = document.getElementById("price-sort");
const searchFormElement = document.getElementById("search-form");
const searchInputElement = document.getElementById("search-input");
const controlsRowElement = document.querySelector(".controls-row");
const filterSwitchElement = document.querySelector(".filter-switch");
const layoutSwitchElement = document.querySelector(".layout-switch");
const listFeedbackElement = document.getElementById("list-feedback");
const listFeedbackTextElement = document.getElementById("list-feedback-text");
const retryLoadButtonElement = document.getElementById("retry-load-btn");
const siteHeaderElement = document.querySelector(".site-header");
const soccerRainLayerElement = document.getElementById("soccer-rain-layer");
const soccerRainToggleButtonElement = document.getElementById("soccer-rain-toggle");
let activeLayout = 4;
let activeCategory = "全部";
let activeSort = "default";
let activeSearchKeyword = "";
let isFetchingProducts = false;
let hasLoadError = false;
let hotMarqueeElement = null;
let hotMarqueeTrackElement = null;
let hotProductIds = [];
let hotProductTitles = [];
let searchDebounceTimer = null;
let productsFetchController = null;
const favoriteProductIds = new Set();
let currentUserNickname = "";
let favoritesLoadedForNickname = "";
let soccerRainEnabled = true;
let soccerRainSpawnTimer = null;
let activeSoccerDropCount = 0;

function formatPrice(price) {
  return `NT$ ${price.toLocaleString("zh-TW")}`;
}

function getCategoryClass(category) {
  const categoryClassMap = {
    電子產品: "category-electronics",
    書籍: "category-books",
    家具: "category-furniture",
    服飾: "category-fashion",
    其他: "category-other"
  };

  return categoryClassMap[category] || "category-other";
}

function getCategoryVariants(category) {
  const categoryVariantsMap = {
    電子產品: ["電子產品", "電子", "電"],
    書籍: ["書籍", "書"],
    家具: ["家具", "家"],
    服飾: ["服飾", "服"],
    其他: ["其他", "其"]
  };

  return categoryVariantsMap[category] || [category, category.slice(0, 1)];
}

function getStatusVariants(status) {
  const statusVariantsMap = {
    可購買: ["可購買", "購"],
    已售出: ["已售出", "售"]
  };

  return statusVariantsMap[status] || [status, status.slice(0, 1)];
}

function normalizeProduct(item) {
  const name = (item.name || item.title || "").trim();
  const parsedPrice = Number(item.price);

  return {
    id: item.id,
    name: name || "未命名商品",
    description: item.description || "",
    price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
    category: item.category || "其他",
    image: item.image || "",
    status: item.status || "可購買",
    seller: item.seller || ""
  };
}

function buildHotMarquee() {
  if (!siteHeaderElement || hotMarqueeElement) {
    return;
  }

  hotMarqueeElement = document.createElement("div");
  hotMarqueeElement.className = "hot-marquee";

  const viewportElement = document.createElement("div");
  viewportElement.className = "hot-marquee-viewport";

  hotMarqueeTrackElement = document.createElement("div");
  hotMarqueeTrackElement.className = "hot-marquee-track";
  hotMarqueeTrackElement.textContent = "🔥 熱門商品：載入中...";

  viewportElement.appendChild(hotMarqueeTrackElement);
  hotMarqueeElement.appendChild(viewportElement);
  siteHeaderElement.appendChild(hotMarqueeElement);
}

function updateHotMarquee() {
  if (!hotMarqueeTrackElement) {
    return;
  }

  const titleText = hotProductTitles.length ? hotProductTitles.join(" ｜ ") : "暫無熱門商品";
  const marqueeText = `🔥 熱門商品：${titleText}`;
  hotMarqueeTrackElement.textContent = `${marqueeText}　　${marqueeText}　　${marqueeText}`;
}

function applyHotBadges(items) {
  const cardElements = gridElement.querySelectorAll(".product-card");

  cardElements.forEach((cardElement, index) => {
    const oldBadgeElement = cardElement.querySelector(".hot-badge-ribbon");
    if (oldBadgeElement) {
      oldBadgeElement.remove();
    }

    const currentItem = items[index];
    if (!currentItem || !hotProductIds.includes(currentItem.id)) {
      return;
    }

    const imageWrapElement = cardElement.querySelector(".image-wrap");
    if (!imageWrapElement) {
      return;
    }

    const badgeElement = document.createElement("span");
    badgeElement.className = "hot-badge-ribbon";
    badgeElement.textContent = "🔥 熱門";
    imageWrapElement.appendChild(badgeElement);
  });
}

function isFavoriteProduct(productId) {
  return favoriteProductIds.has(productId);
}

function readCurrentUserNickname() {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) {
    return "";
  }

  try {
    const profile = JSON.parse(raw);
    return String(profile?.nickname || "").trim();
  } catch (error) {
    return "";
  }
}

function syncFavoriteButtonsInView() {
  const favoriteButtons = gridElement.querySelectorAll(".favorite-btn");

  favoriteButtons.forEach((buttonElement) => {
    const productId = Number.parseInt(buttonElement.getAttribute("data-id"), 10);
    if (Number.isNaN(productId)) {
      return;
    }

    const isFavorite = isFavoriteProduct(productId);
    buttonElement.classList.toggle("is-favorite", isFavorite);
    buttonElement.textContent = isFavorite ? "♥" : "♡";
    buttonElement.setAttribute("aria-pressed", String(isFavorite));
    buttonElement.setAttribute("aria-label", isFavorite ? "取消收藏" : "加入收藏");
  });
}

function getFavoritesNavLinkElement() {
  return document.querySelector('.nav-list a[href="favorites.html"]');
}

function playFavoritesLinkCatchEffect() {
  const favoritesNavLinkElement = getFavoritesNavLinkElement();
  if (!favoritesNavLinkElement) {
    return;
  }

  favoritesNavLinkElement.classList.remove("favorite-link-catch");
  requestAnimationFrame(() => {
    favoritesNavLinkElement.classList.add("favorite-link-catch");
  });

  window.setTimeout(() => {
    favoritesNavLinkElement.classList.remove("favorite-link-catch");
  }, 520);
}

function animateFavoriteToNav(sourceButtonElement) {
  const cardShellElement = sourceButtonElement.closest(".product-card-shell");
  const sourceImageElement = cardShellElement?.querySelector(".product-image");
  if (!sourceImageElement) {
    playFavoritesLinkCatchEffect();
    return;
  }

  const sourceRect = sourceImageElement.getBoundingClientRect();
  if (!sourceRect.width || !sourceRect.height) {
    playFavoritesLinkCatchEffect();
    return;
  }

  const favoritesNavLinkElement = getFavoritesNavLinkElement();
  let targetRect = favoritesNavLinkElement?.getBoundingClientRect();

  if (!targetRect || !targetRect.width || !targetRect.height) {
    const headerRect = siteHeaderElement?.getBoundingClientRect();
    targetRect = {
      left: (headerRect?.right || window.innerWidth) - 40,
      top: (headerRect?.top || 0) + 16,
      width: 24,
      height: 24
    };
  }

  const flySize = Math.max(56, Math.min(90, sourceRect.width * 0.42));
  const startX = sourceRect.left + sourceRect.width / 2 - flySize / 2;
  const startY = sourceRect.top + sourceRect.height / 2 - flySize / 2;
  const endX = targetRect.left + targetRect.width / 2 - flySize / 2;
  const endY = targetRect.top + targetRect.height / 2 - flySize / 2;
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const travelDistance = Math.hypot(deltaX, deltaY);
  const arcLift = Math.max(32, Math.min(96, travelDistance * 0.22));

  const flyerElement = document.createElement("img");
  flyerElement.className = "favorite-fly-image";
  flyerElement.src = sourceImageElement.currentSrc || sourceImageElement.src;
  flyerElement.alt = "";
  flyerElement.width = Math.round(flySize);
  flyerElement.height = Math.round(flySize);
  flyerElement.style.left = `${startX}px`;
  flyerElement.style.top = `${startY}px`;
  flyerElement.style.transform = "translate3d(0, 0, 0) scale(1)";
  flyerElement.style.opacity = "0.96";
  document.body.appendChild(flyerElement);

  const startAnimation = () => {
    const animation = flyerElement.animate(
      [
        {
          transform: "translate3d(0px, 0px, 0px) scale(1)",
          opacity: 0.96,
          offset: 0
        },
        {
          transform: `translate3d(${deltaX * 0.58}px, ${deltaY * 0.42 - arcLift}px, 0px) scale(0.66)`,
          opacity: 0.88,
          offset: 0.55
        },
        {
          transform: `translate3d(${deltaX}px, ${deltaY}px, 0px) scale(0.2)`,
          opacity: 0.14,
          offset: 1
        }
      ],
      {
        duration: 760,
        easing: "cubic-bezier(0.22, 0.74, 0.2, 1)",
        fill: "forwards"
      }
    );

    animation.onfinish = () => {
      flyerElement.remove();
      playFavoritesLinkCatchEffect();
    };

    animation.oncancel = () => {
      flyerElement.remove();
    };
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(startAnimation);
  });
}

function readSoccerRainEnabled() {
  const savedValue = localStorage.getItem(SOCCER_RAIN_KEY);
  if (savedValue === "off") {
    return false;
  }

  return true;
}

function updateSoccerRainToggleState() {
  if (!soccerRainToggleButtonElement) {
    return;
  }

  soccerRainToggleButtonElement.classList.toggle("is-off", !soccerRainEnabled);
  soccerRainToggleButtonElement.setAttribute("aria-pressed", String(soccerRainEnabled));
  soccerRainToggleButtonElement.setAttribute("aria-label", soccerRainEnabled ? "關閉足球雨特效" : "開啟足球雨特效");
  soccerRainToggleButtonElement.title = soccerRainEnabled ? "足球雨：開啟中" : "足球雨：已關閉";
}

function clearSoccerRainDrops() {
  if (!soccerRainLayerElement) {
    return;
  }

  soccerRainLayerElement.innerHTML = "";
  activeSoccerDropCount = 0;
}

function createSoccerDrop() {
  if (!soccerRainLayerElement || !soccerRainEnabled) {
    return;
  }

  if (activeSoccerDropCount >= SOCCER_RAIN_MAX_ACTIVE) {
    return;
  }

  const dropElement = document.createElement("span");
  dropElement.className = "soccer-drop";
  dropElement.textContent = "⚽";

  const size = Math.floor(18 + Math.random() * 16);
  const startX = Math.random() * window.innerWidth;
  const driftX = (Math.random() - 0.5) * 120;
  const fallDistance = window.innerHeight + 140;
  const duration = 5600 + Math.random() * 2800;
  const delay = Math.random() * 220;

  dropElement.style.left = `${startX}px`;
  dropElement.style.fontSize = `${size}px`;
  dropElement.style.opacity = String(0.28 + Math.random() * 0.32);
  soccerRainLayerElement.appendChild(dropElement);
  activeSoccerDropCount += 1;

  const animation = dropElement.animate(
    [
      {
        transform: "translate3d(0, -10vh, 0) rotate(0deg)",
        opacity: Number(dropElement.style.opacity),
        offset: 0
      },
      {
        transform: `translate3d(${driftX}px, 110vh, 0) rotate(${Math.random() > 0.5 ? 360 : -360}deg)`,
        opacity: Math.max(0.12, Number(dropElement.style.opacity) - 0.1),
        offset: 1
      }
    ],
    {
      duration,
      delay,
      easing: "linear",
      fill: "forwards"
    }
  );

  const cleanup = () => {
    dropElement.remove();
    activeSoccerDropCount = Math.max(0, activeSoccerDropCount - 1);
  };

  animation.onfinish = cleanup;
  animation.oncancel = cleanup;
}

function startSoccerRain() {
  if (!soccerRainLayerElement || soccerRainSpawnTimer) {
    return;
  }

  soccerRainLayerElement.hidden = false;

  for (let i = 0; i < 8; i += 1) {
    createSoccerDrop();
  }

  soccerRainSpawnTimer = window.setInterval(() => {
    if (!soccerRainEnabled) {
      return;
    }

    const spawnCount = Math.random() < 0.45 ? 2 : 1;
    for (let i = 0; i < spawnCount; i += 1) {
      createSoccerDrop();
    }
  }, 420);
}

function stopSoccerRain() {
  if (soccerRainSpawnTimer) {
    clearInterval(soccerRainSpawnTimer);
    soccerRainSpawnTimer = null;
  }

  clearSoccerRainDrops();

  if (soccerRainLayerElement) {
    soccerRainLayerElement.hidden = true;
  }
}

function setSoccerRainEnabled(nextEnabled) {
  soccerRainEnabled = Boolean(nextEnabled);
  localStorage.setItem(SOCCER_RAIN_KEY, soccerRainEnabled ? "on" : "off");
  updateSoccerRainToggleState();

  if (soccerRainEnabled) {
    startSoccerRain();
  } else {
    stopSoccerRain();
  }
}

function setupSoccerRain() {
  if (!soccerRainLayerElement || !soccerRainToggleButtonElement) {
    return;
  }

  soccerRainEnabled = readSoccerRainEnabled();
  updateSoccerRainToggleState();

  if (soccerRainEnabled) {
    startSoccerRain();
  } else {
    stopSoccerRain();
  }

  soccerRainToggleButtonElement.addEventListener("click", () => {
    setSoccerRainEnabled(!soccerRainEnabled);
  });
}

async function loadFavoritesFromApi() {
  currentUserNickname = readCurrentUserNickname();

  favoriteProductIds.clear();
  if (!currentUserNickname) {
    favoritesLoadedForNickname = "";
    return;
  }

  const response = await fetch(`${FAVORITES_API_URL}?nickname=${encodeURIComponent(currentUserNickname)}`);
  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.success || !Array.isArray(result.data)) {
    throw new Error(result?.message || "取得收藏清單失敗");
  }

  result.data.forEach((item) => {
    if (Number.isInteger(item.id)) {
      favoriteProductIds.add(item.id);
    }
  });

  favoritesLoadedForNickname = currentUserNickname;
}

async function addFavoriteViaApi(productId) {
  const response = await fetch(FAVORITES_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      nickname: currentUserNickname,
      productId
    })
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    throw new Error(result?.message || "加入收藏失敗");
  }
}

async function removeFavoriteViaApi(productId) {
  const query = new URLSearchParams({
    nickname: currentUserNickname,
    productId: String(productId)
  });

  const response = await fetch(`${FAVORITES_API_URL}?${query.toString()}`, {
    method: "DELETE"
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    throw new Error(result?.message || "取消收藏失敗");
  }
}

async function loadHotProductsFromApi() {
  const response = await fetch(HOT_PRODUCTS_API_URL);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const result = await response.json();
  if (!result.success || !Array.isArray(result.data)) {
    throw new Error("Invalid hot products response");
  }

  hotProductIds = result.data.map((item) => item.id);
  hotProductTitles = result.data.map((item) => item.title || item.name || "未命名商品");
  updateHotMarquee();
}

function recordProductClick(productId) {
  if (!Number.isInteger(productId)) {
    return;
  }

  const clickUrl = `${PRODUCTS_API_URL}/${productId}/click`;
  if (navigator.sendBeacon) {
    const payload = new Blob(["{}"], { type: "application/json" });
    navigator.sendBeacon(clickUrl, payload);
    return;
  }

  fetch(clickUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: "{}",
    keepalive: true
  }).catch(() => {
    // Ignore click tracking errors so navigation remains smooth.
  });
}

function showListFeedback(message, showRetryButton = false) {
  if (!listFeedbackElement || !listFeedbackTextElement || !retryLoadButtonElement) {
    return;
  }

  listFeedbackTextElement.textContent = message;
  retryLoadButtonElement.hidden = !showRetryButton;
  listFeedbackElement.hidden = false;
  emptyStateElement.hidden = true;
  gridElement.innerHTML = "";
  countElement.textContent = "0";
}

function hideListFeedback() {
  if (!listFeedbackElement || !retryLoadButtonElement) {
    return;
  }

  listFeedbackElement.hidden = true;
  retryLoadButtonElement.hidden = true;
}

function showLoadingState() {
  showListFeedback("載入中...");
}

function showLoadErrorState() {
  showListFeedback("載入失敗，請稍後再試。", true);
}

async function loadProductsFromApi() {
  if (productsFetchController) {
    productsFetchController.abort();
  }

  productsFetchController = new AbortController();
  isFetchingProducts = true;
  hasLoadError = false;
  showLoadingState();

  try {
    const query = new URLSearchParams();
    if (activeCategory && activeCategory !== "全部") {
      query.set("category", activeCategory);
    }
    if (activeSort && activeSort !== "default") {
      query.set("sort", activeSort);
    }
    if (activeSearchKeyword) {
      query.set("search", activeSearchKeyword);
    }

    const requestUrl = query.toString() ? `${PRODUCTS_API_URL}?${query.toString()}` : PRODUCTS_API_URL;

    const response = await fetch(requestUrl, {
      signal: productsFetchController.signal
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    if (!result.success || !Array.isArray(result.data)) {
      throw new Error("Invalid API response");
    }

    products = result.data.map(normalizeProduct);
    if (favoritesLoadedForNickname !== readCurrentUserNickname()) {
      try {
        await loadFavoritesFromApi();
      } catch (favoriteError) {
        favoriteProductIds.clear();
        favoritesLoadedForNickname = "";
        console.warn("載入收藏清單失敗，已略過收藏同步", favoriteError);
      }
    }
    await loadHotProductsFromApi();
    isFetchingProducts = false;
    hideListFeedback();
    refreshProductList();
    setGridLayout(activeLayout);
    updateControlsRowLayout();
  } catch (error) {
    if (error.name === "AbortError") {
      return;
    }

    hasLoadError = true;
    showLoadErrorState();
    console.error("載入商品資料失敗", error);
  } finally {
    productsFetchController = null;
    isFetchingProducts = false;
  }
}

function renderProducts(items) {
  countElement.textContent = String(items.length);

  if (!items.length) {
    gridElement.innerHTML = "";
    emptyStateElement.hidden = false;
    return;
  }

  emptyStateElement.hidden = true;

  gridElement.innerHTML = items
    .map((item) => {
      const itemName = item.name || item.title || "未命名商品";
      const isSold = item.status === "已售出";
      const statusClass = item.status === "已售出" ? "status-chip-sold" : "status-chip-available";
      const categoryClass = getCategoryClass(item.category);
      const categoryVariants = getCategoryVariants(item.category).join("|");
      const statusVariants = getStatusVariants(item.status).join("|");
      const cardClass = isSold ? "product-card is-sold" : "product-card";
      const isFavorite = isFavoriteProduct(item.id);
      const favoriteSymbol = isFavorite ? "♥" : "♡";
      const favoriteLabel = isFavorite ? "取消收藏" : "加入收藏";
      const favoriteClass = isFavorite ? "favorite-btn is-favorite" : "favorite-btn";

      return `
        <div class="product-card-shell">
          <a class="product-link-card" href="product-detail.html?id=${item.id}" aria-label="查看${itemName}詳情">
            <article class="${cardClass}">
              <div class="image-wrap">
                <img class="product-image" src="${item.image}" alt="${itemName}" loading="lazy" />
                <div class="chip-row">
                  <span class="adaptive-chip category-chip ${categoryClass}" data-variants="${categoryVariants}">${item.category}</span>
                  <span class="adaptive-chip status-chip ${statusClass}" data-variants="${statusVariants}">${item.status}</span>
                </div>
              </div>
              <div class="product-body">
                <h2 class="product-name">${itemName}</h2>
                <p class="price">${formatPrice(item.price)}</p>
              </div>
            </article>
          </a>
          <button
            class="${favoriteClass}"
            type="button"
            data-action="favorite"
            data-id="${item.id}"
            aria-label="${favoriteLabel}"
            aria-pressed="${isFavorite}"
          >${favoriteSymbol}</button>
        </div>
      `;
    })
    .join("");
}

function applyAdaptiveChipLabels() {
  const chipElements = document.querySelectorAll(".adaptive-chip");

  chipElements.forEach((chipElement) => {
    const variants = (chipElement.dataset.variants || "")
      .split("|")
      .map((text) => text.trim())
      .filter(Boolean);

    if (!variants.length) {
      return;
    }

    chipElement.textContent = variants[0];

    for (const variant of variants) {
      chipElement.textContent = variant;
      if (chipElement.scrollWidth <= chipElement.clientWidth) {
        break;
      }
    }
  });
}

function applyAdaptivePriceText() {
  const priceElements = document.querySelectorAll(".price");

  priceElements.forEach((priceElement) => {
    priceElement.style.fontSize = "";
    const baseFontSize = parseFloat(getComputedStyle(priceElement).fontSize);
    let currentFontSize = baseFontSize;
    const minFontSize = 13;

    while (priceElement.scrollWidth > priceElement.clientWidth && currentFontSize > minFontSize) {
      currentFontSize -= 0.5;
      priceElement.style.fontSize = `${currentFontSize}px`;
    }
  });
}

function applyCardAdaptiveLayout() {
  applyAdaptiveChipLabels();
  applyAdaptivePriceText();
}

function refreshProductList() {
  if (isFetchingProducts || hasLoadError) {
    return;
  }

  renderProducts(products);
  applyHotBadges(products);
  applyCardAdaptiveLayout();
}

function setGridLayout(layout) {
  const allLayoutClasses = ["layout-1", "layout-2", "layout-4"];
  gridElement.classList.remove(...allLayoutClasses);
  gridElement.classList.add(`layout-${layout}`);
  activeLayout = Number(layout);

  layoutButtonElements.forEach((buttonElement) => {
    const isActive = buttonElement.dataset.layout === String(layout);
    buttonElement.classList.toggle("is-active", isActive);
    buttonElement.setAttribute("aria-pressed", String(isActive));
  });

  applyCardAdaptiveLayout();
}

function setCategoryFilter(category) {
  activeCategory = category;

  filterButtonElements.forEach((buttonElement) => {
    const isActive = buttonElement.dataset.category === category;
    buttonElement.classList.toggle("is-active", isActive);
    buttonElement.setAttribute("aria-pressed", String(isActive));
  });

  loadProductsFromApi();
  setGridLayout(activeLayout);
}

function setSortMode(sortMode) {
  activeSort = sortMode;
  loadProductsFromApi();
  setGridLayout(activeLayout);
}

function setSearchKeyword(keyword) {
  activeSearchKeyword = keyword.trim();
  loadProductsFromApi();
  setGridLayout(activeLayout);
}

function triggerSearchWithDebounce(keyword) {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
  }

  searchDebounceTimer = setTimeout(() => {
    setSearchKeyword(keyword);
  }, 400);
}

function hasFilterWrapped() {
  if (!filterSwitchElement) {
    return false;
  }

  const filterControls = Array.from(filterSwitchElement.children);
  if (!filterControls.length) {
    return false;
  }

  const firstTop = filterControls[0].offsetTop;
  return filterControls.some((controlElement) => controlElement.offsetTop > firstTop + 1);
}

function updateControlsRowLayout() {
  if (!controlsRowElement || !filterSwitchElement || !layoutSwitchElement) {
    return;
  }

  controlsRowElement.classList.remove("controls-stacked");

  const controlsWidth = controlsRowElement.clientWidth;
  const filterWidth = filterSwitchElement.offsetWidth;
  const layoutWidth = layoutSwitchElement.offsetWidth;
  const rowGap = 10;
  const nearOverlapBuffer = 16;
  const isNearOverlap = filterWidth + layoutWidth + rowGap + nearOverlapBuffer > controlsWidth;
  const shouldStack = isNearOverlap || hasFilterWrapped();

  controlsRowElement.classList.toggle("controls-stacked", shouldStack);
}

layoutButtonElements.forEach((buttonElement) => {
  buttonElement.addEventListener("click", () => {
    const layout = buttonElement.dataset.layout;
    setGridLayout(layout);
  });
});

filterButtonElements.forEach((buttonElement) => {
  buttonElement.addEventListener("click", () => {
    const category = buttonElement.dataset.category;
    setCategoryFilter(category);
  });
});

if (sortSelectElement) {
  sortSelectElement.addEventListener("change", (event) => {
    const target = event.target;
    setSortMode(target.value);
  });
}

if (searchFormElement && searchInputElement) {
  searchFormElement.addEventListener("submit", (event) => {
    event.preventDefault();
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = null;
    }
    setSearchKeyword(searchInputElement.value);
  });

  searchInputElement.addEventListener("input", () => {
    triggerSearchWithDebounce(searchInputElement.value);
  });
}

setGridLayout(4);
updateControlsRowLayout();
buildHotMarquee();
setupSoccerRain();
loadProductsFromApi();

if (retryLoadButtonElement) {
  retryLoadButtonElement.addEventListener("click", () => {
    loadProductsFromApi();
  });
}

if (gridElement) {
  gridElement.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const favoriteButton = target.closest(".favorite-btn");
    if (favoriteButton) {
      event.preventDefault();
      event.stopPropagation();

      const productId = Number.parseInt(favoriteButton.getAttribute("data-id"), 10);
      if (Number.isNaN(productId)) {
        return;
      }

      currentUserNickname = readCurrentUserNickname();
      if (!currentUserNickname) {
        window.alert("請先在『我的商品』設定賣家暱稱，再使用收藏功能。");
        return;
      }

      if (favoriteButton.getAttribute("data-loading") === "true") {
        return;
      }

      favoriteButton.setAttribute("data-loading", "true");
      favoriteButton.disabled = true;
      const shouldAddFavorite = !isFavoriteProduct(productId);

      try {
        if (!shouldAddFavorite) {
          await removeFavoriteViaApi(productId);
        } else {
          await addFavoriteViaApi(productId);
        }

        await loadFavoritesFromApi();
        syncFavoriteButtonsInView();

        if (shouldAddFavorite) {
          animateFavoriteToNav(favoriteButton);
        }
      } catch (error) {
        window.alert(error.message || "收藏操作失敗，請稍後再試。");
      } finally {
        favoriteButton.removeAttribute("data-loading");
        favoriteButton.disabled = false;
      }
      return;
    }

    const cardLink = target.closest(".product-link-card");
    if (!cardLink) {
      return;
    }

    const hrefValue = cardLink.getAttribute("href") || "";
    const hrefUrl = new URL(hrefValue, window.location.href);
    const productId = Number.parseInt(hrefUrl.searchParams.get("id"), 10);
    if (Number.isNaN(productId)) {
      return;
    }

    recordProductClick(productId);
  });
}

window.addEventListener("resize", () => {
  applyCardAdaptiveLayout();
  updateControlsRowLayout();
});

if (navToggleElement && primaryNavElement) {
  navToggleElement.addEventListener("click", () => {
    const isExpanded = navToggleElement.getAttribute("aria-expanded") === "true";
    navToggleElement.setAttribute("aria-expanded", String(!isExpanded));
    navToggleElement.setAttribute("aria-label", isExpanded ? "開啟導覽選單" : "關閉導覽選單");
    primaryNavElement.classList.toggle("is-open", !isExpanded);
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) {
      navToggleElement.setAttribute("aria-expanded", "false");
      navToggleElement.setAttribute("aria-label", "開啟導覽選單");
      primaryNavElement.classList.remove("is-open");
    }
  });
}
