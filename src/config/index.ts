import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { AITestConfig, defaultConfig } from './types.js';

export * from './types.js';

/**
 * Carga la configuración desde ai-test.config.ts
 */
export async function loadConfig(configPath?: string): Promise<AITestConfig> {
  // El archivo ai-test.config.ts se compila a dist/ai-test.config.js
  const possiblePaths = configPath 
    ? [configPath]
    : [
        './dist/ai-test.config.js',      // Compilado en dist/
        './ai-test.config.js',           // JS en raíz
      ];
  
  for (const configFile of possiblePaths) {
    const absolutePath = path.resolve(configFile);
    
    if (fs.existsSync(absolutePath)) {
      try {
        const fileUrl = pathToFileURL(absolutePath).href;
        const module = await import(fileUrl);
        const userConfig = module.default as Partial<AITestConfig>;
        
        console.log(`✅ Configuración cargada desde: ${configFile}`);
        
        // Merge con config por defecto
        return mergeConfig(defaultConfig, userConfig);
      } catch (error) {
        console.warn(`⚠️  Error cargando config desde ${configFile}:`, (error as Error).message);
      }
    }
  }
  
  console.log('ℹ️  Usando configuración por defecto (no se encontró ai-test.config.ts)');
  return defaultConfig;
}

/**
 * Merge profundo de configuraciones
 */
function mergeConfig(defaults: AITestConfig, user: Partial<AITestConfig>): AITestConfig {
  const merged = { ...defaults };
  
  for (const key of Object.keys(user) as (keyof AITestConfig)[]) {
    const userValue = user[key];
    const defaultValue = defaults[key];
    
    if (userValue !== undefined) {
      if (typeof userValue === 'object' && !Array.isArray(userValue) && userValue !== null) {
        // Merge recursivo para objetos
        (merged as any)[key] = { ...(defaultValue as any), ...(userValue as any) };
      } else {
        (merged as any)[key] = userValue;
      }
    }
  }
  
  return merged;
}

/**
 * Obtiene configuración para el runner
 */
export function getRunnerOptions(config: AITestConfig) {
  return {
    testDir: config.testDir,
    reportDir: config.reportDir,
    baseUrl: config.baseUrl,
    headless: config.browser.headless,
    failFast: config.execution.failFast,
    retries: config.execution.retries,
    generateReport: config.reports.html.enabled,
    enableTracing: config.reports.trace.enabled,
  };
}

/**
 * Obtiene configuración para el agente
 */
export function getAgentOptions(config: AITestConfig) {
  return {
    analysisMode: config.ai.analysisMode,
    useSelectorCache: config.cache.enabled,
    cacheConfig: {
      maxSize: config.cache.maxSize,
      defaultTTL: config.cache.ttl,
      maxFailures: config.cache.maxFailures,
      debug: config.cache.debug,
      cacheFilePath: config.selectorCachePath
    },
    browserOptions: {
      headless: config.browser.headless,
      slowMo: config.browser.slowMo
    },
    screenshotOptions: {
      enabled: config.screenshots.enabled,
      mode: config.screenshots.mode,
      fullPage: config.screenshots.fullPage,
      format: config.screenshots.format,
      embedInHtml: config.screenshots.embedInHtml
    }
  };
}
