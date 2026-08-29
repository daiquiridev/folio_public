import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

// Inject extension-specific scripts (oauth.js) into pages that use Raindrop
// auth — the new tab page doesn't, and every ms counts there.
function injectExtensionScripts(): Plugin {
  return {
    name: 'inject-extension-scripts',
    transformIndexHtml(_html, ctx) {
      if (ctx.filename.endsWith('newtab.html')) return []
      return [
        { tag: 'script', attrs: { src: 'oauth.js' }, injectTo: 'head-prepend' },
      ]
    },
  }
}

export default defineConfig({
  root: 'src',
  plugins: [
    react(),
    tailwindcss(),
    injectExtensionScripts(),
  ],
  build: {
    outDir: '../extension',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup.html'),
        options: resolve(__dirname, 'src/options.html'),
        newtab: resolve(__dirname, 'src/newtab.html'),
      },
      output: {
        entryFileNames: '[name].bundle.js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})
