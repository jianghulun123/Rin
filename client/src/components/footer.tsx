import { useContext, useEffect, useRef, useState } from 'react';
import Popup from 'reactjs-popup';
import { useLocation } from 'wouter';
import { ClientConfigContext } from '../state/config';
import { Helmet } from "react-helmet";
import { siteName } from '../utils/constants';
import { useTranslation } from "react-i18next";
import { buildLoginPath, HIDDEN_LOGIN_REDIRECT } from "../utils/auth-redirect";
import { Padding } from "./padding";

type ThemeMode = 'light' | 'dark' | 'system';
function Footer() {
    const { t } = useTranslation()
    const [, setLocation] = useLocation()
    const [modeState, setModeState] = useState<ThemeMode>('system');
    const config = useContext(ClientConfigContext);
    const footerHtml = config.get<string>('footer');
    const footerHtmlRef = useRef<HTMLDivElement | null>(null);
    const mountedScriptNodesRef = useRef<HTMLScriptElement[]>([]);
    const loginEnabled = config.getBoolean('login.enabled');
    const [doubleClickTimes, setDoubleClickTimes] = useState(0);
    useEffect(() => {
        const mode = localStorage.getItem('theme') as ThemeMode || 'system';
        setModeState(mode);
        setMode(mode);
    }, [])

    useEffect(() => {
        const container = footerHtmlRef.current;
        if (!container) {
            return;
        }

        mountedScriptNodesRef.current.forEach((script) => script.remove());
        mountedScriptNodesRef.current = [];
        container.replaceChildren();

        if (!footerHtml) {
            return;
        }

        const template = document.createElement('template');
        template.innerHTML = footerHtml;

        const scripts = Array.from(template.content.querySelectorAll('script'));
        scripts.forEach((script) => script.remove());

        container.appendChild(template.content.cloneNode(true));

        scripts.forEach((script) => {
            const nextScript = document.createElement('script');

            Array.from(script.attributes).forEach((attribute) => {
                nextScript.setAttribute(attribute.name, attribute.value);
            });

            nextScript.textContent = script.textContent;
            container.appendChild(nextScript);
            mountedScriptNodesRef.current.push(nextScript);
        });

        return () => {
            mountedScriptNodesRef.current.forEach((script) => script.remove());
            mountedScriptNodesRef.current = [];
        };
    }, [footerHtml])

    const setMode = (mode: ThemeMode) => {
        setModeState(mode);
        localStorage.setItem('theme', mode);


        if (mode !== 'system' || (!('theme' in localStorage) && window.matchMedia(`(prefers-color-scheme: ${mode})`).matches)) {
            document.documentElement.setAttribute('data-color-mode', mode);
        } else {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
            if (mediaQuery.matches) {
                document.documentElement.setAttribute('data-color-mode', 'dark');
            } else {
                document.documentElement.setAttribute('data-color-mode', 'light');
            }
        }
        window.dispatchEvent(new Event("colorSchemeChange"));
    };

    return (
        <footer>
            <Helmet>
                <link rel="alternate" type="application/rss+xml" title={siteName} href="/rss.xml" />
                <link rel="alternate" type="application/atom+xml" title={siteName} href="/atom.xml" />
                <link rel="alternate" type="application/json" title={siteName} href="/rss.json" />
            </Helmet>
            <div className="flex flex-col mb-8 space-y-2 justify-center items-center t-primary ani-show">
                <div ref={footerHtmlRef} />
                <Padding className="mx-4 self-stretch">
                    <div className="flex w-full flex-col items-center gap-3 md:flex-row md:gap-4">
                        <p className='text-sm text-neutral-500 font-normal link-line text-center md:mr-auto md:shrink-0 md:text-start'>
                            <span onDoubleClick={() => {
                                if(doubleClickTimes >= 2){ // actually need 3 times doubleClick
                                    setDoubleClickTimes(0)
                                    if(!loginEnabled) {
                                        setLocation(buildLoginPath(HIDDEN_LOGIN_REDIRECT))
                                    }
                                } else {
                                    setDoubleClickTimes(doubleClickTimes + 1)
                                }
                            }}>
                                © {new Date().getFullYear()} Powered by <a className='hover:underline' href="https://github.com/openRin/Rin" target="_blank">Rin</a>
                            </span>
                            {config.getBoolean('rss') && <>
                                <Spliter />
                                <Popup trigger={
                                    <button className="hover:underline" type="button">
                                        RSS
                                    </button>
                                }
                                    position="top center"
                                    arrow={false}
                                    closeOnDocumentClick>
                                    <div className="border-card">
                                        <p className='font-bold t-primary'>
                                            {t('footer.rss')}
                                        </p>
                                        <p>
                                            <a href='/rss.xml'>
                                                RSS
                                            </a> <Spliter />
                                            <a href='/atom.xml'>
                                                Atom
                                            </a> <Spliter />
                                            <a href='/rss.json'>
                                                JSON
                                            </a>
                                        </p>

                                    </div>
                                </Popup>
                            </>}
                        </p>
                        <div className="hazard-tape relative w-full min-w-0 max-w-[18rem] overflow-hidden rounded-full py-1.5 md:mx-auto md:max-w-[21rem] lg:max-w-[30rem] xl:max-w-[38rem]">
                            <span className="hazard-stripe pointer-events-none absolute inset-x-0 top-0 h-1.5" aria-hidden="true" />
                            <span className="hazard-stripe pointer-events-none absolute inset-x-0 bottom-0 h-1.5" aria-hidden="true" />
                            <span className="hazard-fade pointer-events-none absolute inset-y-0 left-0 w-12 md:w-16" aria-hidden="true" />
                            <span className="hazard-fade pointer-events-none absolute inset-y-0 right-0 w-12 -scale-x-100 md:w-16" aria-hidden="true" />
                            <div className="rin-marquee flex w-max items-center" aria-hidden="true">
                                {[0, 1].map((copy) => (
                                    <div key={copy} className="flex shrink-0 items-center">
                                        {Array.from({ length: 6 }, (_, index) => (
                                            <span key={index} className="flex shrink-0 items-center gap-3 px-6 text-[11px] font-bold whitespace-nowrap text-black">
                                                立入禁止テープ
                                            </span>
                                        ))}
                                    </div>
                                ))}
                            </div>
                            <span className="sr-only">立入禁止テープ</span>
                        </div>
                        <div className="w-fit-content inline-flex shrink-0 rounded-full border border-zinc-200 p-[3px] md:ml-auto dark:border-zinc-700">
                            <ThemeButton mode='light' current={modeState} label="Toggle light mode" icon="ri-sun-line" onClick={setMode} />
                            <ThemeButton mode='system' current={modeState} label="Toggle system mode" icon="ri-computer-line" onClick={setMode} />
                            <ThemeButton mode='dark' current={modeState} label="Toggle dark mode" icon="ri-moon-line" onClick={setMode} />
                        </div>
                    </div>
                </Padding>
            </div>
        </footer>
    );
}

function Spliter() {
    return (<span className='px-1'>
        |
    </span>
    )
}

function ThemeButton({ current, mode, label, icon, onClick }: { current: ThemeMode, label: string, mode: ThemeMode, icon: string, onClick: (mode: ThemeMode) => void }) {
    return (<button aria-label={label} type="button" onClick={() => onClick(mode)}
        className={`rounded-inherit inline-flex h-[32px] w-[32px] items-center justify-center border-0 t-primary ${current === mode ? "bg-w rounded-full shadow-xl shadow-light" : ""}`}>
        <i className={`${icon}`} />
    </button>)
}

export default Footer;