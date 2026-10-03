/** Visual identity for this deployment. This is not a tenant or authorization setting. */
export const brand = {
  name: process.env.REACT_APP_BRAND_NAME || 'KP Transportes',
  shortName: process.env.REACT_APP_BRAND_SHORT_NAME || 'KP',
  wordmark: process.env.REACT_APP_BRAND_WORDMARK || 'TRANSPORTES',
  tagline: process.env.REACT_APP_BRAND_TAGLINE || 'Conectando caminhos.',
  logoUrl: process.env.REACT_APP_BRAND_LOGO_URL || '',
  productName: 'Gestão operacional',
};
