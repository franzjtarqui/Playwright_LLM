import { defineFlow } from '../../../src/runner/index.js';

/**
 * Test de Navegación a Operadores
 * 
 * Tags:
 * - operadores: módulo de operadores
 * - navigation: test de navegación
 */
export default defineFlow({
  name: 'Navegación a sección Operadores',
  tags: ['operadores', 'navigation'],
  
  url: '${TEST_URL}',
  
  steps: [
    // Login primero
    'Ingresar email ${TEST_EMAIL} y contraseña ${TEST_PASSWORD}, click en Ingresar',
    
    // Navegar
    'Hacer click en la opción Mi flota',
    'Hacer click en Operadores',
    
    // Verificar
    'Verificar que aparece la sección de Configuración de Operadores'
  ]
});
