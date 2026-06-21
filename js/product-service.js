import { appConfig, supabase, supabaseReady } from "./supabase-client.js";

const STORAGE_KEY = "poderosaAdminProducts";

export function getFallbackProducts() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return JSON.parse(saved);
  return getInitialCatalogProducts();
}

export function getInitialCatalogProducts() {
  return (window.defaultProducts || window.PODEROSA_FALLBACK_PRODUCTS || []).map(normalizeProduct);
}

export function normalizeProduct(product) {
  const imagens = product.imagens || product.images || [];
  return {
    id: product.id === undefined || product.id === null || product.id === "" ? undefined : String(product.id),
    nome: product.nome || product.name || "",
    slug: product.slug || slugify(product.nome || product.name || ""),
    descricao: product.descricao || product.description || "",
    preco: Number(product.preco ?? product.price ?? 0),
    preco_promocional: product.preco_promocional ? Number(product.preco_promocional) : null,
    categoria: product.categoria || product.category || "Sem categoria",
    tamanhos: parseArray(product.tamanhos || product.sizes),
    cores: parseArray(product.cores || product.colors),
    imagens,
    imagem_principal: product.imagem_principal || imagens[0] || "",
    status: product.status || (product.isNew ? "novo" : "mais_vendido"),
    estoque: product.estoque ?? null,
    em_destaque: Boolean(product.em_destaque),
    no_banner: Boolean(product.no_banner),
    ativo: product.ativo !== false,
    criado_em: product.criado_em || product.created_at || new Date().toISOString(),
    atualizado_em: product.atualizado_em || product.updated_at || new Date().toISOString()
  };
}

export function parseArray(value) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  if (!value) return [];
  return String(value).split(",").map(item => item.trim()).filter(Boolean);
}

export function slugify(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function listPublicProducts() {
  if (!supabaseReady) {
    return getFallbackProducts().filter(product => product.ativo);
  }

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("ativo", true)
    .order("em_destaque", { ascending: false })
    .order("criado_em", { ascending: false });

  if (error) throw error;
  return data.map(normalizeProduct);
}

export async function listAdminProducts() {
  if (!supabaseReady) return getFallbackProducts();

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("criado_em", { ascending: false });

  if (error) throw error;
  return data.map(normalizeProduct);
}

export async function saveProduct(product) {
  const now = new Date().toISOString();
  const payload = cleanProductPayload(normalizeProduct({
    ...product,
    slug: product.slug || slugify(product.nome),
    atualizado_em: now,
    criado_em: product.criado_em || now
  }));

  if (!supabaseReady) {
    const products = getFallbackProducts();
    const id = payload.id || Date.now();
    const next = { ...payload, id };
    const index = products.findIndex(productItem => String(productItem.id) === String(id));
    if (index >= 0) products[index] = next;
    else products.unshift(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    return next;
  }

  const { data, error } = await supabase
    .from("products")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();

  if (error) throw error;
  return normalizeProduct(data);
}

export async function deleteProduct(id) {
  if (!supabaseReady) {
    const products = getFallbackProducts().filter(product => String(product.id) !== String(id));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    return;
  }

  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}

export async function setProductActive(id, active) {
  if (!supabaseReady) {
    const products = getFallbackProducts().map(product =>
      String(product.id) === String(id) ? { ...product, ativo: active, atualizado_em: new Date().toISOString() } : product
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    return;
  }

  const { error } = await supabase
    .from("products")
    .update({ ativo: active, atualizado_em: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export async function uploadProductImages(files) {
  const validFiles = validateImageFiles(files);
  if (!supabaseReady) return validFiles.map(file => URL.createObjectURL(file));

  const urls = [];
  for (const file of validFiles) {
    const ext = file.name.split(".").pop();
    const path = `products/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from(appConfig.imageBucket)
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (error) throw error;

    const { data } = supabase.storage.from(appConfig.imageBucket).getPublicUrl(path);
    urls.push(data.publicUrl);
  }

  return urls;
}

export function validateImageFiles(files) {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  const maxBytes = appConfig.maxImageSizeMb * 1024 * 1024;

  return [...files].map(file => {
    if (!allowed.includes(file.type)) {
      throw new Error(`A imagem "${file.name}" precisa ser JPG, PNG ou WEBP.`);
    }
    if (file.size > maxBytes) {
      throw new Error(`A imagem "${file.name}" passa de ${appConfig.maxImageSizeMb}MB.`);
    }
    return file;
  });
}

function cleanProductPayload(product) {
  return Object.fromEntries(
    Object.entries(product).filter(([, value]) => value !== undefined)
  );
}
