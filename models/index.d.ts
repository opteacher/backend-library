import Router from 'koa-router'
import { DataBase, MdlInf } from "../databases"

interface ModelConfig {
  version: number
  prefix: string
  type: string
  sync: boolean | string[]
  inits?: Map<string, string>
}

interface ModelMapper {
  [mdlName: string]: MdlInf
}

interface ModelExports {
  router: Router
  models: ModelMapper
  db: DataBase
}

export declare function genMdlRoutes(mdlsPath: string, dbCfgPath: string, mdlCfgPath: string): ModelExports;
