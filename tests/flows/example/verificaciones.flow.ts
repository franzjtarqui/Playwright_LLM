import { defineFlows } from '../../../src/runner/index.js';

/**
 * Múltiples tests de verificación en un solo archivo
 * Útil para agrupar tests relacionados
 */
export default defineFlows([
  {
    name: 'Verificar dashboard después de login',
    tags: ['smoke', 'dashboard'],
    url: '${TEST_URL}',
    steps: [
      'Login con ${TEST_EMAIL} y ${TEST_PASSWORD}',
      'Verificar que existe el título "Informe operativo"',
      'Verificar que aparece el menú lateral'
    ]
  },
  
  {
    name: 'Verificar menú Mi flota',
    tags: ['smoke', 'menu'],
    url: '${TEST_URL}',
    steps: [
      'Login con ${TEST_EMAIL} y ${TEST_PASSWORD}',
      'Hacer click en Mi flota',
      'Verificar que aparecen las opciones: Operadores, Vehículos, Rutas'
    ]
  },
  
  {
    name: 'Verificar logout',
    tags: ['smoke', 'auth', 'logout'],
    url: '${TEST_URL}',
    steps: [
      'Login con ${TEST_EMAIL} y ${TEST_PASSWORD}',
      'Hacer click en el menú de usuario o perfil',
      'Hacer click en Cerrar sesión',
      'Verificar que aparece la página de login'
    ]
  }
]);
