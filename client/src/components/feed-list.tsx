import { useTranslation } from "react-i18next";
import { Button } from "./button";
import type { FeedLayout } from "./feed-layout-options";

export function feedListClass(layout: FeedLayout) {
    return layout === "masonry" ? "wtile ani-show" : "w-full flex flex-col ani-show";
}

export function FeedListEmpty() {
    const { t } = useTranslation();
    return (
        <div className="w-full flex flex-col items-center justify-center rounded-2xl bg-w p-6 ani-show">
            <p className="text-sm t-secondary">{t("article.empty")}</p>
        </div>
    );
}

export function FeedListError({ onRetry }: { onRetry: () => void }) {
    const { t } = useTranslation();
    return (
        <div className="w-full flex flex-col items-center justify-center space-y-3 rounded-2xl bg-w p-6 ani-show">
            <p className="text-sm t-secondary">{t("error.load_failed")}</p>
            <Button title={t("reload")} onClick={onRetry} />
        </div>
    );
}
