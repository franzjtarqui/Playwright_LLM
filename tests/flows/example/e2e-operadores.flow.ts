import { defineFlow } from '../../../src/runner/index.js';

/**
 * Test lento/pesado - excluido de smoke tests
 * 
 * Tags:
 * - slow: test que toma mucho tiempo
 * - e2e: test end-to-end completo
 * - regression: test de regresión
 */
export default defineFlow({
  name: 'Flujo completo de gestión de operadores',
  tags: ['slow', 'e2e', 'regression'],
  
  url: '${TEST_URL}',
  timeout: 120000,  // 2 minutos
  delayBetweenSteps: 5000,
  
  steps: [
    // Login
    'Ingresar credenciales ${TEST_EMAIL} / ${TEST_PASSWORD} y hacer login',
    
    // Navegar
    'Ir a Mi flota > Operadores',
    
    // Crear operador
    'Click en Crear nuevo',
    'Llenar formulario: Nombre "Test Auto", Apellido "E2E", Fecha "01/01/1990"',
    'Seleccionar "Solo full" en Apto para operar',
    'Guardar el formulario',
    
    // Verificar creación
    'Verificar que aparece mensaje de éxito',
    'Buscar el operador "Test Auto" en la lista',
    
    // Editar operador
    'Click en el operador "Test Auto" para editarlo',
    'Cambiar el nombre a "Test Editado"',
    'Guardar cambios',
    
    // Verificar edición
    'Verificar que el nombre cambió a "Test Editado"',
    
    // Eliminar operador
    'Click en eliminar operador',
    'Confirmar eliminación',
    
    // Verificar eliminación
    'Verificar que el operador ya no aparece en la lista'
  ]
});
