export interface ScriptRouteDefinition {
    urlPattern: string;
    filePattern: string;
}
export interface CompiledRoutes {
    resolveUrlPathname(pathname: string): string | null;
    toUrlPathname(filePath: string): string | null;
}
export declare function normalizePathname(pathname: string): string;
export declare function normalizeFilePath(filePath: string): string;
export declare function normalizeFilePattern(pattern: string): string;
export declare function compileRoutes(options: {
    routes: readonly ScriptRouteDefinition[];
    root: string;
}): CompiledRoutes;
//# sourceMappingURL=routes.d.ts.map