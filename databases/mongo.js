import _ from 'lodash'
import mongoose from 'mongoose'
mongoose.Promise = global.Promise
import { getErrContent, rmvEndsOf } from '../utils/index.js'

// @block{Mongo}:mongodb的实例类
// @role:数据库操作类
// @includes:lodash
// @includes:mongoose
// @includes:../config/db.mongo
// @includes:../utils/error
// @type:class
// @description:常量：
//  * *Types*[`object`]：可用列类型
function Mongo(config) {
    this.config = config
    this.models = {}
    Object.defineProperty(this, 'PropTypes', {
        value: {
            Id: mongoose.Schema.Types.ObjectId,
            String: String,
            Number: Number,
            Date: Date,
            Boolean: Boolean,
            Array: Array,
            Object: Map,
            Any: mongoose.Schema.Types.Mixed
        },
        writable: false
    })
    Object.defineProperty(this, 'Middles', {
        value: {
            select: 'find',
            create: 'save',
            update: 'save',
            save: 'save',
            delete: 'remove',
            before: 'pre',
            doing: '',
            after: 'post'
        },
        writable: false
    })
    Object.defineProperty(this, 'getRefCollection', {
        value: mdlStruct => {
            let ret = {}
            _.forIn(mdlStruct, (v, k) => {
                let val = v
                if (val instanceof Array) {
                    val = val[0]
                }
                if (val.ref) { ret[k] = val.ref }
            })
            return ret
        },
        writable: false
    })
}

// @block{connect}:数据库连接方法
// @description:连接后方可操作数据库
// @type:function (prototype)
// @return{conn}[Promise]:连接Promise
Mongo.prototype.connect = function() {
    return mongoose.connect([
        'mongodb://',
        (this.config.username ? `${this.config.username}:` : ''),
        (this.config.password ? `${this.config.password}@` : ''),
        `${this.config.host}:`,
        `${this.config.port}/`,
        `${this.config.database}?authSource=admin`
    ].join(''), {
        useNewUrlParser: true,
        keepAlive: false
    })
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
Mongo.prototype.defineModel = function(struct, options) {
    if (!options) { options = {} }
    if (!options.middle) { options.middle = {} }

    let mdlName = struct.__modelName
    delete struct.__modelName

    if (!options.operate) { options.operate = {} }
    const setOperate = name => {
        if (!options.operate[name]) {
            options.operate[name] = {
                columns: _.keys(struct)
            }
        }
    }
    setOperate('select')
    setOperate('update')
    setOperate('create')
    setOperate('delete')
    _.forIn(struct, (prop, name) => {
        if (prop.excludes) {
            prop.excludes.map(oper => {
                _.remove(options.operate[oper].columns, n => {
                    return n === name
                })
            })
            delete prop.excludes
        }
    })

    let self = this
    let schema = mongoose.Schema(struct)
    _.forIn(options.middle, (v, obs) => {
        if (!(obs in self.Middles)) { return }
        _.forIn(v, (func, stage) => {
            if (!(stage in self.Middles)) { return }
            switch (stage) {
                case 'before':
                    schema.pre(self.Middles[obs], function(next) {
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
        })
    })

    let model = mongoose.model(mdlName, schema)
    this.models[mdlName] = {
        model,
        name: mdlName,
        struct,
        options
    }
    return this.models[mdlName]
}

Mongo.prototype.select = function(mdlInf, condition, options) {
    if (!options) { options = {} }
    if (!condition) { condition = {} }
    if (condition._index) {
        condition._id = condition._index
        delete condition._index
    }

    return this.connect().then(() => {
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
            offset = condition.offset - 1
            delete condition.offset
        }
        let limit = null
        if (condition.limit) {
            limit = condition.limit
            delete condition.limit
        }
        let selCols = mdlInf.options.operate.select.columns.join(' ')
        if (options.selCols) { selCols = options.selCols.join(' ') }
        let res = mdlInf.model.find(condition, selCols)
        if (order_by) { res = res.sort(order_by) }
        if (offset) { res = res.skip(offset) }
        if (limit) { res = res.limit(limit) }
        if (options.ext) {
            _.forIn(this.getRefCollection(mdlInf.struct), (_, prop) => {
                res = res.populate(prop)
            })
        }
        return res.exec()
    }).catch(error => { return getErrContent(error) })
}

Mongo.prototype.save = function(mdlInf, values, condition, options) {
    if (!options) { options = {} }
    if (!options.updMode) { options.updMode = 'cover' }
    if (condition && condition._index) {
        condition._id = condition._index
        delete condition._index
    }

    return this.connect().then(() => {
        if (!condition) {
            return Promise.resolve()
        } else {
            return mdlInf.model.find(condition)
        }
    }).then(res => {
        if (!res || !res.length) {
            res = new mdlInf.model(values)
            res = [res.save()]
        } else {
            res = res.map(obj => {
                _.forIn(values, (v, k) => {
                    let propType = mdlInf.struct[k]
                    switch (options.updMode.toLowerCase()) {
                        case 'append':
                            if (propType instanceof String
                            || propType.name === 'Number') {
                                obj.set(k, obj.get(k) + v)
                            } else if (propType instanceof Array) {
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
                            } else if (propType instanceof Array) {
                                const array = obj.get(k)
                                array.splice(array.findIndex(el => el === v))
                                obj.set(k, array)
                            } else {
                                obj.set(k, null)
                            }
                            break
                        case 'cover':
                        default:
                            obj.set(k, v)
                    }
                })
                return obj.save()
            })
        }
        return Promise.all(res)
    }).catch(error => { return getErrContent(error) })
}

Mongo.prototype.del = function(mdlInf, condition, options) {
    if (!options) { options = {} }
    if (condition && condition._index) {
        condition._id = condition._index
        delete condition._index
    }

    return this.connect().then(() => {
        return mdlInf.model.deleteOne(condition)
    }).catch(error => { return getErrContent(error) })
}

Mongo.prototype.genPreRoutes = function() {
    for (const [mdlNam, mdlInf] of Object.entries(this.models)) {
        _.forIn(this.getRefCollection(mdlInf.struct), (colNam, prop) => {
            let prePath = []
            prePath.push(prop)
            prePath.push(`${mdlNam}/:${mdlNam}_id`)
            if (!this.models[colNam].options.router.prePath) {
                this.models[colNam].options.router.prePath = [prePath]
            } else {
                this.models[colNam].options.router.prePath.push(prePath)
            }
        })
    }
}

Mongo.prototype.sync = function(mdlInf) {
    return this.connect().then(() => new Promise((res, rej) => {
        mdlInf.model.deleteMany({}, err => {
            err ? rej(err) : res()
        })
    })).catch(error => getErrContent(error))
}

Mongo.prototype.dump = function(mdlInf, flPath) {
    const data = require(flPath).data
    return this.connect().then(() => {
            return Promise.all(data.map(record => (new mdlInf.model(record)).save()))
        })
        .then(() => Promise.resolve(data.length))
        .catch(error => getErrContent(error))
}

Mongo.prototype.count = function (mdlInf) {
    return this.connect().then(() => mdlInf.model.count())
}

export default Mongo
