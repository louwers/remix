import type { FileStorage } from '@remix-run/file-storage';
import type { CompiledRoutes } from './routes.ts';
export interface ModuleCompileResult {
    compiledCode: string;
    compiledHash: string;
    deps: string[];
    fingerprint: string;
    sourcemap: string | null;
    sourcemapHash: string | null;
    stableUrlPathname: string;
}
interface ModuleCompilerOptions {
    buildId?: string;
    external: string[];
    fileStorage?: FileStorage;
    fingerprintInternalModules: boolean;
    isAllowed(absolutePath: string): boolean;
    isEntryPoint(absolutePath: string): boolean;
    minify: boolean;
    routes: CompiledRoutes;
    sourceMapSourcePaths: 'absolute' | 'url';
    sourceMaps?: 'external' | 'inline';
}
interface ResolveModuleResult {
    identityPath: string;
    resolvedPath: string;
}
export interface ModuleCompiler {
    compileModule(absolutePath: string): Promise<ModuleCompileResult>;
    getPreloadUrls(moduleUrl: string): Promise<string[]>;
    resolveRequestPath(absolutePath: string): ResolveModuleResult | null;
}
export declare function createModuleCompiler(options: ModuleCompilerOptions): ModuleCompiler;
export declare function resolveModulePath(absolutePath: string): ResolveModuleResult | null;
export declare function createResponseForModule(result: ModuleCompileResult, options: {
    cacheControl: string;
    ifNoneMatch: string | null;
    isSourceMapRequest: boolean;
    method: string;
}): Response;
export {};
//# sourceMappingURL=modules.d.ts.map