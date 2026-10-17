import type { QueueTask } from "./queue";

declare global {
  interface Env {
    TASK_QUEUE?: Queue<QueueTask>;
    R2_BUCKET?: R2Bucket;
    /** 站点公开访问地址（可选）。未设置时 sitemap/robots 回退到请求来源 origin */
    FRONTEND_URL?: string;
    /** Turnstile 站点密钥（公开值，随 /auth/status 下发；与 secret 同时配置才启用） */
    TURNSTILE_SITE_KEY?: string;
    /** Turnstile 服务端校验密钥（用 wrangler secret 下发，绝不返回给前端） */
    TURNSTILE_SECRET?: string;
    /** siteverify 返回 hostname 的白名单，逗号分隔；留空则跳过 hostname 校验 */
    TURNSTILE_HOSTNAMES?: string;
  }
}

export {};
