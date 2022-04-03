'use strict'
import { readFile } from 'fs/promises'
import mongoose from 'mongoose'
mongoose.Promise = global.Promise
import { pickProp, getErrContent } from '../utils/index.js'

// @block{Mongo}:mongodb的实例类
// @role:数据库操作类
// @includes:lodash
// @includes:mongoose
// @includes:../config/db.mongo
// @includes:../utils/error
// @type:class
// @description:常量：
//  * *Types*[`object`]：可用列类型
export default class Mongo {
  constructor(config) {
    this.config = config
    this.models = {}
    this.PropTypes = {
      Id: mongoose.Types.ObjectId,
      String: String,
      Number: Number,
      DateTime: Date,
      Boolean: Boolean,
      Array: Array,
      Object: Map,
      Any: mongoose.Schema.Types.Mixed,
    }
    this.Middles = {
      select: 'find',
      create: 'save',
      update: 'save',
      save: 'save',
      delete: 'remove',
      before: 'pre',
      doing: '',
      after: 'post',
    }
  }

  static getRefCollection(mdlStruct) {
    let ret = {}
    for (const [k, v] of Object.entries(mdlStruct)) {
      let val = v
      if (val instanceof Array) {
        val = val[0]
      }
      if (val.ref) {
        ret[k] = val.ref
      }
    }
    return ret
  }

  // @block{connect}:数据库连接方法
  // @description:连接后方可操作数据库
  // @type:function (prototype)
  // @return{conn}[Promise]:连接Promise
  connect() {
    return mongoose.connect(
      [
        'mongodb://',
        this.config.username ? `${this.config.username}:` : '',
        this.config.password ? `${this.config.password}@` : '',
        `${this.config.host}:`,
        `${this.config.port}/`,
        `${this.config.database}?authSource=admin`,
      ].join(''),
      {
        useNewUrlParser: true,
        keepAlive: false,
      }
    )
  }

  disconnect() {
    return mongoose.disconnect()
  }

  // @block{defineModel}:定义模型
  // @type:function (prototype)
  // @params{struct}[object]:ORM结构
  // @params{options}[object]:定义参数
  //  * *router*[`object`]：路由参数
  //    + *methods*[`array`]：需要生成的method方式
  //    > 有GET/POST/PUT/DELETE/LINK/PROP（注：PROP可以指定是哪个属性）
  //  * *middle*[`object`]：中间件，数据库操作前中后自定义操作
  //    + *create*[`object`]：创建
  //    + *update*[`object`]：更新
  //    + *save*[`object`]：创建/更新
  //    + *select*[`object`]：查询
  //    + *delete*[`object`]：删除
  //    > 每个中间件属性都可以定义before/doing/after三个子属性
  // @notices:因为在mongoose中，创建/更新/保存都用的同\
  //  一个save接口，所以这三个操作无法同时定义，待修复
  defineModel(struct, options) {
    if (!options) {
      options = {}
    }
    if (!options.middle) {
      options.middle = {}
    }

    let mdlName = struct.__modelName
    delete struct.__modelName

    if (!options.operate) {
      options.operate = {}
    }
    const setOperate = (name) => {
      if (!options.operate[name]) {
        options.operate[name] = {
          columns: Object.keys(struct),
        }
      }
    }
    setOperate('select')
    setOperate('update')
    setOperate('create')
    setOperate('delete')
    for (const [name, prop] of Object.entries(struct)) {
      if (prop.excludes) {
        prop.excludes.map((oper) => {
          options.operate[oper].columns.splice(
            options.operate[oper].columns.indexOf(name),
            1
          )
        })
        delete prop.excludes
      }
    }

    let self = this
    let schema = mongoose.Schema(struct)
    for (const [obs, v] of Object.entries(options.middle)) {
      if (!(obs in self.Middles)) {
        continue
      }
      for (const [stage, func] of Object.entries(v)) {
        if (!(stage in self.Middles)) {
          continue
        }
        switch (stage) {
          case 'before':
            schema.pre(self.Middles[obs], function (next) {
              func(this)
              next()
            })
            break
          case 'doing':
            console.error('mongoose不支持doing中间件')
            break
          case 'after':
            schema.post(self.Middles[obs], func)
            break
        }
      }
    }

    let model = mongoose.model(mdlName, schema)
    this.models[mdlName] = {
      model,
      name: mdlName,
      struct,
      options,
    }
    return this.models[mdlName]
  }

  async select(mdlInf, condition, options) {
    if (!options) {
      options = {}
    }
    if (!condition) {
      condition = {}
    }

    try {
      await this.connect()

      if (condition._index) {
        let res = mdlInf.model.findById(condition._index)
        if (options.ext) {
          for (const [prop] of Object.entries(
            Mongo.getRefCollection(mdlInf.struct)
          )) {
            res = res.populate(prop)
          }
        }
        return res.exec()
      }

      let order_by = null
      if (condition.order_by) {
        order_by = condition.order_by
        delete condition.order_by
        if (typeof order_by === 'string') {
          order_by = JSON.parse(order_by)
        }
      }
      let offset = null
      if (condition.offset) {
        offset = condition.offset
        delete condition.offset
      }
      let limit = null
      if (condition.limit) {
        limit = condition.limit
        delete condition.limit
      }
      let selCols = mdlInf.options.operate.select.columns.join(' ')
      if (options.selCols) {
        selCols = options.selCols.join(' ')
      }
      let res = mdlInf.model.find(condition, selCols)
      if (order_by) {
        res = res.sort(order_by)
      }
      if (offset) {
        res = res.skip(offset)
      }
      if (limit) {
        res = res.limit(limit)
      }
      if (options.ext) {
        for (const [prop] of Object.entries(
          Mongo.getRefCollection(mdlInf.struct)
        )) {
          res = res.populate(prop)
        }
      }
      return res.exec()
    } catch (error) {
      return getErrContent(error)
    }
  }

  async saveOne(mdlInf, id, values, options) {
    if (!options) {
      options = {}
    }
    if (!options.updMode) {
      options.updMode = 'cover'
    }

    try {
      await this.connect()
      const obj = await mdlInf.model.findById(id)
      for (const [k, v] of Object.entries(values)) {
        let propType = pickProp(mdlInf.struct, k)
        switch (options.updMode.toLowerCase()) {
          case 'append':
            if (propType instanceof String || propType.name === 'Number') {
              obj.set(k, obj.get(k) + v)
            } else if (propType instanceof Array || propType.name === 'Array') {
              // https://github.com/Automattic/mongoose/issues/4455
              obj.set(k, obj.get(k).concat(v))
            } else {
              obj.set(k, v)
            }
            break
          case 'delete':
            if (propType instanceof String) {
              obj.set(k, '')
            } else if (propType.name === 'Number') {
              obj.set(k, 0)
            } else if (propType instanceof Array || propType.name === 'Array') {
              const array = obj.get(k)
              array.splice(array.indexOf(v), 1)
              obj.set(k, array)
            } else {
              obj[k] = undefined
            }
            break
          case 'cover':
          default:
            obj.set(k, v)
        }
      }
      return obj.save().then((res) => res.toObject())
    } catch (error) {
      return getErrContent(error)
    }
  }

  async save(mdlInf, values, condition, options) {
    if (!options) {
      options = {}
    }
    if (!options.updMode) {
      options.updMode = 'cover'
    }

    try {
      await this.connect()

      if (condition) {
        if (condition._index) {
          return this.saveOne(mdlInf, condition._index, values, options)
        } else {
          return (await mdlInf.model.find(condition)).map((res) => {
            return this.saveOne(mdlInf, res._id, values, options)
          })
        }
      } else {
        return new mdlInf.model(values).save()
      }
    } catch (error) {
      return getErrContent(error)
    }
  }

  async del(mdlInf, condition, options) {
    if (!options) {
      options = {}
    }
    if (condition && condition._index) {
      condition._id = condition._index
      delete condition._index
    }

    try {
      await this.connect()
      return mdlInf.model.deleteMany(condition).then((res) => res.deletedCount)
    } catch (error) {
      return getErrContent(error)
    }
  }

  async sync(mdlInf) {
    try {
      await this.connect()
      return new Promise((res, rej) => {
        mdlInf.model.deleteMany({}, (err) => {
          err ? rej(err) : res()
        })
      })
    } catch (error) {
      return getErrContent(error)
    }
  }

  async dump(mdlInf, flPath) {
    try {
      await this.connect()
      const json = await readFile(/*new URL(*/ flPath /*, import.meta.url)*/)
      const data = await Promise.all(
        JSON.parse(json).data.map((record) => new mdlInf.model(record).save())
      )
      return data.length
    } catch (error) {
      return getErrContent(error)
    }
  }

  count(mdlInf) {
    return this.connect().then(() => mdlInf.model.count())
  }

  async max(mdlInf, prop, condition = null) {
    try {
      await this.connect()
      const res = mdlInf.model.findOne(condition, prop, {
        sort: { [prop]: 1 },
      })
      return res && res[prop] ? res[prop] : 0
    } catch (error) {
      return getErrContent(error)
    }
  }
}
