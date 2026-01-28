import { defineFlow } from '../../src/runner/index.js';

export default defineFlow({
  name: 'Flujo piloto',
  tags: ['operadores','piloto'],
  
  url: '${TEST_URL}',
  
  // Variables específicas de este test
  variables: {
    OPERADOR_NOMBRE: 'Marines Nolan',
    OPERADOR_APELLIDO: 'Jose Jose',
    OPERADOR_FECHA: '01/01/2009',
    OPERADOR_LICENCIA: '33333444444'
  },
  
  // Más tiempo entre pasos para formularios
  delayBetweenSteps: 4000,
  
  steps: [
    'Ingresar correo ${TEST_EMAIL} y contraseña ${TEST_PASSWORD}, hacer click en Ingresar',    
    'Ir a Mi flota y luego a Operadores',    
    'En configuración de Operadores, hacer click en "Crear nuevo"',    
    `Llenar el formulario con:
     - Nombre(s): \${OPERADOR_NOMBRE}
     - Apellido(s): \${OPERADOR_APELLIDO}
     - Fecha de nacimiento: \${OPERADOR_FECHA}
     - Apto para operar: seleccionar "Solo full"
     - Nro. de licencia de conducir: \${OPERADOR_LICENCIA}`,
  ]
});