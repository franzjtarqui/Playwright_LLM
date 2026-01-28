/**
 * Configuración global para los tests
 */
import { RunnerOptions } from '../src/runner/index.js';

const config: RunnerOptions = {
  // Directorio de tests
  testDir: './tests/flows',
  
  // URL base (puede sobreescribirse por variable de entorno)
  baseUrl: process.env.TEST_URL,
  
  // Reportes
  generateReport: true,
  reportDir: './playwright-report',
  enableTracing: true,
  
  // Ejecución
  headless: process.env.CI === 'true',  // Headless en CI, con UI en local
  failFast: false,
  retries: 0,
};

export default config;
