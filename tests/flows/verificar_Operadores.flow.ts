import { defineFlow } from '../../src/runner/index.js';

export default defineFlow({
  name: 'Flujo piloto',
  tags: ['operadores','piloto'],
  
  url: '${TEST_URL}',

  
  // Más tiempo entre pasos para formularios
  delayBetweenSteps: 4000,
  
  steps: [
  'Llenar campo email con ${TEST_EMAIL}, campo contraseña con ${TEST_PASSWORD}, y hacer click en botón Ingresar',
  'Hacer click en el elemento de menú que tenga el texto exacto "Mi flota" y después en el submenú con texto exacto "Operadores"',
   `Verificar pantalla Operadores:
   - título exacto: "Operadores"
   - subtitulo exacto: "ZEMOG"
   - botón: "Crear nuevo"
   - tab: "Tradicional"
   - tab: "Eventuales"
   - placeholder: "Buscar por: Nombre, Apellido, Nro. de documento"
   - columna: "Nombre"
   - columna: "Apellido"
   - menú "...":
     - opción habilitada: "Descargar"
     - opción habilitada: "Reporte de incidencias"
     - opción habilitada: "Editar columnas"
     - opción deshabilitada: "Limpiar filtros"`,
  `Verificar menú de registro de la tabla:
   - menú primer registro tabla:
     - opción: "Ver detalle"
     - opción: "Editar"
     - opción: "Eliminar"
     - opción: "Solicitar habilitación"`,
]
});