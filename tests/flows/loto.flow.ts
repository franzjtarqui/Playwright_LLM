import { defineFlow } from '../../src/runner/index.js';

export default defineFlow({
  name: 'Flujo Loto',
  tags: ['operadores','pil'],
  
  url: '${TEST_URL}',
  
  // Variables específicas de este test
  variables: {
  },
  
  // Más tiempo entre pasos para formularios
  delayBetweenSteps: 4000,
  
  steps: [
    'Ingresar correo ${TEST_EMAIL} y contraseña ${TEST_PASSWORD}, hacer click en Ingresar',    
    'Ir a Gestión y luego a Órdenes de carga',
  ]
});