import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const desktopRoot = __dirname

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: resolve(desktopRoot, 'src/main/index.ts'),
      },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        input: resolve(desktopRoot, 'src/preload/index.ts'),
      },
    },
  },
  renderer: {
    root: resolve(desktopRoot, 'src/renderer'),
    build: {
      rollupOptions: {
        input: resolve(desktopRoot, 'src/renderer/index.html'),
      },
    },
    plugins: [react()],
  },
})
