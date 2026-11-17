// CampusFind Lite - Frontend Logic (Vanilla JavaScript)

// ---------- State ----------
let allItems = [];          // all items from the server
let currentItemId = null;   // item currently open in details modal

// ---------- Element references ----------
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const typeFilter = document.getElementById("typeFilter");
const categoryFilter = document.getElementById("categoryFilter");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const itemsGrid = document.getElementById("itemsGrid");

const formModal = document.getElementById("formModal");
const detailsModal = document.getElementById("detailsModal");
const itemForm = document.getElementById("itemForm");
const formTitle = document.getElementById("formTitle");
const formSubtitle = document.getElementById("formSubtitle");
const itemType = document.getElementById("itemType");
const itemCategory = document.getElementById("itemCategory");
const itemName = document.getElementById("itemName");
const itemLocation = document.getElementById("itemLocation");
const itemDate = document.getElementById("itemDate");
const itemDescription = document.getElementById("itemDescription");
const itemImage = document.getElementById("itemImage");
const imagePreview = document.getElementById("imagePreview");
const formError = document.getElementById("formError");
const submitBtn = document.getElementById("submitBtn");

const detailsContent = document.getElementById("detailsContent");
const deleteItemBtn = document.getElementById("deleteItemBtn");
const toast = document.getElementById("toast");

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

// ---------- Helpers ----------

// Escape text so user input cannot inject HTML
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Format a date like "2026-11-10" into "10 Nov 2026"
function formatDate(dateString) {
  const date = new Date(dateString + "T00:00:00");
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// Show a toast message. isError = true makes it red.
function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle("toast-error", isError);
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

// Open a modal
function openModal(modal) {
  modal.classList.add("open");
  document.body.style.overflow = "hidden";
}

// Close a modal
function closeModal(modal) {
  modal.classList.remove("open");
  document.body.style.overflow = "";
}

// Get a category icon for the card placeholder
function getCategoryIcon(category) {
  const icons = {
    "Electronics": "💻",
    "Wallet & Bags": "👛",
    "Keys": "🔑",
    "Books & Stationery": "📚",
    "Clothing": "🧥",
    "ID Cards": "🪪",
    "Accessories": "⌚",
    "Other": "📦"
  };
  return icons[category] || "📦";
}

// ---------- API calls ----------

// Load all items from the server
async function loadItems() {
  try {
    const response = await fetch("/api/items");
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || "Could not load items.");
    }
    allItems = data.items;
    renderItems();
  } catch (error) {
    itemsGrid.innerHTML = `<p class="empty-message">${escapeHtml(error.message)}</p>`;
  }
}

// Load counts from the server
async function loadStats() {
  try {
    const response = await fetch("/api/stats");
    const data = await response.json();
    if (data.success) {
      document.getElementById("totalCount").textContent = data.stats.total;
      document.getElementById("lostCount").textContent = data.stats.lost;
      document.getElementById("foundCount").textContent = data.stats.found;
    }
  } catch (error) {
    console.error("Could not load stats:", error);
  }
}

// Reload both items and stats
async function refreshAll() {
  await Promise.all([loadItems(), loadStats()]);
}

// ---------- Rendering ----------

// Apply search and filters, then draw cards
function renderItems() {
  const searchText = searchInput.value.trim().toLowerCase();
  const selectedType = typeFilter.value;
  const selectedCategory = categoryFilter.value;

  const filtered = allItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchText);
    const matchesType = selectedType === "all" || item.type === selectedType;
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    return matchesSearch && matchesType && matchesCategory;
  });

  if (filtered.length === 0) {
    itemsGrid.innerHTML = `<p class="empty-message">No items found. Try a different search or filter.</p>`;
    return;
  }

  itemsGrid.innerHTML = filtered.map((item) => {
    const imageHtml = item.image
      ? `<img class="card-image" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">`
      : `<div class="card-image-placeholder">${getCategoryIcon(item.category)}</div>`;

    const badgeClass = item.type === "lost" ? "badge-lost" : "badge-found";
    const badgeText = item.type === "lost" ? "Lost" : "Found";

    return `
      <article class="item-card" data-id="${escapeHtml(item.id)}">
        ${imageHtml}
        <div class="card-body">
          <div class="card-top">
            <h3 class="card-title">${escapeHtml(item.name)}</h3>
            <span class="badge ${badgeClass}">${badgeText}</span>
          </div>
          <span class="category-tag">${escapeHtml(item.category)}</span>
          <p class="card-meta"><strong>Location:</strong> ${escapeHtml(item.location)}</p>
          <p class="card-meta"><strong>Date:</strong> ${escapeHtml(formatDate(item.date))}</p>
          <p class="card-description">${escapeHtml(item.description)}</p>
        </div>
      </article>
    `;
  }).join("");

  // Attach click events to each card to open details
  document.querySelectorAll(".item-card").forEach((card) => {
    card.addEventListener("click", () => openDetails(card.dataset.id));
  });
}

// ---------- Item details ----------

function openDetails(itemId) {
  const item = allItems.find((entry) => entry.id === itemId);
  if (!item) return;

  currentItemId = itemId;

  const imageHtml = item.image
    ? `<img class="details-image" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">`
    : `<div class="card-image-placeholder details-image">${getCategoryIcon(item.category)}</div>`;

  const badgeClass = item.type === "lost" ? "badge-lost" : "badge-found";
  const badgeText = item.type === "lost" ? "Lost" : "Found";

  detailsContent.innerHTML = `
    ${imageHtml}
    <div class="details-title">
      ${escapeHtml(item.name)}
      <span class="badge ${badgeClass}">${badgeText}</span>
    </div>
    <div class="details-grid">
      <div><span>Category</span><strong>${escapeHtml(item.category)}</strong></div>
      <div><span>Location</span><strong>${escapeHtml(item.location)}</strong></div>
      <div><span>Date</span><strong>${escapeHtml(formatDate(item.date))}</strong></div>
      <div><span>Reported On</span><strong>${escapeHtml(new Date(item.createdAt).toLocaleString("en-GB"))}</strong></div>
    </div>
    <h4>Description</h4>
    <p class="details-description">${escapeHtml(item.description)}</p>
  `;

  openModal(detailsModal);
}

// ---------- Add item form ----------

// Open the report form, pre-selecting Lost or Found
function openReportForm(type) {
  itemForm.reset();
  formError.textContent = "";
  imagePreview.innerHTML = "<span>No image selected</span>";
  itemType.value = type;

  if (type === "lost") {
    formTitle.textContent = "Report a Lost Item";
    formSubtitle.textContent = "Tell us what you lost and where you last saw it.";
  } else {
    formTitle.textContent = "Report a Found Item";
    formSubtitle.textContent = "Tell us what you found so the owner can claim it.";
  }

  // Default date is today
  itemDate.value = new Date().toISOString().split("T")[0];
  openModal(formModal);
}

// Read the selected image file and convert it to base64 data URL
function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read the image file."));
    reader.readAsDataURL(file);
  });
}

// Validate the form fields on the frontend. Returns error text or empty string.
function validateForm() {
  const name = itemName.value.trim();
  const location = itemLocation.value.trim();
  const description = itemDescription.value.trim();

  if (!itemCategory.value) return "Please select a category.";
  if (name.length < 2) return "Item name must be at least 2 characters.";
  if (location.length < 2) return "Location must be at least 2 characters.";
  if (!itemDate.value) return "Please select a date.";
  if (description.length < 5) return "Description must be at least 5 characters.";
  return "";
}

// Submit the form to the API
async function handleFormSubmit(event) {
  event.preventDefault();
  formError.textContent = "";

  const errorMessage = validateForm();
  if (errorMessage) {
    formError.textContent = errorMessage;
    return;
  }

  const file = itemImage.files[0];
  let imageData = "";

  // Check the image file before sending it
  if (file) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      formError.textContent = "Only JPG, PNG, GIF and WEBP images are allowed.";
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      formError.textContent = "Image is too large. Maximum size is 2 MB.";
      return;
    }
    try {
      imageData = await readImageAsDataUrl(file);
    } catch (error) {
      formError.textContent = error.message;
      return;
    }
  }

  const newItem = {
    type: itemType.value,
    name: itemName.value.trim(),
    category: itemCategory.value,
    location: itemLocation.value.trim(),
    date: itemDate.value,
    description: itemDescription.value.trim(),
    image: imageData
  };

  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting...";

  try {
    const response = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newItem)
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Could not save the item.");
    }

    closeModal(formModal);
    showToast("Item reported successfully!");
    await refreshAll();
  } catch (error) {
    formError.textContent = error.message;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit Report";
  }
}

// Show a live preview of the chosen image
function handleImageChange() {
  const file = itemImage.files[0];
  if (!file) {
    imagePreview.innerHTML = "<span>No image selected</span>";
    return;
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    formError.textContent = "Only JPG, PNG, GIF and WEBP images are allowed.";
    itemImage.value = "";
    imagePreview.innerHTML = "<span>No image selected</span>";
    return;
  }
  if (file.size > MAX_IMAGE_SIZE) {
    formError.textContent = "Image is too large. Maximum size is 2 MB.";
    itemImage.value = "";
    imagePreview.innerHTML = "<span>No image selected</span>";
    return;
  }
  formError.textContent = "";
  const previewUrl = URL.createObjectURL(file);
  imagePreview.innerHTML = `<img src="${previewUrl}" alt="Preview">`;
}

// ---------- Delete item ----------

async function handleDelete() {
  if (!currentItemId) return;
  if (!confirm("Are you sure you want to delete this item?")) return;

  try {
    const response = await fetch(`/api/items/${encodeURIComponent(currentItemId)}`, {
      method: "DELETE"
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Could not delete the item.");
    }

    closeModal(detailsModal);
    currentItemId = null;
    showToast("Item deleted.");
    await refreshAll();
  } catch (error) {
    showToast(error.message, true);
  }
}

// ---------- Event listeners ----------

// Search: runs on button click and while typing
searchBtn.addEventListener("click", renderItems);
searchInput.addEventListener("input", renderItems);
searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") renderItems();
});

// Filters
typeFilter.addEventListener("change", renderItems);
categoryFilter.addEventListener("change", renderItems);
clearFiltersBtn.addEventListener("click", () => {
  searchInput.value = "";
  typeFilter.value = "all";
  categoryFilter.value = "all";
  renderItems();
});

// Report buttons (hero buttons and navbar links)
document.querySelectorAll("[data-open-form]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    openReportForm(button.dataset.openForm);
  });
});

// Form
itemForm.addEventListener("submit", handleFormSubmit);
itemImage.addEventListener("change", handleImageChange);
document.getElementById("cancelFormBtn").addEventListener("click", () => closeModal(formModal));
document.getElementById("closeFormBtn").addEventListener("click", () => closeModal(formModal));

// Details modal
document.getElementById("closeDetailsBtn").addEventListener("click", () => closeModal(detailsModal));
document.getElementById("closeDetailsBtn2").addEventListener("click", () => closeModal(detailsModal));
deleteItemBtn.addEventListener("click", handleDelete);

// Close modals when clicking the dark background
[formModal, detailsModal].forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal(modal);
  });
});

// Close modals with Escape key
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeModal(formModal);
    closeModal(detailsModal);
  }
});

// ---------- Start the app ----------
refreshAll();