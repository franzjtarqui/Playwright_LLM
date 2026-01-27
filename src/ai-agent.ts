import { chromium, Browser, Page, Locator, BrowserContext } from '@playwright/test';
import { createLLMProvider, LLMProvider, AIDecision, AIAction } from './llm-providers.js';
import { SelectorCacheManager, SelectorCacheConfig, CachedSelector, CachedAction } from './selector-cache.js';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

/**
 * Contexto de la página actual
 */
interface PageContext {
  url: string;
  title: string;
  htmlLength: number;
}

/**
 * Resultado de la ejecución del agente
 */
export interface ExecutionResult {
  success: boolean;
  decision?: AIDecision;
  finalUrl?: string;
  error?: string;
}

/**
 * Resultado de un paso en el flujo
 */
export interface StepResult {
  step: number;
  instruction: string;
  success: boolean;
  error?: string;
}

/**
 * Resultado de la ejecución de un flujo completo
 */
export interface FlowResult {
  success: boolean;
  totalSteps: number;
  completedSteps: number;
  steps: StepResult[];
  finalUrl?: string;
  error?: string;
}

/**
 * Parámetros para ejecutar el agente
 */
export interface ExecuteParams {
  url: string;
  instruction: string;
  /** Modo de análisis: 'screenshot' | 'html' | 'hybrid' */
  analysisMode?: AnalysisMode;
}

/**
 * Parámetros para ejecutar un flujo con múltiples pasos
 */
export interface ExecuteFlowParams {
  url: string;
  steps: string[];
  stopOnError?: boolean;      // Detener si hay error (default: true)
  delayBetweenSteps?: number; // Delay en ms entre pasos (default: 2000)
  /** 
   * Modo de análisis de la página:
   * - 'screenshot': Solo imagen (más visual, más tokens)
   * - 'html': Solo HTML filtrado (más barato, más rápido)  
   * - 'hybrid': Ambos (más preciso, balance de tokens)
   */
  analysisMode?: AnalysisMode;
  /**
   * Habilitar tracing de Playwright para generar reportes
   * Genera un archivo .zip con capturas, DOM, network, etc.
   */
  enableTracing?: boolean;
  /**
   * Generar reporte HTML al finalizar
   */
  generateReport?: boolean;
  /**
   * Directorio donde guardar los reportes (default: './test-results')
   */
  reportDir?: string;
}

/**
 * Modo de análisis de la página
 * - 'screenshot': Solo imagen (más visual, más tokens)
 * - 'html': Solo HTML filtrado (más barato, más rápido)
 * - 'hybrid': Ambos (más preciso, balance de tokens)
 */
export type AnalysisMode = 'screenshot' | 'html' | 'hybrid';

/**
 * Elemento interactivo extraído del DOM
 */
export interface InteractiveElement {
  tag: string;
  type?: string;
  id?: string;
  name?: string;
  placeholder?: string;
  text?: string;
  ariaLabel?: string;
  value?: string;
  href?: string;
  role?: string;
  visible?: boolean;
  label?: string;
}

/**
 * Agente IA que usa Playwright y LLM Vision para automatizar páginas web
 * sin necesidad de selectores predefinidos
 * 
 * Soporta múltiples proveedores: Google AI, OpenAI, Anthropic, DeepSeek, Ollama, Azure
 */
export class PlaywrightAIAgent {
  private llmProvider: LLMProvider | null = null;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  public page: Page | null = null;
  private maxRetries = 3;
  private stepScreenshots: Array<{ step: number; path: string; success: boolean }> = [];
  private tracingEnabled = false;
  
  /** Caché de selectores para ahorrar tokens */
  private selectorCache: SelectorCacheManager;
  /** Habilitar/deshabilitar el uso del caché */
  public useSelectorCache: boolean = true;
  
  /**
   * Modo de análisis: 'screenshot', 'html', o 'hybrid'
   * Cambia esto para optimizar costos vs precisión
   */
  public analysisMode: AnalysisMode = 'html'; // Por defecto usa HTML (más barato)

  /**
   * Constructor del agente
   * @param cacheConfig Configuración opcional del caché de selectores
   */
  constructor(cacheConfig?: Partial<SelectorCacheConfig>) {
    this.selectorCache = new SelectorCacheManager({
      debug: true,  // Mostrar logs del caché
      cacheFilePath: './selector-cache.json',
      ...cacheConfig,
    });
  }

  /**
   * Configura el modo de análisis de la página
   * @param mode 'screenshot' | 'html' | 'hybrid'
   * @returns this (para encadenamiento)
   */
  setAnalysisMode(mode: AnalysisMode): this {
    this.analysisMode = mode;
    console.log(`📊 Modo de análisis configurado: ${mode}`);
    return this;
  }

  /**
   * Habilita o deshabilita el caché de selectores
   * @param enabled true para habilitar, false para deshabilitar
   * @returns this (para encadenamiento)
   */
  setSelectorCache(enabled: boolean): this {
    this.useSelectorCache = enabled;
    console.log(`💾 Caché de selectores: ${enabled ? 'HABILITADO' : 'DESHABILITADO'}`);
    return this;
  }

  /**
   * Limpia todo el caché de selectores
   */
  clearSelectorCache(): void {
    this.selectorCache.clear();
  }

  /**
   * Muestra estadísticas del caché
   */
  printCacheStats(): void {
    this.selectorCache.printSummary();
  }

  /**
   * Inicializa el navegador y el proveedor de LLM
   */
  async initialize(): Promise<void> {
    // Inicializar proveedor de LLM (auto-detecta según .env)
    this.llmProvider = createLLMProvider();
    await this.llmProvider.initialize();
    console.log(`🤖 Usando proveedor: ${this.llmProvider.name}`);
    console.log(`💾 Caché de selectores: ${this.useSelectorCache ? 'HABILITADO' : 'DESHABILITADO'}\n`);
    
    // Inicializar navegador
    this.browser = await chromium.launch({ 
      headless: false, // Ver lo que hace el agente
      slowMo: 500 // Ralentizar para observar
    });
    
    // Crear contexto (necesario para tracing)
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: undefined // Puedes habilitar video: { dir: './videos' }
    });
    
    this.page = await this.context.newPage();
  }

  /**
   * Captura un screenshot de la página actual
   */
  private async captureScreenshot(): Promise<string> {
    if (!this.page) throw new Error('Página no inicializada');
    
    const screenshot = await this.page.screenshot({ 
      fullPage: false,
      type: 'png'
    });
    return screenshot.toString('base64');
  }

  /**
   * Selectores comunes de loaders/spinners para detectar
   */
  private readonly LOADER_SELECTORS = [
    // Spinners
    '[class*="spinner"]',
    '[class*="loading"]',
    '[class*="loader"]',
    '.spinner',
    '.loading',
    '.loader',
    // Skeletons
    '[class*="skeleton"]',
    '.skeleton',
    // Progress bars
    '[role="progressbar"]',
    '[class*="progress"]',
    // Overlays
    '[class*="overlay"]',
    '.overlay',
    // Material UI / Ant Design / Bootstrap
    '.MuiCircularProgress-root',
    '.MuiLinearProgress-root',
    '.ant-spin',
    '.ant-skeleton',
    '.spinner-border',
    '.spinner-grow',
    // Otros comunes
    '[data-loading="true"]',
    '[data-testid*="loading"]',
    '[data-testid*="spinner"]',
  ];

  /**
   * Espera a que desaparezcan los loaders de la página
   * @param timeout Tiempo máximo de espera en ms
   */
  private async waitForLoadersToDisappear(timeout: number = 15000): Promise<void> {
    if (!this.page) return;
    
    const startTime = Date.now();
    
    // Combinar todos los selectores en uno
    const combinedSelector = this.LOADER_SELECTORS.join(', ');
    
    while (Date.now() - startTime < timeout) {
      // Verificar si hay loaders visibles
      const hasVisibleLoaders = await this.page.evaluate((selector) => {
        const elements = Array.from(document.querySelectorAll(selector));
        for (const el of elements) {
          const element = el as HTMLElement;
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          const isVisible = rect.width > 0 && rect.height > 0 &&
                           style.display !== 'none' &&
                           style.visibility !== 'hidden' &&
                           style.opacity !== '0';
          if (isVisible) return true;
        }
        return false;
      }, combinedSelector);
      
      if (!hasVisibleLoaders) {
        return; // No hay loaders, continuar
      }
      
      // Esperar un poco y volver a verificar
      await this.page.waitForTimeout(200);
    }
    
    console.log('   ⚠️ Timeout esperando que loaders desaparezcan');
  }

  /**
   * Espera a que aria-busy sea false en toda la página
   */
  private async waitForAriaBusyFalse(timeout: number = 10000): Promise<void> {
    if (!this.page) return;
    
    try {
      await this.page.waitForFunction(() => {
        // Buscar cualquier elemento con aria-busy="true"
        const busyElements = document.querySelectorAll('[aria-busy="true"]');
        return busyElements.length === 0;
      }, { timeout });
    } catch {
      console.log('   ⚠️ Timeout esperando aria-busy=false');
    }
  }

  /**
   * Espera a que el DOM esté estable (sin cambios)
   * @param stableTime Tiempo que debe permanecer sin cambios en ms
   */
  private async waitForDOMStable(stableTime: number = 500, timeout: number = 10000): Promise<void> {
    if (!this.page) return;
    
    const startTime = Date.now();
    let lastSnapshot = '';
    let lastChangeTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        // Usar el contenido del body como snapshot simple
        const currentSnapshot = await this.page.evaluate(() => {
          return document.body?.innerHTML?.length.toString() || '';
        });
        
        if (currentSnapshot !== lastSnapshot) {
          lastSnapshot = currentSnapshot;
          lastChangeTime = Date.now();
        } else if (Date.now() - lastChangeTime >= stableTime) {
          // El DOM no ha cambiado por el tiempo requerido
          return;
        }
        
        await this.page.waitForTimeout(100);
      } catch {
        await this.page.waitForTimeout(100);
      }
    }
  }

  /**
   * Espera a que la página esté completamente cargada y estable
   * Incluye: network idle, loaders, aria-busy, y estabilidad del Accessibility Tree
   */
  private async waitForPageStable(): Promise<void> {
    if (!this.page) return;
    
    console.log('   ⏳ Esperando a que la página esté estable...');
    
    // 1. Esperar a que no haya peticiones de red pendientes
    try {
      await this.page.waitForLoadState('networkidle', { timeout: 10000 });
    } catch {
      console.log('   ⚠️ Timeout en networkidle, continuando...');
    }
    
    // 2. Esperar a que el DOM esté completamente cargado
    try {
      await this.page.waitForLoadState('domcontentloaded', { timeout: 5000 });
    } catch {
      // Ignorar si ya pasó
    }
    
    // 3. Esperar a que document.readyState === 'complete'
    try {
      await this.page.waitForFunction(() => {
        return document.readyState === 'complete';
      }, { timeout: 5000 });
    } catch {
      // Ignorar si ya está listo
    }
    
    // 4. Esperar a que desaparezcan los loaders/spinners
    console.log('   🔄 Verificando loaders...');
    await this.waitForLoadersToDisappear(15000);
    
    // 5. Esperar a que aria-busy sea false
    await this.waitForAriaBusyFalse(5000);
    
    // 6. Esperar estabilidad del DOM
    console.log('   🌳 Verificando estabilidad del DOM...');
    await this.waitForDOMStable(500, 5000);
    
    // 7. Pequeña espera adicional para renderizado final
    await this.page.waitForTimeout(300);
    
    console.log('   ✅ Página estable');
  }

  /**
   * Extrae elementos interactivos usando el Accessibility Tree
   * Esto es más preciso y eficiente que escanear el DOM
   */
  private async extractInteractiveElements(): Promise<InteractiveElement[]> {
    if (!this.page) throw new Error('Página no inicializada');
    
    // Esperar a que la página esté estable (incluyendo loaders)
    await this.waitForPageStable();
    
    console.log('   🌳 Extrayendo elementos interactivos con información de accesibilidad...');
    
    // Extraer elementos con información de accesibilidad del DOM
    const elements = await this.page.evaluate((): InteractiveElement[] => {
      const results: InteractiveElement[] = [];
      
      // Selectores para elementos interactivos
      const interactiveSelectors = [
        // Elementos nativos interactivos
        'input:not([type="hidden"])',
        'button',
        'a[href]',
        'select',
        'textarea',
        // Roles ARIA interactivos
        '[role="button"]',
        '[role="link"]',
        '[role="textbox"]',
        '[role="checkbox"]',
        '[role="radio"]',
        '[role="combobox"]',
        '[role="listbox"]',
        '[role="menuitem"]',
        '[role="menuitemcheckbox"]',
        '[role="menuitemradio"]',
        '[role="option"]',
        '[role="tab"]',
        '[role="switch"]',
        '[role="slider"]',
        '[role="spinbutton"]',
        '[role="searchbox"]',
        // Elementos con eventos
        '[onclick]',
        '[tabindex]:not([tabindex="-1"])',
      ];
      
      const allSelector = interactiveSelectors.join(', ');
      const allElements = Array.from(document.querySelectorAll(allSelector));
      
      for (const el of allElements) {
        const element = el as HTMLElement;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        
        // Verificar visibilidad
        const isVisible = rect.width > 0 && rect.height > 0 &&
                         style.display !== 'none' &&
                         style.visibility !== 'hidden' &&
                         style.opacity !== '0';
        
        if (!isVisible) continue;
        
        // Obtener el nombre accesible (prioridad: aria-label > aria-labelledby > texto visible)
        let accessibleName = element.getAttribute('aria-label') || '';
        
        if (!accessibleName) {
          const labelledBy = element.getAttribute('aria-labelledby');
          if (labelledBy) {
            const labelEl = document.getElementById(labelledBy);
            accessibleName = labelEl?.textContent?.trim() || '';
          }
        }
        
        if (!accessibleName) {
          // Para inputs, buscar label asociado
          if (element.tagName === 'INPUT' || element.tagName === 'SELECT' || element.tagName === 'TEXTAREA') {
            const inputEl = element as HTMLInputElement;
            const label = document.querySelector(`label[for="${inputEl.id}"]`);
            accessibleName = label?.textContent?.trim() || '';
          }
        }
        
        if (!accessibleName) {
          accessibleName = element.textContent?.trim().substring(0, 100) || '';
        }
        
        const inputEl = element as HTMLInputElement;
        const role = element.getAttribute('role') || 
                    (element.tagName === 'BUTTON' ? 'button' : 
                     element.tagName === 'A' ? 'link' :
                     element.tagName === 'INPUT' ? 'textbox' : 
                     element.tagName === 'SELECT' ? 'combobox' : '');
        
        // Detectar si el ID es dinámico de React (patrón :r\d+:)
        const elementId = element.id || undefined;
        const isDynamicId = elementId && (/^:r\d+:$/i.test(elementId) || /^:.*:$/.test(elementId) || /^mui-\d+$/.test(elementId));
        
        results.push({
          tag: element.tagName.toLowerCase(),
          type: element.getAttribute('type') || undefined,
          id: isDynamicId ? undefined : elementId, // NO incluir IDs dinámicos
          name: element.getAttribute('name') || undefined,
          placeholder: element.getAttribute('placeholder') || undefined,
          text: accessibleName || undefined,
          ariaLabel: element.getAttribute('aria-label') || undefined,
          value: inputEl.value || undefined,
          href: element.getAttribute('href') || undefined,
          role: role || undefined,
          visible: true,
          label: accessibleName || undefined // Label asociado (para formularios)
        });
      }
      
      return results;
    });
    
    // Eliminar duplicados
    const unique = elements.filter((el, index, self) =>
      index === self.findIndex(e =>
        e.tag === el.tag && e.id === el.id && e.name === el.name && e.text === el.text
      )
    );
    
    console.log(`   ✅ Encontrados ${unique.length} elementos interactivos`);
    
    return unique;
  }

  /**
   * Formatea los elementos interactivos como texto legible para la IA
   */
  private formatElementsForAI(elements: InteractiveElement[]): string {
    if (elements.length === 0) return 'No interactive elements found. Use visible text locators like "text \'ElementName\'" to target elements.';
    
    const formatted = elements.map((el, index) => {
      const parts = [`${index + 1}. <${el.tag}>`];
      
      if (el.type) parts.push(`type="${el.type}"`);
      // Priorizar atributos estables sobre IDs dinámicos
      if (el.name) parts.push(`name="${el.name}"`);
      if (el.placeholder) parts.push(`placeholder="${el.placeholder}"`);
      // Mostrar label para campos de formulario (más útil que ID para la IA)
      if (el.label && (el.tag === 'input' || el.tag === 'select' || el.tag === 'textarea')) {
        parts.push(`label="${el.label}"`);
      }
      if (el.ariaLabel) parts.push(`aria-label="${el.ariaLabel}"`);
      if (el.role) parts.push(`role="${el.role}"`);
      // Solo incluir ID si existe y NO es dinámico (ya filtrado antes)
      if (el.id) parts.push(`id="${el.id}"`);
      if (el.text && el.tag !== 'input') parts.push(`texto="${el.text}"`);
      if (el.href) parts.push(`href="${el.href.substring(0, 50)}..."`);
      
      return parts.join(' ');
    });
    
    return formatted.join('\n');
  }

  /**
   * Obtiene el contexto de la página para información adicional
   */
  private async getPageContext(): Promise<PageContext> {
    if (!this.page) throw new Error('Página no inicializada');
    
    const html = await this.page.content();
    const url = this.page.url();
    const title = await this.page.title();
    
    return {
      url,
      title,
      htmlLength: html.length
    };
  }

  /**
   * Genera el prompt para el LLM - adaptado según el modo de análisis
   * NOTA: Prompt en inglés para mejor comprensión de la IA
   */
  private generatePrompt(instruction: string, context: PageContext, elementsHtml?: string): string {
    const basePrompt = `You are an expert web automation agent. Analyze the page information and determine what Playwright actions are needed to fulfill this instruction:

USER INSTRUCTION: "${instruction}"

CONTEXT:
- Current URL: ${context.url}
- Page Title: ${context.title}`;

    const elementsSection = elementsHtml ? `
INTERACTIVE ELEMENTS AVAILABLE ON THE PAGE:
${elementsHtml}
` : '';

    const modeHint = this.analysisMode === 'html' 
      ? '\nNOTE: Use IDs, names, placeholders or visible text from the listed elements to identify them precisely.'
      : '\nNOTE: Describe elements by their visual appearance.';

    return `${basePrompt}
${elementsSection}${modeHint}

CRITICAL RULES:
1. You MUST generate ALL actions mentioned in the instruction, even if elements are not visible in the list
2. If the instruction says "click on X, then click on Y", generate BOTH click actions
3. Menu items, sidebar links, and navigation elements may not be in the list but still exist on the page
4. ALWAYS generate actions for every task mentioned in the instruction
5. Use visible text as locator when element is not in the list: "text 'ElementName'"

You MUST respond ONLY with a valid JSON object in this exact format:
{
  "actions": [
    {
      "type": "fill|click|press|wait|verify",
      "description": "Human readable description of the action",
      "locator": "element identifier - use ONLY ONE: name='value', id='value', placeholder='value', type='password', or visible text like 'Login'",
      "value": "value to input (only for fill)" 
    }
  ],
  "reasoning": "Your reasoning for choosing these actions",
  "needsVerification": true/false
}

ACTION TYPES:
- fill: Fill a text field
- click: Click on a button, link, or any element (use text 'ElementText' for menu items)
- press: Press a key (Enter, Tab, etc)
- wait: Wait for specific time in milliseconds
- verify: Verify that text exists on the page (use locator with text to search)

LOCATOR RULES:
1. For email fields: use "name='email'" or "placeholder='email'"
2. For password fields: use "type='password'" or "name='password'" 
3. For buttons/links/menu items: use visible text like "text 'Login'" or "text 'Settings'"
4. DO NOT mix multiple attributes in one locator
5. Generate SEPARATE actions for each task
6. Respond ONLY with valid JSON, no markdown
7. NEVER use IDs that look like ":r65:", ":r0:", or similar - these are dynamic React IDs that change every session
8. For form fields with labels, use "label='LabelText'" instead of dynamic IDs
9. PREFER this order: name > placeholder > label > aria-label > text > id (only if stable)

EXAMPLE - Multiple actions instruction:
Instruction: "Verify title 'Dashboard', click on 'Settings', then click on 'Users'"
{
  "actions": [
    {
      "type": "verify",
      "description": "Verify the Dashboard title is present",
      "locator": "text 'Dashboard'"
    },
    {
      "type": "click",
      "description": "Click on Settings menu",
      "locator": "text 'Settings'"
    },
    {
      "type": "click",
      "description": "Click on Users option",
      "locator": "text 'Users'"
    }
  ],
  "reasoning": "Generated all 3 actions: verify title, click Settings, click Users as requested",
  "needsVerification": true
}`;
  }

  /**
   * Consulta al LLM para analizar la página y decidir acciones
   * Soporta 3 modos: 'screenshot', 'html', 'hybrid'
   * 
   * AHORA CON CACHÉ: Si la instrucción ya fue procesada antes,
   * usa el selector cacheado sin consultar al LLM (ahorra tokens)
   * 
   * @param instruction Instrucción a ejecutar
   * @param screenshot Screenshot opcional
   * @param skipCache Si es true, ignora el caché y consulta directamente a la IA
   */
  private async analyzePageAndDecide(instruction: string, screenshot?: string, skipCache: boolean = false): Promise<AIDecision> {
    if (!this.llmProvider) throw new Error('Proveedor LLM no inicializado');
    if (!this.page) throw new Error('Página no inicializada');
    
    // 📋 PASO 0: Esperar a que la página esté estable ANTES de verificar caché
    // Esto asegura que la URL sea la correcta después de navegaciones
    let elementsHtml: string | undefined;
    if (this.analysisMode === 'html' || this.analysisMode === 'hybrid') {
      console.log('📋 Extrayendo elementos interactivos del DOM...');
      const elements = await this.extractInteractiveElements();
      elementsHtml = this.formatElementsForAI(elements);
      console.log(`   Encontrados: ${elements.length} elementos`);
    } else {
      // Incluso en modo screenshot, esperar estabilización básica
      await this.page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
    }
    
    // Capturar URL DESPUÉS de que la página esté estable
    const currentUrl = this.page.url();
    console.log(`🔗 URL estable: ${currentUrl}`);
    
    // 🔍 PASO 1: Buscar en caché (si no se está saltando)
    if (this.useSelectorCache && !skipCache) {
      const cached = this.selectorCache.find(currentUrl, instruction);
      
      if (cached && cached.actions.length > 0) {
        console.log(`💾 ¡CACHE HIT! Usando ${cached.actions.length} acciones guardadas (0 tokens)`);
        cached.actions.forEach((action, i) => {
          console.log(`   ${i + 1}. [${action.actionType}] ${action.selector}`);
        });
        
        // Construir AIDecision desde el caché con TODAS las acciones
        const cachedDecision: AIDecision = {
          actions: cached.actions.map(action => ({
            type: action.actionType as 'fill' | 'click' | 'press' | 'wait' | 'verify',
            description: action.description,
            locator: action.selector,
            value: action.value,
          })),
          reasoning: `[DESDE CACHÉ] ${cached.reasoning}`,
          needsVerification: false,
          fromCache: true,  // Marcar que viene del caché
        };
        
        return cachedDecision;
      }
    }
    
    // 🧠 PASO 2: Cache MISS - Consultar al LLM
    if (skipCache) {
      console.log('🔄 Cache invalidado - Consultando al LLM para obtener selectores actualizados...');
    } else {
      console.log('🧠 Cache MISS - Consultando al LLM...');
    }
    
    const context = await this.getPageContext();
    let responseText: string;
    
    const prompt = this.generatePrompt(instruction, context, elementsHtml);
    
    // Decidir qué enviar según el modo
    if (this.analysisMode === 'html') {
      // Solo texto, sin imagen (más barato)
      console.log('💰 Modo HTML: enviando solo texto (ahorra tokens)');
      responseText = await this.llmProvider.analyzeImage('', prompt);
    } else {
      // Con imagen (screenshot o hybrid)
      if (!screenshot) {
        screenshot = await this.captureScreenshot();
      }
      console.log(this.analysisMode === 'hybrid' 
        ? '🔄 Modo híbrido: enviando screenshot + HTML' 
        : '📸 Modo screenshot: enviando imagen');
      responseText = await this.llmProvider.analyzeImage(screenshot, prompt);
    }
    
    console.log(`\n🤖 Respuesta de ${this.llmProvider.name}:`);
    console.log(responseText);
    
    // Limpiar posible markdown del JSON
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '');
    }
    
    try {
      const decision = JSON.parse(jsonText.trim()) as AIDecision;
      
      // 💾 PASO 3: Guardar TODAS las acciones en caché para futuras consultas
      if (this.useSelectorCache && decision.actions.length > 0) {
        const cachedActions = decision.actions.map(action => ({
          selector: action.locator,
          actionType: action.type,
          description: action.description,
          value: action.value,
        }));
        
        this.selectorCache.set(
          currentUrl,
          instruction,
          cachedActions,
          decision.reasoning
        );
      }
      
      return decision;
    } catch (error) {
      console.error('❌ Error parseando JSON:', (error as Error).message);
      console.error('Texto recibido:', jsonText);
      throw new Error('La IA no devolvió un JSON válido');
    }
  }

  /**
   * Encuentra un elemento en la página usando descripción flexible
   * Soporta: selectores CSS, texto, placeholder, name, id
   */
  private async findElementByDescription(description: string): Promise<Locator> {
    if (!this.page) throw new Error('Página no inicializada');
    
    console.log(`  🔍 Buscando: "${description}"`);
    
    const page = this.page;
    const descLower = description.toLowerCase();
    
    // Extraer información del locator que envió la IA
    const nameMatch = description.match(/name[=:]?\s*['"]?([^'">\s]+)/i);
    const idMatch = description.match(/id[=:]?\s*['"]?([^'">\s]+)/i);
    const placeholderMatch = description.match(/placeholder[=:]?\s*['"]?([^'"]+)/i);
    const typeMatch = description.match(/type[=:]?\s*['"]?([^'">\s]+)/i);
    const textMatch = description.match(/texto?\s*['"]?([^'"]+)/i) || description.match(/['"]([^'"]+)['"]/);
    
    // Estrategias de búsqueda ordenadas por especificidad
    const strategies: Array<() => Promise<Locator | null>> = [
      
      // 1. Si es un selector CSS directo, probarlo
      async () => {
        if (description.includes('[') || description.startsWith('button') || 
            description.startsWith('input') || description.startsWith('a') ||
            description.startsWith('#') || description.startsWith('.')) {
          const loc = page.locator(description.replace(/['"]/g, "'")).first();
          if (await loc.count() > 0) return loc;
        }
        return null;
      },
      
      // 2. Por name extraído
      async () => {
        if (nameMatch) {
          const name = nameMatch[1];
          const loc = page.locator(`[name="${name}"]`).first();
          if (await loc.count() > 0) return loc;
        }
        return null;
      },
      
      // 3. Por label (prioridad alta para campos de formulario)
      async () => {
        // Buscar por label= explícito en la descripción
        const labelMatch = description.match(/label[=:]?\s*['"]?([^'"]+)['"]?/i);
        if (labelMatch) {
          const labelText = labelMatch[1].trim();
          const loc = page.getByLabel(new RegExp(labelText, 'i')).first();
          if (await loc.count() > 0) return loc;
        }
        // También buscar si la descripción contiene el nombre del campo (ej: "Fecha de nacimiento")
        const fieldName = description.replace(/id[=:]?\s*['"][^'"]+['"]?/gi, '').trim();
        if (fieldName && fieldName.length > 3) {
          const loc = page.getByLabel(new RegExp(fieldName.split(/\s+/).join('.*'), 'i')).first();
          if (await loc.count() > 0) return loc;
        }
        return null;
      },
      
      // 4. Por id extraído (SOLO si no es ID dinámico de React)
      async () => {
        if (idMatch) {
          const id = idMatch[1];
          // Detectar IDs dinámicos de React/MUI (patrón :r\d+: o similar)
          const isDynamicReactId = /^:r\d+:$/i.test(id) || /^:.*:$/.test(id) || /^mui-\d+$/.test(id);
          if (isDynamicReactId) {
            console.log(`  ⚠️ ID dinámico detectado (${id}), buscando alternativas...`);
            return null; // Saltar IDs dinámicos
          }
          const loc = page.locator(`#${id}, [id="${id}"]`).first();
          if (await loc.count() > 0) return loc;
        }
        return null;
      },
      
      // 4. Por placeholder
      async () => {
        if (placeholderMatch) {
          return page.getByPlaceholder(new RegExp(placeholderMatch[1], 'i')).first();
        }
        return page.getByPlaceholder(new RegExp(description.split(/\s+/).slice(-2).join('.*'), 'i')).first();
      },
      
      // 5. Detectar tipo de campo por palabras clave
      async () => {
        // Password/contraseña
        if (descLower.includes('password') || descLower.includes('contraseña')) {
          const loc = page.locator('input[type="password"]').first();
          if (await loc.count() > 0) return loc;
        }
        // Email/correo
        if (descLower.includes('email') || descLower.includes('correo')) {
          // Buscar por name="email" o type="email" o placeholder con correo
          const loc = page.locator('input[name="email"], input[type="email"], input[placeholder*="correo" i], input[placeholder*="email" i]').first();
          if (await loc.count() > 0) return loc;
        }
        // Usuario/username
        if (descLower.includes('usuario') || descLower.includes('user')) {
          const loc = page.locator('input[name*="user" i], input[id*="user" i], input[placeholder*="usuario" i]').first();
          if (await loc.count() > 0) return loc;
        }
        return null;
      },
      
      // 6. Botones - buscar por texto visible
      async () => {
        if (descLower.includes('botón') || descLower.includes('button') || 
            descLower.includes('click') || descLower.includes('submit') ||
            descLower.includes('ingresar') || descLower.includes('login') ||
            descLower.includes('enviar') || descLower.includes('entrar')) {
          // Extraer texto del botón de la descripción
          const textoBtn = textMatch ? textMatch[1] : 
            description.replace(/botón|button|click|submit|con texto|tipo/gi, '').trim();
          
          // Buscar botón por texto
          if (textoBtn && textoBtn.length > 2) {
            const loc = page.getByRole('button', { name: new RegExp(textoBtn, 'i') }).first();
            if (await loc.count() > 0) return loc;
          }
          
          // Buscar botón submit
          const submitBtn = page.locator('button[type="submit"], input[type="submit"]').first();
          if (await submitBtn.count() > 0) return submitBtn;
          
          // Buscar cualquier botón con texto similar
          const anyBtn = page.locator('button').filter({ hasText: new RegExp('ingresar|login|entrar|enviar|submit', 'i') }).first();
          if (await anyBtn.count() > 0) return anyBtn;
        }
        return null;
      },
      
      // 7. Por type extraído
      async () => {
        if (typeMatch) {
          const type = typeMatch[1];
          const loc = page.locator(`input[type="${type}"]`).first();
          if (await loc.count() > 0) return loc;
        }
        return null;
      },
      
      // 8. Por texto visible general (links, menús, opciones)
      async () => {
        // Extraer texto limpio de la descripción
        const cleanText = textMatch ? textMatch[1].trim() : description.replace(/texto\s*[=:]?\s*['"']?/gi, '').replace(/['"']/g, '').trim();
        if (cleanText && cleanText.length > 1) {
          // Buscar por texto exacto primero
          let loc = page.getByText(cleanText, { exact: true }).first();
          if (await loc.count() > 0) return loc;
          
          // Buscar por texto parcial
          loc = page.getByText(cleanText).first();
          if (await loc.count() > 0) return loc;
          
          // Buscar en links
          loc = page.getByRole('link', { name: new RegExp(cleanText, 'i') }).first();
          if (await loc.count() > 0) return loc;
          
          // Buscar en cualquier elemento clickeable
          loc = page.locator(`a, button, [role="button"], [role="link"], [role="menuitem"], span, div`)
            .filter({ hasText: new RegExp(`^${cleanText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).first();
          if (await loc.count() > 0) return loc;
          
          // Búsqueda más flexible
          loc = page.locator(`*`).filter({ hasText: new RegExp(cleanText, 'i') }).first();
          if (await loc.count() > 0) return loc;
        }
        return null;
      },
      
      // 9. Por label asociado
      async () => page.getByLabel(new RegExp(description, 'i')).first(),
      
      // 10. Role textbox genérico
      async () => {
        if (descLower.includes('campo') || descLower.includes('input') || descLower.includes('texto')) {
          return page.getByRole('textbox').first();
        }
        return null;
      },
      
      // 11. Buscar en menús laterales y navegación
      async () => {
        const menuText = textMatch ? textMatch[1].trim() : description.replace(/['"]/g, '').trim();
        if (menuText && menuText.length > 1) {
          // Menú items
          let loc = page.getByRole('menuitem', { name: new RegExp(menuText, 'i') }).first();
          if (await loc.count() > 0) return loc;
          
          // Navegación
          loc = page.locator('nav a, .sidebar a, .menu a, [class*="nav"] a, [class*="menu"] a')
            .filter({ hasText: new RegExp(menuText, 'i') }).first();
          if (await loc.count() > 0) return loc;
          
          // List items
          loc = page.getByRole('listitem').filter({ hasText: new RegExp(menuText, 'i') }).first();
          if (await loc.count() > 0) return loc;
        }
        return null;
      }
    ];

    // Intentar encontrar el elemento con reintentos
    const maxRetries = 2;
    const retryDelay = 2000;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      for (const strategy of strategies) {
        try {
          const element = await strategy();
          if (element && await element.count() > 0) {
            // Verificar que el elemento es visible e interactuable
            try {
              await element.waitFor({ state: 'visible', timeout: 2000 });
              console.log(`  ✅ Elemento encontrado (intento ${attempt})`);
              return element;
            } catch {
              // El elemento existe pero no es visible, continuar buscando
              continue;
            }
          }
        } catch {
          // Continuar con la siguiente estrategia
          continue;
        }
      }
      
      // Si no encontramos nada y quedan reintentos, esperar y volver a intentar
      if (attempt < maxRetries) {
        console.log(`  ⏳ Elemento no encontrado, reintentando en ${retryDelay}ms... (intento ${attempt}/${maxRetries})`);
        await page.waitForTimeout(retryDelay);
        
        // Esperar a que la página esté estable antes de reintentar
        try {
          await page.waitForLoadState('networkidle', { timeout: 5000 });
        } catch {
          // Continuar aunque timeout
        }
      }
    }

    throw new Error(`No se pudo encontrar elemento: ${description}`);
  }

  /**
   * Ejecuta una acción de Playwright basada en la decisión de la IA
   */
  private async executeAction(action: AIAction): Promise<void> {
    if (!this.page) throw new Error('Página no inicializada');
    
    console.log(`\n▶️  ${action.description}`);
    console.log(`   Tipo: ${action.type}`);
    
    try {
      switch (action.type) {
        case 'fill': {
          const element = await this.findElementByDescription(action.locator);
          await element.fill(action.value || '');
          console.log(`   ✅ Llenado con: "${action.value}"`);
          await this.page.waitForTimeout(300);
          break;
        }

        case 'click': {
          const element = await this.findElementByDescription(action.locator);
          
          // Guardar URL actual para detectar navegación
          const urlBefore = this.page.url();
          
          await element.click();
          console.log(`   ✅ Click realizado`);
          
          // Esperar un poco y verificar si hubo navegación
          await this.page.waitForTimeout(500);
          
          // Si la URL cambió, esperar a que la nueva página cargue
          const urlAfter = this.page.url();
          if (urlBefore !== urlAfter) {
            console.log(`   🔄 Navegación detectada: ${urlAfter}`);
            try {
              await this.page.waitForLoadState('networkidle', { timeout: 10000 });
              console.log(`   ✅ Nueva página cargada`);
            } catch {
              console.log(`   ⚠️ Timeout esperando carga, continuando...`);
            }
          }
          break;
        }

        case 'press': {
          await this.page.keyboard.press(action.value || 'Enter');
          console.log(`   ✅ Tecla presionada: ${action.value}`);
          await this.page.waitForTimeout(300);
          break;
        }

        case 'wait': {
          const ms = parseInt(action.value || '1000');
          await this.page.waitForTimeout(ms);
          console.log(`   ✅ Esperado ${ms}ms`);
          break;
        }

        case 'verify': {
          // Verificar que un texto existe en la página
          const textToVerify = action.locator.replace(/texto?\s*[=:]?\s*['"]?/i, '').replace(/['"]$/g, '').trim();
          console.log(`  🔍 Verificando texto: "${textToVerify}"`);
          
          // Esperar a que el texto aparezca (máximo 10 segundos)
          try {
            await this.page.waitForSelector(`text=${textToVerify}`, { timeout: 10000 });
            console.log(`   ✅ Texto "${textToVerify}" encontrado en la página`);
          } catch {
            // Intentar buscar de forma más flexible
            const pageContent = await this.page.content();
            if (pageContent.toLowerCase().includes(textToVerify.toLowerCase())) {
              console.log(`   ✅ Texto "${textToVerify}" encontrado en el HTML`);
            } else {
              throw new Error(`No se encontró el texto: "${textToVerify}"`);
            }
          }
          break;
        }

        default:
          console.warn(`   ⚠️  Tipo de acción desconocida: ${action.type}`);
      }
    } catch (error) {
      console.error(`   ❌ Error ejecutando acción: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Ejecuta una instrucción completa
   */
  async execute({ url, instruction, analysisMode }: ExecuteParams): Promise<ExecutionResult> {
    if (!this.page) throw new Error('Agente no inicializado. Llama a initialize() primero.');
    
    // Usar el modo pasado por parámetro o el configurado en la instancia
    if (analysisMode) this.analysisMode = analysisMode;
    
    console.log('\n' + '='.repeat(80));
    console.log('🤖 PLAYWRIGHT AI AGENT');
    console.log('='.repeat(80));
    console.log(`\n📍 URL: ${url}`);
    console.log(`💬 Instrucción: "${instruction}"`);
    console.log(`📊 Modo de análisis: ${this.analysisMode}`);
    console.log(`💾 Caché: ${this.useSelectorCache ? 'HABILITADO' : 'DESHABILITADO'}\n`);

    const executionUrl = this.page.url() || url;

    try {
      // 1. Navegar a la página
      console.log('🌐 Navegando a la página...');
      await this.page.goto(url, { waitUntil: 'networkidle' });
      await this.page.waitForTimeout(1000);

      // 2. Analizar con IA (el método decide si usar screenshot o HTML según el modo)
      console.log('🧠 Analizando con IA...');
      let decision = await this.analyzePageAndDecide(instruction);
      let usedCache = decision.fromCache || false;

      console.log('\n📋 Plan de acciones:');
      console.log(`   Razonamiento: ${decision.reasoning}`);
      console.log(`   Acciones: ${decision.actions.length}`);

      // 3. Ejecutar acciones con retry si falla el caché
      console.log('\n🎬 Ejecutando acciones...');
      try {
        for (const action of decision.actions) {
          await this.executeAction(action);
        }
      } catch (actionError) {
        // Si falló y venía del caché, reintentar consultando a la IA
        if (usedCache && this.useSelectorCache) {
          console.log('\n🔄 Selector del caché falló, invalidando y consultando a IA...');
          
          // Invalidar el caché para esta instrucción
          this.selectorCache.invalidate(executionUrl, instruction);
          
          // Reintentar con IA (sin usar caché)
          decision = await this.analyzePageAndDecide(instruction, undefined, true);
          
          console.log(`\n📋 Nuevo Plan (desde IA): ${decision.reasoning}`);
          console.log(`   Acciones: ${decision.actions.length}`);
          
          // Ejecutar las nuevas acciones
          console.log('\n🎬 Reintentando con selectores actualizados...');
          for (const action of decision.actions) {
            await this.executeAction(action);
          }
          
          console.log('   ✅ Retry exitoso con nuevos selectores');
        } else {
          throw actionError;
        }
      }

      // 4. Marcar éxito en caché
      if (this.useSelectorCache) {
        this.selectorCache.markSuccess(executionUrl, instruction);
      }

      // 5. Captura final (opcional, para debug)
      await this.page.waitForTimeout(1000);

      console.log('\n✅ Ejecución completada!');
      console.log('='.repeat(80) + '\n');

      return {
        success: true,
        decision,
        finalUrl: this.page.url()
      };

    } catch (error) {
      console.error('\n❌ Error durante la ejecución:', (error as Error).message);
      
      // Marcar fallo en caché (puede invalidar si hay muchos fallos)
      if (this.useSelectorCache) {
        const invalidated = this.selectorCache.markFailure(executionUrl, instruction);
        if (invalidated) {
          console.log('🔄 Selector cacheado invalidado, próxima vez consultará a IA');
        }
      }
      
      console.error('='.repeat(80) + '\n');
      
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Ejecuta un flujo completo con múltiples pasos/instrucciones
   * Ideal para automatizar flujos de trabajo complejos
   * 
   * @example
   * await agent.executeFlow({
   *   url: 'https://ejemplo.com/login',
   *   steps: [
   *     'Ingresar usuario admin y password 1234',
   *     'Hacer click en el menú Reportes',
   *     'Seleccionar el reporte de ventas',
   *     'Exportar a Excel'
   *   ]
   * });
   */
  async executeFlow({ 
    url, 
    steps, 
    stopOnError = true, 
    delayBetweenSteps = 2000,
    analysisMode,
    enableTracing = false,
    generateReport = false,
    reportDir = './test-results'
  }: ExecuteFlowParams): Promise<FlowResult> {
    if (!this.page) throw new Error('Agente no inicializado. Llama a initialize() primero.');
    
    // Usar el modo pasado por parámetro o el configurado en la instancia
    if (analysisMode) this.analysisMode = analysisMode;
    
    // Limpiar screenshots anteriores
    this.stepScreenshots = [];
    
    // Iniciar tracing si está habilitado
    if (enableTracing) {
      await this.startTracing(reportDir);
    }
    
    console.log('\n' + '═'.repeat(80));
    console.log('🔄 PLAYWRIGHT AI AGENT - FLUJO COMPLETO');
    console.log('═'.repeat(80));
    console.log(`\n📍 URL inicial: ${url}`);
    console.log(`📋 Total de pasos: ${steps.length}`);
    console.log(`⏱️  Delay entre pasos: ${delayBetweenSteps}ms`);
    console.log(`🛑 Detener en error: ${stopOnError ? 'Sí' : 'No'}`);
    console.log(`📊 Modo de análisis: ${this.analysisMode}`);
    console.log(`� Caché de selectores: ${this.useSelectorCache ? 'HABILITADO' : 'DESHABILITADO'}`);
    console.log(`�📝 Tracing: ${enableTracing ? 'Habilitado' : 'Deshabilitado'}`);
    console.log(`📄 Reporte HTML: ${generateReport ? 'Sí' : 'No'}\n`);
    
    console.log('📝 Pasos a ejecutar:');
    steps.forEach((step, i) => console.log(`   ${i + 1}. ${step}`));
    console.log('');

    const stepResults: StepResult[] = [];
    let currentUrl = url;
    let completedSteps = 0;

    // Navegar a la URL inicial
    console.log('🌐 Navegando a la URL inicial...');
    await this.page.goto(url, { waitUntil: 'networkidle' });
    await this.page.waitForTimeout(1000);

    for (let i = 0; i < steps.length; i++) {
      const stepNumber = i + 1;
      const instruction = steps[i];
      
      console.log('\n' + '─'.repeat(80));
      console.log(`📌 PASO ${stepNumber}/${steps.length}: ${instruction}`);
      console.log('─'.repeat(80));

      try {
        // Analizar con IA según el modo configurado
        console.log(`🧠 Analizando con IA (modo: ${this.analysisMode})...`);
        let decision = await this.analyzePageAndDecide(instruction);
        let usedCache = decision.fromCache || false;

        console.log(`\n📋 Plan: ${decision.reasoning}`);
        console.log(`   Acciones: ${decision.actions.length}`);

        // Ejecutar acciones con retry si falla el caché
        console.log('\n🎬 Ejecutando acciones...');
        try {
          for (const action of decision.actions) {
            await this.executeAction(action);
          }
        } catch (actionError) {
          // Si falló y venía del caché, reintentar consultando a la IA
          if (usedCache && this.useSelectorCache) {
            console.log('\n🔄 Selector del caché falló, invalidando y consultando a IA...');
            
            // Invalidar el caché para esta instrucción
            this.selectorCache.invalidate(currentUrl, instruction);
            
            // Reintentar con IA (sin usar caché)
            decision = await this.analyzePageAndDecide(instruction, undefined, true);
            
            console.log(`\n📋 Nuevo Plan (desde IA): ${decision.reasoning}`);
            console.log(`   Acciones: ${decision.actions.length}`);
            
            // Ejecutar las nuevas acciones
            console.log('\n🎬 Reintentando con selectores actualizados...');
            for (const action of decision.actions) {
              await this.executeAction(action);
            }
            
            // Si llegamos aquí, funcionó - el caché se actualizó en analyzePageAndDecide
            console.log('   ✅ Retry exitoso con nuevos selectores');
          } else {
            // No venía del caché o el caché está deshabilitado, propagar el error
            throw actionError;
          }
        }

        // Esperar a que la página se estabilice
        await this.page.waitForTimeout(delayBetweenSteps);
        currentUrl = this.page.url();

        // Marcar éxito en caché
        if (this.useSelectorCache) {
          this.selectorCache.markSuccess(currentUrl, instruction);
        }

        // Capturar screenshot del paso completado
        if (generateReport) {
          await this.captureStepScreenshot(stepNumber, true, reportDir);
        }

        stepResults.push({
          step: stepNumber,
          instruction,
          success: true
        });
        completedSteps++;

        console.log(`\n✅ Paso ${stepNumber} completado!`);

      } catch (error) {
        const errorMessage = (error as Error).message;
        console.error(`\n❌ Error en paso ${stepNumber}: ${errorMessage}`);
        
        // Nota: Si llegamos aquí después de un retry, el caché ya fue invalidado
        // Solo marcamos fallo si es un error nuevo
        if (this.useSelectorCache) {
          // El caché ya fue invalidado si hubo retry, markFailure es seguro
          this.selectorCache.markFailure(currentUrl, instruction);
        }
        
        // Capturar screenshot del error
        if (generateReport) {
          await this.captureStepScreenshot(stepNumber, false, reportDir);
        }
        
        stepResults.push({
          step: stepNumber,
          instruction,
          success: false,
          error: errorMessage
        });

        if (stopOnError) {
          console.log('\n🛑 Deteniendo flujo debido a error...');
          break;
        } else {
          console.log('\n⚠️  Continuando con el siguiente paso...');
          await this.page.waitForTimeout(delayBetweenSteps);
        }
      }
    }

    // Resumen final
    console.log('\n' + '═'.repeat(80));
    console.log('📊 RESUMEN DEL FLUJO');
    console.log('═'.repeat(80));
    console.log(`\n   Total de pasos: ${steps.length}`);
    console.log(`   Completados: ${completedSteps}`);
    console.log(`   Fallidos: ${steps.length - completedSteps}`);
    console.log(`   URL final: ${currentUrl}`);
    
    const allSuccess = completedSteps === steps.length;
    if (allSuccess) {
      console.log('\n🎉 ¡Flujo completado exitosamente!');
    } else {
      console.log('\n⚠️  Flujo completado con errores');
    }
    console.log('═'.repeat(80) + '\n');

    const flowResult: FlowResult = {
      success: allSuccess,
      totalSteps: steps.length,
      completedSteps,
      steps: stepResults,
      finalUrl: currentUrl
    };

    // Generar reportes si están habilitados
    if (enableTracing) {
      await this.stopTracing(reportDir);
    }
    
    if (generateReport) {
      await this.generateHTMLReport(flowResult, reportDir);
    }

    return flowResult;
  }

  /**
   * Ejecuta una instrucción en la página actual (sin navegar)
   * Útil para continuar un flujo desde donde quedó
   */
  async executeStep(instruction: string): Promise<ExecutionResult> {
    if (!this.page) throw new Error('Agente no inicializado');
    
    return this.execute({
      url: this.page.url(),
      instruction
    });
  }

  /**
   * Cierra el navegador, guarda el caché y el trace si está habilitado
   */
  async close(): Promise<void> {
    // Guardar caché y detener timer de limpieza
    if (this.selectorCache) {
      this.selectorCache.printSummary();
      this.selectorCache.dispose();
    }
    
    if (this.context) {
      await this.context.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
  }

  /**
   * Inicia el tracing de Playwright
   */
  async startTracing(reportDir: string): Promise<void> {
    if (!this.context) throw new Error('Contexto no inicializado');
    
    // Crear directorio si no existe
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    await this.context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: true
    });
    
    this.tracingEnabled = true;
    console.log(`📝 Tracing habilitado. Los reportes se guardarán en: ${reportDir}`);
  }

  /**
   * Detiene el tracing y guarda el archivo
   */
  async stopTracing(reportDir: string): Promise<string> {
    if (!this.context || !this.tracingEnabled) return '';
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const tracePath = path.join(reportDir, `trace-${timestamp}.zip`);
    
    await this.context.tracing.stop({ path: tracePath });
    this.tracingEnabled = false;
    
    console.log(`\n📦 Trace guardado en: ${tracePath}`);
    console.log(`   Para ver el trace ejecuta: npx playwright show-trace ${tracePath}`);
    
    return tracePath;
  }

  /**
   * Captura screenshot de un paso
   */
  private async captureStepScreenshot(stepNumber: number, success: boolean, reportDir: string): Promise<string> {
    if (!this.page) return '';
    
    const screenshotDir = path.join(reportDir, 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    
    const status = success ? 'passed' : 'failed';
    const screenshotPath = path.join(screenshotDir, `step-${stepNumber}-${status}.png`);
    
    await this.page.screenshot({ path: screenshotPath, fullPage: false });
    
    this.stepScreenshots.push({ step: stepNumber, path: screenshotPath, success });
    
    return screenshotPath;
  }

  /**
   * Genera un reporte HTML con los resultados del flujo
   */
  async generateHTMLReport(result: FlowResult, reportDir: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(reportDir, `report-${timestamp}.html`);
    
    const stepsHtml = result.steps.map((step, index) => {
      const screenshot = this.stepScreenshots.find(s => s.step === step.step);
      let screenshotImg = '';
      
      // Embeber la imagen en base64 para que el HTML sea autocontenido (para Slack/CircleCI)
      if (screenshot && fs.existsSync(screenshot.path)) {
        const imageBuffer = fs.readFileSync(screenshot.path);
        const base64Image = imageBuffer.toString('base64');
        screenshotImg = `<img src="data:image/png;base64,${base64Image}" alt="Step ${step.step}" style="max-width: 100%; border: 1px solid #ddd; border-radius: 4px; margin-top: 10px;">`;
      }
      
      return `
        <div class="step ${step.success ? 'passed' : 'failed'}">
          <div class="step-header">
            <span class="step-number">Paso ${step.step}</span>
            <span class="step-status ${step.success ? 'passed' : 'failed'}">
              ${step.success ? '✅ Completado' : '❌ Fallido'}
            </span>
          </div>
          <div class="step-instruction">${step.instruction}</div>
          ${step.error ? `<div class="step-error">❌ Error: ${step.error}</div>` : ''}
          ${screenshotImg}
        </div>
      `;
    }).join('');

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte de Automatización - Playwright AI Agent</title>
  <style>
    * { box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      margin: 0; 
      padding: 20px; 
      background: #f5f5f5; 
    }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
      color: white; 
      padding: 30px; 
      border-radius: 10px; 
      margin-bottom: 20px;
    }
    .header h1 { margin: 0 0 10px 0; }
    .summary { 
      display: grid; 
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
      gap: 15px; 
      margin-bottom: 20px; 
    }
    .summary-card { 
      background: white; 
      padding: 20px; 
      border-radius: 10px; 
      box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
      text-align: center;
    }
    .summary-card h3 { margin: 0; color: #666; font-size: 14px; }
    .summary-card .value { font-size: 36px; font-weight: bold; margin: 10px 0; }
    .summary-card .value.success { color: #22c55e; }
    .summary-card .value.error { color: #ef4444; }
    .summary-card .value.total { color: #3b82f6; }
    .steps-container { background: white; border-radius: 10px; padding: 20px; }
    .step { 
      border: 1px solid #e5e7eb; 
      border-radius: 8px; 
      padding: 15px; 
      margin-bottom: 15px; 
    }
    .step.passed { border-left: 4px solid #22c55e; }
    .step.failed { border-left: 4px solid #ef4444; background: #fef2f2; }
    .step-header { display: flex; justify-content: space-between; margin-bottom: 10px; }
    .step-number { font-weight: bold; color: #374151; }
    .step-status.passed { color: #22c55e; }
    .step-status.failed { color: #ef4444; }
    .step-instruction { color: #4b5563; margin-bottom: 10px; }
    .step-error { color: #ef4444; font-size: 14px; background: #fee2e2; padding: 10px; border-radius: 4px; }
    .footer { text-align: center; color: #9ca3af; margin-top: 20px; font-size: 14px; }
    .trace-link { 
      display: inline-block; 
      background: #3b82f6; 
      color: white; 
      padding: 10px 20px; 
      border-radius: 5px; 
      text-decoration: none; 
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🤖 Playwright AI Agent - Reporte de Ejecución</h1>
      <p>Generado: ${new Date().toLocaleString('es-ES')}</p>
      <p>URL Final: ${result.finalUrl || 'N/A'}</p>
    </div>
    
    <div class="summary">
      <div class="summary-card">
        <h3>Total de Pasos</h3>
        <div class="value total">${result.totalSteps}</div>
      </div>
      <div class="summary-card">
        <h3>Completados</h3>
        <div class="value success">${result.completedSteps}</div>
      </div>
      <div class="summary-card">
        <h3>Fallidos</h3>
        <div class="value error">${result.totalSteps - result.completedSteps}</div>
      </div>
      <div class="summary-card">
        <h3>Estado</h3>
        <div class="value ${result.success ? 'success' : 'error'}">
          ${result.success ? '✅ Éxito' : '❌ Fallido'}
        </div>
      </div>
    </div>

    <div class="steps-container">
      <h2>📝 Detalle de Pasos</h2>
      ${stepsHtml}
    </div>

    <div class="footer">
      <p>Generado por Playwright AI Agent</p>
      <p>Para ver el trace detallado: <code>npx playwright show-trace trace-*.zip</code></p>
    </div>
  </div>
</body>
</html>
    `;

    fs.writeFileSync(reportPath, html);
    console.log(`\n📄 Reporte HTML guardado en: ${reportPath}`);
    
    // También guardar JSON para integración con webhooks (Slack, etc.)
    const jsonReport = {
      timestamp: new Date().toISOString(),
      success: result.success,
      totalSteps: result.totalSteps,
      completedSteps: result.completedSteps,
      failedSteps: result.totalSteps - result.completedSteps,
      finalUrl: result.finalUrl,
      steps: result.steps.map(s => ({
        step: s.step,
        instruction: s.instruction,
        success: s.success,
        error: s.error || null
      })),
      reportHtmlPath: reportPath,
      tracePath: fs.existsSync(path.join(reportDir, 'trace.zip')) 
        ? path.join(reportDir, 'trace.zip') 
        : null
    };
    
    const jsonPath = path.join(reportDir, `report-${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));
    console.log(`📊 Reporte JSON guardado en: ${jsonPath}`);
    
    return reportPath;
  }

  /**
   * Genera un payload listo para enviar a Slack via webhook
   * @param result Resultado del flujo
   * @param options Opciones adicionales para el mensaje
   */
  generateSlackPayload(result: FlowResult, options?: { 
    channel?: string; 
    projectName?: string;
    buildUrl?: string;
  }): object {
    const statusEmoji = result.success ? '✅' : '❌';
    const statusText = result.success ? 'Exitoso' : 'Fallido';
    const color = result.success ? '#22c55e' : '#ef4444';
    
    const failedSteps = result.steps.filter(s => !s.success);
    const failedText = failedSteps.length > 0 
      ? failedSteps.map(s => `• Paso ${s.step}: ${s.error}`).join('\n')
      : 'Ninguno';

    return {
      channel: options?.channel,
      attachments: [
        {
          color: color,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: `${statusEmoji} Playwright AI Agent - ${statusText}`,
                emoji: true
              }
            },
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: `*Proyecto:*\n${options?.projectName || 'Playwright AI'}`
                },
                {
                  type: 'mrkdwn',
                  text: `*Estado:*\n${statusText}`
                },
                {
                  type: 'mrkdwn',
                  text: `*Pasos Completados:*\n${result.completedSteps}/${result.totalSteps}`
                },
                {
                  type: 'mrkdwn',
                  text: `*Fecha:*\n${new Date().toLocaleString('es-ES')}`
                }
              ]
            },
            ...(failedSteps.length > 0 ? [{
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*❌ Pasos Fallidos:*\n${failedText}`
              }
            }] : []),
            ...(options?.buildUrl ? [{
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: '📊 Ver Reporte',
                    emoji: true
                  },
                  url: options.buildUrl
                }
              ]
            }] : [])
          ]
        }
      ]
    };
  }
}
