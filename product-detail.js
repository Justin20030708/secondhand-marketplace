const PRODUCTS_API_URL = "/api/products";
const SELLER_PROFILE_API_URL = "/api/sellers/profile";

const navToggleElement = document.getElementById("nav-toggle");
const primaryNavElement = document.getElementById("primary-nav");

const detailFeedbackElement = document.getElementById("detail-feedback");
const detailFeedbackTextElement = document.getElementById("detail-feedback-text");
const detailContentElement = document.getElementById("detail-content");

const detailImageElement = document.getElementById("detail-image");
const detailCategoryElement = document.getElementById("detail-category");
const detailStatusElement = document.getElementById("detail-status");
const detailTitleElement = document.getElementById("detail-title");
const detailPriceElement = document.getElementById("detail-price");
const detailDescriptionElement = document.getElementById("detail-description");

const detailSellerNicknameElement = document.getElementById("detail-seller-nickname");
const detailSellerPhoneElement = document.getElementById("detail-seller-phone");
const detailSellerEmailElement = document.getElementById("detail-seller-email");

const contactSellerButtonElement = document.getElementById("contact-seller-btn");
const contactModalElement = document.getElementById("contact-modal");
const copyPhoneButtonElement = document.getElementById("copy-phone-btn");
const copyEmailButtonElement = document.getElementById("copy-email-btn");
const closeContactButtonElement = document.getElementById("close-contact-btn");
const contactCopyMessageElement = document.getElementById("contact-copy-message");

let sellerContact = {
  phone: "",
  email: ""
};

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

function showFeedback(message) {
  detailFeedbackTextElement.textContent = message;
  detailFeedbackElement.hidden = false;
  detailContentElement.hidden = true;
}

function hideFeedback() {
  detailFeedbackElement.hidden = true;
}

function parseProductIdFromQuery() {
  const query = new URLSearchParams(window.location.search);
  const id = Number.parseInt(query.get("id"), 10);
  return Number.isNaN(id) ? null : id;
}

async function fetchProduct(productId) {
  const response = await fetch(`${PRODUCTS_API_URL}/${productId}`);
  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.success || !result?.data) {
    throw new Error(result?.message || "找不到商品資料");
  }

  return result.data;
}

async function fetchSellerProfile(nickname) {
  const response = await fetch(`${SELLER_PROFILE_API_URL}?nickname=${encodeURIComponent(nickname)}`);
  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.success || !result?.data) {
    return null;
  }

  return result.data;
}

function renderDetail(product, sellerProfile) {
  const category = product.category || "其他";
  const status = product.status || "可購買";
  const sellerNickname = product.seller || "未提供";
  const sellerPhone = sellerProfile?.phone || "";
  const sellerEmail = sellerProfile?.email || "";

  detailImageElement.src = product.image || "";
  detailImageElement.alt = product.title || "商品圖片";

  detailCategoryElement.textContent = category;
  detailCategoryElement.classList.remove(
    "category-electronics",
    "category-books",
    "category-furniture",
    "category-fashion",
    "category-other"
  );
  detailCategoryElement.classList.add(getCategoryClass(category));

  detailStatusElement.textContent = status;
  detailStatusElement.classList.toggle("status-chip-available", status !== "已售出");
  detailStatusElement.classList.toggle("status-chip-sold", status === "已售出");

  detailTitleElement.textContent = product.title || "未命名商品";
  detailPriceElement.textContent = formatPrice(product.price || 0);
  detailDescriptionElement.textContent = product.description || "暫無商品描述";

  detailSellerNicknameElement.textContent = sellerNickname;
  detailSellerPhoneElement.textContent = sellerPhone || "未提供";
  detailSellerEmailElement.textContent = sellerEmail || "未提供";

  sellerContact = {
    phone: sellerPhone,
    email: sellerEmail
  };

  copyPhoneButtonElement.textContent = `電話：${sellerPhone || "未提供"}`;
  copyEmailButtonElement.textContent = `Email：${sellerEmail || "未提供"}`;
}

async function copyText(text) {
  if (!text) {
    throw new Error("沒有可複製的內容");
  }

  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand("copy");
  document.body.removeChild(textArea);
}

function openContactModal() {
  contactCopyMessageElement.textContent = "";
  contactCopyMessageElement.classList.remove("is-error", "is-success");
  contactModalElement.hidden = false;
}

function closeContactModal() {
  contactModalElement.hidden = true;
}

async function initDetailPage() {
  const productId = parseProductIdFromQuery();
  if (productId === null) {
    showFeedback("網址缺少商品編號，請返回列表重試。");
    return;
  }

  showFeedback("載入中...");

  try {
    const product = await fetchProduct(productId);
    const sellerProfile = await fetchSellerProfile(product.seller || "");

    renderDetail(product, sellerProfile);
    hideFeedback();
    detailContentElement.hidden = false;
  } catch (error) {
    showFeedback(error.message || "載入失敗，請稍後再試。");
  }
}

if (contactSellerButtonElement) {
  contactSellerButtonElement.addEventListener("click", () => {
    openContactModal();
  });
}

if (copyPhoneButtonElement) {
  copyPhoneButtonElement.addEventListener("click", async () => {
    try {
      await copyText(sellerContact.phone);
      contactCopyMessageElement.textContent = "電話已複製";
      contactCopyMessageElement.classList.add("is-success");
      contactCopyMessageElement.classList.remove("is-error");
    } catch (error) {
      contactCopyMessageElement.textContent = error.message || "複製失敗";
      contactCopyMessageElement.classList.add("is-error");
      contactCopyMessageElement.classList.remove("is-success");
    }
  });
}

if (copyEmailButtonElement) {
  copyEmailButtonElement.addEventListener("click", async () => {
    try {
      await copyText(sellerContact.email);
      contactCopyMessageElement.textContent = "Email 已複製";
      contactCopyMessageElement.classList.add("is-success");
      contactCopyMessageElement.classList.remove("is-error");
    } catch (error) {
      contactCopyMessageElement.textContent = error.message || "複製失敗";
      contactCopyMessageElement.classList.add("is-error");
      contactCopyMessageElement.classList.remove("is-success");
    }
  });
}

if (closeContactButtonElement) {
  closeContactButtonElement.addEventListener("click", () => {
    closeContactModal();
  });
}

if (contactModalElement) {
  contactModalElement.addEventListener("click", (event) => {
    if (event.target === contactModalElement) {
      closeContactModal();
    }
  });
}

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !contactModalElement.hidden) {
    closeContactModal();
  }
});

initDetailPage();

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
