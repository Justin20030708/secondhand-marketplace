const FAVORITES_API_URL = "/api/favorites";
const PROFILE_KEY = "sellerProfile";

const navToggleElement = document.getElementById("nav-toggle");
const primaryNavElement = document.getElementById("primary-nav");
const favoritesGridElement = document.getElementById("favorites-grid");
const favoritesEmptyElement = document.getElementById("favorites-empty");
const favoritesCountElement = document.getElementById("favorites-count");
const favoritesUserElement = document.getElementById("favorites-user");
const favoritesFeedbackElement = document.getElementById("favorites-feedback");
const favoritesFeedbackTextElement = document.getElementById("favorites-feedback-text");

let favorites = [];
let currentUserNickname = "";

function formatPrice(price) {
  return `NT$ ${Number(price).toLocaleString("zh-TW")}`;
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

function showFeedback(message) {
  favoritesFeedbackTextElement.textContent = message;
  favoritesFeedbackElement.hidden = false;
}

function hideFeedback() {
  favoritesFeedbackElement.hidden = true;
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

function renderFavorites() {
  favoritesCountElement.textContent = String(favorites.length);

  if (!favorites.length) {
    favoritesGridElement.innerHTML = "";
    favoritesEmptyElement.hidden = false;
    return;
  }

  favoritesEmptyElement.hidden = true;

  favoritesGridElement.innerHTML = favorites
    .map((item) => {
      const itemName = item.title || "未命名商品";
      const isSold = item.status === "已售出";
      const statusClass = isSold ? "status-chip-sold" : "status-chip-available";
      const categoryClass = getCategoryClass(item.category);
      const categoryVariants = getCategoryVariants(item.category).join("|");
      const statusVariants = getStatusVariants(item.status).join("|");
      const cardClass = isSold ? "product-card is-sold" : "product-card";

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
            class="favorite-btn is-favorite"
            type="button"
            data-action="favorite-remove"
            data-id="${item.id}"
            aria-label="取消收藏"
            aria-pressed="true"
          >♥</button>
        </div>
      `;
    })
    .join("");

  applyCardAdaptiveLayout();
}

async function loadFavorites() {
  currentUserNickname = readCurrentUserNickname();

  if (!currentUserNickname) {
    favoritesUserElement.textContent = "目前使用者：未設定";
    favorites = [];
    hideFeedback();
    renderFavorites();
    return;
  }

  favoritesUserElement.textContent = `目前使用者：${currentUserNickname}`;
  showFeedback("載入中...");

  try {
    const response = await fetch(`${FAVORITES_API_URL}?nickname=${encodeURIComponent(currentUserNickname)}`);
    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.success || !Array.isArray(result.data)) {
      throw new Error(result?.message || "取得收藏清單失敗");
    }

    favorites = result.data;
    hideFeedback();
    renderFavorites();
  } catch (error) {
    favorites = [];
    showFeedback(error.message || "載入收藏清單失敗");
    renderFavorites();
  }
}

async function removeFavorite(productId, triggerButton) {
  const query = new URLSearchParams({
    nickname: currentUserNickname,
    productId: String(productId)
  });

  triggerButton.disabled = true;

  try {
    const response = await fetch(`${FAVORITES_API_URL}?${query.toString()}`, {
      method: "DELETE"
    });
    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.success) {
      throw new Error(result?.message || "取消收藏失敗");
    }

    favorites = favorites.filter((item) => item.id !== productId);
    renderFavorites();
  } catch (error) {
    window.alert(error.message || "取消收藏失敗，請稍後再試。");
    triggerButton.disabled = false;
  }
}

if (favoritesGridElement) {
  favoritesGridElement.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const removeButton = target.closest(".favorite-btn");
    if (!removeButton) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const productId = Number.parseInt(removeButton.getAttribute("data-id"), 10);
    if (Number.isNaN(productId)) {
      return;
    }

    if (!currentUserNickname) {
      window.alert("請先在『我的商品』設定賣家暱稱，再使用收藏功能。");
      return;
    }

    if (removeButton.getAttribute("data-loading") === "true") {
      return;
    }

    removeButton.setAttribute("data-loading", "true");
    await removeFavorite(productId, removeButton);
    removeButton.removeAttribute("data-loading");
  });
}

window.addEventListener("resize", () => {
  applyCardAdaptiveLayout();
});

loadFavorites();

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
