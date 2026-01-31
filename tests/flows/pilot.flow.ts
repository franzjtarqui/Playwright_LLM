import { defineFlow } from '../../src/runner/index.js';

export default defineFlow({
  name: 'Flujo piloto',
  tags: ['operadores','pil'],
  
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
  'Llenar campo email con ${TEST_EMAIL}, campo contraseña con ${TEST_PASSWORD}, y hacer click en botón Ingresar',
  'Hacer click en el elemento de menú que tenga el texto exacto "Mi flota" y después en el submenú con texto exacto "Operadores"',
  'Click en botón "Crear nuevo"',
  `Completar formulario de operador:
   - Campo "Nombre(s)": \${OPERADOR_NOMBRE}
   - Campo "Apellido(s)": \${OPERADOR_APELLIDO}
   - Campo "Fecha de nacimiento": \${OPERADOR_FECHA}
   - Campo "Nro. de licencia de conducir": \${OPERADOR_LICENCIA}
   - Dropdown "Apto para operar": seleccionar "Solo full"`,
]
});