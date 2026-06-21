import { appConfig, supabaseReady } from "./js/supabase-client.js";
import { listPublicProducts } from "./js/product-service.js";

const WHATSAPP_NUMBER = appConfig.whatsappNumber || "5585982184602";

let products = [];
let favorites = JSON.parse(localStorage.getItem("poderosaFavorites")) || [];
let cart = loadCart();

const filters = {
  categories: [],
  sizes: [],
  colors: [],
  maxPrice: 999,
  sort: "mais-vendidos",
  search: ""
};

const CATEGORY_MENU = [
  { key: "body", label: "Body" },
  { key: "top", label: "Top" },
  { key: "legging", label: "Legging" },
  { key: "short", label: "Short" },
  { key: "macaquinho", label: "Macaquinho" },
  { key: "conjuntos", label: "Conjuntos" },
  { key: "acessorios", label: "Acessórios" }
];

const SPECIAL_CATEGORIES = {
  novidades: { kind: "status", value: "novo", label: "Novidades" },
  outlet: { kind: "status", value: "promocao", label: "Outlet" }
};


const statusLabels = {
  novo: "Novo",
  promocao: "Promocao",
  mais_vendido: "Mais vendido",
  esgotado: "Esgotado"
};

const colorMap = {
  preto: "#1a1a1a",
  branco: "#ffffff",
  cinza: "#b8b8b8",
  rosa: "#f3a8b8",
  azul: "#1d4e89",
  verde: "#4a5a2a",
  marrom: "#6b4a3a"
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

initStorefront();

function initStorefront() {
  bindLayoutEvents();
  updateCartBadge();
  renderSkeleton();

  try {
    products = await listPublicProducts();
    pruneUnavailableCartItems();

    // aplica filtro da URL SOMENTE depois que os produtos estiverem carregados
    applyUrlCategoryFilters();

    setupFilterLimits();
    renderFilters();
    applyFilters();
    renderCart();
    updateCartBadge();
  } catch (error) {
    console.error("Erro ao carregar produtos:", error);
    renderError(error);
  }
}


function normalizeKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function applyUrlCategoryFilters() {
  const url = new URL(window.location.href);
  const raw = url.searchParams.get("categoria");
  const key = normalizeKey(raw);

  // reset categoria/status antes de aplicar
  // (não chamamos applyUrlCategoryFilters() antes do carregamento dos produtos)
  filters.categories = [];
  filters.__status = null;






  // Início / sem categoria/status: não aplica filtro base
  if (!key || key === "todas" || key === "inicio") {
    setActiveNav(null);
    updateVitrineTitleAndCount(null);
    // garante que não bloqueia renderização
    filters.categories = [];
    filters.__status = null;
    return;
  }


  // Novidades / Outlet (status)
  if (SPECIAL_CATEGORIES[key]) {
    const special = SPECIAL_CATEGORIES[key];

    filters.__status = special.value;
    const hidden = document.getElementById("currentCategoryStatus");
    if (hidden) hidden.value = special.value;

    setActiveNav(key);
    updateVitrineTitleAndCount(special.label);
    return;


  }

  // Categorias normais
  const normalizedMenuKey = CATEGORY_MENU.find(item => normalizeKey(item.key) === key)?.key;
  if (!normalizedMenuKey) {
    // Se a categoria não for reconhecida, não bloqueia
    setActiveNav(null);
    updateVitrineTitleAndCount(null);
    filters.categories = [];
    filters.__status = null;
    return;
  }

  filters.__status = null;
  const hidden = document.getElementById("currentCategoryStatus");
  if (hidden) hidden.value = "";

  filters.categories = [normalizedMenuKey];
  setActiveNav(key);

  const label = CATEGORY_MENU.find(item => item.key === normalizedMenuKey)?.label;
  updateVitrineTitleAndCount(label);
}


function setActiveNav(activeKey) {
  document.querySelectorAll("#nav [data-nav='categoria']").forEach(a => {
    a.classList.remove("nav__link--category-active");
  });

  if (!activeKey) {
    const first = document.querySelector("#nav [data-nav='categoria'][data-categoria='todas']");
    first?.classList.add("nav__link--category-active");
    return;
  }

  // match insensível (normalização) para tolerar variações na URL
  const activeNorm = normalizeKey(activeKey);
  const candidates = Array.from(document.querySelectorAll("#nav [data-nav='categoria']"));
  const el = candidates.find(a => normalizeKey(a.dataset.categoria) === activeNorm);
  el?.classList.add("nav__link--category-active");
}


function updateVitrineTitleAndCount(title) {
  const h2 = document.getElementById("vitrineTitle");
  if (!h2) return;

  if (!title) {
    h2.textContent = "TODOS OS PRODUTOS";
    return;
  }

  const normalized = normalizeKey(title);
  // garante saída estável mesmo se vier com acentos/caixa
  if (normalized === "novidades") h2.textContent = "NOVIDADES";
  else if (normalized === "outlet") h2.textContent = "OUTLET";
  else h2.textContent = title.toUpperCase();
}



function setupFilterLimits() {
  const highestPrice = Math.max(...products.map(product => activePrice(product)), 299);
  filters.maxPrice = Math.ceil(highestPrice);

  const priceRange = document.querySelector('[data-filter="price"]');
  if (priceRange) {
    priceRange.max = filters.maxPrice;
    priceRange.value = filters.maxPrice;
  }

  const lastPriceLabel = document.querySelector(".price__labels span:last-child");
  if (lastPriceLabel) lastPriceLabel.textContent = money.format(filters.maxPrice);
}

function renderFilters() {
  const allCategories = [...new Set(products.map(product => product.categoria))].sort();
  const allSizes = [...new Set(products.flatMap(product => product.tamanhos))].sort();
  const allColors = [...new Set(products.flatMap(product => product.cores))].sort();

  renderCheckboxFilter("categories", allCategories, "filter-category", "categories");
  renderButtonFilter("sizes", allSizes, "size", "sizes");
  renderColorFilter(allColors);
  bindPriceFilter();
}

function renderCheckboxFilter(filterName, values, className, stateKey) {
  const container = document.querySelector(`[data-filter="${filterName}"]`);
  if (!container) return;

  container.innerHTML = values.map(value => `
    <label>
      <input type="checkbox" value="${escapeHtml(value)}" class="${className}" ${filters[stateKey].includes(value) ? "checked" : ""}>
      ${escapeHtml(value)}
    </label>
  `).join("");

  container.querySelectorAll(`.${className}`).forEach(input => {
    input.addEventListener("change", () => {
      filters[stateKey] = input.checked
        ? [...filters[stateKey], input.value]
        : filters[stateKey].filter(item => item !== input.value);
      applyFilters();
    });
  });
}

function renderButtonFilter(filterName, values, className, stateKey) {
  const container = document.querySelector(`[data-filter="${filterName}"]`);
  if (!container) return;

  container.innerHTML = values.map(value => `
    <button class="${className} ${filters[stateKey].includes(value) ? "active" : ""}" data-value="${escapeHtml(value)}">${escapeHtml(value)}</button>
  `).join("");

  container.querySelectorAll(`.${className}`).forEach(button => {
    button.addEventListener("click", () => {
      const value = button.dataset.value;
      button.classList.toggle("active");
      filters[stateKey] = button.classList.contains("active")
        ? [...filters[stateKey], value]
        : filters[stateKey].filter(item => item !== value);
      applyFilters();
    });
  });
}

function renderColorFilter(colors) {
  const container = document.querySelector('[data-filter="colors"]');
  if (!container) return;

  container.innerHTML = colors.map(color => `
    <button class="swatch ${filters.colors.includes(color) ? "active" : ""}" aria-label="${escapeHtml(color)}" title="${escapeHtml(color)}" data-color="${escapeHtml(color)}" style="--c:${colorMap[color] || color}"></button>
  `).join("");

  container.querySelectorAll(".swatch").forEach(button => {
    button.addEventListener("click", () => {
      const value = button.dataset.color;
      button.classList.toggle("active");
      filters.colors = button.classList.contains("active")
        ? [...filters.colors, value]
        : filters.colors.filter(color => color !== value);
      applyFilters();
    });
  });
}

function bindPriceFilter() {
  const priceRange = document.querySelector('[data-filter="price"]');
  if (!priceRange) return;

  priceRange.addEventListener("input", () => {
    filters.maxPrice = Number(priceRange.value);
    const lastPriceLabel = document.querySelector(".price__labels span:last-child");
    if (lastPriceLabel) lastPriceLabel.textContent = money.format(filters.maxPrice);
    applyFilters();
  });
}

function applyFilters() {
  let filtered = products.filter(product => {
    // status especial (novidades/outlet)
    if (filters.__status) {
      if (product.status !== filters.__status) return false;
    }

    // normaliza categoria para comparar com URL (sem acentos/caixa)
    const productCategoriaKey = normalizeKey(product.categoria);

    // categoria normal (normaliza acentos/caixa)
    if (filters.categories.length) {
      const required = filters.categories.map(c => normalizeKey(c));
      if (!required.includes(productCategoriaKey)) return false;
    }

    if (filters.sizes.length && !filters.sizes.some(size => product.tamanhos.includes(size))) return false;
    if (filters.colors.length && !filters.colors.some(color => product.cores.includes(color))) return false;
    if (activePrice(product) > filters.maxPrice) return false;
    if (filters.search && !product.nome.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });



  filtered = sortProducts(filtered);
  renderProducts(filtered);

  const count = document.getElementById("count");
  if (count) count.textContent = filtered.length;
}

function sortProducts(list) {
  const sorted = [...list];
  switch (filters.sort) {
    case "menor-preco":
      return sorted.sort((a, b) => activePrice(a) - activePrice(b));
    case "maior-preco":
      return sorted.sort((a, b) => activePrice(b) - activePrice(a));
    case "lancamentos":
      return sorted.sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
    default:
      return sorted.sort((a, b) => Number(b.em_destaque) - Number(a.em_destaque) || statusScore(b) - statusScore(a));
  }
}

function renderProducts(list) {
  const grid = document.getElementById("grid");
  if (!grid) return;

  if (!list.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <strong>Nenhum produto encontrado.</strong>
        <span>Tente limpar os filtros ou buscar por outro nome.</span>
      </div>
    `;
    return;
  }

  grid.innerHTML = list.map((product, index) => {
    const isFav = favorites.includes(String(product.id));
    const image = product.imagem_principal || product.imagens[0] || "";
    const hoverImage = product.imagens.find(item => item !== image);
    const disabled = product.status === "esgotado" || product.ativo === false;
    return `
      <article class="product-card" data-id="${product.id}" style="animation-delay:${index * 45}ms">
        <div class="product-image">
          <img src="${escapeHtml(image)}" class="main-img" alt="${escapeHtml(product.nome)}" loading="lazy">
          ${hoverImage ? `<img src="${escapeHtml(hoverImage)}" class="hover-img" alt="${escapeHtml(product.nome)}" loading="lazy">` : ""}
          <div class="product-actions">
            <button class="favorite ${isFav ? "active" : ""}" data-id="${product.id}" aria-label="Favoritar">${isFav ? "♥" : "♡"}</button>
          </div>
          ${product.status ? `<span class="badge-product badge-product--${product.status}">${statusLabels[product.status] || product.status}</span>` : ""}
        </div>
        <div class="product-info">
          <p class="product-category">${escapeHtml(product.categoria)}</p>
          <h3>${escapeHtml(product.nome)}</h3>
          <div class="product-meta">${product.tamanhos.map(size => `<span>${escapeHtml(size)}</span>`).join("")}</div>
          <div class="price-line">
            ${product.preco_promocional ? `<span class="old-price">${money.format(product.preco)}</span>` : ""}
            <span class="price">${money.format(activePrice(product))}</span>
          </div>
          <button class="buy-btn" data-id="${product.id}" ${disabled ? "disabled" : ""}>${disabled ? "Esgotado" : "Adicionar à sacola"}</button>
        </div>
      </article>
    `;
  }).join("");

  bindProductEvents();
}

function bindProductEvents() {
  document.querySelectorAll(".favorite").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      toggleFavorite(String(button.dataset.id));
    });
  });

  document.querySelectorAll(".product-card").forEach(card => {
    card.addEventListener("click", event => {
      if (event.target.closest(".buy-btn") || event.target.closest(".favorite")) return;
      openProductModal(card.dataset.id);
    });
  });

  document.querySelectorAll(".buy-btn").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      const product = products.find(item => String(item.id) === String(button.dataset.id));
      if (product) startAddToCart(product);
    });
  });
}

function openProductModal(id) {
  const product = products.find(item => String(item.id) === String(id));
  if (!product) return;
  const disabled = product.status === "esgotado" || product.ativo === false;

  const modal = document.createElement("div");
  modal.classList.add("product-modal");
  modal.innerHTML = `
    <div class="modal-content" role="dialog" aria-modal="true" aria-label="${escapeHtml(product.nome)}">
      <button class="close-modal" aria-label="Fechar">x</button>
      <div class="modal-gallery">
        <img src="${escapeHtml(product.imagem_principal || product.imagens[0] || "")}" class="main-modal-image" id="mainImage" alt="${escapeHtml(product.nome)}">
        <div class="thumbs">
          ${product.imagens.map((image, index) => `<img src="${escapeHtml(image)}" class="thumb ${index === 0 ? "active" : ""}" alt="${escapeHtml(product.nome)}">`).join("")}
        </div>
      </div>
      <div class="modal-info">
        <p class="product-category">${escapeHtml(product.categoria)}</p>
        <h2>${escapeHtml(product.nome)}</h2>
        <div class="price-line price-line--modal">
          ${product.preco_promocional ? `<span class="old-price">${money.format(product.preco)}</span>` : ""}
          <span class="modal-price">${money.format(activePrice(product))}</span>
        </div>
        <p>${escapeHtml(product.descricao || "")}</p>
        <p class="modal-meta"><strong>Tamanhos:</strong> ${product.tamanhos.join(", ") || "Único"}<br><strong>Cores:</strong> ${product.cores.join(", ") || "Única"}</p>
        <button class="buy-btn" data-id="${product.id}" ${disabled ? "disabled" : ""}>${disabled ? "Esgotado" : "Adicionar à sacola"}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.style.overflow = "hidden";

  const close = () => {
    modal.remove();
    document.body.style.overflow = "";
  };

  modal.querySelector(".close-modal").addEventListener("click", close);
  modal.addEventListener("click", event => {
    if (event.target === modal) close();
  });

  const mainImage = modal.querySelector("#mainImage");
  modal.querySelectorAll(".thumb").forEach(thumb => {
    thumb.addEventListener("click", () => {
      mainImage.src = thumb.src;
      modal.querySelectorAll(".thumb").forEach(item => item.classList.remove("active"));
      thumb.classList.add("active");
    });
  });

  modal.querySelector(".buy-btn").addEventListener("click", () => {
    close();
    startAddToCart(product);
  });
}

function toggleFavorite(id) {
  favorites = favorites.includes(id)
    ? favorites.filter(item => item !== id)
    : [...favorites, id];
  localStorage.setItem("poderosaFavorites", JSON.stringify(favorites));
  updateFavoritesBadge();
  applyFilters();
}

function updateFavoritesBadge() {
  const badge = document.getElementById("favoritesBadge");
  if (badge) badge.textContent = favorites.length;
}

function loadCart() {
  const saved = JSON.parse(localStorage.getItem("poderosaCart") || "[]");
  if (!Array.isArray(saved)) return [];

  return saved
    .map(item => {
      if (typeof item === "object" && item.productId) {
        return {
          productId: String(item.productId),
          size: item.size || "",
          color: item.color || "",
          quantity: Math.max(1, Number(item.quantity || 1))
        };
      }

      return {
        productId: String(item),
        size: "",
        color: "",
        quantity: 1
      };
    })
    .filter(item => item.productId);
}

function saveCart() {
  localStorage.setItem("poderosaCart", JSON.stringify(cart));
  updateCartBadge();
  renderCart();
}

function startAddToCart(product) {
  if (product.status === "esgotado" || product.ativo === false) {
    showToast("Esse produto está esgotado no momento.");
    return;
  }

  if (product.tamanhos.length || product.cores.length) {
    openVariantModal(product);
    return;
  }

  addToCart(product, { size: "", color: "" });
}

function openVariantModal(product) {
  const modal = document.createElement("div");
  modal.className = "variant-modal";
  modal.innerHTML = `
    <div class="variant-box" role="dialog" aria-modal="true" aria-label="Escolher variações">
      <button class="close-modal" type="button" aria-label="Fechar">x</button>
      <img src="${escapeHtml(product.imagem_principal || product.imagens[0] || "")}" alt="${escapeHtml(product.nome)}">
      <div class="variant-box__info">
        <p class="product-category">${escapeHtml(product.categoria)}</p>
        <h2>${escapeHtml(product.nome)}</h2>
        <strong>${money.format(activePrice(product))}</strong>
        ${renderVariantOptions("Tamanho", "size", product.tamanhos)}
        ${renderVariantOptions("Cor", "color", product.cores)}
        <button class="cart-checkout" id="confirmVariant" type="button">Adicionar à sacola</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.style.overflow = "hidden";

  const close = () => {
    modal.remove();
    document.body.style.overflow = "";
  };

  modal.querySelector(".close-modal").addEventListener("click", close);
  modal.addEventListener("click", event => {
    if (event.target === modal) close();
  });

  modal.querySelectorAll("[data-option-group]").forEach(group => {
    group.querySelectorAll("button").forEach(button => {
      button.addEventListener("click", () => {
        group.querySelectorAll("button").forEach(item => item.classList.remove("active"));
        button.classList.add("active");
      });
    });
  });

  modal.querySelector("#confirmVariant").addEventListener("click", () => {
    const size = getSelectedVariant(modal, "size");
    const color = getSelectedVariant(modal, "color");

    if (product.tamanhos.length && !size) {
      showToast("Escolha um tamanho para continuar.");
      return;
    }

    if (product.cores.length && !color) {
      showToast("Escolha uma cor para continuar.");
      return;
    }

    addToCart(product, { size, color });
    close();
  });
}

function renderVariantOptions(label, group, values) {
  if (!values.length) return "";

  return `
    <div class="variant-group" data-option-group="${group}">
      <span>${label}</span>
      <div>
        ${values.map(value => `<button type="button" data-value="${escapeHtml(value)}">${escapeHtml(value)}</button>`).join("")}
      </div>
    </div>
  `;
}

function getSelectedVariant(scope, group) {
  return scope.querySelector(`[data-option-group="${group}"] button.active`)?.dataset.value || "";
}

function addToCart(product, options) {
  const key = getCartKey(product.id, options.size, options.color);
  const existing = cart.find(item => getCartKey(item.productId, item.size, item.color) === key);

  if (existing) existing.quantity += 1;
  else {
    cart.push({
      productId: String(product.id),
      size: options.size || "",
      color: options.color || "",
      quantity: 1
    });
  }

  saveCart();
  openCartDrawer();
  showToast("Produto adicionado à sacola.");
}

function updateCartBadge() {
  const badge = document.getElementById("cartBadge");
  if (badge) badge.textContent = cart.reduce((total, item) => total + item.quantity, 0);
  updateFavoritesBadge();
}

function renderCart() {
  const container = document.getElementById("cartItems");
  const totalEl = document.getElementById("cartTotal");
  const checkout = document.getElementById("cartCheckout");
  const clear = document.getElementById("cartClear");
  if (!container || !totalEl) return;

  const hydrated = getHydratedCartItems();
  const total = hydrated.reduce((sum, item) => sum + item.subtotal, 0);

  totalEl.textContent = money.format(total);
  if (checkout) checkout.disabled = !hydrated.length;
  if (clear) clear.disabled = !hydrated.length;

  if (!hydrated.length) {
    container.innerHTML = `
      <div class="cart-empty">
        <strong>Sua sacola está vazia.</strong>
        <span>Escolha suas peças favoritas e monte seu pedido.</span>
      </div>
    `;
    return;
  }

  container.innerHTML = hydrated.map(item => `
    <article class="cart-item" data-key="${escapeHtml(item.key)}">
      <img src="${escapeHtml(item.product.imagem_principal || item.product.imagens[0] || "")}" alt="${escapeHtml(item.product.nome)}">
      <div class="cart-item__body">
        <div>
          <h3>${escapeHtml(item.product.nome)}</h3>
          <p>${item.size ? `Tam. ${escapeHtml(item.size)}` : "Tam. único"} · ${item.color ? escapeHtml(item.color) : "Cor única"}</p>
        </div>
        <div class="cart-item__meta">
          <span>${money.format(item.unitPrice)}</span>
          <strong>${money.format(item.subtotal)}</strong>
        </div>
        <div class="cart-item__controls">
          <button type="button" data-cart-decrease="${escapeHtml(item.key)}" aria-label="Diminuir quantidade">−</button>
          <span>${item.quantity}</span>
          <button type="button" data-cart-increase="${escapeHtml(item.key)}" aria-label="Aumentar quantidade">+</button>
          <button type="button" class="cart-remove" data-cart-remove="${escapeHtml(item.key)}">Remover</button>
        </div>
      </div>
    </article>
  `).join("");

  bindCartItemEvents();
}

function bindCartItemEvents() {
  document.querySelectorAll("[data-cart-increase]").forEach(button => {
    button.addEventListener("click", () => changeCartQuantity(button.dataset.cartIncrease, 1));
  });

  document.querySelectorAll("[data-cart-decrease]").forEach(button => {
    button.addEventListener("click", () => changeCartQuantity(button.dataset.cartDecrease, -1));
  });

  document.querySelectorAll("[data-cart-remove]").forEach(button => {
    button.addEventListener("click", () => removeCartItem(button.dataset.cartRemove));
  });
}

function changeCartQuantity(key, delta) {
  const item = cart.find(cartItem => getCartKey(cartItem.productId, cartItem.size, cartItem.color) === key);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) removeCartItem(key);
  else saveCart();
}

function removeCartItem(key) {
  cart = cart.filter(item => getCartKey(item.productId, item.size, item.color) !== key);
  saveCart();
}

function clearCart() {
  cart = [];
  saveCart();
}

function getHydratedCartItems() {
  return cart
    .map(item => {
      const product = products.find(productItem => String(productItem.id) === String(item.productId));
      if (!product || product.ativo === false || product.status === "esgotado") return null;

      const unitPrice = activePrice(product);
      return {
        ...item,
        key: getCartKey(item.productId, item.size, item.color),
        product,
        unitPrice,
        subtotal: unitPrice * item.quantity
      };
    })
    .filter(Boolean);
}

function pruneUnavailableCartItems() {
  const availableIds = new Set(
    products
      .filter(product => product.ativo !== false && product.status !== "esgotado")
      .map(product => String(product.id))
  );
  const nextCart = cart.filter(item => availableIds.has(String(item.productId)));

  if (nextCart.length !== cart.length) {
    cart = nextCart;
    localStorage.setItem("poderosaCart", JSON.stringify(cart));
  }
}

function getCartKey(productId, size, color) {
  return `${productId}::${size || ""}::${color || ""}`;
}

function openCartDrawer() {
  renderCart();
  document.body.classList.add("cart-open");
  document.getElementById("cartDrawer")?.setAttribute("aria-hidden", "false");
}

function closeCartDrawer() {
  document.body.classList.remove("cart-open");
  document.getElementById("cartDrawer")?.setAttribute("aria-hidden", "true");
}


function checkoutWhatsApp() {
  const items = getHydratedCartItems();
  if (!items.length) {
    showToast("Sua sacola está vazia.");
    return;
  }

  const total = items.reduce((sum, item) => sum + item.subtotal, 0);
  const lines = [
    "Olá! Quero finalizar meu pedido na Poderosa Moda Fitness:",
    "",
    ...items.flatMap((item, index) => [
      `${index + 1}. ${item.product.nome}`,
      `Quantidade: ${item.quantity}`,
      `Tamanho: ${item.size || "Único"}`,
      `Cor: ${item.color || "Única"}`,
      `Preço unitário: ${money.format(item.unitPrice)}`,
      `Subtotal: ${money.format(item.subtotal)}`,
      ""
    ]),
    `Total geral: ${money.format(total)}`
  ];

  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank");
}

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.classList.remove("show"), 2600);
}

function renderSkeleton() {
  const grid = document.getElementById("grid");
  if (!grid) return;

  grid.innerHTML = Array.from({ length: 8 }, () => `
    <div class="product-card product-card--skeleton">
      <div class="product-image"></div>
      <div class="product-info">
        <span></span><strong></strong><p></p><button></button>
      </div>
    </div>
  `).join("");
}

function renderError(error) {
  const grid = document.getElementById("grid");
  if (!grid) return;

  grid.innerHTML = `
    <div class="empty-state empty-state--error">
      <strong>Não foi possível carregar a vitrine.</strong>
      <span>${escapeHtml(error.message || "Confira a configuração do Supabase e tente novamente.")}</span>
    </div>
  `;
}

function bindLayoutEvents() {
  const header = document.getElementById("header");
  window.addEventListener("scroll", () => header?.classList.toggle("scrolled", window.scrollY > 20));

  document.querySelectorAll("[data-whatsapp-contact]").forEach(link => {
    link.href = `https://wa.me/${WHATSAPP_NUMBER}`;
  });

  document.getElementById("menuToggle")?.addEventListener("click", () => {
    document.getElementById("menuToggle").classList.toggle("open");
    document.getElementById("nav").classList.toggle("open");
  });

  document.querySelectorAll("#nav a").forEach(link => link.addEventListener("click", () => {
    document.getElementById("menuToggle").classList.remove("open");
    document.getElementById("nav").classList.remove("open");
  }));

  document.querySelectorAll(".filter-group").forEach(group => {
    const title = group.querySelector(".filter-group__title");
    title?.addEventListener("click", () => group.classList.toggle("collapsed"));
  });

  document.getElementById("sortSelect")?.addEventListener("change", event => {
    filters.sort = event.target.value;
    applyFilters();
  });

  document.getElementById("searchInput")?.addEventListener("input", event => {
    filters.search = event.target.value;
    applyFilters();
  });

  document.getElementById("clearFilters")?.addEventListener("click", resetFilters);
  document.getElementById("filterToggle")?.addEventListener("click", openFilterDrawer);
  document.getElementById("filterOverlay")?.addEventListener("click", closeFilterDrawer);
  document.getElementById("closeFilters")?.addEventListener("click", closeFilterDrawer);
  document.getElementById("cartButton")?.addEventListener("click", openCartDrawer);
  document.getElementById("cartOverlay")?.addEventListener("click", closeCartDrawer);
  document.getElementById("cartClose")?.addEventListener("click", closeCartDrawer);
  document.getElementById("cartCheckout")?.addEventListener("click", checkoutWhatsApp);
  document.getElementById("cartClear")?.addEventListener("click", clearCart);

  if (!supabaseReady) {
    document.body.classList.add("is-demo-data");
  }
}

function resetFilters() {
  // Mantém a categoria atual vinda da URL (se existir)
  // e limpa apenas busca, tamanho, cor e preço.
  filters.sizes = [];
  filters.colors = [];
  filters.search = "";

  const priceRange = document.querySelector('[data-filter="price"]');
  if (priceRange) {
    setupFilterLimits();
    // setupFilterLimits já atualiza filters.maxPrice
  }

  // Preserva categoria vinda da URL (inclui status de novidades/outlet)
  applyUrlCategoryFilters();


  const searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.value = "";

  // Re-render para atualizar filtros disponíveis (checkbox/button ficam coerentes)
  renderFilters();
  applyFilters();
}


function openFilterDrawer() {
  document.body.classList.add("filters-open");
}

function closeFilterDrawer() {
  document.body.classList.remove("filters-open");
}

function activePrice(product) {
  return Number(product.preco_promocional || product.preco || 0);
}

function statusScore(product) {
  return { mais_vendido: 4, promocao: 3, novo: 2, esgotado: 0 }[product.status] || 1;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
