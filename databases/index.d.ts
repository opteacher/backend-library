/* eslint-disable @typescript-eslint/no-explicit-any */
import Sequelize from 'sequelize'
import * as mongoose from 'mongoose'

type Middle = 'select' | 'create' | 'update' | 'save' | 'delete' | 'valid'
type Process = 'before' | 'doing' | 'after'
type Type =
  | 'Id'
  | 'String'
  | 'Number'
  | 'Date'
  | 'Boolean'
  | 'Array'
  | 'Object'
  | 'Any'
type UpdMode = 'cover' | 'append' | 'delete' | 'merge'
type Method = 'GET' | 'POST' | 'DELETE' | 'PUT' | 'ALL' | 'LINK'

type DefineMiddle = {
  [middle in Middle]?: {
    [process in Process]?: (record: any) => void
  }
}

interface DefineOptions extends IndexStruct {
  middle?: DefineMiddle
  router: {
    prePath?: [any, string][]
    methods: Method[]
  }
}

interface SelectOptions extends IndexStruct {
  selCols?: string[]
  rawQuery?: boolean
  ext?: boolean | string[]
}

interface SaveOptions extends IndexStruct {
  updMode?: UpdMode
}

type DeleteOptions = IndexStruct

interface IndexStruct {
  [prop: string]: any
}

interface NamedStruct extends IndexStruct {
  __modelName: string
}

type Model = Sequelize.Model<any, any> | mongoose.Model<any> | null
type Conn = Sequelize.Sequelize | mongoose.Mongoose

interface MdlInf {
  model: Model
  name: string
  struct: IndexStruct
  options: DefineOptions
}

interface TypeMapper {
  [tname: string]: any
}

declare class DataBase {
  get PropTypes(): TypeMapper
  connect(): Promise<Conn>
  disconnect(): Promise<void>
  useDataBase(dbName: string): Promise<boolean>
  defineModel(
    name: string,
    struct: NamedStruct,
    options?: DefineOptions
  ): MdlInf
  select(mdlInf: MdlInf, condition?: any, options?: SelectOptions): Promise<any>
  save(
    mdlInf: MdlInf,
    values: any,
    condition?: any,
    options?: SaveOptions
  ): Promise<any>
  saveOne(
    mdlInf: MdlInf,
    id: any,
    values: any,
    options?: SaveOptions
  ): Promise<any>
  remove(
    mdlInf: MdlInf,
    condition?: any,
    options?: DeleteOptions
  ): Promise<number>
  sync(mdlInf: MdlInf): Promise<void>
  count(mdlInf: MdlInf): Promise<number>
  max(
    mdlInf: MdlInf,
    prop: string,
    group?: Record<string, any>
  ): Promise<number>
  dump(mdlInf: MdlInf, flPath: string): Promise<number>
}

interface OperOptions {
  operType?: string
}

type GetOptions = OperOptions

interface SetOptions extends OperOptions {
  expSeconds?: number
}

export declare function getDbByName(
  name: string,
  cfgPath: string
): Promise<DataBase>

export declare function getAvaDbs(): string[]

export declare function fmtQuerySQL(
  sql: string,
  query: { [name: string]: any },
  symbol: string,
  options?: {
    addWhere?: boolean
    tags?: string[]
  }
): string

export declare function getPropType(struct: IndexStruct, prop: string): any
