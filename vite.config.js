import {defineConfig} from 'vite';
import {resolve} from 'node:path';
export default defineConfig({build:{rollupOptions:{input:{index:resolve('index.html'),admin:resolve('admin.html'),storskjerm:resolve('storskjerm.html')}}}});
