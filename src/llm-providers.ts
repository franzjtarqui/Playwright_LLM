import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import OpenAI from 'openai';
import 'dotenv/config';

/**
 * Interfaz común para todos los proveedores de LLM
 */
export interface LLMProvider {
  name: string;
  initialize(): Promise<void>;
  analyzeImage(screenshotBase64: string, prompt: string): Promise<string>;
}

/**
 * Respuesta de análisis de la IA
 */
export interface AIAction {
  type: 'fill' | 'click' | 'press' | 'wait' | 'verify' | 'verifyAll';
  description: string;
  locator: string;
  value?: string;
  /** Para verifyAll: lista de verificaciones a realizar */
  verifications?: VerifyItem[];
}

/**
 * Item de verificación para verifyAll
 */
export interface VerifyItem {
  /** Tipo de verificación */
  type: 'element' | 'menu' | 'sidebar';
  /** Texto o selector del elemento */
  target: string;
  /** Para menús: opciones a verificar dentro */
  options?: MenuOption[];
  /** Si debe verificar match exacto */
  exact?: boolean;
}

/**
 * Opción de menú a verificar
 */
export interface MenuOption {
  /** Texto de la opción */
  text: string;
  /** Estado esperado: habilitado, deshabilitado, o cualquiera */
  state?: 'enabled' | 'disabled' | 'any';
}

export interface AIDecision {
  actions: AIAction[];
  reasoning: string;
  needsVerification: boolean;
  /** Indica si la decisión viene del caché (para retry si falla) */
  fromCache?: boolean;
}

// ============================================
// ANTHROPIC (Claude)
// ============================================
export class AnthropicProvider implements LLMProvider {
  name = 'Anthropic Claude';
  private client: Anthropic | null = null;
  
  constructor(private apiKey: string) {}

  async initialize(): Promise<void> {
    this.client = new Anthropic({ apiKey: this.apiKey });
  }

  async analyzeImage(screenshotBase64: string, prompt: string): Promise<string> {
    if (!this.client) throw new Error('Cliente no inicializado');
    
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
export class GoogleAIProvider implements LLMProvider {
  name = 'Google Gemini';
  private model: GenerativeModel | null = null;
  
  constructor(private apiKey: string) {}

  async initialize(): Promise<void> {
    const genAI = new GoogleGenerativeAI(this.apiKey);
    // Usar gemini-2.0-flash que soporta visión y texto
    this.model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }

  async analyzeImage(screenshotBase64: string, prompt: string): Promise<string> {
    if (!this.model) throw new Error('Modelo no inicializado');
    
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
export class OpenAIProvider implements LLMProvider {
  name = 'OpenAI GPT-4';
  private client: OpenAI | null = null;
  
  constructor(private apiKey: string) {}

  async initialize(): Promise<void> {
    this.client = new OpenAI({ apiKey: this.apiKey });
  }

  async analyzeImage(screenshotBase64: string, prompt: string): Promise<string> {
    if (!this.client) throw new Error('Cliente no inicializado');
    
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
export class DeepSeekProvider implements LLMProvider {
  name = 'DeepSeek';
  private client: OpenAI | null = null;
  
  constructor(private apiKey: string) {}

  async initialize(): Promise<void> {
    this.client = new OpenAI({ 
      apiKey: this.apiKey,
      baseURL: 'https://api.deepseek.com/v1'
    });
  }

  async analyzeImage(screenshotBase64: string, prompt: string): Promise<string> {
    if (!this.client) throw new Error('Cliente no inicializado');
    
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

// ============================================
// OLLAMA (Local - LLaVA, etc.)
// ============================================
interface OllamaResponse {
  response: string;
}

export class OllamaProvider implements LLMProvider {
  name = 'Ollama (Local)';
  private model: string;
  
  constructor(private baseUrl: string = 'http://localhost:11434') {
    this.model = process.env.OLLAMA_MODEL || 'llava';
  }

  async initialize(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) throw new Error('Ollama no responde');
      console.log(`✅ Conectado a Ollama en ${this.baseUrl}`);
    } catch {
      throw new Error(`No se puede conectar a Ollama. ¿Está corriendo? (${this.baseUrl})`);
    }
  }

  async analyzeImage(screenshotBase64: string, prompt: string): Promise<string> {
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

    const data = await response.json() as OllamaResponse;
    return data.response;
  }
}

// ============================================
// AZURE OPENAI
// ============================================
export class AzureOpenAIProvider implements LLMProvider {
  name = 'Azure OpenAI';
  private client: OpenAI | null = null;
  private deploymentName: string;
  
  constructor(private apiKey: string, private endpoint: string) {
    this.deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
  }

  async initialize(): Promise<void> {
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

  async analyzeImage(screenshotBase64: string, prompt: string): Promise<string> {
    if (!this.client) throw new Error('Cliente no inicializado');
    
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
export function createLLMProvider(): LLMProvider {
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
      return new AzureOpenAIProvider(
        process.env.AZURE_OPENAI_API_KEY,
        process.env.AZURE_OPENAI_ENDPOINT
      );
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
  const providers: Record<string, () => LLMProvider> = {
    'google': () => new GoogleAIProvider(process.env.GOOGLE_AI_API_KEY!),
    'gemini': () => new GoogleAIProvider(process.env.GOOGLE_AI_API_KEY!),
    'openai': () => new OpenAIProvider(process.env.OPENAI_API_KEY!),
    'gpt': () => new OpenAIProvider(process.env.OPENAI_API_KEY!),
    'anthropic': () => new AnthropicProvider(process.env.ANTHROPIC_API_KEY!),
    'claude': () => new AnthropicProvider(process.env.ANTHROPIC_API_KEY!),
    'deepseek': () => new DeepSeekProvider(process.env.DEEPSEEK_API_KEY!),
    'azure': () => new AzureOpenAIProvider(
      process.env.AZURE_OPENAI_API_KEY!,
      process.env.AZURE_OPENAI_ENDPOINT!
    ),
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
] as const;
