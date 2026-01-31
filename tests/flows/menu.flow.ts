import { defineFlow } from '../../src/runner/index.js';

export default defineFlow({
  name: 'Flujo piloto',
  tags: ['operadores','pilo'],
  
  url: '${TEST_URL}',

  
  // Más tiempo entre pasos para formularios
  delayBetweenSteps: 4000,
  
  steps: [
  'Llenar campo email con ${TEST_EMAIL}, campo contraseña con ${TEST_PASSWORD}, y hacer click en botón Ingresar',
   `Verificar pantalla Informe operativo:
   - sidebar "Estadísticas":
     - submenú: "Informe operativo"
     - submenú: "Scorecard"
   - sidebar "Monitoreo":
     - submenú: "Mapa de seguimiento"
     - submenú: "Dispositivos conectados"
     - submenú: "Control operativo"
   - sidebar "Gestión":
     - submenú: "Órdenes de carga"
     - submenú: "Operaciones"
     - submenú: "Facturación"`,
]
});