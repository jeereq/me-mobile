// Les tests tournent sur les sources TypeScript telles quelles : `import './autre'` doit y trouver `autre.ts`,
// comme le font Metro et tsc dans l'app. Ce crochet ajoute l'extension quand elle manque.
import { register } from 'node:module';

register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, suite) {
  try {
    return await suite(specifier, context);
  } catch (e) {
    if (e && e.code === 'ERR_MODULE_NOT_FOUND' && /^\\.{1,2}\\//.test(specifier) && !/\\.[a-z]+$/.test(specifier)) {
      return suite(specifier + '.ts', context);
    }
    throw e;
  }
}`), import.meta.url);
