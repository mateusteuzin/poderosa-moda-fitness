import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const config = window.PODEROSA_CONFIG || {};

export const supabaseReady = Boolean(config.supabaseUrl && config.supabaseAnonKey);

export const supabase = supabaseReady
  ? createClient(config.supabaseUrl, config.supabaseAnonKey)
  : null;

export const appConfig = {
  whatsappNumber: config.whatsappNumber || "5585982184602",
  imageBucket: config.imageBucket || "product-images",
  maxImageSizeMb: Number(config.maxImageSizeMb || 4)
};
