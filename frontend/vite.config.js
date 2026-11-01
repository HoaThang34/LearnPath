import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-shape') || id.includes('node_modules/d3-path') || id.includes('node_modules/d3-scale')) {
            return 'vendor-recharts'
          }
          if (id.includes('node_modules/d3')) {
            return 'vendor-d3'
          }
          if (
            id.includes('node_modules/react-markdown') ||
            id.includes('node_modules/rehype') ||
            id.includes('node_modules/remark') ||
            id.includes('node_modules/micromark') ||
            id.includes('node_modules/unist') ||
            id.includes('node_modules/vfile')
          ) {
            return 'vendor-markdown'
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-lucide'
          }
        },
      },
    },
  },
})
