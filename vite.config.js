import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 👇 이 부분이 새로 추가된 설정입니다
  build: {
    outDir: 'dist',       // 결과물은 dist 폴더에 넣어라
    emptyOutDir: true,    // ⭐️ 핵심: 빌드 시작 전에 dist 폴더를 깨끗이 비워라!
  },
})