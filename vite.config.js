import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Expõe o endereço "Network" para abrir no celular na mesma Wi-Fi.
    host: true,
  },
})
