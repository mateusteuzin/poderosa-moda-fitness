import { supabase, supabaseReady } from "./js/supabase-client.js";
import { deleteProduct, listAdminProducts, parseArray, saveProduct, setProductActive, slugify, uploadProductImages } from "./js/product-service.js";

let products = [];
let currentImages = [];
let draggedImage = null;

const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");
const setupAlert = document.getElementById("setupAlert");
const productForm = document.getElementById("productForm");
const adminList = document.getElementById("adminList");
const imagePreviewList = document.getElementById("imagePreviewList");
const dashboardAlert = document.getElementById("dashboardAlert");
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

initAdmin();

async function initAdmin() {
  bindEvents();

  if (!supabaseReady) {
    showDashboard();
    showAlert("Supabase ainda nao configurado. O painel abriu em modo local apenas para testes; configure supabase-config.js e as politicas RLS antes de publicar.");
    return;
  }

  const { data } = await supabase.auth.getSession();
  if (data.session) showDashboard();
  else showLogin();
}

function bindEvents() {
  document.getElementById("loginForm")?.addEventListener("submit", handleLogin);
  document.getElementById("logoutButton")?.addEventListener("click", handleLogout);
  document.getElementById("newProductButton")?.addEventListener("click", resetForm);
  productForm?.addEventListener("submit", handleSave);
  document.getElementById("deleteButton")?.addEventListener("click", handleDelete);
  document.getElementById("toggleActiveButton")?.addEventListener("click", handleToggleActive);
  document.getElementById("imageUpload")?.addEventListener("change", handleUpload);
  document.getElementById("adminSearch")?.addEventListener("input", renderAdminList);
}

async function handleLogin(event) {
  event.preventDefault();
  clearAlert();

  if (!supabaseReady) {
    showDashboard();
    return;
  }

  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    showAlert(error.message);
    return;
  }

  showDashboard();
}

async function handleLogout() {
  if (supabaseReady) await supabase.auth.signOut();
  showLogin();
}

async function showDashboard() {
  loginView.hidden = true;
  dashboardView.hidden = false;
  await refreshProducts();
}

function showLogin() {
  loginView.hidden = false;
  dashboardView.hidden = true;
}

async function refreshProducts() {
  try {
    products = await listAdminProducts();
    renderAdminList();
  } catch (error) {
    showAlert(error.message || "Nao foi possivel carregar os produtos.");
  }
}

function renderAdminList() {
  const term = document.getElementById("adminSearch")?.value.toLowerCase() || "";
  const filtered = products.filter(product => product.nome.toLowerCase().includes(term));
  document.getElementById("adminCount").textContent = `${filtered.length} produto(s)`;

  if (!filtered.length) {
    adminList.innerHTML = `<div class="admin-empty">Nenhum produto encontrado.</div>`;
    return;
  }

  adminList.innerHTML = filtered.map(product => `
    <article class="admin-item" data-id="${product.id}">
      <img src="${escapeHtml(product.imagem_principal || product.imagens[0] || "")}" alt="${escapeHtml(product.nome)}">
      <div>
        <strong>${escapeHtml(product.nome)}</strong>
        <span>${escapeHtml(product.categoria)} · ${money.format(product.preco_promocional || product.preco)} · ${formatStatus(product.status)}</span>
      </div>
      <div class="admin-item__actions">
        <span class="admin-status ${product.ativo ? "is-active" : ""}">${product.ativo ? "Ativo" : "Inativo"}</span>
        <button type="button" class="admin-mini-button" data-active-toggle="${product.id}">${product.ativo ? "Desativar" : "Ativar"}</button>
      </div>
    </article>
  `).join("");

  adminList.querySelectorAll(".admin-item").forEach(item => {
    item.addEventListener("click", event => {
      if (event.target.closest("[data-active-toggle]")) return;
      editProduct(item.dataset.id);
    });
  });

  adminList.querySelectorAll("[data-active-toggle]").forEach(button => {
    button.addEventListener("click", async event => {
      event.stopPropagation();
      const product = products.find(item => String(item.id) === String(button.dataset.activeToggle));
      if (!product) return;
      await toggleProductActive(product);
    });
  });
}

function editProduct(id) {
  const product = products.find(item => String(item.id) === String(id));
  if (!product) return;

  document.getElementById("formTitle").textContent = "Editar produto";
  document.getElementById("deleteButton").hidden = false;
  document.getElementById("productId").value = product.id;
  document.getElementById("createdAt").value = product.criado_em || "";
  document.getElementById("nome").value = product.nome;
  document.getElementById("preco").value = product.preco;
  document.getElementById("precoPromocional").value = product.preco_promocional || "";
  document.getElementById("categoria").value = product.categoria;
  document.getElementById("status").value = product.status;
  document.getElementById("tamanhos").value = product.tamanhos.join(", ");
  document.getElementById("cores").value = product.cores.join(", ");
  document.getElementById("estoque").value = product.estoque ?? "";
  document.getElementById("slug").value = product.slug;
  document.getElementById("descricao").value = product.descricao || "";
  document.getElementById("ativo").checked = product.ativo;
  document.getElementById("emDestaque").checked = product.em_destaque;
  document.getElementById("noBanner").checked = product.no_banner;
  updateToggleActiveButton(product.ativo);
  currentImages = [...product.imagens];
  renderImagePreview();
}

async function handleSave(event) {
  event.preventDefault();
  clearAlert();

  const product = {
    id: document.getElementById("productId").value || undefined,
    criado_em: document.getElementById("createdAt").value || undefined,
    nome: document.getElementById("nome").value.trim(),
    slug: document.getElementById("slug").value.trim() || slugify(document.getElementById("nome").value),
    descricao: document.getElementById("descricao").value.trim(),
    preco: Number(document.getElementById("preco").value),
    preco_promocional: document.getElementById("precoPromocional").value ? Number(document.getElementById("precoPromocional").value) : null,
    categoria: document.getElementById("categoria").value.trim(),
    tamanhos: parseArray(document.getElementById("tamanhos").value),
    cores: parseArray(document.getElementById("cores").value),
    imagens: currentImages,
    imagem_principal: currentImages[0] || "",
    status: document.getElementById("status").value,
    estoque: document.getElementById("estoque").value ? Number(document.getElementById("estoque").value) : null,
    ativo: document.getElementById("ativo").checked,
    em_destaque: document.getElementById("emDestaque").checked,
    no_banner: document.getElementById("noBanner").checked
  };

  if (!product.imagens.length) {
    showAlert("Adicione pelo menos uma imagem para o produto.");
    return;
  }

  try {
    await saveProduct(product);
    resetForm();
    await refreshProducts();
    showAlert("Produto salvo com sucesso.", "success");
  } catch (error) {
    showAlert(error.message || "Nao foi possivel salvar o produto.");
  }
}

async function handleDelete() {
  const id = document.getElementById("productId").value;
  if (!id || !confirm("Excluir este produto?")) return;

  try {
    await deleteProduct(id);
    resetForm();
    await refreshProducts();
    showAlert("Produto excluido.", "success");
  } catch (error) {
    showAlert(error.message || "Nao foi possivel excluir o produto.");
  }
}

async function handleToggleActive() {
  const id = document.getElementById("productId").value;
  if (!id) return;
  const product = products.find(item => String(item.id) === String(id));
  if (!product) return;
  await toggleProductActive(product);
  const updated = products.find(item => String(item.id) === String(id));
  if (updated) editProduct(updated.id);
}

async function toggleProductActive(product) {
  clearAlert();
  try {
    await setProductActive(product.id, !product.ativo);
    await refreshProducts();
    showAlert(product.ativo ? "Produto desativado. Ele saiu da vitrine pública." : "Produto ativado na vitrine.", "success");
  } catch (error) {
    showAlert(error.message || "Nao foi possivel alterar o status do produto.");
  }
}

async function handleUpload(event) {
  clearAlert();
  try {
    const urls = await uploadProductImages(event.target.files);
    currentImages = [...currentImages, ...urls];
    renderImagePreview();
    event.target.value = "";
  } catch (error) {
    showAlert(error.message);
  }
}

function renderImagePreview() {
  if (!currentImages.length) {
    imagePreviewList.innerHTML = `<div class="admin-empty">Nenhuma imagem adicionada.</div>`;
    return;
  }

  imagePreviewList.innerHTML = currentImages.map((url, index) => `
    <div class="image-preview" draggable="true" data-index="${index}">
      <img src="${escapeHtml(url)}" alt="Imagem ${index + 1}">
      <span>${index === 0 ? "Principal" : `Foto ${index + 1}`}</span>
      <div class="image-preview__actions">
        <label>
          Trocar
          <input type="file" data-replace="${index}" accept="image/jpeg,image/png,image/webp">
        </label>
        <button type="button" data-remove="${index}" aria-label="Remover imagem">Remover</button>
      </div>
    </div>
  `).join("");

  imagePreviewList.querySelectorAll("[data-remove]").forEach(button => {
    button.addEventListener("click", () => {
      currentImages.splice(Number(button.dataset.remove), 1);
      renderImagePreview();
    });
  });

  imagePreviewList.querySelectorAll("[data-replace]").forEach(input => {
    input.addEventListener("change", async () => {
      if (!input.files.length) return;
      clearAlert();
      try {
        const [url] = await uploadProductImages(input.files);
        currentImages[Number(input.dataset.replace)] = url;
        renderImagePreview();
      } catch (error) {
        showAlert(error.message || "Nao foi possivel trocar a imagem.");
      }
    });
  });

  imagePreviewList.querySelectorAll(".image-preview").forEach(item => {
    item.addEventListener("dragstart", () => draggedImage = Number(item.dataset.index));
    item.addEventListener("dragover", event => event.preventDefault());
    item.addEventListener("drop", () => {
      const target = Number(item.dataset.index);
      const [moved] = currentImages.splice(draggedImage, 1);
      currentImages.splice(target, 0, moved);
      renderImagePreview();
    });
  });
}

function resetForm() {
  productForm.reset();
  document.getElementById("formTitle").textContent = "Novo produto";
  document.getElementById("deleteButton").hidden = true;
  document.getElementById("toggleActiveButton").hidden = true;
  document.getElementById("productId").value = "";
  document.getElementById("createdAt").value = "";
  document.getElementById("ativo").checked = true;
  currentImages = [];
  renderImagePreview();
}

function updateToggleActiveButton(isActive) {
  const button = document.getElementById("toggleActiveButton");
  button.hidden = false;
  button.textContent = isActive ? "Desativar" : "Ativar";
}

function formatStatus(status) {
  return {
    novo: "Novo",
    mais_vendido: "Mais vendido",
    promocao: "Promocao",
    esgotado: "Esgotado"
  }[status] || status || "Sem status";
}

function showAlert(message, type = "error") {
  const target = dashboardView.hidden ? setupAlert : dashboardAlert;
  target.hidden = false;
  target.textContent = message;
  target.dataset.type = type;
}

function clearAlert() {
  setupAlert.hidden = true;
  setupAlert.textContent = "";
  dashboardAlert.hidden = true;
  dashboardAlert.textContent = "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
