import { DataBase } from "../databases";

export declare function scanPath (dirPath: string, options: {
  ignores?: string[], ext?: string, orgPath?: string
}): string[];

export declare function readConfig (cfgFile: string, withEnv?: boolean): any;

export declare function getErrContent (err: any): string;

export declare function getDatabase(): Promise<DataBase>;
