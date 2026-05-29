// === Poderosa — E-commerce JavaScript ===

/* ========== FAVORITOS (localStorage) ========== */
let favorites = JSON.parse(localStorage.getItem("poderosaFavorites")) || [];

function toggleFavorite(id) {
  const index = favorites.indexOf(id);
  if (index > -1) favorites.splice(index, 1);
  else favorites.push(id);
  localStorage.setItem("poderosaFavorites", JSON.stringify(favorites));
  renderProducts();
}

/* ========== CARRINHO ========== */
let cart = JSON.parse(localStorage.getItem("poderosaCart")) || [];

function addToCart(id) {
  cart.push(id);
  localStorage.setItem("poderosaCart", JSON.stringify(cart));
  updateCartBadge();
}

function updateCartBadge() {
  const badge = document.getElementById("cartBadge");
  if (badge) badge.textContent = cart.length;
}

/* ========== FILTROS ========== */
const filters = {
  categories: [],
  sizes: [],
  colors: [],
  maxPrice: 299,
  sort: "mais-vendidos",
  search: ""
};

// Extrair valores únicos dos produtos
const allCategories = [...new Set(products.map(p => p.category))];
const allSizes = [...new Set(products.flatMap(p => p.sizes))].sort();
const allColors = [...new Set(products.flatMap(p => p.colors))];

/* ========== RENDERIZAR FILTROS ========== */
function renderFilters() {
  // Categorias
  const catContainer = document.querySelector('[data-filter="categories"]');
  if (catContainer) {
    catContainer.innerHTML = allCategories.map(cat => `
      <label><input type="checkbox" value="${cat}" class="filter-category" ${filters.categories.includes(cat) ? "checked" : ""}> ${cat}</label>
    `).join("");
    catContainer.querySelectorAll(".filter-category").forEach(cb => {
      cb.addEventListener("change", () => {
        const val = cb.value;
        filters.categories = cb.checked
          ? [...filters.categories, val]
          : filters.categories.filter(c => c !== val);
        applyFilters();
      });
    });
  }

  // Tamanhos
  const sizeContainer = document.querySelector('[data-filter="sizes"]');
  if (sizeContainer) {
    sizeContainer.innerHTML = allSizes.map(s => `
      <button class="size ${filters.sizes.includes(s) ? "active" : ""}" data-size="${s}">${s}</button>
    `).join("");
    sizeContainer.querySelectorAll(".size").forEach(btn => {
      btn.addEventListener("click", () => {
        const val = btn.dataset.size;
        btn.classList.toggle("active");
        filters.sizes = btn.classList.contains("active")
          ? [...filters.sizes, val]
          : filters.sizes.filter(s => s !== val);
        applyFilters();
      });
    });
  }

  // Cores
  const colorContainer = document.querySelector('[data-filter="colors"]');
  if (colorContainer) {
    const colorMap = { "preto": "#1a1a1a", "branco": "#ffffff", "cinza": "#b8b8b8", "rosa": "#f3a8b8", "azul": "#1d4e89", "verde": "#4a5a2a", "marrom": "#6b4a3a" };
    colorContainer.innerHTML = allColors.map(c => `
      <button class="swatch ${filters.colors.includes(c) ? "active" : ""}" data-color="${c}" style="--c:${colorMap[c] || '#ccc'}"></button>
    `).join("");
    colorContainer.querySelectorAll(".swatch").forEach(btn => {
      btn.addEventListener("click", () => {
        const val = btn.dataset.color;
        btn.classList.toggle("active");
        filters.colors = btn.classList.contains("active")
          ? [...filters.colors, val]
          : filters.colors.filter(c => c !== val);
        applyFilters();
      });
    });
  }

  // Preço
  const priceRange = document.querySelector('[data-filter="price"]');
  if (priceRange) {
    priceRange.value = filters.maxPrice;
    priceRange.addEventListener("input", () => {
      filters.maxPrice = Number(priceRange.value);
      document.querySelector(".price__labels span:last-child").textContent = `R$ ${filters.maxPrice.toFixed(0)},90`;
      applyFilters();
    });
  }
}

/* ========== APLICAR FILTROS ========== */
function applyFilters() {
  let filtered = products.filter(p => {
    // Categoria
    if (filters.categories.length && !filters.categories.includes(p.category)) return false;
    // Tamanho
    if (filters.sizes.length && !filters.sizes.some(s => p.sizes.includes(s))) return false;
    // Cor
    if (filters.colors.length && !filters.colors.some(c => p.colors.includes(c))) return false;
    // Preço
    if (p.price > filters.maxPrice) return false;
    // Busca
    if (filters.search && !p.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });

  // Ordenação
  switch (filters.sort) {
    case "menor-preco": filtered.sort((a, b) => a.price - b.price); break;
    case "maior-preco": filtered.sort((a, b) => b.price - a.price); break;
    case "lancamentos": filtered.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0)); break;
    default: filtered.sort((a, b) => b.rating - a.rating); break;
  }

  renderProducts(filtered);
  document.getElementById("count").textContent = filtered.length;
}

/* ========== RENDERIZAR PRODUTOS ========== */
function renderProducts(list = products) {
  const grid = document.getElementById("grid");
  grid.innerHTML = list.map((p, i) => {
    const isFav = favorites.includes(p.id);
    return `
      <div class="product-card" data-id="${p.id}" style="animation-delay:${i * 60}ms">
        <div class="product-image">
          <img src="${p.images[0]}" class="main-img" alt="${p.name}" loading="lazy" />
          ${p.images[1] ? `<img src="${p.images[1]}" class="hover-img" alt="${p.name}" loading="lazy" />` : ""}
          <div class="product-actions">
            <button class="favorite ${isFav ? "active" : ""}" data-id="${p.id}">${isFav ? "♥" : "♡"}</button>
          </div>
          ${p.isNew ? `<span class="badge-product">NOVO</span>` : ""}
        </div>
        <div class="product-info">
          <h3>${p.name}</h3>
          <div class="stars">${"★".repeat(p.rating)}${"☆".repeat(5 - p.rating)}</div>
          <p class="price">R$ ${p.price.toFixed(2).replace(".", ",")}</p>
          <button class="buy-btn" data-id="${p.id}">Comprar no WhatsApp</button>
        </div>
      </div>
    `;
  }).join("");

  // Event listeners nos cards
  document.querySelectorAll(".favorite").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      toggleFavorite(Number(btn.dataset.id));
    });
  });

  document.querySelectorAll(".product-card").forEach(card => {
    card.addEventListener("click", e => {
      if (e.target.closest(".buy-btn")) return;
      if (e.target.closest(".favorite")) return;
      openProductModal(Number(card.dataset.id));
    });
  });

  document.querySelectorAll(".buy-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const p = products.find(pr => pr.id === Number(btn.dataset.id));
      if (p) {
        const msg = encodeURIComponent(`Olá! Tenho interesse no ${p.name} - R$ ${p.price.toFixed(2).replace(".", ",")}`);
        window.open(`https://wa.me/5511999999999?text=${msg}`, "_blank");
      }
    });
  });
}

/* ========== MODAL DO PRODUTO ========== */
function openProductModal(id) {
  const p = products.find(pr => pr.id === id);
  if (!p) return;

  const modal = document.createElement("div");
  modal.classList.add("product-modal");
  modal.innerHTML = `
    <div class="modal-content">
      <button class="close-modal">×</button>
      <div class="modal-gallery">
        <img src="${p.images[0]}" class="main-modal-image" id="mainImage" />
        <div class="thumbs">
          ${p.images.map((img, gi) => `<img src="${img}" class="thumb ${gi === 0 ? "active" : ""}" />`).join("")}
        </div>
      </div>
      <div class="modal-info">
        <h2>${p.name}</h2>
        <p class="modal-price">R$ ${p.price.toFixed(2).replace(".", ",")}</p>
        <p>${p.description || ""}</p>
        <p class="modal-meta"><strong>Categoria:</strong> ${p.category} &nbsp;|&nbsp; <strong>Tamanhos:</strong> ${p.sizes.join(", ")}</p>
        <button class="buy-btn">Comprar no WhatsApp</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.style.overflow = "hidden";

  modal.querySelector(".close-modal").onclick = () => { modal.remove(); document.body.style.overflow = ""; };
  modal.addEventListener("click", e => { if (e.target === modal) { modal.remove(); document.body.style.overflow = ""; } });

  const mainImage = modal.querySelector("#mainImage");
  modal.querySelectorAll(".thumb").forEach(thumb => {
    thumb.addEventListener("click", () => {
      mainImage.src = thumb.src;
      modal.querySelectorAll(".thumb").forEach(t => t.classList.remove("active"));
      thumb.classList.add("active");
    });
  });

  modal.querySelector(".buy-btn").addEventListener("click", () => {
    const msg = encodeURIComponent(`Olá! Tenho interesse no ${p.name} - R$ ${p.price.toFixed(2).replace(".", ",")}`);
    window.open(`https://wa.me/5511999999999?text=${msg}`, "_blank");
  });
}

/* ========== ORDENAÇÃO ========== */
document.getElementById("sortSelect")?.addEventListener("change", e => {
  filters.sort = e.target.value;
  applyFilters();
});

/* ========== BUSCA ========== */
document.getElementById("searchInput")?.addEventListener("input", e => {
  filters.search = e.target.value;
  applyFilters();
});

/* ========== LIMPAR FILTROS ========== */
document.getElementById("clearFilters")?.addEventListener("click", () => {
  filters.categories = [];
  filters.sizes = [];
  filters.colors = [];
  filters.maxPrice = 299;
  filters.search = "";
  document.getElementById("searchInput").value = "";
  document.querySelector('[data-filter="price"]').value = 299;
  document.querySelector(".price__labels span:last-child").textContent = "R$ 299,90";
  renderFilters();
  applyFilters();
});

/* ========== INICIAR ========== */
renderFilters();
applyFilters();
updateCartBadge();

// Header scroll
const header = document.getElementById("header");
window.addEventListener("scroll", () => header.classList.toggle("scrolled", window.scrollY > 20));

// Mobile menu
document.getElementById("menuToggle")?.addEventListener("click", () => {
  document.getElementById("menuToggle").classList.toggle("open");
  document.getElementById("nav").classList.toggle("open");
});
document.querySelectorAll("#nav a").forEach(a => a.addEventListener("click", () => {
  document.getElementById("menuToggle").classList.remove("open");
  document.getElementById("nav").classList.remove("open");
}));

// Collapsible filters
document.querySelectorAll(".filter-group").forEach(g => {
  const title = g.querySelector(".filter-group__title");
  if (title) title.addEventListener("click", () => g.classList.toggle("collapsed"));
});