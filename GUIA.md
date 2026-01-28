# Guía de Uso - Playwright AI Agent

## 🚀 Inicio Rápido

### Paso 1: Instalar Dependencias

```bash
npm install
npm run install-browsers
```

### Paso 2: Configurar API Key (Elige UNO)

Copia el archivo de ejemplo y configura tu proveedor preferido:

```bash
cp .env.example .env
```

#### 🌟 Opción GRATIS - Google AI Studio (Gemini)
1. Ve a: https://aistudio.google.com/apikey
2. Crea una API key
3. En `.env`:
```bash
GOOGLE_AI_API_KEY=tu_api_key_aqui
```

#### 🌟 Opción GRATIS - Ollama (Local)
1. Instala Ollama: https://ollama.ai/
2. Descarga el modelo: `ollama pull llava`
3. En `.env`:
```bash
OLLAMA_ENABLED=true
```

#### Otras opciones (de pago)
```bash
# OpenAI GPT-4
OPENAI_API_KEY=tu_api_key_aqui

# Anthropic Claude
ANTHROPIC_API_KEY=tu_api_key_aqui

# DeepSeek
DEEPSEEK_API_KEY=tu_api_key_aqui

# Azure OpenAI
AZURE_OPENAI_API_KEY=tu_api_key_aqui
AZURE_OPENAI_ENDPOINT=https://tu-recurso.openai.azure.com/
```

**Nota:** El sistema auto-detecta qué proveedor usar según la API key configurada.

### Paso 3: Ejecutar el Demo

**Terminal 1 - Servidor de prueba:**
```bash
npm run serve-demo
```

**Terminal 2 - Agente IA:**
```bash
npm run demo
```

## 📖 Cómo Funciona

### Arquitectura

```
Instrucción (lenguaje natural)
         ↓
   [Agente IA]
         ↓
   Captura Screenshot
         ↓
   [LLM Vision] ← Gemini/GPT-4/Claude/etc
         ↓
   Genera Plan de Acciones (JSON)
         ↓
   [Ejecutor Playwright]
         ↓
   Ejecuta Acciones sin Selectores
```

### Flujo de Ejecución

1. **Navegación**: El agente abre la página especificada
2. **Captura**: Toma un screenshot de la página
3. **Análisis IA**: El LLM Vision analiza la imagen y entiende la interfaz
4. **Planificación**: La IA genera un plan de acciones en JSON
5. **Ejecución**: El agente ejecuta cada acción usando Playwright
6. **Verificación**: Captura el resultado final

### Ejemplo de Flujo Interno

**Instrucción:**
```javascript
"Ingresar usuario Franz, password 1234 y hacer click en Login"
```

**IA Genera (internamente):**
```json
{
  "actions": [
    {
      "type": "fill",
      "locator": "el campo de texto con label 'Usuario'",
      "value": "Franz"
    },
    {
      "type": "fill",
      "locator": "el campo de contraseña",
      "value": "1234"
    },
    {
      "type": "click",
      "locator": "el botón que dice 'Iniciar Sesión'"
    }
  ]
}
```

**Playwright Ejecuta:**
- Busca el campo de usuario visualmente (sin selectores)
- Llena "Franz"
- Busca el campo de contraseña
- Llena "1234"
- Busca y hace click en el botón

## 🎯 Casos de Uso

### 1. Login Automático
```javascript
await agent.execute({
  url: 'http://localhost:3000',
  instruction: 'Ingresar usuario Franz, password 1234 y hacer login'
});
```

### 2. Búsqueda
```javascript
await agent.execute({
  url: 'https://www.google.com',
  instruction: 'Buscar "Playwright tutorial" y presionar Enter'
});
```

### 3. Formulario Complejo
```javascript
await agent.execute({
  url: 'https://ejemplo.com/registro',
  instruction: 'Llenar formulario con nombre Juan, email juan@test.com, edad 25 y enviar'
});
```

### 4. Navegación
```javascript
await agent.execute({
  url: 'https://ejemplo.com',
  instruction: 'Hacer click en el menú Productos y luego en la categoría Laptops'
});
```

## 🛠️ Personalización

### Crear Tu Propio Script

```javascript
// mi-script.js
import { PlaywrightAIAgent } from './src/ai-agent.js';

async function miAutomatizacion() {
  const agent = new PlaywrightAIAgent();
  
  try {
    await agent.initialize();
    
    // Tu lógica aquí
    await agent.execute({
      url: 'https://tu-sitio.com',
      instruction: 'Tu instrucción aquí'
    });
    
    await agent.page.waitForTimeout(3000);
    
  } finally {
    await agent.close();
  }
}

miAutomatizacion();
```

### Configurar Comportamiento

En `src/ai-agent.js`, puedes modificar:

```javascript
// Modo headless (sin ver el navegador)
this.browser = await chromium.launch({ 
  headless: true,  // Cambiar a true
  slowMo: 0        // Eliminar delay
});

// Tamaño de pantalla
await this.page.setViewportSize({ 
  width: 1920, 
  height: 1080 
});

// Máximo de reintentos
this.maxRetries = 5;
```

## 🔍 Debug y Troubleshooting

### Activar Logs Detallados

El agente ya incluye logs detallados. Para ver más información:

```javascript
// En ai-agent.js, agrega console.logs adicionales
console.log('HTML de la página:', await this.page.content());
console.log('Elementos encontrados:', await this.page.locator('input').count());
```

### Errores Comunes

**1. "ANTHROPIC_API_KEY no configurada"**
- Solución: Crea el archivo `.env` con tu API key

**2. "ECONNREFUSED localhost:3000"**
- Solución: Inicia el servidor demo primero: `npm run serve-demo`

**3. "No se pudo encontrar elemento"**
- Causa: La IA no puede identificar el elemento visualmente
- Solución: Asegúrate que los elementos tengan texto visible o labels claros

**4. "La IA no devolvió un JSON válido"**
- Causa: A veces Claude responde con texto adicional
- Solución: El código intenta limpiar markdown, pero puedes ajustar el prompt

### Capturar Screenshots de Debug

```javascript
// En tu script
await agent.page.screenshot({ 
  path: 'debug-screenshot.png',
  fullPage: true 
});
```

## 💰 Costos de API

- **Claude Vision**: ~$0.003 USD por imagen (screenshot)
- **Demo típico**: 2 screenshots = ~$0.006 USD
- **Créditos gratuitos**: Anthropic ofrece $5 USD gratis

### Optimizar Costos

1. Usa screenshots más pequeños
2. Reduce la calidad de imagen
3. Cachea decisiones para páginas similares

## 🚀 Próximos Pasos

1. **Prueba con tu propia aplicación**: Cambia la URL en `demo.js`
2. **Agrega más tipos de acciones**: Extiende el switch en `executeAction()`
3. **Implementa verificaciones**: Agrega lógica para validar resultados
4. **Crea tests automatizados**: Usa el agente en tests E2E

## 📚 Recursos

- [Documentación de Playwright](https://playwright.dev/)
- [Anthropic Claude API](https://docs.anthropic.com/)
- [Ejemplos de Prompts para Visión](https://docs.anthropic.com/claude/docs/vision)

## ⚡ Tips Avanzados

### 1. Manejo de Páginas Dinámicas

```javascript
// Esperar a que cargue contenido dinámico
await agent.page.waitForLoadState('networkidle');
await agent.page.waitForTimeout(2000);
```

### 2. Múltiples Páginas

```javascript
// Trabajar con nuevas pestañas
const [newPage] = await Promise.all([
  context.waitForEvent('page'),
  page.click('a[target="_blank"]')
]);
```

### 3. Manejo de Errores Robusto

```javascript
// Reintentar en caso de fallo
for (let i = 0; i < 3; i++) {
  try {
    await agent.execute({...});
    break;
  } catch (error) {
    if (i === 2) throw error;
    await agent.page.waitForTimeout(1000);
  }
}
```

---

## ⚙️ Archivo de Configuración

El proyecto usa un archivo de configuración centralizado `ai-test.config.ts` que permite personalizar todos los aspectos de la automatización.

### Ubicación

El archivo se encuentra en la raíz del proyecto:

```
📁 Proyecto/
├── ai-test.config.ts   ← Archivo de configuración
├── package.json
├── tests/
│   └── flows/
└── ...
```

### Secciones de Configuración

#### 🌐 Navegador

```typescript
browser: {
  headless: false,           // true para CI/CD
  slowMo: 500,               // Delay en ms (debugging)
  navigationTimeout: 30000,  // Timeout navegación
  actionTimeout: 10000,      // Timeout por acción
  viewport: { width: 1280, height: 720 },
  recordVideo: false,        // Grabar video
  videoDir: './videos'
}
```

#### 📊 Reportes

```typescript
reports: {
  html: {
    enabled: true,
    openOnFinish: false      // Abrir en navegador
  },
  json: {
    enabled: true
  },
  trace: {
    enabled: true,
    mode: 'always'           // 'always' | 'on-failure' | 'never'
  }
}
```

#### 📸 Capturas de Pantalla

```typescript
screenshots: {
  enabled: true,
  mode: 'always',           // 'always' | 'on-failure' | 'never'
  fullPage: false,          // true = scroll completo
  quality: 80,              // 0-100 (solo JPEG)
  format: 'png',            // 'png' | 'jpeg'
  embedInHtml: true         // Embeber en base64
}
```

#### 🧠 IA

```typescript
ai: {
  analysisMode: 'html',     // 'html' | 'screenshot' | 'hybrid'
  provider: 'auto',         // 'auto' | 'google' | 'openai' | etc
  retryOnCacheFailure: true,
  maxRetries: 2
}
```

#### 💾 Caché de Selectores

```typescript
cache: {
  enabled: true,
  maxSize: 500,
  ttl: 24 * 60 * 60 * 1000, // 24 horas
  maxFailures: 3,
  debug: false
}
```

#### ⚙️ Ejecución

```typescript
execution: {
  stopOnError: true,        // Detener al primer error
  failFast: false,          // Detener toda la suite
  delayBetweenSteps: 2000,  // Delay entre pasos
  retries: 0,               // Reintentos por flow
  flowTimeout: 120000,      // 2 minutos max por flow
  parallel: false,          // Experimental
  maxWorkers: 2
}
```

#### 🔔 Notificaciones (Opcional)

```typescript
notifications: {
  slack: {
    enabled: false,
    webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
    notifyOn: 'on-failure', // 'always' | 'on-failure' | 'never'
    projectName: 'AI Test Runner'
  }
}
```

### Ejemplo: Configuración para CI/CD

```typescript
const config: AITestConfig = {
  browser: {
    headless: true,        // Sin interfaz gráfica
    slowMo: 0,             // Sin delays
    ...
  },
  reports: {
    html: { enabled: true, openOnFinish: false },
    trace: { enabled: true, mode: 'on-failure' }  // Solo si falla
  },
  screenshots: {
    enabled: true,
    mode: 'on-failure'     // Solo capturar errores
  },
  execution: {
    failFast: true,        // Detener al primer error
    retries: 1             // Reintentar 1 vez
  }
};
```

### Ejemplo: Configuración para Desarrollo

```typescript
const config: AITestConfig = {
  browser: {
    headless: false,       // Ver el navegador
    slowMo: 1000,          // Lento para ver acciones
    ...
  },
  reports: {
    trace: { enabled: true, mode: 'always' }
  },
  screenshots: {
    mode: 'always',        // Capturar todo
    fullPage: true         // Página completa
  },
  cache: {
    debug: true            // Ver logs del caché
  }
};
```

### Variables de Entorno

La configuración también soporta variables de entorno:

```typescript
baseUrl: process.env.TEST_URL || 'http://localhost:3000',
globalVariables: {
  AMBIENTE: process.env.AMBIENTE || 'desarrollo'
}
```
