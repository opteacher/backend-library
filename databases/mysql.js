import _ from 'lodash'
import inflection from 'lodash-inflection'
_.mixin(inflection)
import { readFileSync } from 'fs'
import { Sequelize, DataTypes, Op } from 'sequelize'
import { setProp, getProp, getErrContent } from '../utils/index.js'
import { getPropType } from './index.js'

// @block{Mongo}:mongodb的实例类
// @role:数据库操作类
// @includes:lodash
// @includes:mongoose
// @includes:../config/db.mongo
// @includes:../utils/error
// @type:class
// @description:常量：
//  * *Types*[`object`]：可用列类型
export default class Mysql {
  constructor(config) {
    this.config = config
    this.sequelize = null
    this.models = {}
    this.PropTypes = {
      Id: DataTypes.UUID,
      String: DataTypes.STRING,
      LongStr: DataTypes.TEXT('long'),
      Number: DataTypes.INTEGER,
      DateTime: DataTypes.DATE,
      Boolean: DataTypes.BOOLEAN,
      Decimal: DataTypes.DECIMAL(64, 20),
      Array: DataTypes.ARRAY,
      Object: DataTypes.JSON,
      Any: DataTypes.BLOB
    }
    this.Middles = {
      select: '',
      create: 'create',
      update: 'update',
      save: 'save',
      delete: 'destroy',
      valid: 'validation',
      before: 'before',
      after: 'after'
    }
    this.connect()
  }

  static getRefCollection(struct) {
    const ret = {}
    for (const [key, val] of Object.entries(struct)) {
      let value = val
      if (val.length && val[0] && val[0].ref) {
        ret[key] = { array: val.length }
        value = val[0]
      }
      if (value.ref) {
        ret[key] = { ref: value.ref }
        if (typeof value.belong === 'undefined') {
          ret[key].belong = !ret[key].array
        } else {
          ret[key].belong = value.belong
        }
      }
    }
    return ret
  }

  // @block{connect}:数据库连接方法
  // @description:连接后方可操作数据库
  // @type:function (prototype)
  // @return{conn}[Promise]:连接Promise
  connect() {
    if (!this.sequelize) {
      this.sequelize = new Sequelize(
        this.config.database,
        this.config.username,
        this.config.password,
        {
          logging: false,
          host: this.config.host,
          dialect: 'mysql',

          pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
          }
        }
      )
    }
    return this.sequelize
  }

  disconnect() {
    return this.sequelize && this.sequelize.close()
  }

  // @block{defineModel}:定义模型
  // @type:function (prototype)
  // @params{struct}[object]:ORM结构
  // @params{options}[object]:定义参数
  //  * *router*[`object`]：路由参数
  //      + *methods*[`array`]：需要生成的method方式
  //      > 有GET/POST/PUT/DELETE/LINK/PROP（注：PROP可以指定是哪个属性）
  //  * *middle*[`object`]：中间件，数据库操作前中后自定义操作
  //      + *create*[`object`]：创建
  //      + *update*[`object`]：更新
  //      + *save*[`object`]：创建/更新
  //      + *select*[`object`]：查询
  //      + *delete*[`object`]：删除
  //      > 每个中间件属性都可以定义before/doing/after三个子属性
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
    const adjStt = _.cloneDeep(struct)
    const addTypePfx = value => {
      if (typeof value === 'number') {
        if (Math.floor(value) === value) {
          return `n${value}`
        } else {
          return `d${value}`
        }
      } else if (typeof value === 'boolean') {
        return `b${value}`
      } else {
        return `s${value}`
      }
    }
    const rmvTypePfx = text => {
      switch (text[0]) {
        case 'n':
          return parseInt(text.substring(1))
        case 'd':
          return parseFloat(text.substring(1))
        case 'b':
          return text.substring(1).toLowerCase() === 'true' ? true : false
        case 's':
        default:
          return text.substring(1)
      }
    }
    const moptions = { hooks: {} }
    const foreignProps = Mysql.getRefCollection(struct)
    const foreignKeys = Object.keys(foreignProps)
    for (const [pname, prop] of Object.entries(adjStt)) {
      if (foreignKeys.includes(pname)) {
        // 删除外键防止命名冲突
        delete adjStt[pname]
        continue
      }
      if (prop.type === this.PropTypes.Array) {
        adjStt[pname].type = DataTypes.STRING(4096)
        adjStt[pname].get = function () {
          const strAry = this.getDataValue(pname)
          return strAry ? strAry.split(',').map(rmvTypePfx) : []
        }
        adjStt[pname].set = function set(value) {
          this.setDataValue(pname, value.map(addTypePfx).join(','))
        }
      } else if (prop === this.PropTypes.Array) {
        adjStt[pname] = {
          type: DataTypes.STRING(4096),
          get() {
            const strAry = this.getDataValue(pname)
            return strAry ? strAry.split(',').map(rmvTypePfx) : []
          },
          set(value) {
            this.setDataValue(pname, value.map(addTypePfx).join(','))
          }
        }
      } else if (prop.type === this.PropTypes.Object || prop === this.PropTypes.Object) {
        adjStt[pname] = {
          type: DataTypes.STRING(4096),
          get() {
            const value = this.getDataValue(pname)
            return value ? JSON.parse(value) : undefined
          },
          set(value) {
            if (value) {
              this.setDataValue(pname, JSON.stringify(value))
            }
          }
        }
      }
      if (prop.index) {
        if (!moptions.indexes) {
          moptions.indexes = [{ unique: true, fields: [] }]
        }
        moptions.indexes[0].fields.push(pname)
        delete adjStt[pname].index
      }
      if (typeof prop.default !== 'undefined') {
        if (prop.default == Date.now) {
          adjStt[pname].defaultValue = Sequelize.NOW
        } else if (prop === this.PropTypes.Array || prop.type === this.PropTypes.Array) {
          adjStt[pname].defaultValue = prop.default.map(addTypePfx).join(',')
        }
        delete adjStt[pname].default
      }
    }

    for (const [obs, v] of Object.entries(options.middle)) {
      if (!(obs in this.Middles)) {
        continue
      }
      for (const [stage, func] of Object.entries(v)) {
        if (!(stage in this.Middles)) {
          continue
        }
        if (stage === 'doing') {
          console.error('mongoose不支持doing中间件')
          continue
        }
        moptions.hooks[`${stage}${_.upperFirst(obs)}`] = func
      }
    }

    const model = this.sequelize.define(name, adjStt, moptions)
    // belong参数指明该模型以何种形式与关联到外部表。e.g:
    // 1. A表的外键b: { type: DataTypes.ID, ref: 'B', belong: true }。则有A.belongsTo(B, { foreignKey: 'b' })
    // 2. A表的外键b: { type: DataTypes.ID, ref: 'B', belong: false }。则有A.hasOne(B, { foreignKey: 'b' })
    // 3. A表的外键bs: [{ type: DataTypes.ID, ref: 'B', belong: true }]。【不支持】
    // 4. A表的外键bs: [{ type: DataTypes.ID, ref: 'B', belong: false }]。则有A.hasMany(B, { foreignKey: 'bs' })
    // * 注意：不带belong参数时，默认以2和4关联
    for (const [prop, table] of Object.entries(foreignProps)) {
      let func = table.belong ? 'belongsTo' : 'hasOne'
      if (table.array) {
        func = 'hasMany'
      }
      // @_@: 存在模型前后加载问题，所关联表可能还未注册到模型表中
      let countdown = 0
      const h = setInterval(() => {
        try {
          model[func](this.models[table.ref].model, {
            foreignKey: prop,
            constraints: false
          })
          clearInterval(h)
        } catch (e) {
          countdown++
          if (countdown > 200) {
            throw new Error('关联模型失败！')
          }
        }
      }, 1000)
    }
    this.models[name] = {
      model,
      name,
      struct,
      options
    }
    return this.models[name]
  }

  adjConds(conds) {
    for (const [key, val] of Object.entries(conds.where)) {
      if (val instanceof Array) {
        switch (val[0]) {
          case '<':
            conds.where[key] = {
              [Op.lt]: val[1]
            }
            break
          case '>':
            conds.where[key] = {
              [Op.gt]: val[1]
            }
            break
          case '<=':
            conds.where[key] = {
              [Op.lte]: val[1]
            }
            break
          case '>=':
            conds.where[key] = {
              [Op.gte]: val[1]
            }
            break
          case '==':
            if (val[1].toLowerCase() === 'null') {
              conds.where[key] = {
                [Op.is]: null
              }
            } else {
              conds.where[key] = {
                [Op.eq]: val[1]
              }
            }
            break
          case '!=':
            if (val[1].toLowerCase() === 'null') {
              conds.where[key] = {
                [Op.not]: null
              }
            } else {
              conds.where[key] = {
                [Op.ne]: val[1]
              }
            }
            break
          case 'in':
            conds.where[key] = {
              [Op.in]: val[1] instanceof Array ? val[1] : val.slice(1)
            }
            break
          case 'like':
            conds.where[key] = {
              [Op.like]: val[1]
            }
            break
        }
      } else if (val === 'null') {
        conds.where[key] = {
          [Op.is]: null
        }
      }
    }
  }

  select(mdlInf, condition, options) {
    if (!options) {
      options = {}
    }
    if (typeof options.raw === 'undefined') {
      options.raw = true
    }
    if (!condition) {
      condition = {}
    }

    let index = -1
    const conds = {}
    if (Object.keys(condition).length !== 0) {
      if (condition._index) {
        index = parseInt(condition._index)
        delete condition._index
      }

      conds['where'] = condition
      if (condition.order_by) {
        conds.order = Object.entries(condition.order_by).map(([prop, order]) => [
          prop,
          order.toUpperCase()
        ])
        delete condition.order_by
        delete conds.where.order_by
      }
      if (condition.offset) {
        conds.offset = parseInt(condition.offset)
        delete conds.where.offset
      }
      if (condition.limit) {
        conds.limit = parseInt(condition.limit)
        delete conds.where.limit
      }

      // 条件选择，目前只支持一个属性一个条件
      this.adjConds(conds)
    }
    if (options.selCols) {
      conds['attributes'] = options.selCols
    }
    if (options.rawQuery) {
      conds.raw = options.rawQuery
    }
    if (options.ext) {
      const refs = Mysql.getRefCollection(mdlInf.struct)
      if (Object.keys(refs).length) {
        conds.include = []
        Object.values(refs).forEach(table => {
          conds.include.push({ model: this.models[table.ref].model })
        })
      }
    }
    if (index !== -1 && !conds.include) {
      return mdlInf.model.findByPk(index).then(res => (res && options.raw ? res.toJSON() : res))
    } else {
      return mdlInf.model
        .findAll(conds)
        .then(ress => ress.filter(res => res))
        .then(ress => (options.raw ? ress.map(res => res.toJSON()) : ress))
        .then(ress => (index !== -1 ? ress[0] : ress))
    }
  }

  exec(sql, params, options) {
    return this.connect().query(
      sql,
      Object.assign(
        {
          replacements: params,
          type: Sequelize.QueryTypes.SELECT
        },
        options
      )
    )
  }

  async saveOne(mdlInf, id, values, options) {
    if (!options) {
      options = {}
    }
    if (!options.updMode) {
      options.updMode = 'cover'
    }
    const updMode = options.updMode.toLowerCase()

    const refs = Mysql.getRefCollection(mdlInf.struct)
    const refKeys = Object.keys(refs)
    let obj = null
    if (refKeys.length) {
      const models = this.models
      const res = await mdlInf.model.findAll({
        where: { id },
        include: Object.values(refs).map(table => ({
          model: models[table.ref].model
        }))
      })
      obj = res[0]
    } else {
      obj = await mdlInf.model.findByPk(id)
    }
    // 1. A表的外键b: { type: DataTypes.ID, ref: 'B', belong: true }。则有A.belongsTo(B, { foreignKey: 'b' })
    // 2. A表的外键b: { type: DataTypes.ID, ref: 'B', belong: false }。则有A.hasOne(B, { foreignKey: 'b' })
    // 3. A表的外键bs: [{ type: DataTypes.ID, ref: 'B', belong: true }]。【不支持】
    // 4. A表的外键bs: [{ type: DataTypes.ID, ref: 'B', belong: false }]。则有A.hasMany(B, { foreignKey: 'bs' })
    // * 注意：不带belong参数时，默认以2和4关联
    for (const [k, v] of Object.entries(values)) {
      if (refKeys.includes(k)) {
        const refInf = refs[k]
        const key = _.capitalize(_.camelCase(refInf.ref))
        const refMdl = this.models[refInf.ref]
        if (!refInf.array) {
          if (updMode !== 'delete') {
            await obj[`set${key}`](await refMdl.model.findByPk(v))
          } else {
            await obj[`set${key}`](null)
          }
        } else {
          const value = !(v instanceof Array) ? [v] : v
          switch (updMode) {
            case 'append':
              for (const sv of value) {
                const record = await refMdl.model.findByPk(sv)
                await obj[`add${_.singularize(key)}`](record)
              }
              break
            case 'delete':
              for (const sv of value) {
                const record = await refMdl.model.findByPk(sv)
                await obj[`remove${_.singularize(key)}`](record)
              }
              break
            case 'cover':
            default:
              const records = await Promise.all(value.map(sv => refMdl.model.findByPk(sv)))
              await obj[`set${key}`](records)
              break
          }
        }
        continue
      }
      const propType = getPropType(mdlInf.struct, k)
      let key = k
      let value = v
      switch (updMode) {
        case 'append':
          if (
            propType === DataTypes.STRING ||
            propType == DataTypes.INTEGER ||
            propType === DataTypes.DECIMAL
          ) {
            value = getProp(obj, key) + v
          } else if (propType == DataTypes.ARRAY) {
            value = getProp(obj, key).concat(v)
          }
          break
        case 'delete':
          if (propType === DataTypes.STRING) {
            value = ''
          } else if (propType == DataTypes.INTEGER || propType === DataTypes.DECIMAL) {
            value = 0
          } else if (propType == DataTypes.ARRAY) {
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
          } else if (propType === DataTypes.JSON) {
            const fstPidx = k.indexOf('.')
            if (fstPidx !== -1) {
              key = k.substring(0, fstPidx)
              value = _.cloneDeep(obj[key])
              setProp(value, k.substring(fstPidx + 1), undefined)
            } else {
              value = undefined
            }
          } else {
            value = undefined
          }
          break
        case 'cover':
          if (propType === DataTypes.JSON) {
            const fstPidx = k.indexOf('.')
            if (fstPidx !== -1) {
              key = k.substring(0, fstPidx)
              value = _.cloneDeep(obj[key])
              setProp(value, k.substring(fstPidx + 1), v)
            }
          }
        default:
      }
      setProp(obj, key, value)
    }
    return obj.save().then(result => {
      const ret = result.toJSON()
      // console.log('UUUUUUUUUUUUUU', ret)
      return ret
    })
  }

  async save(mdlInf, values, condition, options) {
    if (!options) {
      options = {}
    }
    if (!options.updMode) {
      options.updMode = 'cover'
    }

    if (condition) {
      if (condition._index) {
        return this.saveOne(mdlInf, condition._index, values, options)
      } else {
        const result = (await this.select(mdlInf, condition, { selCols: ['id'] })) || []
        if (result.length) {
          return Promise.all(result.map(entity => this.saveOne(mdlInf, entity.id, values, options)))
        }
      }
    }
    return mdlInf.model
      .build(values)
      .save()
      .then(result => result.toJSON())
  }

  remove(mdlInf, condition, _options) {
    if (condition._index) {
      condition.id = parseInt(condition._index)
      delete condition._index
    }
    return mdlInf.model.destroy({ where: condition })
  }

  sync(mdlInf) {
    return mdlInf.model.sync({ force: true })
  }

  count(mdlInf, condition) {
    const conds = { where: condition || {} }
    this.adjConds(conds)
    return mdlInf.model.count(conds)
  }

  max(mdlInf, column) {
    return mdlInf.model
      .findOne({
        order: [[column, 'DESC']],
        attributes: [column]
      })
      .then(res => res[column])
  }

  async dump(_mdlInf, flPath) {
    return this.exec(
      readFileSync(/*new URL(*/ flPath /*, import.meta.url)*/, {
        encoding: 'utf8'
      })
    )
  }

  genId(mdlInf) {
    return this.max(mdlInf, 'id').then(maxId => maxId + 1)
  }
}
