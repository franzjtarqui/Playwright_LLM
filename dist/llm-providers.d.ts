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
    type: 'fill' | 'click' | 'press' | 'wait' | 'verify';
    description: string;
    locator: string;
    value?: string;
}
export interface AIDecision {
    actions: AIAction[];
    reasoning: string;
    needsVerification: boolean;
}
export declare class AnthropicProvider implements LLMProvider {
    private apiKey;
    name: string;
    private client;
    constructor(apiKey: string);
    initialize(): Promise<void>;
    analyzeImage(screenshotBase64: string, prompt: string): Promise<string>;
}
export declare class GoogleAIProvider implements LLMProvider {
    private apiKey;
    name: string;
    private model;
    constructor(apiKey: string);
    initialize(): Promise<void>;
    analyzeImage(screenshotBase64: string, prompt: string): Promise<string>;
}
export declare class OpenAIProvider implements LLMProvider {
    private apiKey;
    name: string;
    private client;
    constructor(apiKey: string);
    initialize(): Promise<void>;
    analyzeImage(screenshotBase64: string, prompt: string): Promise<string>;
}
export declare class DeepSeekProvider implements LLMProvider {
    private apiKey;
    name: string;
    private client;
    constructor(apiKey: string);
    initialize(): Promise<void>;
    analyzeImage(screenshotBase64: string, prompt: string): Promise<string>;
}
export declare class OllamaProvider implements LLMProvider {
    private baseUrl;
    name: string;
    private model;
    constructor(baseUrl?: string);
    initialize(): Promise<void>;
    analyzeImage(screenshotBase64: string, prompt: string): Promise<string>;
}
export declare class AzureOpenAIProvider implements LLMProvider {
    private apiKey;
    private endpoint;
    name: string;
    private client;
    private deploymentName;
    constructor(apiKey: string, endpoint: string);
    initialize(): Promise<void>;
    analyzeImage(screenshotBase64: string, prompt: string): Promise<string>;
}
export declare function createLLMProvider(): LLMProvider;
export declare const SUPPORTED_PROVIDERS: readonly [{
    readonly name: "Google AI (Gemini)";
    readonly envVar: "GOOGLE_AI_API_KEY";
    readonly provider: "google";
    readonly free: true;
}, {
    readonly name: "Ollama (Local)";
    readonly envVar: "OLLAMA_ENABLED";
    readonly provider: "ollama";
    readonly free: true;
}, {
    readonly name: "OpenAI (GPT-4)";
    readonly envVar: "OPENAI_API_KEY";
    readonly provider: "openai";
    readonly free: false;
}, {
    readonly name: "Anthropic (Claude)";
    readonly envVar: "ANTHROPIC_API_KEY";
    readonly provider: "anthropic";
    readonly free: false;
}, {
    readonly name: "DeepSeek";
    readonly envVar: "DEEPSEEK_API_KEY";
    readonly provider: "deepseek";
    readonly free: false;
}, {
    readonly name: "Azure OpenAI";
    readonly envVar: "AZURE_OPENAI_API_KEY";
    readonly provider: "azure";
    readonly free: false;
}];
//# sourceMappingURL=llm-providers.d.ts.map