// Tailwind v4 is CSS-first (no tailwind.config.js). Its only footprint here is the docs
// surface (fumadocs-ui ships on Tailwind v4); marketing stays plain CSS keyed off --cs-*.
const config = { plugins: { "@tailwindcss/postcss": {} } };

export default config;
