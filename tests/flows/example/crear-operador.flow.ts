import { defineFlow } from '../../../src/runner/index.js';

/**
 * Test de Creación de Operador
 * 
 * Tags:
 * - operadores: módulo de operadores
 * - crud: operación de creación
 * - regression: test de regresión
 */
export default defineFlow({
  name: 'Crear nuevo operador',
  tags: ['operadores', 'crud', 'regression'],
  
  url: '${TEST_URL}',
  
  // Variables específicas de este test
  variables: {
    OPERADOR_NOMBRE: 'Jonas Alde',
    OPERADOR_APELLIDO: 'Ticona Mamani',
    OPERADOR_FECHA: '01/01/2008',
    OPERADOR_LICENCIA: '33333211112'
  },
  
  // Más tiempo entre pasos para formularios
  delayBetweenSteps: 4000,
  
  steps: [
    // Login
    'Ingresar correo ${TEST_EMAIL} y contraseña ${TEST_PASSWORD}, hacer click en Ingresar',
    
    // Navegar al módulo
    'Ir a Mi flota y luego a Operadores',
    
    // Abrir formulario
    'En configuración de Operadores, hacer click en "Crear nuevo"',
    
    // Llenar formulario
    `Llenar el formulario con:
     - Nombre(s): \${OPERADOR_NOMBRE}
     - Apellido(s): \${OPERADOR_APELLIDO}
     - Fecha de nacimiento: \${OPERADOR_FECHA}
     - Apto para operar: seleccionar "Solo full"
     - Nro. de licencia de conducir: \${OPERADOR_LICENCIA}`,
    
    // Guardar
    'Hacer click en el botón Guardar'
  ]
});
