import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

// package.json의 version을 빌드 시 앱에 주입 (APP_VERSION이 실제 버전과 어긋나지 않도록)
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    outDir: 'dist',       // 결과물은 dist 폴더에 넣어라
    emptyOutDir: true,    // ⭐️ 핵심: 빌드 시작 전에 dist 폴더를 깨끗이 비워라!
  },
})
