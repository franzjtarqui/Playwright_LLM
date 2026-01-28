/**
 * Tipos para el sistema de ejecución de tests
 */

/**
 * Definición de un flow de test
 */
export interface FlowDefinition {
  /** Nombre descriptivo del test */
  name: string;
  
  /** Etiquetas para filtrar tests */
  tags?: string[];
  
  /** URL inicial (puede usar variables ${VAR}) */
  url?: string;
  
  /** Pasos en lenguaje natural */
  steps: string[];
  
  /** Timeout en ms (default: 60000) */
  timeout?: number;
  
  /** Delay entre pasos en ms (default: 2000) */
  delayBetweenSteps?: number;
  
  /** Modo de análisis: 'html' | 'screenshot' | 'hybrid' */
  analysisMode?: 'html' | 'screenshot' | 'hybrid';
  
  /** Variables específicas de este flow */
  variables?: Record<string, string>;
  
  /** Ejecutar antes de los pasos */
  beforeAll?: () => Promise<void>;
  
  /** Ejecutar después de los pasos */
  afterAll?: () => Promise<void>;
  
  /** Callback cuando un paso falla */
  onStepError?: (step: string, error: Error) => void;
  
  /** Callback cuando un paso tiene éxito */
  onStepSuccess?: (step: string) => void;
}

/**
 * Opciones de ejecución del runner
 */
export interface RunnerOptions {
  /** Tags a incluir (OR logic) */
  tags?: string[];
  
  /** Tags a excluir */
  excludeTags?: string[];
  
  /** Ejecutar solo tests que coincidan con este nombre */
  nameFilter?: string;
  
  /** Directorio de tests */
  testDir?: string;
  
  /** URL base para todos los tests */
  baseUrl?: string;
  
  /** Generar reporte HTML */
  generateReport?: boolean;
  
  /** Directorio de reportes */
  reportDir?: string;
  
  /** Habilitar tracing de Playwright */
  enableTracing?: boolean;
  
  /** Ejecutar en paralelo */
  parallel?: boolean;
  
  /** Número máximo de workers en paralelo */
  maxWorkers?: number;
  
  /** Detener al primer error */
  failFast?: boolean;
  
  /** Modo headless */
  headless?: boolean;
  
  /** Reintentos por test fallido */
  retries?: number;
}

/**
 * Resultado de un flow ejecutado
 */
export interface FlowExecutionResult {
  name: string;
  tags: string[];
  success: boolean;
  totalSteps: number;
  completedSteps: number;
  duration: number;
  error?: string;
  steps: StepExecutionResult[];
}

/**
 * Resultado de un paso ejecutado
 */
export interface StepExecutionResult {
  step: number;
  instruction: string;
  success: boolean;
  duration: number;
  error?: string;
}

/**
 * Resultado global de la ejecución
 */
export interface TestRunResult {
  totalFlows: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  flows: FlowExecutionResult[];
}

/**
 * Flow cargado con metadata
 */
export interface LoadedFlow {
  filePath: string;
  definition: FlowDefinition;
}
