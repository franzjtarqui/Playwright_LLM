import { chromium } from '@playwright/test';
import { createLLMProvider } from './llm-providers.js';
import 'dotenv/config';
/**
 * Agente IA que usa Playwright y LLM Vision para automatizar páginas web
 * sin necesidad de selectores predefinidos
 *
 * Soporta múltiples proveedores: Google AI, OpenAI, Anthropic, DeepSeek, Ollama, Azure
 */
export class PlaywrightAIAgent {
    llmProvider = null;
    browser = null;
    page = null;
    maxRetries = 3;
    /**
     * Modo de análisis: 'screenshot', 'html', o 'hybrid'
     * Cambia esto para optimizar costos vs precisión
     */
    analysisMode = 'html'; // Por defecto usa HTML (más barato)
    /**
     * Configura el modo de análisis de la página
     * @param mode 'screenshot' | 'html' | 'hybrid'
     * @returns this (para encadenamiento)
     */
    setAnalysisMode(mode) {
        this.analysisMode = mode;
        console.log(`📊 Modo de análisis configurado: ${mode}`);
        return this;
    }
    /**
     * Inicializa el navegador y el proveedor de LLM
     */
    async initialize() {
        // Inicializar proveedor de LLM (auto-detecta según .env)
        this.llmProvider = createLLMProvider();
        await this.llmProvider.initialize();
        console.log(`🤖 Usando proveedor: ${this.llmProvider.name}\n`);
        // Inicializar navegador
        this.browser = await chromium.launch({
            headless: false, // Ver lo que hace el agente
            slowMo: 500 // Ralentizar para observar
        });
        this.page = await this.browser.newPage();
        await this.page.setViewportSize({ width: 1280, height: 720 });
    }
    /**
     * Captura un screenshot de la página actual
     */
    async captureScreenshot() {
        if (!this.page)
            throw new Error('Página no inicializada');
        const screenshot = await this.page.screenshot({
            fullPage: false,
            type: 'png'
        });
        return screenshot.toString('base64');
    }
    /**
     * Espera a que la página esté completamente cargada y estable
     * Esto es crucial después de navegaciones o acciones que cambian la página
     */
    async waitForPageStable() {
        if (!this.page)
            return;
        console.log('   ⏳ Esperando a que la página esté estable...');
        try {
            // 1. Esperar a que no haya peticiones de red pendientes
            await this.page.waitForLoadState('networkidle', { timeout: 10000 });
        }
        catch {
            console.log('   ⚠️ Timeout en networkidle, continuando...');
        }
        try {
            // 2. Esperar a que el DOM esté completamente cargado
            await this.page.waitForLoadState('domcontentloaded', { timeout: 5000 });
        }
        catch {
            // Ignorar si ya pasó
        }
        // 3. Pequeña espera adicional para renderizado de SPA/frameworks
        await this.page.waitForTimeout(500);
        // 4. Esperar a que no haya animaciones/cambios en el DOM
        try {
            await this.page.waitForFunction(() => {
                return document.readyState === 'complete';
            }, { timeout: 5000 });
        }
        catch {
            // Ignorar si ya está listo
        }
        console.log('   ✅ Página estable');
    }
    /**
     * Extrae solo los elementos interactivos del DOM
     * Esto reduce significativamente los tokens enviados a la IA
     */
    async extractInteractiveElements() {
        if (!this.page)
            throw new Error('Página no inicializada');
        // Esperar a que la página esté estable antes de extraer
        await this.waitForPageStable();
        // El código dentro de evaluate() se ejecuta en el navegador
        const elements = await this.page.evaluate(() => {
            const interactiveSelectors = [
                'input',
                'button',
                'a',
                'select',
                'textarea',
                '[role="button"]',
                '[role="link"]',
                '[role="textbox"]',
                '[role="menuitem"]',
                '[role="tab"]',
                '[role="option"]',
                '[role="listitem"]',
                '[onclick]',
                '[type="submit"]',
                // Elementos de navegación y menú
                'nav a',
                'nav li',
                'nav span',
                '.sidebar a',
                '.sidebar li',
                '.menu a',
                '.menu li',
                '[class*="nav"] a',
                '[class*="nav"] li',
                '[class*="menu"] a',
                '[class*="menu"] li',
                '[class*="sidebar"] a',
                '[class*="sidebar"] li',
                // Elementos clickeables comunes
                'li[class*="item"]',
                'div[class*="item"]',
                'span[class*="link"]',
                'div[class*="link"]'
            ];
            const results = [];
            interactiveSelectors.forEach((selector) => {
                document.querySelectorAll(selector).forEach((el) => {
                    const element = el;
                    const rect = element.getBoundingClientRect();
                    const style = window.getComputedStyle(element);
                    const isVisible = rect.width > 0 && rect.height > 0 &&
                        style.display !== 'none' &&
                        style.visibility !== 'hidden';
                    if (!isVisible)
                        return;
                    const text = element.textContent?.trim().substring(0, 100) || '';
                    const inputEl = element;
                    results.push({
                        tag: element.tagName.toLowerCase(),
                        type: element.getAttribute('type') || undefined,
                        id: element.id || undefined,
                        name: element.getAttribute('name') || undefined,
                        placeholder: element.getAttribute('placeholder') || undefined,
                        text: text || undefined,
                        ariaLabel: element.getAttribute('aria-label') || undefined,
                        value: inputEl.value || undefined,
                        href: element.getAttribute('href') || undefined,
                        role: element.getAttribute('role') || undefined,
                        visible: true
                    });
                });
            });
            return results;
        });
        // Eliminar duplicados y elementos vacíos
        const unique = elements.filter((el, index, self) => index === self.findIndex(e => e.tag === el.tag && e.id === el.id && e.name === el.name && e.text === el.text));
        return unique;
    }
    /**
     * Formatea los elementos interactivos como texto legible para la IA
     */
    formatElementsForAI(elements) {
        if (elements.length === 0)
            return 'No interactive elements found. Use visible text locators like "text \'ElementName\'" to target elements.';
        const formatted = elements.map((el, index) => {
            const parts = [`${index + 1}. <${el.tag}>`];
            if (el.type)
                parts.push(`type="${el.type}"`);
            if (el.id)
                parts.push(`id="${el.id}"`);
            if (el.name)
                parts.push(`name="${el.name}"`);
            if (el.placeholder)
                parts.push(`placeholder="${el.placeholder}"`);
            if (el.ariaLabel)
                parts.push(`aria-label="${el.ariaLabel}"`);
            if (el.role)
                parts.push(`role="${el.role}"`);
            if (el.text && el.tag !== 'input')
                parts.push(`texto="${el.text}"`);
            if (el.href)
                parts.push(`href="${el.href.substring(0, 50)}..."`);
            return parts.join(' ');
        });
        return formatted.join('\n');
    }
    /**
     * Obtiene el contexto de la página para información adicional
     */
    async getPageContext() {
        if (!this.page)
            throw new Error('Página no inicializada');
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
    generatePrompt(instruction, context, elementsHtml) {
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
     */
    async analyzePageAndDecide(instruction, screenshot) {
        if (!this.llmProvider)
            throw new Error('Proveedor LLM no inicializado');
        const context = await this.getPageContext();
        let elementsHtml;
        let responseText;
        // Extraer elementos HTML si el modo lo requiere
        if (this.analysisMode === 'html' || this.analysisMode === 'hybrid') {
            console.log('📋 Extrayendo elementos interactivos del DOM...');
            const elements = await this.extractInteractiveElements();
            elementsHtml = this.formatElementsForAI(elements);
            console.log(`   Encontrados: ${elements.length} elementos`);
        }
        const prompt = this.generatePrompt(instruction, context, elementsHtml);
        // Decidir qué enviar según el modo
        if (this.analysisMode === 'html') {
            // Solo texto, sin imagen (más barato)
            console.log('💰 Modo HTML: enviando solo texto (ahorra tokens)');
            responseText = await this.llmProvider.analyzeImage('', prompt);
        }
        else {
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
        }
        else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```\n?/g, '');
        }
        try {
            return JSON.parse(jsonText.trim());
        }
        catch (error) {
            console.error('❌ Error parseando JSON:', error.message);
            console.error('Texto recibido:', jsonText);
            throw new Error('La IA no devolvió un JSON válido');
        }
    }
    /**
     * Encuentra un elemento en la página usando descripción flexible
     * Soporta: selectores CSS, texto, placeholder, name, id
     */
    async findElementByDescription(description) {
        if (!this.page)
            throw new Error('Página no inicializada');
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
        const strategies = [
            // 1. Si es un selector CSS directo, probarlo
            async () => {
                if (description.includes('[') || description.startsWith('button') ||
                    description.startsWith('input') || description.startsWith('a') ||
                    description.startsWith('#') || description.startsWith('.')) {
                    const loc = page.locator(description.replace(/['"]/g, "'")).first();
                    if (await loc.count() > 0)
                        return loc;
                }
                return null;
            },
            // 2. Por name extraído
            async () => {
                if (nameMatch) {
                    const name = nameMatch[1];
                    const loc = page.locator(`[name="${name}"]`).first();
                    if (await loc.count() > 0)
                        return loc;
                }
                return null;
            },
            // 3. Por id extraído  
            async () => {
                if (idMatch) {
                    const id = idMatch[1];
                    const loc = page.locator(`#${id}, [id="${id}"]`).first();
                    if (await loc.count() > 0)
                        return loc;
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
                    if (await loc.count() > 0)
                        return loc;
                }
                // Email/correo
                if (descLower.includes('email') || descLower.includes('correo')) {
                    // Buscar por name="email" o type="email" o placeholder con correo
                    const loc = page.locator('input[name="email"], input[type="email"], input[placeholder*="correo" i], input[placeholder*="email" i]').first();
                    if (await loc.count() > 0)
                        return loc;
                }
                // Usuario/username
                if (descLower.includes('usuario') || descLower.includes('user')) {
                    const loc = page.locator('input[name*="user" i], input[id*="user" i], input[placeholder*="usuario" i]').first();
                    if (await loc.count() > 0)
                        return loc;
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
                        if (await loc.count() > 0)
                            return loc;
                    }
                    // Buscar botón submit
                    const submitBtn = page.locator('button[type="submit"], input[type="submit"]').first();
                    if (await submitBtn.count() > 0)
                        return submitBtn;
                    // Buscar cualquier botón con texto similar
                    const anyBtn = page.locator('button').filter({ hasText: new RegExp('ingresar|login|entrar|enviar|submit', 'i') }).first();
                    if (await anyBtn.count() > 0)
                        return anyBtn;
                }
                return null;
            },
            // 7. Por type extraído
            async () => {
                if (typeMatch) {
                    const type = typeMatch[1];
                    const loc = page.locator(`input[type="${type}"]`).first();
                    if (await loc.count() > 0)
                        return loc;
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
                    if (await loc.count() > 0)
                        return loc;
                    // Buscar por texto parcial
                    loc = page.getByText(cleanText).first();
                    if (await loc.count() > 0)
                        return loc;
                    // Buscar en links
                    loc = page.getByRole('link', { name: new RegExp(cleanText, 'i') }).first();
                    if (await loc.count() > 0)
                        return loc;
                    // Buscar en cualquier elemento clickeable
                    loc = page.locator(`a, button, [role="button"], [role="link"], [role="menuitem"], span, div`)
                        .filter({ hasText: new RegExp(`^${cleanText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).first();
                    if (await loc.count() > 0)
                        return loc;
                    // Búsqueda más flexible
                    loc = page.locator(`*`).filter({ hasText: new RegExp(cleanText, 'i') }).first();
                    if (await loc.count() > 0)
                        return loc;
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
                    if (await loc.count() > 0)
                        return loc;
                    // Navegación
                    loc = page.locator('nav a, .sidebar a, .menu a, [class*="nav"] a, [class*="menu"] a')
                        .filter({ hasText: new RegExp(menuText, 'i') }).first();
                    if (await loc.count() > 0)
                        return loc;
                    // List items
                    loc = page.getByRole('listitem').filter({ hasText: new RegExp(menuText, 'i') }).first();
                    if (await loc.count() > 0)
                        return loc;
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
                        }
                        catch {
                            // El elemento existe pero no es visible, continuar buscando
                            continue;
                        }
                    }
                }
                catch {
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
                }
                catch {
                    // Continuar aunque timeout
                }
            }
        }
        throw new Error(`No se pudo encontrar elemento: ${description}`);
    }
    /**
     * Ejecuta una acción de Playwright basada en la decisión de la IA
     */
    async executeAction(action) {
        if (!this.page)
            throw new Error('Página no inicializada');
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
                        }
                        catch {
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
                    }
                    catch {
                        // Intentar buscar de forma más flexible
                        const pageContent = await this.page.content();
                        if (pageContent.toLowerCase().includes(textToVerify.toLowerCase())) {
                            console.log(`   ✅ Texto "${textToVerify}" encontrado en el HTML`);
                        }
                        else {
                            throw new Error(`No se encontró el texto: "${textToVerify}"`);
                        }
                    }
                    break;
                }
                default:
                    console.warn(`   ⚠️  Tipo de acción desconocida: ${action.type}`);
            }
        }
        catch (error) {
            console.error(`   ❌ Error ejecutando acción: ${error.message}`);
            throw error;
        }
    }
    /**
     * Ejecuta una instrucción completa
     */
    async execute({ url, instruction, analysisMode }) {
        if (!this.page)
            throw new Error('Agente no inicializado. Llama a initialize() primero.');
        // Usar el modo pasado por parámetro o el configurado en la instancia
        if (analysisMode)
            this.analysisMode = analysisMode;
        console.log('\n' + '='.repeat(80));
        console.log('🤖 PLAYWRIGHT AI AGENT');
        console.log('='.repeat(80));
        console.log(`\n📍 URL: ${url}`);
        console.log(`💬 Instrucción: "${instruction}"`);
        console.log(`📊 Modo de análisis: ${this.analysisMode}\n`);
        try {
            // 1. Navegar a la página
            console.log('🌐 Navegando a la página...');
            await this.page.goto(url, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(1000);
            // 2. Analizar con IA (el método decide si usar screenshot o HTML según el modo)
            console.log('🧠 Analizando con IA...');
            const decision = await this.analyzePageAndDecide(instruction);
            console.log('\n📋 Plan de acciones:');
            console.log(`   Razonamiento: ${decision.reasoning}`);
            console.log(`   Acciones: ${decision.actions.length}`);
            // 3. Ejecutar acciones
            console.log('\n🎬 Ejecutando acciones...');
            for (const action of decision.actions) {
                await this.executeAction(action);
            }
            // 4. Captura final (opcional, para debug)
            await this.page.waitForTimeout(1000);
            console.log('\n✅ Ejecución completada!');
            console.log('='.repeat(80) + '\n');
            return {
                success: true,
                decision,
                finalUrl: this.page.url()
            };
        }
        catch (error) {
            console.error('\n❌ Error durante la ejecución:', error.message);
            console.error('='.repeat(80) + '\n');
            return {
                success: false,
                error: error.message
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
    async executeFlow({ url, steps, stopOnError = true, delayBetweenSteps = 2000, analysisMode }) {
        if (!this.page)
            throw new Error('Agente no inicializado. Llama a initialize() primero.');
        // Usar el modo pasado por parámetro o el configurado en la instancia
        if (analysisMode)
            this.analysisMode = analysisMode;
        console.log('\n' + '═'.repeat(80));
        console.log('🔄 PLAYWRIGHT AI AGENT - FLUJO COMPLETO');
        console.log('═'.repeat(80));
        console.log(`\n📍 URL inicial: ${url}`);
        console.log(`📋 Total de pasos: ${steps.length}`);
        console.log(`⏱️  Delay entre pasos: ${delayBetweenSteps}ms`);
        console.log(`🛑 Detener en error: ${stopOnError ? 'Sí' : 'No'}`);
        console.log(`📊 Modo de análisis: ${this.analysisMode}\n`);
        console.log('📝 Pasos a ejecutar:');
        steps.forEach((step, i) => console.log(`   ${i + 1}. ${step}`));
        console.log('');
        const stepResults = [];
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
                const decision = await this.analyzePageAndDecide(instruction);
                console.log(`\n📋 Plan: ${decision.reasoning}`);
                console.log(`   Acciones: ${decision.actions.length}`);
                // Ejecutar acciones
                console.log('\n🎬 Ejecutando acciones...');
                for (const action of decision.actions) {
                    await this.executeAction(action);
                }
                // Esperar a que la página se estabilice
                await this.page.waitForTimeout(delayBetweenSteps);
                currentUrl = this.page.url();
                stepResults.push({
                    step: stepNumber,
                    instruction,
                    success: true
                });
                completedSteps++;
                console.log(`\n✅ Paso ${stepNumber} completado!`);
            }
            catch (error) {
                const errorMessage = error.message;
                console.error(`\n❌ Error en paso ${stepNumber}: ${errorMessage}`);
                stepResults.push({
                    step: stepNumber,
                    instruction,
                    success: false,
                    error: errorMessage
                });
                if (stopOnError) {
                    console.log('\n🛑 Deteniendo flujo debido a error...');
                    break;
                }
                else {
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
        }
        else {
            console.log('\n⚠️  Flujo completado con errores');
        }
        console.log('═'.repeat(80) + '\n');
        return {
            success: allSuccess,
            totalSteps: steps.length,
            completedSteps,
            steps: stepResults,
            finalUrl: currentUrl
        };
    }
    /**
     * Ejecuta una instrucción en la página actual (sin navegar)
     * Útil para continuar un flujo desde donde quedó
     */
    async executeStep(instruction) {
        if (!this.page)
            throw new Error('Agente no inicializado');
        return this.execute({
            url: this.page.url(),
            instruction
        });
    }
    /**
     * Cierra el navegador
     */
    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}
//# sourceMappingURL=ai-agent.js.map