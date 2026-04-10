const PROFILE_KEY = "sellerProfile";
const PRODUCTS_API_URL = "/api/products";
const SELLER_PROFILE_API_URL = "/api/sellers/profile";

const navToggleElement = document.getElementById("nav-toggle");
const primaryNavElement = document.getElementById("primary-nav");

const sellerProfileFormElement = document.getElementById("seller-profile-form");
const sellerNicknameInputElement = document.getElementById("seller-nickname");
const sellerPhoneInputElement = document.getElementById("seller-phone");
const sellerEmailInputElement = document.getElementById("seller-email");
const saveSellerButtonElement = document.getElementById("save-seller-btn");
const sellerFormMessageElement = document.getElementById("seller-form-message");
const sellerPanelHintElement = document.getElementById("seller-panel-hint");

const currentNicknameElement = document.getElementById("current-nickname");
const currentPhoneElement = document.getElementById("current-phone");
const currentEmailElement = document.getElementById("current-email");

const myProductsFeedbackElement = document.getElementById("my-products-feedback");
const myProductsFeedbackTextElement = document.getElementById("my-products-feedback-text");
const myProductsEmptyElement = document.getElementById("my-products-empty");
const myProductsGridElement = document.getElementById("my-products-grid");

let currentProfile = null;
let myProducts = [];
let loadingMyProducts = false;

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

function normalizeProfile(profile) {
  return {
    nickname: String(profile?.nickname || "").trim(),
    phone: String(profile?.phone || "").trim(),
    email: String(profile?.email || "").trim()
  };
}

function saveProfileToLocal(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function readProfileFromLocal() {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    const normalized = normalizeProfile(parsed);
    return normalized.nickname ? normalized : null;
  } catch (error) {
    return null;
  }
}

function renderCurrentProfile(profile) {
  const nickname = profile?.nickname || "未設定";
  const phone = profile?.phone || "-";
  const email = profile?.email || "-";

  currentNicknameElement.textContent = nickname;
  currentPhoneElement.textContent = phone;
  currentEmailElement.textContent = email;
}

function setSellerFormMessage(message, isError = false) {
  sellerFormMessageElement.textContent = message;
  sellerFormMessageElement.classList.toggle("is-error", isError);
  sellerFormMessageElement.classList.toggle("is-success", !isError && Boolean(message));
}

function setMyProductsFeedback(message) {
  myProductsFeedbackTextElement.textContent = message;
  myProductsFeedbackElement.hidden = false;
  myProductsGridElement.innerHTML = "";
  myProductsEmptyElement.hidden = true;
}

function clearMyProductsFeedback() {
  myProductsFeedbackElement.hidden = true;
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

function renderMyProducts() {
  if (!currentProfile?.nickname) {
    myProductsGridElement.innerHTML = "";
    myProductsEmptyElement.hidden = true;
    return;
  }

  if (!myProducts.length) {
    myProductsGridElement.innerHTML = "";
    myProductsEmptyElement.hidden = false;
    return;
  }

  myProductsEmptyElement.hidden = true;

  myProductsGridElement.innerHTML = myProducts
    .map((item) => {
      const itemName = item.title || item.name || "未命名商品";
      const isSold = item.status === "已售出";
      const statusClass = isSold ? "status-chip-sold" : "status-chip-available";
      const categoryClass = getCategoryClass(item.category);
      const categoryVariants = getCategoryVariants(item.category).join("|");
      const statusVariants = getStatusVariants(item.status).join("|");
      const cardClass = isSold ? "product-card is-sold" : "product-card";

      return `
        <div class="my-product-item">
          <article class="${cardClass}" aria-label="${itemName}">
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
          <div class="my-product-actions-bar">
            <button class="manage-btn sold-btn" data-action="sold" data-id="${item.id}" ${isSold ? "disabled" : ""}>${isSold ? "已售出" : "標記已售出"}</button>
            <button class="manage-btn delete-btn" data-action="delete" data-id="${item.id}">刪除</button>
          </div>
        </div>
      `;
    })
    .join("");

  applyCardAdaptiveLayout();
}

async function fetchSellerProfile(nickname) {
  const response = await fetch(`${SELLER_PROFILE_API_URL}?nickname=${encodeURIComponent(nickname)}`);
  if (!response.ok) {
    return null;
  }

  const result = await response.json();
  if (!result.success || !result.data) {
    return null;
  }

  return normalizeProfile(result.data);
}

async function saveSellerProfile(profile) {
  const response = await fetch(SELLER_PROFILE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(profile)
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    throw new Error(result?.message || "儲存賣家資訊失敗");
  }

  return normalizeProfile(result.data);
}

async function loadMyProducts() {
  if (!currentProfile?.nickname) {
    return;
  }

  loadingMyProducts = true;
  setMyProductsFeedback("載入中...");

  try {
    const response = await fetch(PRODUCTS_API_URL);
    const result = await response.json();

    if (!response.ok || !result?.success || !Array.isArray(result.data)) {
      throw new Error(result?.message || "無法取得商品資料");
    }

    myProducts = result.data.filter((item) => String(item.seller || "").trim() === currentProfile.nickname);
    clearMyProductsFeedback();
    renderMyProducts();
  } catch (error) {
    setMyProductsFeedback("載入商品失敗，請稍後重整頁面。");
  } finally {
    loadingMyProducts = false;
  }
}

async function markProductAsSold(productId) {
  const response = await fetch(`${PRODUCTS_API_URL}/${productId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ status: "已售出" })
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    throw new Error(result?.message || "更新商品狀態失敗");
  }

  myProducts = myProducts.map((item) => (item.id === productId ? { ...item, status: "已售出" } : item));
  renderMyProducts();
}

async function deleteProduct(productId) {
  const response = await fetch(`${PRODUCTS_API_URL}/${productId}`, {
    method: "DELETE"
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    throw new Error(result?.message || "刪除商品失敗");
  }

  myProducts = myProducts.filter((item) => item.id !== productId);
  renderMyProducts();
}

async function hydrateProfileFromStorage() {
  const localProfile = readProfileFromLocal();

  if (!localProfile) {
    sellerPanelHintElement.textContent = "請先輸入賣家暱稱，才能查看你發布的商品。";
    renderCurrentProfile(null);
    setMyProductsFeedback("請先設定賣家資訊。");
    return;
  }

  currentProfile = localProfile;
  sellerNicknameInputElement.value = localProfile.nickname;
  sellerPhoneInputElement.value = localProfile.phone;
  sellerEmailInputElement.value = localProfile.email;
  renderCurrentProfile(localProfile);

  const remoteProfile = await fetchSellerProfile(localProfile.nickname);
  if (remoteProfile) {
    currentProfile = remoteProfile;
    saveProfileToLocal(remoteProfile);
    sellerPhoneInputElement.value = remoteProfile.phone;
    sellerEmailInputElement.value = remoteProfile.email;
    renderCurrentProfile(remoteProfile);
  }

  sellerPanelHintElement.textContent = `目前登入身分：${currentProfile.nickname}`;
  await loadMyProducts();
}

if (sellerProfileFormElement) {
  sellerProfileFormElement.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (loadingMyProducts) {
      return;
    }

    const profile = normalizeProfile({
      nickname: sellerNicknameInputElement.value,
      phone: sellerPhoneInputElement.value,
      email: sellerEmailInputElement.value
    });

    if (!profile.nickname) {
      setSellerFormMessage("請先輸入賣家暱稱。", true);
      sellerNicknameInputElement.focus();
      return;
    }

    saveSellerButtonElement.disabled = true;
    saveSellerButtonElement.textContent = "儲存中...";
    setSellerFormMessage("");

    try {
      const savedProfile = await saveSellerProfile(profile);
      currentProfile = savedProfile;
      saveProfileToLocal(savedProfile);
      renderCurrentProfile(savedProfile);
      sellerPanelHintElement.textContent = `目前登入身分：${savedProfile.nickname}`;
      setSellerFormMessage("賣家資訊已儲存。", false);
      await loadMyProducts();
    } catch (error) {
      setSellerFormMessage(error.message || "儲存失敗，請稍後再試。", true);
    } finally {
      saveSellerButtonElement.disabled = false;
      saveSellerButtonElement.textContent = "儲存賣家資訊";
    }
  });
}

if (myProductsGridElement) {
  myProductsGridElement.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const action = target.dataset.action;
    const id = Number(target.dataset.id);
    if (!action || Number.isNaN(id)) {
      return;
    }

    target.disabled = true;

    try {
      if (action === "sold") {
        await markProductAsSold(id);
      }

      if (action === "delete") {
        const confirmed = window.confirm("確定要刪除嗎？");
        if (!confirmed) {
          target.disabled = false;
          return;
        }
        await deleteProduct(id);
      }
    } catch (error) {
      alert(error.message || "操作失敗，請稍後再試。");
      target.disabled = false;
    }
  });
}

hydrateProfileFromStorage();

window.addEventListener("resize", () => {
  applyCardAdaptiveLayout();
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
