import { useContext, useEffect, useRef, useState } from "react"
import { Helmet } from 'react-helmet'
import { Link, useSearch } from "wouter"
import { FeedCard } from "../components/feed_card"
import { FeedListEmpty, FeedListError, feedListClass } from "../components/feed-list"
import { PageTuner } from "../components/page-tuner"
import { Waiting } from "../components/loading"
import { client } from "../app/runtime"
import { ProfileContext } from "../state/profile"

import { useSiteConfig } from "../hooks/useSiteConfig";
import { siteName } from "../utils/constants"
import { tryInt } from "../utils/int"
import { useTranslation } from "react-i18next";

type FeedsData = {
    size: number,
    data: any[],
    hasNext: boolean
}

type FeedType = 'draft' | 'unlisted' | 'normal'

type FeedsMap = {
    [key in FeedType]: FeedsData
}

export function FeedsPage() {
    const { t } = useTranslation()
    const siteConfig = useSiteConfig();
    const query = new URLSearchParams(useSearch());
    const profile = useContext(ProfileContext);
    const [listState, _setListState] = useState<FeedType>(query.get("type") as FeedType || 'normal')
    const [status, setStatus] = useState<'loading' | 'idle' | 'error'>('loading')
    const [feeds, setFeeds] = useState<FeedsMap>({
        draft: { size: 0, data: [], hasNext: false },
        unlisted: { size: 0, data: [], hasNext: false },
        normal: { size: 0, data: [], hasNext: false }
    })
    const page = tryInt(1, query.get("page"))
    const limit = tryInt(siteConfig.pageSize, query.get("limit"))
    const feedListClassValue = feedListClass(siteConfig.feedLayout);
    const currentFeeds = feeds[listState] ?? { size: 0, data: [], hasNext: false };
    const currentFeedData = Array.isArray(currentFeeds.data) ? currentFeeds.data : [];
    const ref = useRef("")
    function fetchFeeds(type: FeedType) {
        setStatus('loading')
        client.feed.list({
            page: page,
            limit: limit,
            type: type
        }).then(({ data }) => {
            if (!data) {
                setStatus('error')
                return
            }
            setFeeds(prev => ({
                ...prev,
                [type]: data
            }))
            setStatus('idle')
        }).catch(() => {
            setStatus('error')
        })
    }
    function reload() {
        fetchFeeds(listState)
    }
    useEffect(() => {
        const key = `${query.get("page")} ${query.get("type")} ${limit}`
        if (ref.current == key) return
        const type = query.get("type") as FeedType || 'normal'
        if (type !== listState) {
            _setListState(type)
        }
        setStatus('loading')
        fetchFeeds(type)
        ref.current = key
    }, [limit, query.get("page"), query.get("type")])
    return (
        <>
            <Helmet>
                <title>{`${t('article.title')} - ${siteConfig.name}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={t('article.title')} />
                <meta property="og:image" content={siteConfig.avatar} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={document.URL} />
            </Helmet>
            <Waiting for={feeds.draft.size + feeds.normal.size + feeds.unlisted.size > 0 || status !== 'loading'}>
                <main className="w-full flex flex-col justify-center items-center mb-8">
                    <div className="w-full text-start text-black dark:text-white py-4 text-4xl font-bold">
                        <p>
                            {listState === 'draft' ? t('draft_bin') : listState === 'normal' ? t('article.title') : t('unlisted')}
                        </p>
                        <div className="flex flex-row justify-between">
                            <p className="text-sm mt-4 text-neutral-500 font-normal">
                                {t('article.total$count', { count: currentFeeds.size })}
                            </p>
                            {profile?.permission &&
                                <div className="flex flex-row space-x-4">
                                    <Link href={listState === 'draft' ? '/?type=normal' : '/?type=draft'} className={`text-sm mt-4 text-neutral-500 font-normal ${listState === 'draft' ? "text-theme" : ""}`}>
                                        {t('draft_bin')}
                                    </Link>
                                    <Link href={listState === 'unlisted' ? '/?type=normal' : '/?type=unlisted'} className={`text-sm mt-4 text-neutral-500 font-normal ${listState === 'unlisted' ? "text-theme" : ""}`}>
                                        {t('unlisted')}
                                    </Link>
                                </div>
                            }
                        </div>
                    </div>
                    {status === 'error' ? <FeedListError onRetry={reload} /> : (
                        <Waiting for={status === 'idle'}>
                            {currentFeedData.length > 0 ? (
                                <div className={feedListClassValue}>
                                    {currentFeedData.map(({ id, ...feed }: any) => (
                                        <FeedCard key={id} id={id} {...feed} />
                                    ))}
                                </div>
                            ) : (
                                <FeedListEmpty />
                            )}
                            <PageTuner
                                page={page}
                                size={currentFeeds.size}
                                limit={limit}
                                hasNext={currentFeeds.hasNext}
                                hrefFor={(target) => `/?type=${listState}&page=${target}`}
                            />
                        </Waiting>
                    )}
                </main>
            </Waiting>
        </>
    )
}
