// Open Prices (Open Food Facts, ODbL): prices shoppers have reported from receipts and shelf tags, by barcode.
// Only US-dollar reports are shown, newest first.

const cache = new Map();

export async function openPrices(barcode) {
  const code = String(barcode || '').replace(/\D/g, '');
  if (code.length < 8) return [];
  if (cache.has(code)) return cache.get(code);
  // barcodes come as UPC-A (12) or EAN-13 (13 with a leading 0); try both spellings
  const codes = [...new Set([code, code.length === 12 ? '0' + code : code, code.length === 13 && code[0] === '0' ? code.slice(1) : code])];
  let out = [];
  try {
    for (const c of codes) {
      const r = await fetch(`https://prices.openfoodfacts.org/api/v1/prices?product_code=${c}&order_by=-date&size=20`);
      if (!r.ok) continue;
      const j = await r.json();
      out.push(...(j.items || []).filter(x => x.currency === 'USD' && x.price > 0).map(x => ({
        price: x.price, date: x.date, store: x.location?.osm_name || 'A store', city: x.location?.osm_address_city || '', state: x.location?.osm_address_state || '',
      })));
      if (out.length) break;
    }
  } catch { }
  out = out.slice(0, 4);
  cache.set(code, out);
  return out;
}
