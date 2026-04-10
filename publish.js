const navToggleElement = document.getElementById("nav-toggle");
const primaryNavElement = document.getElementById("primary-nav");

const publishFormElement = document.getElementById("publish-form");
const nameInputElement = document.getElementById("product-name");
const descriptionInputElement = document.getElementById("product-description");
const priceInputElement = document.getElementById("product-price");
const categorySelectElement = document.getElementById("product-category");
const imageInputElement = document.getElementById("product-image");
const sellerInputElement = document.getElementById("seller-name");
const cropStageElement = document.getElementById("crop-stage");
const cropImageElement = document.getElementById("crop-image");
const cropBoxElement = document.getElementById("crop-box");
const cropSizeRowElement = document.getElementById("crop-size-row");
const cropSizeInputElement = document.getElementById("crop-size");
const imagePreviewBoxElement = document.getElementById("image-preview-box");
const imagePlaceholderElement = document.getElementById("image-placeholder");
const imageSizeElement = document.getElementById("image-size");
const formErrorElement = document.getElementById("form-error");
const submitButtonElement = document.getElementById("submit-btn");

const liveImageElement = document.getElementById("live-image");
const liveCategoryElement = document.getElementById("live-category");
const liveNameElement = document.getElementById("live-name");
const livePriceElement = document.getElementById("live-price");

const errorElements = {
  name: document.getElementById("name-error"),
  description: document.getElementById("description-error"),
  price: document.getElementById("price-error"),
  category: document.getElementById("category-error"),
  image: document.getElementById("image-error"),
  seller: document.getElementById("seller-error")
};

const fieldStateElements = {
  name: document.getElementById("name-state"),
  description: document.getElementById("description-state"),
  price: document.getElementById("price-state"),
  category: document.getElementById("category-state")
};

const fieldControlElements = {
  name: document.getElementById("name-control"),
  description: document.getElementById("description-control"),
  price: document.getElementById("price-control"),
  category: document.getElementById("category-control")
};

const touchedFields = {
  name: false,
  description: false,
  price: false,
  category: false
};
const PROFILE_KEY = "sellerProfile";

const PRODUCTS_API_URL = "/api/products";

const DEFAULT_PREVIEW_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop stop-color='%23dbeafe'/%3E%3Cstop offset='1' stop-color='%23f1f5f9'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='800' height='600' fill='url(%23g)'/%3E%3Cpath d='M0 520L180 360l110 95 150-140 180 180V600H0z' fill='%23bfdbfe'/%3E%3Ccircle cx='610' cy='160' r='50' fill='%2393c5fd'/%3E%3C/svg%3E";
const CROP_ASPECT_RATIO = 1;
const MIN_CROP_SIZE = 80;

let uploadedImageDataUrl = "";
let croppedImageDataUrl = "";
let draggingCropBox = false;
let cropBoxOffset = { x: 0, y: 0 };
let cropBoxState = { x: 0, y: 0, size: 0 };
let renderedImageRect = { left: 0, top: 0, width: 0, height: 0 };
let isSubmitting = false;

function clearErrors() {
  formErrorElement.textContent = "";
  Object.values(errorElements).forEach((element) => {
    element.textContent = "";
  });
}

function formatPrice(price) {
  return `NT$ ${price.toLocaleString("zh-TW")}`;
}

function formatFileSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

function validateName() {
  const value = nameInputElement.value.trim();
  if (!value) {
    return { valid: false, message: "請輸入商品名稱。" };
  }

  return { valid: true, message: "" };
}

function validateDescription() {
  const value = descriptionInputElement.value.trim();
  if (!value) {
    return { valid: false, message: "請輸入商品描述。" };
  }

  return { valid: true, message: "" };
}

function validatePrice() {
  const value = priceInputElement.value.trim();
  if (!value) {
    return { valid: false, message: "請輸入價格。" };
  }

  const numericValue = Number(value);
  if (Number.isNaN(numericValue) || numericValue <= 0) {
    return { valid: false, message: "價格必須是大於 0 的數字。" };
  }

  return { valid: true, message: "" };
}

function validateCategory() {
  if (!categorySelectElement.value) {
    return { valid: false, message: "請選擇商品分類。" };
  }

  return { valid: true, message: "" };
}

function validateImage() {
  const file = imageInputElement.files[0];
  if (!file) {
    return { valid: true, message: "" };
  }

  if (!file.type.startsWith("image/")) {
    return { valid: false, message: "請上傳圖片檔案。" };
  }

  return { valid: true, message: "" };
}

function getValidationResult(fieldName) {
  const validators = {
    name: validateName,
    description: validateDescription,
    price: validatePrice,
    category: validateCategory
  };

  return validators[fieldName]();
}

function updateFieldFeedback(fieldName, showFeedback) {
  const result = getValidationResult(fieldName);
  const stateElement = fieldStateElements[fieldName];
  const controlElement = fieldControlElements[fieldName];
  const errorElement = errorElements[fieldName];

  if (showFeedback) {
    stateElement.textContent = result.valid ? "✓" : "✕";
    stateElement.classList.toggle("valid", result.valid);
    stateElement.classList.toggle("invalid", !result.valid);
    controlElement.classList.toggle("is-valid", result.valid);
    controlElement.classList.toggle("is-invalid", !result.valid);
    errorElement.textContent = result.valid ? "" : result.message;
  } else {
    stateElement.textContent = "";
    stateElement.classList.remove("valid", "invalid");
    controlElement.classList.remove("is-valid", "is-invalid");
    errorElement.textContent = "";
  }

  return result.valid;
}

function updateImageFeedback(showFeedback) {
  const imageValidation = validateImage();
  errorElements.image.textContent = showFeedback && !imageValidation.valid ? imageValidation.message : "";
  return imageValidation.valid;
}

function isRequiredFieldsValid() {
  return validateName().valid && validateDescription().valid && validatePrice().valid && validateCategory().valid;
}

function setSubmitButtonState() {
  if (isSubmitting) {
    submitButtonElement.disabled = true;
    submitButtonElement.textContent = "處理中...";
    submitButtonElement.classList.add("is-loading");
    return;
  }

  const canSubmit = isRequiredFieldsValid() && validateImage().valid;
  submitButtonElement.disabled = !canSubmit;
  submitButtonElement.textContent = "發布商品";
  submitButtonElement.classList.remove("is-loading");
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

function updateLivePreview() {
  const name = nameInputElement.value.trim();
  const priceRaw = priceInputElement.value.trim();
  const category = categorySelectElement.value || "其他";

  liveNameElement.textContent = name || "商品名稱預覽";

  if (priceRaw && !Number.isNaN(Number(priceRaw)) && Number(priceRaw) > 0) {
    livePriceElement.textContent = formatPrice(Number(priceRaw));
  } else {
    livePriceElement.textContent = "NT$ 0";
  }

  liveCategoryElement.textContent = category;
  liveCategoryElement.classList.remove(
    "category-electronics",
    "category-books",
    "category-furniture",
    "category-fashion",
    "category-other"
  );
  liveCategoryElement.classList.add(getCategoryClass(category));

  liveImageElement.src = croppedImageDataUrl || uploadedImageDataUrl || DEFAULT_PREVIEW_IMAGE;
}

function markAllFieldsTouched() {
  Object.keys(touchedFields).forEach((fieldName) => {
    touchedFields[fieldName] = true;
  });
}

function runRealtimeValidation() {
  Object.keys(touchedFields).forEach((fieldName) => {
    const showFeedback = touchedFields[fieldName] || Boolean(
      {
        name: nameInputElement.value,
        description: descriptionInputElement.value,
        price: priceInputElement.value,
        category: categorySelectElement.value
      }[fieldName]
    );

    updateFieldFeedback(fieldName, showFeedback);
  });

  updateImageFeedback(Boolean(imageInputElement.files[0]));
  setSubmitButtonState();
}

function validateFormOnSubmit() {
  clearErrors();
  markAllFieldsTouched();

  const requiredValid = ["name", "description", "price", "category"]
    .map((fieldName) => updateFieldFeedback(fieldName, true))
    .every(Boolean);
  const imageValid = updateImageFeedback(true);

  if (!requiredValid || !imageValid) {
    formErrorElement.textContent = "請先修正上方欄位錯誤，再重新提交。";
    setSubmitButtonState();
    return false;
  }

  return true;
}

function previewImage() {
  const file = imageInputElement.files[0];

  if (!file) {
    uploadedImageDataUrl = "";
    croppedImageDataUrl = "";
    cropStageElement.hidden = true;
    cropImageElement.removeAttribute("src");
    imagePreviewBoxElement.classList.remove("has-image");
    imagePlaceholderElement.hidden = false;
    cropSizeRowElement.hidden = true;
    imageSizeElement.textContent = "尚未選擇圖片";
    updateImageFeedback(false);
    updateLivePreview();
    setSubmitButtonState();
    return;
  }

  if (!file.type.startsWith("image/")) {
    uploadedImageDataUrl = "";
    croppedImageDataUrl = "";
    cropStageElement.hidden = true;
    cropImageElement.removeAttribute("src");
    imagePreviewBoxElement.classList.remove("has-image");
    imagePlaceholderElement.hidden = false;
    cropSizeRowElement.hidden = true;
    imageSizeElement.textContent = "檔案格式不支援";
    updateImageFeedback(true);
    updateLivePreview();
    setSubmitButtonState();
    return;
  }

  imageSizeElement.textContent = `檔案大小：${formatFileSize(file.size)}`;
  updateImageFeedback(false);

  const fileReader = new FileReader();
  fileReader.onload = (event) => {
    uploadedImageDataUrl = String(event.target?.result || "");
    croppedImageDataUrl = "";
    cropImageElement.src = uploadedImageDataUrl;
    cropStageElement.hidden = false;
    imagePreviewBoxElement.classList.add("has-image");
    imagePlaceholderElement.hidden = true;
    cropSizeRowElement.hidden = false;
  };
  fileReader.readAsDataURL(file);
}

function preloadSellerNickname() {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) {
    return;
  }

  try {
    const profile = JSON.parse(raw);
    const nickname = String(profile?.nickname || "").trim();
    if (nickname) {
      sellerInputElement.value = nickname;
    }
  } catch (error) {
    // Ignore invalid local storage data.
  }
}

function clampCropBoxPosition() {
  const minX = renderedImageRect.left;
  const minY = renderedImageRect.top;
  const maxX = renderedImageRect.left + renderedImageRect.width - cropBoxState.size;
  const maxY = renderedImageRect.top + renderedImageRect.height - cropBoxState.size;

  cropBoxState.x = Math.min(Math.max(cropBoxState.x, minX), maxX);
  cropBoxState.y = Math.min(Math.max(cropBoxState.y, minY), maxY);
}

function renderCropBox() {
  cropBoxElement.style.left = `${cropBoxState.x}px`;
  cropBoxElement.style.top = `${cropBoxState.y}px`;
  cropBoxElement.style.width = `${cropBoxState.size}px`;
  cropBoxElement.style.height = `${cropBoxState.size / CROP_ASPECT_RATIO}px`;
}

function syncCropSizeFromSlider() {
  if (!renderedImageRect.width || !renderedImageRect.height) {
    return;
  }

  const minEdge = Math.min(renderedImageRect.width, renderedImageRect.height);
  const targetRatio = Number(cropSizeInputElement.value) / 100;
  const nextSize = Math.max(MIN_CROP_SIZE, minEdge * targetRatio);
  const centerX = cropBoxState.x + cropBoxState.size / 2;
  const centerY = cropBoxState.y + cropBoxState.size / 2;

  cropBoxState.size = Math.min(nextSize, minEdge);
  cropBoxState.x = centerX - cropBoxState.size / 2;
  cropBoxState.y = centerY - cropBoxState.size / 2;
  clampCropBoxPosition();
  renderCropBox();
  updateCroppedPreview();
}

function updateCroppedPreview() {
  if (!uploadedImageDataUrl || !cropImageElement.naturalWidth || !cropImageElement.naturalHeight) {
    croppedImageDataUrl = "";
    updateLivePreview();
    return;
  }

  const scale = cropImageElement.naturalWidth / renderedImageRect.width;
  const sourceX = Math.max(0, (cropBoxState.x - renderedImageRect.left) * scale);
  const sourceY = Math.max(0, (cropBoxState.y - renderedImageRect.top) * scale);
  const sourceSize = cropBoxState.size * scale;
  const outputSize = 700;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  canvas.width = outputSize;
  canvas.height = outputSize;
  context.drawImage(
    cropImageElement,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    outputSize,
    outputSize
  );

  croppedImageDataUrl = canvas.toDataURL("image/jpeg", 0.9);
  updateLivePreview();
}

function initCropper() {
  if (!cropStageElement.clientWidth || !cropStageElement.clientHeight) {
    return;
  }

  const stageWidth = cropStageElement.clientWidth;
  const stageHeight = cropStageElement.clientHeight;
  const imageRatio = cropImageElement.naturalWidth / cropImageElement.naturalHeight;
  const stageRatio = stageWidth / stageHeight;
  let renderWidth = stageWidth;
  let renderHeight = stageHeight;
  let renderLeft = 0;
  let renderTop = 0;

  if (imageRatio > stageRatio) {
    renderHeight = stageWidth / imageRatio;
    renderTop = (stageHeight - renderHeight) / 2;
  } else {
    renderWidth = stageHeight * imageRatio;
    renderLeft = (stageWidth - renderWidth) / 2;
  }

  cropImageElement.style.left = `${renderLeft}px`;
  cropImageElement.style.top = `${renderTop}px`;
  cropImageElement.style.width = `${renderWidth}px`;
  cropImageElement.style.height = `${renderHeight}px`;

  renderedImageRect = {
    left: renderLeft,
    top: renderTop,
    width: renderWidth,
    height: renderHeight
  };

  const minEdge = Math.min(renderWidth, renderHeight);
  cropBoxState.size = Math.max(MIN_CROP_SIZE, minEdge * (Number(cropSizeInputElement.value) / 100));
  cropBoxState.x = renderLeft + (renderWidth - cropBoxState.size) / 2;
  cropBoxState.y = renderTop + (renderHeight - cropBoxState.size) / 2;
  clampCropBoxPosition();
  renderCropBox();
  updateCroppedPreview();
  setSubmitButtonState();
}

function handleCropBoxPointerDown(event) {
  if (!uploadedImageDataUrl) {
    return;
  }

  draggingCropBox = true;
  const rect = cropBoxElement.getBoundingClientRect();
  cropBoxOffset = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
  cropBoxElement.setPointerCapture(event.pointerId);
}

function handleCropBoxPointerMove(event) {
  if (!draggingCropBox) {
    return;
  }

  const stageRect = cropStageElement.getBoundingClientRect();
  cropBoxState.x = event.clientX - stageRect.left - cropBoxOffset.x;
  cropBoxState.y = event.clientY - stageRect.top - cropBoxOffset.y;
  clampCropBoxPosition();
  renderCropBox();
  updateCroppedPreview();
}

function handleCropBoxPointerUp(event) {
  if (!draggingCropBox) {
    return;
  }

  draggingCropBox = false;
  cropBoxElement.releasePointerCapture(event.pointerId);
}

if (publishFormElement) {
  imageInputElement.addEventListener("change", previewImage);

  cropImageElement.addEventListener("load", () => {
    initCropper();
  });

  cropSizeInputElement.addEventListener("input", () => {
    syncCropSizeFromSlider();
  });

  cropBoxElement.addEventListener("pointerdown", handleCropBoxPointerDown);
  cropBoxElement.addEventListener("pointermove", handleCropBoxPointerMove);
  cropBoxElement.addEventListener("pointerup", handleCropBoxPointerUp);
  cropBoxElement.addEventListener("pointercancel", handleCropBoxPointerUp);

  window.addEventListener("resize", () => {
    if (!uploadedImageDataUrl) {
      return;
    }
    initCropper();
  });

  imagePreviewBoxElement.addEventListener("click", (event) => {
    if (uploadedImageDataUrl && event.target !== imagePlaceholderElement) {
      return;
    }

    imageInputElement.click();
  });

  imagePreviewBoxElement.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      imageInputElement.click();
    }
  });

  const requiredFieldBindings = [
    { key: "name", element: nameInputElement, eventName: "input" },
    { key: "description", element: descriptionInputElement, eventName: "input" },
    { key: "price", element: priceInputElement, eventName: "input" },
    { key: "category", element: categorySelectElement, eventName: "change" }
  ];

  requiredFieldBindings.forEach(({ key, element, eventName }) => {
    element.addEventListener(eventName, () => {
      touchedFields[key] = true;
      runRealtimeValidation();
      updateLivePreview();
    });

    element.addEventListener("blur", () => {
      touchedFields[key] = true;
      runRealtimeValidation();
      updateLivePreview();
    });
  });

  sellerInputElement.addEventListener("input", () => {
    updateLivePreview();
  });

  publishFormElement.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (!validateFormOnSubmit()) {
      return;
    }

    isSubmitting = true;
    setSubmitButtonState();
    formErrorElement.textContent = "";

    const payload = {
      title: nameInputElement.value.trim(),
      description: descriptionInputElement.value.trim(),
      price: Number(priceInputElement.value.trim()),
      category: categorySelectElement.value,
      image: croppedImageDataUrl || uploadedImageDataUrl || DEFAULT_PREVIEW_IMAGE,
      status: "可購買",
      seller: sellerInputElement.value.trim() || "匿名賣家"
    };

    try {
      const response = await fetch(PRODUCTS_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        formErrorElement.textContent = result?.message || "發布失敗，請稍後再試。";
        return;
      }

      alert("發布成功");
      window.location.href = "index.html";
    } catch (error) {
      formErrorElement.textContent = "無法連線到伺服器，請稍後再試。";
      console.error("發布商品失敗", error);
    } finally {
      isSubmitting = false;
      setSubmitButtonState();
    }
  });

  updateLivePreview();
  preloadSellerNickname();
  runRealtimeValidation();
}

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
