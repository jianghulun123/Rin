import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { timeago } from "../utils/timeago";
import { HashTag } from "./hashtag";
import { useEffect, useRef } from "react";
import { drawBlurhashToCanvas } from "../utils/blurhash";
import { parseImageUrlMetadata } from "../utils/image-upload";
import { useImageLoadState } from "../utils/use-image-load-state";
import { type FeedCardVariant, normalizeFeedCardVariant } from "./feed-card-options";
import { useSiteConfig } from "../hooks/useSiteConfig";

function FeedCardImage({ src, variant }: { src: string; variant: FeedCardVariant }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { src: cleanSrc, blurhash, width, height } = parseImageUrlMetadata(src);
    const { failed, imageRef, loaded, onError, onLoad } = useImageLoadState(cleanSrc);
    const aspectRatio = width && height ? `${width} / ${height}` : "16 / 9";
    const imageFrameClass =
        variant === "editorial"
            ? "relative flex max-h-80 w-full flex-row items-center overflow-hidden rounded-[20px]"
            : "relative mb-2 flex max-h-48 w-full flex-row items-center overflow-hidden rounded-xl";

    useEffect(() => {
        if (!blurhash || !canvasRef.current) {
            return;
        }
        try {
            drawBlurhashToCanvas(canvasRef.current, blurhash);
        } catch (error) {
            console.error("Failed to render blurhash", error);
        }
    }, [blurhash]);

    return (
        <div
            className={imageFrameClass}
            style={{ aspectRatio: aspectRatio || '16 / 9' }}
        >
            {blurhash && !loaded ? (
                <canvas
                    ref={canvasRef}
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full scale-110 object-cover blur-sm"
                />
            ) : null}
            {failed && !blurhash ? (
                <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500">
                    <i className="ri-image-line text-2xl" aria-hidden="true" />
                </div>
            ) : null}
            <img
                ref={imageRef}
                src={cleanSrc}
                alt=""
                width={width}
                height={height}
                onLoad={onLoad}
                onError={onError}
                className={`absolute inset-0 h-full w-full object-cover object-center transition duration-300 hover:scale-105 ${failed || (blurhash && !loaded) ? "opacity-0" : "opacity-100"
                    }`}
            />
        </div>
    );
}

const FEED_CARD_STYLES: Record<
    FeedCardVariant,
    {
        card: string;
        imageWrap: string;
        meta: string;
        summary: string;
        title: string;
    }
> = {
    default: {
        card: "flex w-full flex-col rounded-2xl bg-w p-4 duration-300 bg-button",
        imageWrap: "",
        meta: "text-gray-400 text-xs",
        summary: "line-clamp-3 text-sm text-pretty overflow-hidden dark:text-neutral-500",
        title: "break-words text-base font-bold text-gray-700 dark:text-white text-pretty overflow-hidden [overflow-wrap:anywhere]",
    },
    editorial: {
        card: "flex w-full flex-col overflow-hidden rounded-[22px] border border-black/10 bg-w p-2.5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] transition-all hover:-translate-y-0.5 hover:shadow-[0_28px_70px_rgba(15,23,42,0.12)] dark:border-white/10",
        imageWrap: "mb-3 overflow-hidden rounded-[18px] border border-black/5 dark:border-white/10",
        meta: "text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400",
        summary: "line-clamp-4 text-pretty text-[13px] leading-6 text-neutral-600 dark:text-neutral-300",
        title: "break-words text-lg font-semibold tracking-[-0.02em] text-neutral-900 dark:text-white text-pretty overflow-hidden [overflow-wrap:anywhere]",
    },
};

export type FeedCardProps = {
    id: string;
    avatar?: string;
    draft?: number;
    listed?: number;
    top?: number;
    title: string;
    summary: string;
    hashtags?: { id: number, name: string }[];
    createdAt: Date;
    updatedAt: Date;
    preview?: boolean;
    variant?: FeedCardVariant;
};

export function FeedCard({ id, title, avatar, draft, listed, top, summary, hashtags, createdAt, updatedAt, preview = false, variant }: FeedCardProps) {
    const { t } = useTranslation();
    const siteConfig = useSiteConfig();
    const safeHashtags = Array.isArray(hashtags) ? hashtags : [];
    const activeVariant = normalizeFeedCardVariant(variant ?? siteConfig.feedCardVariant);
    const styles = FEED_CARD_STYLES[activeVariant];
    const heading = (
        <h2 className={styles.title}>{title}</h2>
    );
    const detail = (
        <>
            <p className={`space-x-2 ${styles.meta}`}>
                <span title={new Date(createdAt).toLocaleString()}>
                    {createdAt === updatedAt ? timeago(createdAt) : t('feed_card.published$time', { time: timeago(createdAt) })}
                </span>
                {createdAt !== updatedAt &&
                    <span title={new Date(updatedAt).toLocaleString()}>
                        {t('feed_card.updated$time', { time: timeago(updatedAt) })}
                    </span>
                }
            </p>
            <p className={`space-x-2 ${styles.meta} ${activeVariant === "editorial" ? "mt-2" : ""}`}>
                {draft === 1 && <span>{t("draft")}</span>}
                {listed === 0 && <span>{t("unlisted")}</span>}
                {top === 1 && <span className="text-theme">{t('article.top.title')}</span>}
            </p>
            <p className={`whitespace-pre-line break-words [overflow-wrap:anywhere] ${styles.summary} ${activeVariant === "editorial" ? "mt-4 max-w-3xl" : ""}`}>{summary}</p>
        </>
    );
    const cover = avatar ? (
        <div className={styles.imageWrap}>
            <FeedCardImage src={avatar} variant={activeVariant} />
        </div>
    ) : null;
    const text = (
        <div className={activeVariant === "editorial" ? "px-2 pb-2" : ""}>
            {heading}
            {detail}
        </div>
    );
    const tags = safeHashtags.length > 0 && (
        <div className={`mt-auto flex flex-row flex-wrap justify-start gap-2 ${activeVariant === "editorial" ? "px-2 pt-4 pb-2" : "pt-2 gap-x-2"}`}>
            {safeHashtags.map(({ name }, index) => (
                <HashTag key={index} name={name} plain={preview} />
            ))}
        </div>
    );

    return (
        <div className={styles.card}>
            {preview ? (
                <>
                    {cover}
                    {text}
                    {tags}
                </>
            ) : (
                <>
                    <Link href={`/feed/${id}`} target="_blank" rel="noopener noreferrer" className="block min-w-0 w-full flex-1">
                        {cover}
                        {text}
                    </Link>
                    {tags}
                </>
            )}
        </div>
    );
}
