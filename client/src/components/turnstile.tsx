import { useEffect, useRef } from "react";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
    render: (container: HTMLElement, options: Record<string, unknown>) => string;
    reset: (widgetId?: string) => void;
    remove: (widgetId?: string) => void;
};

declare global {
    interface Window {
        turnstile?: TurnstileApi;
    }
}

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
    if (!scriptPromise) {
        scriptPromise = new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = SCRIPT_SRC;
            script.async = true;
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load Turnstile"));
            document.head.appendChild(script);
        });
    }

    return scriptPromise;
}

export function TurnstileWidget({
    siteKey,
    onToken,
    resetKey,
}: {
    siteKey: string;
    onToken: (token: string) => void;
    resetKey: number;
}) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const widgetIdRef = useRef<string | null>(null);
    const lastResetKeyRef = useRef(resetKey);
    const onTokenRef = useRef(onToken);
    onTokenRef.current = onToken;

    useEffect(() => {
        let cancelled = false;
        const container = containerRef.current;

        if (!container) {
            return;
        }

        loadTurnstileScript()
            .then(() => {
                if (cancelled || !window.turnstile || widgetIdRef.current) {
                    return;
                }

                widgetIdRef.current = window.turnstile.render(container, {
                    sitekey: siteKey,
                    action: "login",
                    callback: (token: string) => onTokenRef.current(token),
                });
            })
            .catch(() => undefined);

        return () => {
            cancelled = true;

            if (window.turnstile && widgetIdRef.current) {
                window.turnstile.remove(widgetIdRef.current);
                widgetIdRef.current = null;
            }
        };
    }, [siteKey]);

    useEffect(() => {
        if (resetKey === lastResetKeyRef.current) {
            return;
        }

        lastResetKeyRef.current = resetKey;

        if (window.turnstile && widgetIdRef.current) {
            window.turnstile.reset(widgetIdRef.current);
        }
    }, [resetKey]);

    return <div ref={containerRef} className="flex justify-center" />;
}
