import { FlowDefinition } from './types.js';

/**
 * Helper para definir un flow con tipado completo
 * 
 * @example
 * ```typescript
 * import { defineFlow } from '../../src/runner';
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
 */
export function defineFlow(definition: FlowDefinition): FlowDefinition {
  // Aplicar defaults
  return {
    timeout: 60000,
    delayBetweenSteps: 2000,
    analysisMode: 'html',
    tags: [],
    ...definition,
  };
}

/**
 * Helper para definir múltiples flows en un archivo
 * 
 * @example
 * ```typescript
 * import { defineFlows } from '../../src/runner';
 * 
 * export default defineFlows([
 *   {
 *     name: 'Test 1',
 *     steps: ['...']
 *   },
 *   {
 *     name: 'Test 2', 
 *     steps: ['...']
 *   }
 * ]);
 * ```
 */
export function defineFlows(definitions: FlowDefinition[]): FlowDefinition[] {
  return definitions.map(defineFlow);
}
