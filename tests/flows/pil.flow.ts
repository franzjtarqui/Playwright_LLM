import { defineFlow } from '../../src/runner/index.js';

export default defineFlow({
  name: 'Flujo Pil',
  tags: ['operadores','pil'],
  
  url: '${TEST_URL}',
  
  // Variables específicas de este test
  variables: {
  },
  
  // Más tiempo entre pasos para formularios
  delayBetweenSteps: 4000,
  
  steps: [
    'Ingresar correo ${TEST_EMAIL} y contraseña ${TEST_PASSWORD}, hacer click en Ingresar',    
    'Ir a Mi flota y luego a Libreria',
  ]
});