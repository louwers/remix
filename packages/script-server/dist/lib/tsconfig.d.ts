export interface TsconfigTransformOptions {
    cacheKey: string;
    tsconfigRaw?: {
        compilerOptions: Record<string, unknown>;
    };
}
export declare let typescriptVersion: string;
export declare function getTsconfigTransformOptions(filePath: string): TsconfigTransformOptions;
//# sourceMappingURL=tsconfig.d.ts.map