import * as path from 'node:path';
import * as fs from 'node:fs';
import { createModuleCompiler, createResponseForModule } from "./modules.js";
import { compileRoutes, normalizeFilePath } from "./routes.js";
let fingerprintedCacheControl = 'public, max-age=31536000, immutable';
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
export function createScriptServer(options) {
    let root = fs.realpathSync(path.resolve(options.root ?? process.cwd()));
    let sourceMaps = options.sourceMaps;
    let sourceMapSourcePaths = options.sourceMapSourcePaths ?? 'url';
    let externalRaw = options.external;
    let cacheStrategy = normalizeCacheStrategyOptions(options.cacheStrategy);
    let external = Array.isArray(externalRaw)
        ? externalRaw
        : externalRaw
            ? [externalRaw]
            : [];
    let fingerprintInternalModules = cacheStrategy.fingerprint === 'source';
    let buildId = cacheStrategy.buildId;
    let internalModuleCacheControl = fingerprintInternalModules
        ? fingerprintedCacheControl
        : 'no-cache';
    let minify = options.minify ?? false;
    let onError = options.onError ?? defaultErrorHandler;
    let routes = compileRoutes({
        root,
        routes: options.routes,
    });
    let entryPointMatchers = createEntryPointMatchers(cacheStrategy.fingerprint === 'source' ? cacheStrategy.entryPoints : [], root);
    let allowMatchers = createFileMatchers(options.allow, root);
    let denyMatchers = createFileMatchers(options.deny ?? [], root);
    let moduleCompiler = createModuleCompiler({
        buildId,
        external,
        fileStorage: cacheStrategy.fileStorage,
        fingerprintInternalModules,
        isAllowed,
        isEntryPoint,
        minify,
        routes,
        sourceMapSourcePaths,
        sourceMaps,
    });
    function internalServerError() {
        return new Response('Internal Server Error', {
            status: 500,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
    }
    function defaultErrorHandler(error) {
        console.error(error);
    }
    async function responseForError(error) {
        try {
            return (await onError(error)) ?? internalServerError();
        }
        catch (error) {
            console.error(`There was an error in the script server error handler: ${error}`);
            return internalServerError();
        }
    }
    function isNotFoundError(error) {
        return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
    }
    function isEntryPoint(filePath) {
        let normalized = normalizeFilePath(filePath);
        return entryPointMatchers.some((matcher) => matcher(normalized));
    }
    function isAllowed(filePath) {
        let normalized = normalizeFilePath(filePath);
        if (!allowMatchers.some((matcher) => matcher(normalized)))
            return false;
        if (denyMatchers.length > 0 && denyMatchers.some((matcher) => matcher(normalized)))
            return false;
        return true;
    }
    return {
        async fetch(request) {
            if (request.method !== 'GET' && request.method !== 'HEAD')
                return null;
            let pathname = new URL(request.url).pathname;
            let isSourceMapRequest = pathname.endsWith('.map');
            let withoutMap = isSourceMapRequest ? pathname.slice(0, -4) : pathname;
            let tokenMatch = withoutMap.match(/\.@([a-z0-9]+)$/);
            let requestedToken = tokenMatch ? tokenMatch[1] : null;
            let normalizedPath = tokenMatch ? withoutMap.slice(0, -tokenMatch[0].length) : withoutMap;
            let resolvedPath = routes.resolveUrlPathname(normalizedPath);
            if (!resolvedPath)
                return null;
            let resolved = moduleCompiler.resolveRequestPath(resolvedPath);
            if (!resolved || !isAllowed(resolved.identityPath))
                return null;
            let ifNoneMatch = request.headers.get('If-None-Match');
            let isEntry = isEntryPoint(resolved.identityPath);
            if (!requestedToken && !isEntry && fingerprintInternalModules) {
                return null;
            }
            try {
                let result = await moduleCompiler.compileModule(resolved.resolvedPath);
                if (requestedToken !== null) {
                    if (isEntry) {
                        return new Response('Not found', { status: 404 });
                    }
                    if (result.fingerprint !== requestedToken) {
                        return new Response('Not found', { status: 404 });
                    }
                }
                return createResponseForModule(result, {
                    cacheControl: isEntry ? 'no-cache' : internalModuleCacheControl,
                    ifNoneMatch,
                    isSourceMapRequest,
                    method: request.method,
                });
            }
            catch (error) {
                if (isNotFoundError(error))
                    return null;
                return responseForError(error);
            }
        },
        async preloads(moduleUrl) {
            if (/\.@[a-z0-9]+(?:\.map)?$/.test(moduleUrl)) {
                throw new Error(`Preload URLs must use stable non-fingerprinted module paths, received "${moduleUrl}"`);
            }
            return moduleCompiler.getPreloadUrls(moduleUrl);
        },
    };
}
function createEntryPointMatchers(entryPoints, root) {
    return entryPoints.map((entryPoint) => createFileMatcher(entryPoint, root, { allowDirectories: false }));
}
function createFileMatchers(patterns, root) {
    return patterns.map((pattern) => createFileMatcher(pattern, root));
}
function createFileMatcher(pattern, root, options = {}) {
    let resolved = path.isAbsolute(pattern) ? pattern : path.join(root, pattern);
    let allowDirectories = options.allowDirectories ?? true;
    if (!containsGlobSyntax(pattern)) {
        try {
            resolved = fs.realpathSync(resolved);
        }
        catch {
            // Keep unresolved exact paths so matcher behavior stays deterministic.
        }
        let normalized = normalizeFilePath(resolved);
        if (allowDirectories && isDirectoryPattern(pattern, root)) {
            return (filePath) => isSameOrDescendantPath(filePath, normalized);
        }
        return (filePath) => normalizeFilePath(filePath) === normalized;
    }
    let normalizedPattern = normalizeFilePath(resolved);
    return (filePath) => path.posix.matchesGlob(normalizeFilePath(filePath), normalizedPattern);
}
function isDirectoryPattern(pattern, root) {
    let resolved = path.isAbsolute(pattern) ? pattern : path.join(root, pattern);
    try {
        return fs.statSync(resolved).isDirectory();
    }
    catch {
        return false;
    }
}
function isSameOrDescendantPath(filePath, directoryPath) {
    let normalizedFilePath = normalizeFilePath(filePath);
    let normalizedDirectoryPath = directoryPath.replace(/\/+$/, '');
    return (normalizedFilePath === normalizedDirectoryPath ||
        normalizedFilePath.startsWith(`${normalizedDirectoryPath}/`));
}
function containsGlobSyntax(pattern) {
    return /[*?[\]{}()!+@]/.test(pattern);
}
function normalizeCacheStrategyOptions(options) {
    if (!options) {
        return { fingerprint: false };
    }
    if (options.fingerprint !== undefined &&
        options.fingerprint !== false &&
        options.fingerprint !== 'source') {
        throw new TypeError(`Invalid cacheStrategy.fingerprint "${String(options.fingerprint)}". Expected false or "source".`);
    }
    if (options.fingerprint === 'source') {
        if (typeof options.buildId !== 'string' || options.buildId.length === 0) {
            throw new TypeError('cacheStrategy.buildId must be a non-empty string');
        }
        if (!Array.isArray(options.entryPoints) || options.entryPoints.length === 0) {
            throw new TypeError('cacheStrategy.entryPoints must be a non-empty array');
        }
        return {
            buildId: options.buildId,
            entryPoints: options.entryPoints,
            fileStorage: options.fileStorage,
            fingerprint: 'source',
        };
    }
    if (options.entryPoints !== undefined) {
        throw new TypeError('cacheStrategy.entryPoints is only supported when cacheStrategy.fingerprint is "source"');
    }
    if (options.fileStorage === undefined && options.buildId === undefined) {
        return { fingerprint: false };
    }
    if (options.fileStorage === undefined) {
        throw new TypeError('cacheStrategy.fileStorage is required when cacheStrategy.buildId is set');
    }
    if (options.buildId === undefined) {
        throw new TypeError('cacheStrategy.buildId is required when cacheStrategy.fileStorage is set');
    }
    if (typeof options.buildId !== 'string' || options.buildId.length === 0) {
        throw new TypeError('cacheStrategy.buildId must be a non-empty string');
    }
    return {
        buildId: options.buildId,
        fileStorage: options.fileStorage,
        fingerprint: false,
    };
}
