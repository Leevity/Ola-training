import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({ plugins: [react(),tailwindcss()], server: { host:'0.0.0.0',port: 4173,strictPort:true,proxy:{'/api':{target:'http://127.0.0.1:4190',changeOrigin:false}} },preview:{host:"0.0.0.0",port:4173,strictPort:true,proxy:{'/api':{target:'http://127.0.0.1:4190',changeOrigin:false}}} });
