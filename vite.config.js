import { defineConfig } from 'vite';
export default defineConfig({
    build: { rolldownOptions: { output: { codeSplitting: { groups: [{name:'three-core',test:/node_modules\/three\/(?:build|src)\//},{name:'three-effects',test:/node_modules\/three\/examples\//}] } } } }
});
