import { AITestConfig } from './src/config/types.js';

/**
 * Configuración global de AI Test Runner
 * 
 * Este archivo controla el comportamiento de toda la automatización.
 * Modifica los valores según tus necesidades.
 */
const config: AITestConfig = {
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 📁 RUTAS Y DIRECTORIOS
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Directorio donde están los archivos .flow.ts */
  testDir: './tests/flows',
  
  /** Directorio donde se guardan los reportes */
  reportDir: './playwright-report',
  
  /** Ruta del archivo de caché de selectores */
  selectorCachePath: './selector-cache.json',
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🌐 NAVEGADOR
  // ═══════════════════════════════════════════════════════════════════════════
  
  browser: {
    /** Ejecutar sin interfaz gráfica (útil para CI/CD) */
    headless: false,
    
    /** Ralentizar acciones en ms (útil para debugging) */
    slowMo: 500,
    
    /** Timeout para navegación en ms */
    navigationTimeout: 30000,
    
    /** Timeout para acciones (click, fill, etc) en ms */
    actionTimeout: 10000,
    
    /** Tamaño de la ventana del navegador */
    viewport: {
      width: 1280,
      height: 720
    },
    
    /** Grabar video de la ejecución */
    recordVideo: false,
    
    /** Directorio para videos (si recordVideo es true) */
    videoDir: './videos'
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 📊 REPORTES
  // ═══════════════════════════════════════════════════════════════════════════
  
  reports: {
    /** Generar reporte HTML */
    html: {
      enabled: true,
      /** Abrir automáticamente en el navegador al finalizar */
      openOnFinish: false
    },
    
    /** Generar reporte JSON */
    json: {
      enabled: false
    },
    
    /** Generar Playwright Trace (archivo .zip para debug) */
    trace: {
      enabled: true,
      /** 
       * Cuándo generar trace:
       * - 'always': Siempre
       * - 'on-failure': Solo cuando falla
       * - 'never': Nunca
       */
      mode: 'always' as 'always' | 'on-failure' | 'never'
    }
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 📸 CAPTURAS DE PANTALLA
  // ═══════════════════════════════════════════════════════════════════════════
  
  screenshots: {
    /** Habilitar capturas de pantalla */
    enabled: true,
    
    /**
     * Cuándo capturar:
     * - 'always': En cada paso (éxito y fallo)
     * - 'on-failure': Solo cuando falla un paso
     * - 'never': Nunca
     */
    mode: 'on-failure' as 'always' | 'on-failure' | 'never',
    
    /** Capturar página completa (scroll) o solo viewport */
    fullPage: false,
    
    /** Calidad de imagen (0-100, solo para JPEG) */
    quality: 80,
    
    /** Formato de imagen */
    format: 'png' as 'png' | 'jpeg',
    
    /** Embeber imágenes en base64 en el HTML (hace el archivo más grande pero autocontenido) */
    embedInHtml: true
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🧠 ANÁLISIS CON IA
  // ═══════════════════════════════════════════════════════════════════════════
  
  ai: {
    /**
     * Modo de análisis de la página:
     * - 'html': Solo extrae elementos del DOM (más rápido, menos tokens)
     * - 'screenshot': Envía imagen a la IA (más visual, más tokens)
     * - 'hybrid': Envía ambos (más preciso, balance de tokens)
     */
    analysisMode: 'html' as 'html' | 'screenshot' | 'hybrid',
    
    /** 
     * Proveedor de IA a usar (o 'auto' para detectar desde .env)
     * Opciones: 'auto', 'google', 'openai', 'anthropic', 'deepseek', 'ollama'
     */
    provider: 'auto',
    
    /** Reintentar con IA si el caché falla */
    retryOnCacheFailure: true,
    
    /** Máximo de reintentos por paso */
    maxRetries: 1
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 💾 CACHÉ DE SELECTORES
  // ═══════════════════════════════════════════════════════════════════════════
  
  cache: {
    /** Habilitar caché de selectores (ahorra tokens) */
    enabled: true,
    
    /** Máximo de entradas en caché */
    maxSize: 500,
    
    /** Tiempo de vida de cada entrada en ms (24 horas por defecto) */
    ttl: 24 * 60 * 60 * 1000,
    
    /** Fallos consecutivos antes de invalidar una entrada */
    maxFailures: 3,
    
    /** Mostrar logs de debug del caché */
    debug: false
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ⚙️ EJECUCIÓN
  // ═══════════════════════════════════════════════════════════════════════════
  
  execution: {
    /** Detener al primer error */
    stopOnError: true,
    
    /** Detener toda la suite al primer flow fallido */
    failFast: false,
    
    /** Delay entre pasos en ms */
    delayBetweenSteps: 2000,
    
    /** Reintentos por test fallido (0 = sin reintentos) */
    retries: 0,
    
    /** Timeout máximo por flow en ms (2 minutos) */
    flowTimeout: 120000,
    
    /** Ejecutar flows en paralelo (experimental) */
    parallel: false,
    
    /** Número máximo de workers en paralelo */
    maxWorkers: 4
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🔔 NOTIFICACIONES
  // ═══════════════════════════════════════════════════════════════════════════
  
  notifications: {
    /** Configuración de Slack */
    slack: {
      enabled: false,
      /** URL del webhook (o usar variable de entorno SLACK_WEBHOOK_URL) */
      webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
      /** 
       * Cuándo notificar:
       * - 'always': Siempre
       * - 'on-failure': Solo cuando falla
       * - 'never': Nunca
       */
      notifyOn: 'on-failure' as 'always' | 'on-failure' | 'never',
      /** Nombre del proyecto (aparece en el mensaje) */
      projectName: 'AI Test Runner'
    }
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🌍 VARIABLES DE ENTORNO
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** URL base para todos los tests (sobreescribible por TEST_URL) */
  baseUrl: process.env.TEST_URL || '',
  
  /** Variables globales disponibles en todos los flows */
  globalVariables: {
    // Ejemplo: AMBIENTE: 'produccion'
  }
};

export default config;
