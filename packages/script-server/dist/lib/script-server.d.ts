import type { FileStorage } from '@remix-run/file-storage';
import type { ScriptRouteDefinition } from './routes.ts';
export type CacheStrategyOptions = ({
    /**
     * Serve all modules at stable non-fingerprinted URLs with `Cache-Control: no-cache`.
     */
    fingerprint?: false;
    entryPoints?: never;
} & ({
    buildId?: never;
    fileStorage?: never;
} | {
    /**
     * Per-build cache namespace used for shared transform artifacts.
     *
     * When present, cached modules are treated as immutable for that build.
     */
    buildId: string;
    /**
     * Optional shared storage backend for compiled artifact persistence.
     *
     * Requires `buildId` so stored artifacts are isolated per build.
     */
    fileStorage: FileStorage;
})) | {
    /**
     * Rewrite non-entry modules to `.@fingerprint` URLs based on source text and `buildId`.
     * Modules matching `entryPoints` keep their stable non-fingerprinted URLs.
     */
    fingerprint: 'source';
    /**
     * File-space paths or glob patterns for modules that should keep stable non-fingerprinted URLs.
     * Relative values are resolved from `root`.
     */
    entryPoints: readonly string[];
    /**
     * Per-build invalidation token that must change whenever fingerprinted module URLs
     * and cached transform artifacts should be invalidated together.
     */
    buildId: string;
    /**
     * Optional shared storage backend for compiled artifact persistence.
     *
     * When provided, cached modules are treated as immutable for this build.
     */
    fileStorage?: FileStorage;
};
export interface ScriptServerOptions {
    /** Routes that map public URL patterns to file-space patterns. */
    routes: ReadonlyArray<ScriptRouteDefinition>;
    /**
     * Root directory used to resolve relative file-space patterns. Defaults to `process.cwd()`.
     */
    root?: string;
    /**
     * File-space allow-list paths or filesystem glob patterns. Relative values are resolved from `root`.
     */
    allow: readonly string[];
    /**
     * File-space deny-list paths or filesystem glob patterns. Relative values are resolved from `root`.
     */
    deny?: readonly string[];
    /**
     * Source map mode (disabled when omitted).
     * - `'external'`: serve source maps as separate `.map` files; adds `//# sourceMappingURL=` comment
     * - `'inline'`: embed source maps as a base64 data URL directly in the JS; no separate `.map` file
     */
    sourceMaps?: 'inline' | 'external';
    /**
     * Controls the source paths written into sourcemap `sources`.
     * - `'url'` (default): use the stable server path (e.g. `'/scripts/app/entry.ts'`)
     * - `'absolute'`: use the original filesystem path on disk
     */
    sourceMapSourcePaths?: 'url' | 'absolute';
    /**
     * Controls how served modules are cached and whether compiled artifacts are reused across
     * server restarts for a specific build.
     *
     * When omitted, all served modules use stable non-fingerprinted URLs with `Cache-Control: no-cache`.
     */
    cacheStrategy?: CacheStrategyOptions;
    /**
     * Minify emitted modules.
     */
    minify?: boolean;
    /** Import specifiers to leave unrewritten (CDN URLs, import map entries, etc.) */
    external?: string | string[];
    /**
     * Handles unexpected compilation errors. Return a `Response` to override the default
     * `500 Internal Server Error` response, or return nothing to use the default.
     */
    onError?: (error: unknown) => void | Response | Promise<void | Response>;
}
export interface ScriptServer {
    /**
     * Serves a script request. Returns `Response | null` — null means the request was not
     * handled by this server, letting the router fall through to a 404.
     */
    fetch(request: Request): Promise<Response | null>;
    /**
     * Returns preload URLs for the given module request path, ordered shallowest-first.
     */
    preloads(moduleUrl: string): Promise<string[]>;
}
/**
 * Create the server-side scripts server.
 *
 * Compiles TypeScript/JavaScript modules on demand with optional source-based URL
 * fingerprinting, ETag revalidation, and configurable route/file-space mapping.
 *
 * @param options Server configuration
 * @returns A {@link ScriptServer} with `fetch()` and `preloads()` methods
 *
 * @example
 * ```ts
 * let scriptServer = createScriptServer({
 *   routes: [{ urlPattern: '/scripts/app/*path', filePattern: 'app/*path' }],
 *   allow: ['app/**'],
 * })
 *
 * route('/scripts/*path', ({ request }) => scriptServer.fetch(request))
 * ```
 */
export declare function createScriptServer(options: ScriptServerOptions): ScriptServer;
//# sourceMappingURL=script-server.d.ts.map