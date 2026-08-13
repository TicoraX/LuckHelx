import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  test: {
    // `.claude/worktrees/` guarda copias completas del repo, con sus propios tests. Sin
    // esto, `npm test` corría la suite dos veces (24 archivos, 166 tests, donde había 12)
    // y la mitad de lo verde venía de código viejo que ya nadie edita.
    // `exclude` reemplaza los defaults de vitest, así que node_modules va explícito.
    exclude: ['**/node_modules/**', '**/.next/**', '.claude/**'],
  },
});
