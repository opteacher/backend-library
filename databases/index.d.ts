import Sequelize from 'sequelize'
import * as mongoose from 'mongoose'

type Middle = 'select' | 'create' | 'update' | 'save' | 'delete' | 'valid';
type Process = 'before' | 'doing' | 'after';
type Type = 'Id' | 'String' | 'Number' | 'Date' | 'Boolean' | 'Array' | 'Object';
type UpdMode = 'cover' | 'append';
type Method = 'GET' | 'POST' | 'DELETE' | 'PUT' | 'ALL' | 'LINK';

type DefineMiddle = {
  [middle in Middle]?: {
    [process in Process]?: (record: any) => void;
  };
}

interface DefineOptions extends IndexStruct {
  middle?: DefineMiddle;
  router: {
    prePath?: [any, string][];
    methods: Method[];
  };
}

interface SelectOptions extends IndexStruct {
  selCols?: string[];
  rawQuery?: boolean;
  ext?: boolean | string[];
}

interface SaveOptions extends IndexStruct {
  updMode?: UpdMode;
}

interface DeleteOptions extends IndexStruct {

}

interface IndexStruct {
  [prop: string]: any;
}

interface NamedStruct extends IndexStruct {
  __modelName: string;
}

type Model = Sequelize.Model<any, any> | mongoose.Model<any> | null;
type Conn = Sequelize.Sequelize | mongoose.Mongoose;

interface MdlInf {
  model: Model;
  name: string;
  struct: IndexStruct;
  options: DefineOptions;
}

interface TypeMapper {
  [tname: string]: any;
}

declare class DataBase {
  get PropTypes (): TypeMapper;
  connect (): Promise<Conn>;
  genPreRoutes (): void;
  useDataBase (dbName: string): Promise<boolean>;
  defineModel (struct: NamedStruct, options?: DefineOptions): MdlInf;
  select (mdlInf: MdlInf, condition?: any, options?: SelectOptions): Promise<any>;
  save (mdlInf: MdlInf, values: any, condition?: any, options?: SaveOptions): Promise<any>;
  del (mdlInf: MdlInf, condition?: any, options?: DeleteOptions): Promise<number>;
  sync (mdlInf: MdlInf): Promise<void>;
  count (mdlInf: MdlInf): Promise<number>;
  dump (mdlInf: MdlInf, flPath: string): Promise<number>;
}

interface OperOptions {
  operType?: string;
}

interface GetOptions extends OperOptions{
}

interface SetOptions extends OperOptions {
  expSeconds?: number;
}

export declare function getDbByName (name: string, cfgPath: string): Promise<DataBase>
