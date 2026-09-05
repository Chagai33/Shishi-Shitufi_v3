import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// The one place the site knows its own address. og:url and both share-image tags
// are built from it, so the day a domain arrives this is a single value to change
// and not a hunt through the repo.
// See DOCS/PLANING/106-what-a-domain-switch-will-touch.md
const DEFAULT_SITE_ORIGIN = 'https://shishi-shitufi.netlify.app';

export default defineConfig(({ mode }) => {
  // VITE_SITE_ORIGIN wins when it is set, in a .env file or in the build
  // environment. .env is not in the repo, so the default above is what Netlify
  // actually builds with today.
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const siteOrigin = (env.VITE_SITE_ORIGIN || DEFAULT_SITE_ORIGIN).replace(/\/$/, '');

  return {
    plugins: [
      react(),
      {
        name: 'inject-site-origin',
        transformIndexHtml(html: string) {
          return html.split('__SITE_ORIGIN__').join(siteOrigin);
        },
      },
    ],
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    esbuild: {
      drop: ['console', 'debugger'],
    },
    build: {
      minify: 'esbuild',
    },
  };
});
//
