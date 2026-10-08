/**
 * CloudProxyz mark: a minimal cloud — three circular lobes on a flat baseline, drawn as a single
 * path on a 32×32 grid. Arc endpoints are the exact circle intersections, so the silhouette has no
 * seams at any size.
 */
export const BRAND_MARK_VIEWBOX = '0 0 32 32';

export const BRAND_MARK_PATH =
  'M9 25.25A5.5 5.5 0 0 1 8.75 14.26A7.25 7.25 0 0 1 23.22 13.29A6 6 0 0 1 22.5 25.25Z';

// Favicon: white cloud on a charcoal rounded tile, legible on light and dark browser chrome.
const FAVICON_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${BRAND_MARK_VIEWBOX}">` +
  '<rect width="32" height="32" rx="8" fill="#202020"/>' +
  `<path d="${BRAND_MARK_PATH}" fill="#fff" transform="translate(16 16.4) scale(.8) translate(-16 -16)"/>` +
  '</svg>';

export const BRAND_MARK_DATA_URI = `data:image/svg+xml,${encodeURIComponent(FAVICON_SVG)}`;
