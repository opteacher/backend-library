export declare function scanPath(
  dirPath: string,
  options?: {
    ignores?: string[]
    ext?: string
    orgPath?: string
  }
): string[]

export declare function copyDir(
  src: string,
  dest: string,
  options?: {
    ignores?: string[]
  }
): void

export declare function readConfig(cfgFile: string, withEnv?: boolean): any

export declare function getErrContent(err: any): string

export declare function fixStartsWith(text: string, prefix: string): string

export declare function fixEndsWith(text: string, suffix: string): string

export declare function rmvStartsOf(text: string, prefix: string): string

export declare function rmvEndsOf(text: string, suffix: string): string

export declare function getProp(obj: object, prop: string): any

export declare function setProp(obj: object, prop: string, value: any): void

export declare function uploadToQiniu(
  qnCfgPath: string,
  key: string,
  readableStream: NodeJS.ReadableStream
): Promise<string>

export declare function buildCfgFromPcs(
  sections: string[],
  prefix?: string
): Record<string, any>
