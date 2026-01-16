import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import 'dotenv/config';
// ============================================
// ANTHROPIC (Claude)
// ============================================
export class AnthropicProvider {
    apiKey;
    name = 'Anthropic Claude';
    client = null;
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    async initialize() {
        this.client = new Anthropic({ apiKey: this.apiKey });
    }
    async analyzeImage(screenshotBase64, prompt) {
        if (!this.client)
            throw new Error('Cliente no inicializado');
        const response = await this.client.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1024,
            messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: 'image/png',
                                data: screenshotBase64
                            }
                        },
                        { type: 'text', text: prompt }
                    ]
                }]
        });
        const content = response.content[0];
        if (content.type === 'text') {
            return content.text;
        }
        throw new Error('Respuesta inesperada de Anthropic');
    }
}
// ============================================
// GOOGLE AI (Gemini)
// ============================================
export class GoogleAIProvider {
    apiKey;
    name = 'Google Gemini';
    model = null;
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    async initialize() {
        const genAI = new GoogleGenerativeAI(this.apiKey);
        // Usar gemini-2.0-flash que soporta visión y texto
        this.model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
    }
    async analyzeImage(screenshotBase64, prompt) {
        if (!this.model)
            throw new Error('Modelo no inicializado');
        // Si no hay imagen, enviar solo texto (modo HTML - más barato)
        if (!screenshotBase64) {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        }
        // Con imagen (modo screenshot o hybrid)
        const imagePart = {
            inlineData: {
                data: screenshotBase64,
                mimeType: 'image/png'
            }
        };
        const result = await this.model.generateContent([prompt, imagePart]);
        const response = await result.response;
        return response.text();
    }
}
// ============================================
// OPENAI (GPT-4 Vision)
// ============================================
export class OpenAIProvider {
    apiKey;
    name = 'OpenAI GPT-4';
    client = null;
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    async initialize() {
        this.client = new OpenAI({ apiKey: this.apiKey });
    }
    async analyzeImage(screenshotBase64, prompt) {
        if (!this.client)
            throw new Error('Cliente no inicializado');
        // Si no hay imagen, enviar solo texto
        if (!screenshotBase64) {
            const response = await this.client.chat.completions.create({
                model: 'gpt-4o',
                max_tokens: 1024,
                messages: [{ role: 'user', content: prompt }]
            });
            return response.choices[0].message.content || '';
        }
        const response = await this.client.chat.completions.create({
            model: 'gpt-4o',
            max_tokens: 1024,
            messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:image/png;base64,${screenshotBase64}`
                            }
                        },
                        { type: 'text', text: prompt }
                    ]
                }]
        });
        return response.choices[0].message.content || '';
    }
}
// ============================================
// DEEPSEEK
// ============================================
export class DeepSeekProvider {
    apiKey;
    name = 'DeepSeek';
    client = null;
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    async initialize() {
        this.client = new OpenAI({
            apiKey: this.apiKey,
            baseURL: 'https://api.deepseek.com/v1'
        });
    }
    async analyzeImage(screenshotBase64, prompt) {
        if (!this.client)
            throw new Error('Cliente no inicializado');
        // DeepSeek funciona mejor con solo texto
        if (!screenshotBase64) {
            const response = await this.client.chat.completions.create({
                model: 'deepseek-chat',
                max_tokens: 1024,
                messages: [{ role: 'user', content: prompt }]
            });
            return response.choices[0].message.content || '';
        }
        const response = await this.client.chat.completions.create({
            model: 'deepseek-chat',
            max_tokens: 1024,
            messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:image/png;base64,${screenshotBase64}`
                            }
                        },
                        { type: 'text', text: prompt }
                    ]
                }]
        });
        return response.choices[0].message.content || '';
    }
}
export class OllamaProvider {
    baseUrl;
    name = 'Ollama (Local)';
    model;
    constructor(baseUrl = 'http://localhost:11434') {
        this.baseUrl = baseUrl;
        this.model = process.env.OLLAMA_MODEL || 'llava';
    }
    async initialize() {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            if (!response.ok)
                throw new Error('Ollama no responde');
            console.log(`✅ Conectado a Ollama en ${this.baseUrl}`);
        }
        catch {
            throw new Error(`No se puede conectar a Ollama. ¿Está corriendo? (${this.baseUrl})`);
        }
    }
    async analyzeImage(screenshotBase64, prompt) {
        const response = await fetch(`${this.baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.model,
                prompt: prompt,
                images: [screenshotBase64],
                stream: false
            })
        });
        const data = await response.json();
        return data.response;
    }
}
// ============================================
// AZURE OPENAI
// ============================================
export class AzureOpenAIProvider {
    apiKey;
    endpoint;
    name = 'Azure OpenAI';
    client = null;
    deploymentName;
    constructor(apiKey, endpoint) {
        this.apiKey = apiKey;
        this.endpoint = endpoint;
        this.deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
    }
    async initialize() {
        if (!this.endpoint) {
            throw new Error('AZURE_OPENAI_ENDPOINT no configurado en .env');
        }
        this.client = new OpenAI({
            apiKey: this.apiKey,
            baseURL: `${this.endpoint}/openai/deployments/${this.deploymentName}`,
            defaultQuery: { 'api-version': '2024-02-15-preview' },
            defaultHeaders: { 'api-key': this.apiKey }
        });
    }
    async analyzeImage(screenshotBase64, prompt) {
        if (!this.client)
            throw new Error('Cliente no inicializado');
        const response = await this.client.chat.completions.create({
            model: this.deploymentName,
            max_tokens: 1024,
            messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:image/png;base64,${screenshotBase64}`
                            }
                        },
                        { type: 'text', text: prompt }
                    ]
                }]
        });
        return response.choices[0].message.content || '';
    }
}
// ============================================
// FACTORY: Crear proveedor según configuración
// ============================================
export function createLLMProvider() {
    const provider = process.env.LLM_PROVIDER?.toLowerCase() || 'auto';
    // Auto-detectar según qué API key esté configurada
    if (provider === 'auto') {
        if (process.env.GOOGLE_AI_API_KEY) {
            console.log('🔍 Detectado: Google AI API Key');
            return new GoogleAIProvider(process.env.GOOGLE_AI_API_KEY);
        }
        if (process.env.OPENAI_API_KEY) {
            console.log('🔍 Detectado: OpenAI API Key');
            return new OpenAIProvider(process.env.OPENAI_API_KEY);
        }
        if (process.env.ANTHROPIC_API_KEY) {
            console.log('🔍 Detectado: Anthropic API Key');
            return new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
        }
        if (process.env.DEEPSEEK_API_KEY) {
            console.log('🔍 Detectado: DeepSeek API Key');
            return new DeepSeekProvider(process.env.DEEPSEEK_API_KEY);
        }
        if (process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT) {
            console.log('🔍 Detectado: Azure OpenAI API Key');
            return new AzureOpenAIProvider(process.env.AZURE_OPENAI_API_KEY, process.env.AZURE_OPENAI_ENDPOINT);
        }
        if (process.env.OLLAMA_ENABLED === 'true') {
            console.log('🔍 Detectado: Ollama (Local)');
            return new OllamaProvider(process.env.OLLAMA_URL);
        }
        throw new Error(`
❌ No se encontró ninguna API key configurada.

Configura una de estas en tu archivo .env:
  - GOOGLE_AI_API_KEY     (Google AI Studio - Gemini) [GRATIS]
  - OPENAI_API_KEY        (OpenAI GPT-4)
  - ANTHROPIC_API_KEY     (Anthropic Claude)
  - DEEPSEEK_API_KEY      (DeepSeek)
  - AZURE_OPENAI_API_KEY  (Azure OpenAI)
  - OLLAMA_ENABLED=true   (Ollama local) [GRATIS]
    `);
    }
    // Selección manual del proveedor
    const providers = {
        'google': () => new GoogleAIProvider(process.env.GOOGLE_AI_API_KEY),
        'gemini': () => new GoogleAIProvider(process.env.GOOGLE_AI_API_KEY),
        'openai': () => new OpenAIProvider(process.env.OPENAI_API_KEY),
        'gpt': () => new OpenAIProvider(process.env.OPENAI_API_KEY),
        'anthropic': () => new AnthropicProvider(process.env.ANTHROPIC_API_KEY),
        'claude': () => new AnthropicProvider(process.env.ANTHROPIC_API_KEY),
        'deepseek': () => new DeepSeekProvider(process.env.DEEPSEEK_API_KEY),
        'azure': () => new AzureOpenAIProvider(process.env.AZURE_OPENAI_API_KEY, process.env.AZURE_OPENAI_ENDPOINT),
        'ollama': () => new OllamaProvider(process.env.OLLAMA_URL)
    };
    if (!providers[provider]) {
        throw new Error(`Proveedor desconocido: ${provider}. Opciones: ${Object.keys(providers).join(', ')}`);
    }
    return providers[provider]();
}
// Lista de proveedores soportados
export const SUPPORTED_PROVIDERS = [
    { name: 'Google AI (Gemini)', envVar: 'GOOGLE_AI_API_KEY', provider: 'google', free: true },
    { name: 'Ollama (Local)', envVar: 'OLLAMA_ENABLED', provider: 'ollama', free: true },
    { name: 'OpenAI (GPT-4)', envVar: 'OPENAI_API_KEY', provider: 'openai', free: false },
    { name: 'Anthropic (Claude)', envVar: 'ANTHROPIC_API_KEY', provider: 'anthropic', free: false },
    { name: 'DeepSeek', envVar: 'DEEPSEEK_API_KEY', provider: 'deepseek', free: false },
    { name: 'Azure OpenAI', envVar: 'AZURE_OPENAI_API_KEY', provider: 'azure', free: false }
];
//# sourceMappingURL=llm-providers.js.map