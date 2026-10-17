import type { AIConfig, TranslationConfig } from "@rin/api";
import {
    AI_CONFIG_PREFIX,
    DEFAULT_AI_CONFIG,
    DEFAULT_TRANSLATION_CONFIG,
    TRANSLATION_CONFIG_PREFIX,
} from "@rin/config";

type ConfigReader = {
    get(key: string): Promise<unknown>;
};

type ConfigWriter = ConfigReader & {
    set(key: string, value: unknown, save?: boolean): Promise<void>;
    save(): Promise<void>;
};

const AI_CONFIG_FIELDS = ["enabled", "provider", "model", "api_key", "api_url"] as const;

export function readAIConfigFromValues(values: Record<string, unknown>): AIConfig {
    const config: AIConfig = { ...DEFAULT_AI_CONFIG };

    const enabled = values[AI_CONFIG_PREFIX + "enabled"];
    if (enabled != null) {
        config.enabled = enabled === true || enabled === "true";
    }

    const provider = values[AI_CONFIG_PREFIX + "provider"];
    if (typeof provider === "string" && provider.length > 0) {
        config.provider = provider;
    }

    const model = values[AI_CONFIG_PREFIX + "model"];
    if (typeof model === "string") {
        config.model = model;
    }

    const apiKey = values[AI_CONFIG_PREFIX + "api_key"];
    if (typeof apiKey === "string") {
        config.api_key = apiKey;
    }

    const apiUrl = values[AI_CONFIG_PREFIX + "api_url"];
    if (typeof apiUrl === "string") {
        config.api_url = apiUrl;
    }

    return config;
}

export function readAIConfigFromMap(values: Map<string, unknown>): AIConfig {
    return readAIConfigFromValues(Object.fromEntries(values));
}

export async function getAIConfig(config: ConfigReader): Promise<AIConfig> {
    const values = await Promise.all(
        AI_CONFIG_FIELDS.map(async (field) => [field, await config.get(AI_CONFIG_PREFIX + field)] as const),
    );

    return readAIConfigFromValues(
        Object.fromEntries(values.map(([field, value]) => [AI_CONFIG_PREFIX + field, value])),
    );
}

export async function getFrontendAIEnabled(config: ConfigReader): Promise<boolean> {
    const enabled = await config.get(AI_CONFIG_PREFIX + "enabled");
    return enabled == null ? DEFAULT_AI_CONFIG.enabled : enabled === true || enabled === "true";
}

export async function setAIConfig(config: ConfigWriter, updates: Partial<AIConfig>): Promise<void> {
    for (const field of AI_CONFIG_FIELDS) {
        const value = updates[field];
        if (value === undefined) {
            continue;
        }

        if (field === "api_key" && typeof value === "string" && value.trim() === "") {
            continue;
        }

        await config.set(AI_CONFIG_PREFIX + field, value, false);
    }

    await config.save();
}

export async function getAIConfigForFrontend(
    config: ConfigReader,
): Promise<AIConfig & { api_key_set: boolean }> {
    const aiConfig = await getAIConfig(config);
    return {
        ...aiConfig,
        api_key: "",
        api_key_set: aiConfig.api_key.length > 0,
    };
}

const TRANSLATION_CONFIG_FIELDS = ["enabled", "provider", "model", "api_key", "api_url"] as const;

export function readTranslationConfigFromValues(values: Record<string, unknown>): TranslationConfig {
    const config: TranslationConfig = { ...DEFAULT_TRANSLATION_CONFIG };

    const enabled = values[TRANSLATION_CONFIG_PREFIX + "enabled"];
    if (enabled != null) {
        config.enabled = enabled === true || enabled === "true";
    }

    const provider = values[TRANSLATION_CONFIG_PREFIX + "provider"];
    if (typeof provider === "string" && provider.trim()) {
        config.provider = provider.trim();
    }

    const model = values[TRANSLATION_CONFIG_PREFIX + "model"];
    if (typeof model === "string" && model.trim()) {
        config.model = model.trim();
    }

    const apiKey = values[TRANSLATION_CONFIG_PREFIX + "api_key"];
    if (typeof apiKey === "string" && apiKey.trim()) {
        config.api_key = apiKey;
    }

    const apiUrl = values[TRANSLATION_CONFIG_PREFIX + "api_url"];
    if (typeof apiUrl === "string" && apiUrl.trim()) {
        config.api_url = apiUrl.trim();
    }

    return config;
}

export async function getTranslationConfig(config: ConfigReader): Promise<TranslationConfig> {
    const values = await Promise.all(
        TRANSLATION_CONFIG_FIELDS.map(
            async (field) => [field, await config.get(TRANSLATION_CONFIG_PREFIX + field)] as const,
        ),
    );

    return readTranslationConfigFromValues(
        Object.fromEntries(
            values.map(([field, value]) => [TRANSLATION_CONFIG_PREFIX + field, value]),
        ),
    );
}

export async function getFrontendTranslationEnabled(config: ConfigReader): Promise<boolean> {
    const enabled = await config.get(TRANSLATION_CONFIG_PREFIX + "enabled");
    return enabled == null ? DEFAULT_TRANSLATION_CONFIG.enabled : enabled === true || enabled === "true";
}

export async function setTranslationConfig(
    config: ConfigWriter,
    updates: Partial<TranslationConfig>,
): Promise<void> {
    for (const field of TRANSLATION_CONFIG_FIELDS) {
        const value = updates[field];
        if (value === undefined) {
            continue;
        }

        // Keep the stored key when the admin leaves the masked placeholder untouched.
        if (field === "api_key" && typeof value === "string" && value.trim() === "") {
            continue;
        }

        await config.set(TRANSLATION_CONFIG_PREFIX + field, value, false);
    }

    await config.save();
}
