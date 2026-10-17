import { useTranslation } from "react-i18next"
import { Link } from "wouter"

type TunerSlot = number | "gap"

function tunerSlots(page: number, lastPage: number): TunerSlot[] {
    if (lastPage <= 7) {
        return Array.from({ length: lastPage }, (_, index) => index + 1)
    }
    if (page <= 4) {
        return [1, 2, 3, 4, 5, "gap", lastPage]
    }
    if (page >= lastPage - 3) {
        return [1, "gap", lastPage - 4, lastPage - 3, lastPage - 2, lastPage - 1, lastPage]
    }
    return [1, "gap", page - 1, page, page + 1, "gap", lastPage]
}

function TunerKnob({ href, icon, label, disabled = false }: { href: string; icon: string; label: string; disabled?: boolean }) {
    const shape = "tuner-knob inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/10 transition-transform duration-300 dark:border-white/15"

    if (disabled) {
        return (
            <span className={`${shape} opacity-25`} aria-hidden="true">
                <i className={`${icon} text-base`} />
            </span>
        )
    }

    return (
        <Link href={href} aria-label={label} className={`${shape} t-primary hover:rotate-[45deg] hover:text-theme`}>
            <i className={`${icon} text-base`} />
        </Link>
    )
}

function tunerNeedle(page: number, lastPage: number) {
    if (lastPage <= 1) return "0%"
    return `${((page - 1) / (lastPage - 1)) * 100}%`
}

export function PageTuner({
    page,
    size,
    limit,
    hasNext,
    hrefFor,
}: {
    page: number
    size: number
    limit: number
    hasNext: boolean
    hrefFor: (page: number) => string
}) {
    const { t } = useTranslation()
    const totalPages = Math.max(1, Math.ceil(size / Math.max(1, limit)))
    const lastPage = Math.max(totalPages, hasNext ? page + 1 : page)

    if (lastPage <= 1) return null

    return (
        <div className="mt-6 flex w-full justify-center ani-show">
            <div className="tuner-shell inline-flex max-w-full items-center gap-2 rounded-2xl border border-black/10 px-2 py-2 dark:border-white/10">
                <TunerKnob href={hrefFor(page - 1)} label={t('previous')} icon="ri-skip-back-line" disabled={page <= 1} />
                <div className="tuner-display flex min-w-0 max-w-full flex-col items-center gap-1.5 rounded-xl px-3 py-2">
                    <div className="flex max-w-full min-w-0 items-center gap-0.5 overflow-x-auto">
                        {tunerSlots(page, lastPage).map((slot, index) => {
                            if (slot === "gap") {
                                return (
                                    <span key={`gap-${index}`} className="px-1 text-xs t-secondary" aria-hidden="true">
                                        …
                                    </span>
                                )
                            }
                            const shape = "flex h-7 min-w-[1.75rem] items-center justify-center rounded-md px-1.5 font-mono text-sm tabular-nums duration-300"
                            if (slot === page) {
                                return (
                                    <span key={slot} aria-current="page" className={`${shape} bg-theme font-bold text-white`}>
                                        {slot}
                                    </span>
                                )
                            }
                            return (
                                <Link key={slot} href={hrefFor(slot)} className={`${shape} t-secondary hover:text-theme`}>
                                    {slot}
                                </Link>
                            )
                        })}
                    </div>
                    <div className="flex w-full min-w-0 items-center gap-2">
                        <div className="tuner-scale relative h-1.5 flex-1 opacity-70" aria-hidden="true">
                            <span
                                className="absolute -top-1 h-3.5 w-[2px] -translate-x-1/2 rounded-full bg-theme"
                                style={{ left: tunerNeedle(page, lastPage) }}
                            />
                        </div>
                        <span className="shrink-0 font-mono text-[10px] tracking-tight t-secondary tabular-nums">{page}/{lastPage}</span>
                    </div>
                </div>
                <TunerKnob href={hrefFor(page + 1)} label={t('next')} icon="ri-skip-forward-line" disabled={!hasNext} />
            </div>
        </div>
    )
}
