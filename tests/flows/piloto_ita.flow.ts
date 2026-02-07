import { defineFlow } from '../../src/runner/index.js';

export default defineFlow({
  name: 'Flujo piloto Itacamba',
  tags: ['Piloto_itacamba'],
  
  url: '${TEST_URL_ITA}',
  
  // Variables específicas de este test
  variables: {
    CLIENTE: 'CD GUARACACHI',
    SERVICIO: 'Venta',
    RUTA: 'Bolivia',
    DESPACHO:'Sin T/D',
    FECHA_CARGA:'10/02/2026',
    FECHA_DESCARGA:'12/02/2026',
    NRO_TRANSPORTE:'123333',
    NRO_PEDIDO:'4444441',
    TIPO_CAMION:'Tolva',
    TIPO_CARGA:'Caliza',
    UNIDAD_MEDIDA:'Tonelada',
    PESO:'23',
    ORIGEN:'CD EL ALTO',
    DESTINO:'INQUISIVI',
    EMPRESA_TRANSPORTE:'ADALID LOZA LOZA',
    PLACA:'1035-DNE',
    NOMBRE_CONDUCTOR:'ABEL CALIZAYA',
  },
  
  // Más tiempo entre pasos para formularios
  delayBetweenSteps: 4000,
  
  steps: [
  'Llenar campo email con ${TEST_EMAIL_ITA}, campo contraseña con ${TEST_PASSWORD_ITA}, y hacer click en botón Ingresar',
  'Hacer click en el elemento de menú que tenga el texto exacto "Gestión" y después en el submenú con texto exacto "Operaciones"',
  'Click en botón "Crear nueva"',
  `Completar formulario de step Operación:
   - Dropdown "Tipo de servicio": seleccionar \${SERVICIO}
   - Dropdown "Tipo de despacho": seleccionar \${DESPACHO}
   - Dropdown "Ruta": seleccionar \${RUTA}
   - Dropdown "Cliente": seleccionar \${CLIENTE}
   - Hacer click en botón "Siguiente"`,
  `Completar formulario de step Detalle de viaje:
   - Campo "Fecha de carga": \${FECHA_CARGA}
   - Campo "Fecha de descarga": \${FECHA_DESCARGA}
   - Campo "Nro. de transporte": \${NRO_TRANSPORTE}
   - Campo "Nro. de pedido": \${NRO_PEDIDO}
   - Dropdown "Tipo de camión": seleccionar \${TIPO_CAMION}
   - Hacer click en botón "Siguiente"`,
  `Completar formulario de step Medida y carga:
   - Dropdown "Tipo de carga": seleccionar \${TIPO_CARGA}
   - Dropdown "Unidad de medida": seleccionar \${UNIDAD_MEDIDA}
   - Campo "Peso": \${PESO}
   - Hacer click en botón "Siguiente"`,
  `Completar formulario de step Medida y carga:
   - Dropdown "Origen": seleccionar \${ORIGEN}
   - Dropdown "Destino": seleccionar \${DESTINO}`,  
]
});