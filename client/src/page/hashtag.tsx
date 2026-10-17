import { useEffect, useRef, useState } from "react"
import { Helmet } from 'react-helmet'
import { useTranslation } from "react-i18next"
import { FeedCard } from "../components/feed_card"
import { FeedListEmpty, FeedListError, feedListClass } from "../components/feed-list"
import { Waiting } from "../components/loading"
import { client } from "../app/runtime"

import { useSiteConfig } from "../hooks/useSiteConfig";
import { siteName } from "../utils/constants"


type FeedsData = {
    name: string;
    id: number;
    createdAt: Date;
    updatedAt: Date;
    feeds: {
        hashtags: {
            name: string;
            id: number;
        }[];
        id: number;
        title: string | null;
        summary: string;
        content: string;
        createdAt: Date;
        updatedAt: Date;
        user: {
            id: number;
            username: string;
            avatar: string | null;
        };
    }[] | undefined;
}

export function HashtagPage({ name }: { name: string }) {
    const { t } = useTranslation()
    const siteConfig = useSiteConfig();
    const [status, setStatus] = useState<'loading' | 'idle' | 'error'>('loading')
    const [hashtag, setHashtag] = useState<FeedsData>()
    const feedListClassValue = feedListClass(siteConfig.feedLayout);
    const hashtagFeeds = Array.isArray(hashtag?.feeds) ? hashtag.feeds : [];
    const ref = useRef("")
    function fetchFeeds() {
        const nameDecoded = decodeURI(name)
        setStatus('loading')
        client.tag.get(nameDecoded).then(({ data }) => {
            if (!data) {
                setStatus('error')
                return
            }
            setHashtag(data as any)
            setStatus('idle')
        }).catch(() => {
            setStatus('error')
        })
    }
    useEffect(() => {
        if (ref.current === name) return
        setStatus('loading')
        fetchFeeds()
        ref.current = name
    }, [name])
    return (
        <>
            <Helmet>
                <title>{`${hashtag?.name} - ${siteConfig.name}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={hashtag?.name} />
                <meta property="og:image" content={siteConfig.avatar} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={document.URL} />
            </Helmet>
            <Waiting for={hashtag || status !== 'loading'}>
                <main className="w-full flex flex-col justify-center items-center mb-8">
                    <div className="w-full text-start text-black dark:text-white py-4 text-4xl font-bold">
                        <p>
                            {hashtag?.name}
                        </p>
                        <div className="flex flex-row justify-between">
                            <p className="text-sm mt-4 text-neutral-500 font-normal">
                                {t('article.total$count', { count: hashtagFeeds.length })}
                            </p>
                        </div>
                    </div>
                    {status === 'error' ? <FeedListError onRetry={fetchFeeds} /> : (
                        <Waiting for={status === 'idle'}>
                            {hashtagFeeds.length > 0 ? (
                                <div className={feedListClassValue}>
                                    {hashtagFeeds.map(({ id, ...feed }: any) => (
                                        <FeedCard key={id} id={id} {...feed} />
                                    ))}
                                </div>
                            ) : (
                                <FeedListEmpty />
                            )}
                        </Waiting>
                    )}
                </main>
            </Waiting>
        </>
    )
}
