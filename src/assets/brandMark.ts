/**
 * CloudProxyz mark: a black tile holding four swatches from the brand colour strip.
 * Inline SVG so the single-file build needs no external asset.
 */
const BRAND_MARK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
  '<rect width="32" height="32" fill="#111"/>' +
  '<rect x="5" y="5" width="10" height="10" fill="#d9403a"/>' +
  '<rect x="17" y="5" width="10" height="10" fill="#f4d23d"/>' +
  '<rect x="5" y="17" width="10" height="10" fill="#3f9d5a"/>' +
  '<rect x="17" y="17" width="10" height="10" fill="#3b6fd8"/>' +
  '</svg>';

export const BRAND_MARK_DATA_URI = `data:image/svg+xml,${encodeURIComponent(BRAND_MARK_SVG)}`;
