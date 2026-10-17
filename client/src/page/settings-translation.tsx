import {
  SearchableSelect,
  SettingsBadge,
  SettingsCard,
  SettingsCardBody,
  SettingsCardHeader,
  SettingsCardRow,
} from "@rin/ui";
import * as Switch from "@radix-ui/react-switch";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import ReactLoading from "react-loading";
import { client } from "../app/runtime";
import { Button } from "../components/button";
import { ItemTitle } from "./settings-items";
import {
  AI_MODEL_PRESETS,
  AI_PROVIDER_PRESETS,
  getAIProviderFields,
  getAIProviderPreset,
} from "./settings-helpers";

export type TranslationSettingsValue = {
  enabled: boolean;
  provider: string;
  model: string;
  apiKey: string;
  apiKeySet: boolean;
  apiUrl: string;
};

export const TRANSLATION_LANGUAGE_PRESETS = [
  { value: "ja", label: "日本語" },
  { value: "en", label: "English" },
  { value: "zh-TW", label: "繁體中文" },
  { value: "de", label: "Deutsch" },
  { value: "ru", label: "Русский" },
] as const;

export function TranslationSettings({
  value,
  onChange,
}: {
  value: TranslationSettingsValue;
  onChange: (updates: Partial<TranslationSettingsValue>) => void;
}) {
  const { t } = useTranslation();
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testResult, setTestResult] = useState<{ success?: boolean; response?: string; error?: string; details?: string } | null>(null);
  const [testLanguage, setTestLanguage] = useState<string>("ja");
  const [testPrompt, setTestPrompt] = useState("");
  const providerFields = getAIProviderFields(value.provider);

  const handleProviderChange = (nextProvider: string) => {
    const preset = getAIProviderPreset(nextProvider);
    const models = AI_MODEL_PRESETS[nextProvider] || [];

    onChange({
      provider: nextProvider,
      apiUrl: preset?.url ?? "",
      model: models[0] ?? value.model,
    });
  };

  const handleTest = async () => {
    setTestStatus("testing");
    setTestResult(null);
    try {
      const { data, error } = await client.config.testTranslation({
        provider: value.provider,
        model: value.model,
        api_url: value.apiUrl,
        api_key: value.apiKey,
        language: testLanguage,
        testPrompt: testPrompt.trim() || undefined,
      });

      if (error) {
        setTestStatus("error");
        setTestResult({
          success: false,
          error: error.value || t("settings.translation.test.failed"),
          details: t("settings.translation.test.http_error$status", { status: error.status }),
        });
      } else if (data?.success) {
        setTestStatus("success");
        setTestResult({ success: true, response: data.response || t("settings.translation.test.success") });
      } else {
        setTestStatus("error");
        setTestResult({
          success: false,
          error: data?.error || t("settings.translation.test.failed"),
          details: data?.details,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setTestStatus("error");
      setTestResult({
        success: false,
        error: message || t("settings.translation.test.error"),
      });
    }
  };

  const modelOptions = AI_MODEL_PRESETS[value.provider] || [];

  return (
    <>
      <ItemTitle title={t("settings.translation.title")} />
      <SettingsCard>
        <SettingsCardRow
          header={<SettingsCardHeader title={t("settings.translation.enable.title")} description={t("settings.translation.enable.desc")} />}
          action={
            <Switch.Root
              className="SwitchRoot"
              checked={value.enabled}
              onCheckedChange={(checked) => {
                onChange({ enabled: checked });
              }}
            >
              <Switch.Thumb className="SwitchThumb" />
            </Switch.Root>
          }
        />
      </SettingsCard>

      {value.enabled && (
        <>
          <SettingsCard>
            <SettingsCardRow
              header={<SettingsCardHeader title={t("settings.translation.provider.title")} description={t("settings.translation.provider.desc")} />}
              action={
                <SearchableSelect
                  value={value.provider}
                  onChange={handleProviderChange}
                  options={AI_PROVIDER_PRESETS.map((preset) => ({
                    label: preset.label,
                    value: preset.value,
                  }))}
                  placeholder={t("settings.translation.provider.title")}
                  searchable={false}
                />
              }
            />
            <SettingsCardBody>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium t-primary">{t("settings.translation.model.title")}</p>
                  <SearchableSelect
                    value={value.model}
                    onChange={(nextValue) => {
                      onChange({ model: nextValue });
                    }}
                    options={modelOptions.map((option) => ({
                      label: option,
                      value: option,
                    }))}
                    placeholder={t("settings.translation.model.title")}
                    searchPlaceholder={t("settings.translation.model.title")}
                    emptyLabel={t("no_more")}
                    allowCustomValue
                    customValueLabel={(nextValue) => `${t("update.title")}: ${nextValue}`}
                  />
                </div>
                {providerFields.requiresApiKey ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium t-primary">
                      {t("settings.translation.api_key.title")}
                      {value.apiKeySet && (
                        <span className="ml-2">
                          <SettingsBadge tone="success">{t("settings.translation.api_key.set")}</SettingsBadge>
                        </span>
                      )}
                    </p>
                    <input
                      type="password"
                      name="rin-translation-api-key"
                      autoComplete="new-password"
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                      value={value.apiKey}
                      onChange={(event) => {
                        onChange({ apiKey: event.target.value });
                      }}
                      placeholder={value.apiKeySet ? t("settings.translation.api_key.placeholder_set") : "sk-..."}
                      className="w-full rounded-xl border border-black/10 bg-w px-4 py-3 text-sm t-primary outline-none transition-colors placeholder:text-neutral-400 focus:border-black/20 focus:ring-2 focus:ring-theme/10 dark:border-white/10 dark:placeholder:text-neutral-500 dark:focus:border-white/20"
                    />
                  </div>
                ) : null}
                {providerFields.requiresApiUrl ? (
                  <div className="space-y-2 lg:col-span-2">
                    <p className="text-sm font-medium t-primary">{t("settings.translation.api_url.title")}</p>
                    <input
                      type="text"
                      value={value.apiUrl}
                      onChange={(event) => {
                        onChange({ apiUrl: event.target.value });
                      }}
                      placeholder="https://api.openai.com/v1"
                      className="w-full rounded-xl border border-black/10 bg-w px-4 py-3 text-sm t-primary outline-none transition-colors placeholder:text-neutral-400 focus:border-black/20 focus:ring-2 focus:ring-theme/10 dark:border-white/10 dark:placeholder:text-neutral-500 dark:focus:border-white/20"
                    />
                  </div>
                ) : null}
              </div>
            </SettingsCardBody>
          </SettingsCard>

          <SettingsCard tone={testStatus === "error" ? "danger" : testStatus === "success" ? "success" : "default"}>
            <SettingsCardRow
              header={<SettingsCardHeader title={t("settings.translation.test.title")} description={t("settings.translation.test.desc")} />}
              action={
                <>
                  {testStatus === "testing" && <ReactLoading width="1em" height="1em" type="spin" color="#FC466B" />}
                  <Button
                    title={t("settings.translation.test.button")}
                    onClick={handleTest}
                    disabled={testStatus === "testing"}
                  />
                </>
              }
            />
            <SettingsCardBody>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium t-primary">{t("settings.translation.test.language")}</p>
                  <SearchableSelect
                    value={testLanguage}
                    onChange={setTestLanguage}
                    options={TRANSLATION_LANGUAGE_PRESETS.map((preset) => ({
                      label: preset.label,
                      value: preset.value,
                    }))}
                    placeholder={t("settings.translation.test.language")}
                    searchable={false}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium t-primary">{t("settings.translation.test.prompt")}</p>
                  <input
                    type="text"
                    value={testPrompt}
                    onChange={(event) => {
                      setTestPrompt(event.target.value);
                    }}
                    placeholder={t("settings.translation.test.prompt_placeholder")}
                    className="w-full rounded-xl border border-black/10 bg-w px-4 py-3 text-sm t-primary outline-none transition-colors placeholder:text-neutral-400 focus:border-black/20 focus:ring-2 focus:ring-theme/10 dark:border-white/10 dark:placeholder:text-neutral-500 dark:focus:border-white/20"
                  />
                </div>
              </div>
            </SettingsCardBody>
            {testStatus === "success" && testResult && (
              <SettingsCardBody>
                <p className="text-sm font-semibold text-green-700 dark:text-green-300">{t("settings.translation.test.success")}</p>
                <p className="mt-1 text-sm text-green-700/90 dark:text-green-300/90 [overflow-wrap:anywhere]">{testResult.response}</p>
              </SettingsCardBody>
            )}
            {testStatus === "error" && testResult && (
              <SettingsCardBody>
                <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">{t("settings.translation.test.failed")}</p>
                {testResult.error && <p className="mt-1 text-xs font-medium text-red-700 dark:text-red-300">{testResult.error}</p>}
                {testResult.details && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{testResult.details}</p>}
              </SettingsCardBody>
            )}
          </SettingsCard>
        </>
      )}
    </>
  );
}
