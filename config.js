// YZ SKU Admin — configuration
// The publishable key is safe to ship in a public site: every table is locked by
// row-level security so only emails listed in public.sku_admins can read or write.
window.YZ_CONFIG = {
  SUPABASE_URL: "https://xbjjmfdmdcdsyplhgqus.supabase.co",
  SUPABASE_KEY: "sb_publishable_n0AeHwTE71p56PrjUav_iQ_KRpyrY7D",
  // Base link printed inside every QR code. Leave empty to use the address the app
  // is opened from (e.g. https://leeyazi.github.io/YZ-SKU/). Set it explicitly once
  // you know your final address so labels never change.
  QR_BASE_URL: "https://leeyazi.github.io/YZ-SKU/",
  CURRENCY: "SGD",
};
