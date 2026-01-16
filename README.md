# Playwright + Agente IA Demo

Demo de automatización web usando Playwright con un agente de IA que entiende instrucciones en lenguaje natural y ejecuta acciones **sin necesidad de selectores predefinidos**.

## 🚀 Características

- ✨ **Sin selectores**: La IA analiza la página visualmente
- 🧠 **Lenguaje natural**: Da instrucciones como "Ingresar usuario Franz, password 1234"
- 👁️ **Visión por computadora**: Usa IA Vision para entender la interfaz
- 🎯 **Acciones inteligentes**: El agente decide qué hacer en base al contexto
- 🔄 **Multi-proveedor**: Soporta Google Gemini, OpenAI, Anthropic, DeepSeek, Ollama y más

## 📋 Requisitos

- Node.js 18+
- API Key de algún proveedor de IA (ver opciones abajo)

## 🤖 Proveedores Soportados

| Proveedor | Modelo | Costo | API Key |
|-----------|--------|-------|---------|
| **Google AI** | Gemini 1.5 Flash | ✅ GRATIS | [aistudio.google.com](https://aistudio.google.com/apikey) |
| **Ollama** | LLaVA (local) | ✅ GRATIS | No requiere |
| **OpenAI** | GPT-4o | 💰 Pago | [platform.openai.com](https://platform.openai.com/api-keys) |
| **Anthropic** | Claude 3.5 | 💰 Pago | [console.anthropic.com](https://console.anthropic.com/) |
| **DeepSeek** | DeepSeek | 💰 Pago | [platform.deepseek.com](https://platform.deepseek.com/) |
| **Azure OpenAI** | GPT-4o | 💰 Pago | Portal Azure |

## 🔧 Instalación

1. Instalar dependencias:
```bash
npm install
npm run install-browsers
```

2. Configurar API Key (elige UNO):
```bash
cp .env.example .env
```

Edita `.env` y agrega tu API key:

```bash
# Opción 1: Google AI (GRATIS)
GOOGLE_AI_API_KEY=tu_api_key_aqui

# Opción 2: OpenAI
OPENAI_API_KEY=tu_api_key_aqui

# Opción 3: Anthropic
ANTHROPIC_API_KEY=tu_api_key_aqui

# Opción 4: DeepSeek
DEEPSEEK_API_KEY=tu_api_key_aqui

# Opción 5: Ollama (local, sin API key)
OLLAMA_ENABLED=true
```

El sistema auto-detecta qué proveedor usar según la API key configurada.

## 🎮 Uso

### Demo con página de login local

1. Iniciar el servidor demo:
```bash
npm run serve-demo
```

2. En otra terminal, ejecutar el agente:
```bash
npm run demo
```

### Usar con tu propia página

Edita `src/demo.js` y cambia la URL y las instrucciones:

```javascript
const result = await agent.execute({
  url: 'https://tu-sitio.com',
  instruction: 'Tu instrucción en lenguaje natural'
});
```

## 📖 Ejemplo de Instrucciones

```javascript
// Login simple
"Ingresar usuario Franz, password 1234 y hacer click en Login"

// Búsqueda
"Buscar 'Playwright automation' y hacer click en el primer resultado"

// Formulario complejo
"Llenar el formulario con nombre Juan, email juan@test.com y enviar"
```

## 🏗️ Arquitectura

1. **PlaywrightAIAgent**: Orquesta todo el proceso
2. **Visión IA**: Captura screenshot y analiza con Claude Vision
3. **Ejecutor**: Traduce las decisiones de la IA a acciones de Playwright
4. **Loop de feedback**: Verifica resultados y reintenta si es necesario

## ⚠️ Limitaciones

- Requiere conexión a internet para la API de Claude
- Costo por uso de la API (visión)
- Puede no funcionar en sitios con CAPTCHA o seguridad avanzada
- La precisión depende de la complejidad de la interfaz

## 🔐 Seguridad

- Nunca compartas tu archivo `.env`
- No uses credenciales reales en demos públicas
- Revisa los costos de API antes de uso intensivo
