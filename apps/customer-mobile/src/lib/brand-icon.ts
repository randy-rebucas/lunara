// Mirrors partner-brands/<slug>/icon.png (or the default Lunara icon) at build time —
// see app.config.js. Always import this instead of `assets/icon.png` directly so in-app
// logos (login, home banner, BrandMark) stay in sync with a white-labeled build.
export const brandIconSource = require('../../assets/generated-brand-icon.png');
