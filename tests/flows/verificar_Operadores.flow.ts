import { defineFlow } from '../../src/runner/index.js';

export default defineFlow({
  name: 'Verificar pantalla Operadores',
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
   - columnas: "Nro de documento", "Nombre", "Apellido", "Tipo de flota", "Estado de verificación", "Nro de celular", "Orden de carga", "Etiqueta de flota", "Restricción" 
   - Verificar menú de opciones generales (botón tres puntos horizontales fuera de tabla):
     - opción habilitada: "Descargar"
     - opción habilitada: "Reporte de incidencias"
     - opción habilitada: "Editar columnas"
     - opción deshabilitada: "Limpiar filtros"`,
  `Verificar menú de acciones del primer registro (botón tres puntos verticales en tabla):
   - menú primer registro tabla:
     - opción: "Ver detalle"
     - opción: "Editar"
     - opción: "Eliminar"
     - opción: "Solicitar habilitación"`,
]
});