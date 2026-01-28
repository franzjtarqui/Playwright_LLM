/**
 * AI Test Runner - Ejecutor de tests en lenguaje natural
 * 
 * @example
 * ```typescript
 * // Definir un flow de test
 * import { defineFlow } from './src/runner';
 * 
 * export default defineFlow({
 *   name: 'Login al sistema',
 *   tags: ['smoke', 'login'],
 *   steps: [
 *     'Ingresar email ${TEST_EMAIL}',
 *     'Click en Ingresar'
 *   ]
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Ejecutar tests
 * import { FlowRunner } from './src/runner';
 * 
 * const runner = new FlowRunner({
 *   testDir: './tests/flows',
 *   tags: ['smoke']  // Solo ejecutar tests con tag 'smoke'
 * });
 * 
 * await runner.run();
 * ```
 */

export { defineFlow, defineFlows } from './define-flow.js';
export { FlowRunner } from './flow-runner.js';
export { FlowLoader } from './flow-loader.js';
export { VariableResolver } from './variable-resolver.js';
export * from './types.js';
