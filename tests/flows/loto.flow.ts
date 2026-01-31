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
    'Llenar campo email con ${TEST_EMAIL}, campo contraseña con ${TEST_PASSWORD}, y hacer click en botón Ingresar',
    'Click en menú "Gestión", luego en "Órdenes de carga"',
  ]
});