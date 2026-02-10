/**
 * Tipos para la configuración de AI Test Runner
 */

export interface AITestConfig {
  // Rutas
  testDir: string;
  reportDir: string;
  selectorCachePath: string;
  
  // Navegador
  browser: BrowserConfig;
  
  // Reportes
  reports: ReportsConfig;
  
  // Screenshots
  screenshots: ScreenshotsConfig;
  
  // IA
  ai: AIConfig;
  
  // Caché
  cache: CacheConfig;
  
  // Ejecución
  execution: ExecutionConfig;
  
  // Notificaciones
  notifications: NotificationsConfig;
  
  // Variables
  baseUrl: string;
  globalVariables: Record<string, string>;
}

export interface BrowserConfig {
  headless: boolean;
  slowMo: number;
  navigationTimeout: number;
  actionTimeout: number;
  viewport: {
    width: number;
    height: number;
  };
  recordVideo: boolean;
  videoDir: string;
}

export interface ReportsConfig {
  html: {
    enabled: boolean;
    openOnFinish: boolean;
  };
  json: {
    enabled: boolean;
  };
  trace: {
    enabled: boolean;
    mode: 'always' | 'on-failure' | 'never';
  };
}

export interface ScreenshotsConfig {
  enabled: boolean;
  mode: 'always' | 'on-failure' | 'never';
  fullPage: boolean;
  quality: number;
  format: 'png' | 'jpeg';
  embedInHtml: boolean;
}

export interface AIConfig {
  analysisMode: 'html' | 'screenshot' | 'hybrid';
  provider: 'auto' | 'google' | 'openai' | 'anthropic' | 'deepseek' | 'ollama';
  retryOnCacheFailure: boolean;
  maxRetries: number;
}

export interface CacheConfig {
  enabled: boolean;
  maxSize: number;
  ttl: number;
  maxFailures: number;
  debug: boolean;
}

export interface ExecutionConfig {
  stopOnError: boolean;
  failFast: boolean;
  delayBetweenSteps: number;
  retries: number;
  flowTimeout: number;
  parallel: boolean;
  maxWorkers: number;
}

export interface NotificationsConfig {
  slack: {
    enabled: boolean;
    webhookUrl: string;
    notifyOn: 'always' | 'on-failure' | 'never';
    projectName: string;
  };
}

/**
 * Configuración por defecto
 */
export const defaultConfig: AITestConfig = {
  testDir: './tests/flows',
  reportDir: './playwright-report',
  selectorCachePath: './selector-cache.json',
  
  browser: {
    headless: false,
    slowMo: 100,
    navigationTimeout: 30000,
    actionTimeout: 10000,
    viewport: { width: 1280, height: 720 },
    recordVideo: false,
    videoDir: './videos'
  },
  
  reports: {
    html: { enabled: true, openOnFinish: false },
    json: { enabled: true },
    trace: { enabled: true, mode: 'always' }
  },
  
  screenshots: {
    enabled: true,
    mode: 'always',
    fullPage: false,
    quality: 80,
    format: 'png',
    embedInHtml: true
  },
  
  ai: {
    analysisMode: 'html',
    provider: 'auto',
    retryOnCacheFailure: true,
    maxRetries: 2
  },
  
  cache: {
    enabled: true,
    maxSize: 500,
    ttl: 24 * 60 * 60 * 1000,
    maxFailures: 3,
    debug: false
  },
  
  execution: {
    stopOnError: true,
    failFast: false,
    delayBetweenSteps: 300,
    retries: 0,
    flowTimeout: 120000,
    parallel: false,
    maxWorkers: 5
  },
  
  notifications: {
    slack: {
      enabled: false,
      webhookUrl: '',
      notifyOn: 'on-failure',
      projectName: 'AI Test Runner'
    }
  },
  
  baseUrl: '',
  globalVariables: {}
};
