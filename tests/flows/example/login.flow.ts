import { defineFlow } from '../../../src/runner/index.js';

/**
 * Test de Login
 * 
 * Tags:
 * - smoke: test básico que debe pasar siempre
 * - login: relacionado con autenticación
 * - critical: funcionalidad crítica
 */
export default defineFlow({
  name: 'Login al sistema',
  tags: ['smoke', 'login', 'critical'],
  
  // URL viene de la variable de entorno
  url: '${TEST_URL}',
  
  steps: [
    'Ingresar correo electrónico ${TEST_EMAIL} y contraseña ${TEST_PASSWORD}, luego hacer click en el botón Ingresar',
    'Verificar que aparece el título "Informe operativo" en la página'
  ],
  
  // Callbacks opcionales
  onStepSuccess: (step) => {
    console.log(`   ✓ ${step.substring(0, 50)}...`);
  },
  
  onStepError: (step, error) => {
    console.log(`   ✗ ${step.substring(0, 50)}...`);
    console.log(`     Error: ${error.message}`);
  }
});
