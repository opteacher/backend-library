'use strict'
import _ from 'lodash'
import { readFile } from 'fs/promises'
import mongoose from 'mongoose'
import { setProp, getProp, getErrContent } from '../utils/index.js'
import { getPropType } from './index.js'
mongoose.Promise = global.Promise

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
      LongStr: String,
      Number: Number,
      Decimal: mongoose.Types.Decimal128,
      DateTime: Date,
      Boolean: Boolean,
      Array: Array,
      Object: Map,
      Any: mongoose.Schema.Types.Mixed
    }
    this.Middles = {
      select: 'find',
      create: 'save',
      update: 'save',
      save: 'save',
      delete: 'remove',
      before: 'pre',
      doing: '',
      after: 'post'
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
    return Promise.resolve(
      mongoose.connect(
        [
          this.config.url && this.config.url.startsWith('mongodb://') ? '' : 'mongodb://',
          this.config.username ? `${this.config.username}:` : '',
          this.config.password ? `${this.config.password}@` : '',
          this.config.url ? this.config.url : `${this.config.host}:${this.config.port}`,
          this.config.database ? `/${this.config.database}` : '',
          '?useUnifiedTopology=true'
        ].join(''),
        {
          useNewUrlParser: true,
          keepAlive: false,
          authSource: 'admin'
        }
      )
    )
  }

  disconnect() {
    return mongoose.disconnect()
  }

  // @block{defineModel}:定义模型
  // @type:function (prototype)
  // @params{name}[string]:模型名
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
  defineModel(name, struct, options) {
    if (!options) {
      options = {}
    }
    if (!options.middle) {
      options.middle = {}
    }

    if (!options.operate) {
      options.operate = {}
    }
    const setOperate = name => {
      if (!options.operate[name]) {
        options.operate[name] = {
          columns: Object.keys(struct)
        }
      }
    }
    setOperate('select')
    setOperate('update')
    setOperate('create')
    setOperate('delete')

    const self = this
    // 为子文档设置shema包围
    const types = Object.values(self.PropTypes)
    const pkgSubProp = subStt => {
      for (const [prop, val] of Object.entries(subStt)) {
        if (val === self.PropTypes.DateTime) {
          subStt[prop] = {
            type: self.PropTypes.DateTime,
            default: () => new Date(0) // 日期时间默认尾1970/01/01，此日期为无效
          }
          continue
        }
        const isAry = val instanceof Array && val.length === 1
        let value = val
        if (isAry) {
          value = val[0]
        }
        if (!types.includes(value) && !value.type) {
          pkgSubProp(value)
          if (isAry) {
            subStt[prop] = [mongoose.Schema(value)]
          } else {
            subStt[prop] = mongoose.Schema(value)
          }
        }
      }
    }
    const adjStt = _.cloneDeep(struct)
    pkgSubProp(adjStt)

    const schema = mongoose.Schema(adjStt, { timestamps: options.timestamps })
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
            // console.warn('mongoose不支持doing中间件')
            break
          case 'after':
            schema.post(self.Middles[obs], func)
            break
        }
      }
    }

    let model = mongoose.model(name, schema)
    this.models[name] = {
      model,
      name,
      struct,
      options
    }
    return this.models[name]
  }

  adjConds(condition) {
    for (const [key, val] of Object.entries(condition)) {
      if (val instanceof Array) {
        switch (val[0]) {
          case '<':
            delete condition[key]
            condition[key] = { $lt: parseFloat(val[1]) }
            break
          case '>':
            delete condition[key]
            condition[key] = { $gt: parseFloat(val[1]) }
            break
          case '<=':
            delete condition[key]
            condition[key] = { $lte: parseFloat(val[1]) }
            break
          case '>=':
            delete condition[key]
            condition[key] = { $gte: parseFloat(val[1]) }
            break
          case '==':
            if (val[1].toLowerCase() === 'null') {
              delete condition[key]
              condition[key] = null
            }
            break
          case '!=':
            if (val[1].toLowerCase() === 'null') {
              delete condition[key]
              condition[key] = { $ne: null, $exists: true }
            }
            break
          case 'in':
            delete condition[key]
            condition[key] = { $in: val.slice(1) }
            break
          case 'like':
            delete condition[key]
            condition[key] = { $regex: val[1] }
            break
        }
      }
    }
  }

  async select(mdlInf, condition, options) {
    if (!options) {
      options = {}
    }
    if (!condition) {
      condition = {}
    }

    await this.connect()

    let selCols = mdlInf.options.operate.select.columns.join(' ')
    if (options.selCols) {
      selCols = options.selCols.join(' ')
    }

    const doSel = res => {
      if (options.ext) {
        for (const [prop] of Object.entries(Mongo.getRefCollection(mdlInf.struct))) {
          res = res.populate(prop)
        }
      }
      return res.exec()
    }

    if (condition._index) {
      return doSel(mdlInf.model.findById(condition._index, selCols))
    }

    let order_by = null
    if (condition.order_by) {
      order_by = Object.fromEntries(
        Object.entries(condition.order_by).map(([prop, order]) => [
          prop,
          { DESC: -1, ASC: 1 }[order.toUpperCase()]
        ])
      )
      delete condition.order_by
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
    this.adjConds(condition)
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
    return doSel(res)
  }

  async saveOne(mdlInf, id, values, options) {
    if (!options) {
      options = {}
    }
    if (!options.updMode) {
      options.updMode = 'cover'
    }

    await this.connect()
    const obj = await mdlInf.model.findById(id)
    for (const [k, v] of Object.entries(values)) {
      const propType = getPropType(mdlInf.struct, k)
      if (!propType) {
        continue
      }
      let key = k
      let value = v
      switch (options.updMode.toLowerCase()) {
        case 'append':
          if (propType === String || propType.name === 'Number') {
            value = getProp(obj, key) + v
          } else if (propType instanceof Array || propType.name === 'Array') {
            value = getProp(obj, key).concat(v)
          }
          break
        case 'delete':
          if (propType === String) {
            value = ''
          } else if (propType.name === 'Number') {
            value = 0
          } else if (propType instanceof Array || propType.name === 'Array') {
            let index = -1
            const lstIdx = key.lastIndexOf('[')
            if (lstIdx === -1) {
              value = getProp(obj, key)
              index = value.indexOf(v)
            } else {
              value = getProp(obj, key.substring(0, lstIdx))
              const idxKey = key.substring(lstIdx)
              key = key.substring(0, lstIdx)
              if (idxKey.endsWith('}]')) {
                const res = /^\[\{(\w+):(\"?\w+\"?)\}\]$/.exec(idxKey)
                if (!res || res.length < 3) {
                  throw new Error()
                }
                index = value.findIndex(itm => itm[res[1]] == res[2])
              } else {
                const res = /^\[(\d+)\]$/.exec(idxKey)
                if (!res || res.length < 2) {
                  throw new Error()
                }
                index = parseInt(res[1])
              }
            }
            value.splice(index, 1)
          } else {
            value = undefined
          }
          break
        case 'merge':
          if (propType.name === 'Map') {
            value = getProp(obj, key)
            if (!value) {
              value = new Map()
            }
            for (const [sk, sv] of Object.entries(v)) {
              value.set(sk, sv)
            }
          } else if (propType instanceof Object) {
            value = Object.assign(getProp(obj, key) || {}, v)
          }
          break
        case 'cover':
        default:
      }
      setProp(obj, key, value)
    }
    return obj.save()
  }

  async save(mdlInf, values, condition, options) {
    if (!options) {
      options = {}
    }
    if (!options.updMode) {
      options.updMode = 'cover'
    }

    await this.connect()

    if (condition) {
      if (condition._index) {
        return this.saveOne(mdlInf, condition._index, values, options)
      } else {
        const result = await mdlInf.model.find(condition)
        return Promise.all(result.map(res => this.saveOne(mdlInf, res._id, values, options)))
      }
    } else {
      return new mdlInf.model(values).save()
    }
  }

  async remove(mdlInf, condition, options) {
    if (!options) {
      options = {}
    }
    if (condition && condition._index) {
      condition._id = condition._index
      delete condition._index
    }

    await this.connect()
    return mdlInf.model.deleteMany(condition).then(res => res.deletedCount)
  }

  async sync(mdlInf) {
    await this.connect()
    return new Promise((res, rej) => {
      mdlInf.model.deleteMany({}, err => {
        err ? rej(err) : res()
      })
    })
  }

  async dump(mdlInf, flPath) {
    await this.connect()
    const json = await readFile(/*new URL(*/ flPath /*, import.meta.url)*/)
    const data = await Promise.all(
      JSON.parse(json).data.map(record => new mdlInf.model(record).save())
    )
    return data.length
  }

  async count(mdlInf) {
    await this.connect()
    return mdlInf.model.count()
  }

  async max(mdlInf, prop, condition = null) {
    await this.connect()
    const res = await mdlInf.model
      .findOne(condition)
      .select(prop)
      .sort({ [prop]: -1 })
      .exec()
    return res && res[prop] ? res[prop] : 0
  }

  genId() {
    return Promise.resolve(mongoose.Types.ObjectId())
  }

  buildAssocs() {
    return Promise.resolve()
  }
}
