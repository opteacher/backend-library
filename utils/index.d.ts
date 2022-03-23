export declare function scanPath (dirPath: string, options?: {
  ignores?: string[], ext?: string, orgPath?: string
}): string[];

export declare function copyDir (src: string, dest: string, options?: {
  ignores?: string[]
}): void;

export declare function delDir (path: string): void;

export declare function readConfig (cfgFile: string, withEnv?: boolean): any;

export declare function getErrContent (err: any): string;

export declare function fixStartsWith (text: string, prefix: string): string;

export declare function fixEndsWith (text: string, suffix: string): string;

export declare function rmvStartsOf (text: string, prefix: string): string;

export declare function rmvEndsOf (text: string, suffix: string): string;

export declare function pickProp(obj: object, prop: string): any;
