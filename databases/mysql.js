import _ from "lodash"
import Sequelize from "sequelize"
const Op = Sequelize.Op
import { getErrContent } from "../utils/index.js"

// @block{Mongo}:mongodb的实例类
// @role:数据库操作类
// @includes:lodash
// @includes:mongoose
// @includes:../config/db.mongo
// @includes:../utils/error
// @type:class
// @description:常量：
//  * *Types*[`object`]：可用列类型
class Mysql {
    constructor(config) {
        this.config = config
        this.models = {}
        this.Types = {
            Id: Sequelize.UUID,
            String: Sequelize.STRING,
            Number: Sequelize.INTEGER,
            Date: Sequelize.DATE,
            Boolean: Sequelize.BOOLEAN,
            Decimal: Sequelize.DECIMAL(64, 20)
        }
        this.Middles = {
            select: "",
            create: "create",
            update: "update",
            save: "save",
            delete: "destroy",
            valid: "validation",
            before: "before",
            after: "after"
        }
    }

    _getRefCollection(struct) {
        let ret = {}
        _.forIn(struct, (v, k) => {
            let val = v
            if (val instanceof Array) {
                val = val[0]
            }
            if (val.ref) { ret[k] = val.ref }
        })
        return ret
    }

    // @block{connect}:数据库连接方法
    // @description:连接后方可操作数据库
    // @type:function (prototype)
    // @return{conn}[Promise]:连接Promise
    connect() {
        return new Sequelize(
            this.config.database,
            this.config.username,
            this.config.password, {
                host: this.config.host,
                dialect: 'mysql',

                pool: {
                    max: 5,
                    min: 0,
                    acquire: 30000,
                    idle: 10000
                }
            })
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
    defineModel(struct, options) {
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
        setOperate("select")
        setOperate("update")
        setOperate("create")
        setOperate("delete")
        _.forIn(struct, (prop, name) => {
            if (prop.excludes) {
                prop.excludes.map(oper => {
                    _.remove(options.operate[oper].columns, n => n === name)
                })
                delete prop.excludes
            }
        })

        let self = this
        let middle = { hooks: {} }
        _.forIn(options.middle, (v, obs) => {
            if (!(obs in self.Middles)) { return }
            _.forIn(v, (func, stage) => {
                if (!(stage in self.Middles)) { return }
                if (stage === "doing") {
                    console.error("mongoose不支持doing中间件")
                    return
                }
                middle.hooks[`${stage}${_.upperFirst(obs)}`] = func
            })
        })

        const model = this.connect().define(mdlName, struct, middle)
        this.models[mdlName] = {
            model,
            name: mdlName,
            struct,
            options
        }
        return this.models[mdlName]
    }

    select(mdlInf, condition, options) {
        if (!options) { options = {} }

        let conds = {}
        if (_.keys(condition).length !== 0) {
            if (condition.id && typeof condition.id === "string") {
                condition.id = parseInt(condition.id)
            }
            conds["where"] = condition
            if (condition.order_by) {
                conds.order = conds.order_by
                delete conds.order_by
                delete conds.where.order_by
            }
            if (condition.limit) {
                delete conds.where.limit
            }

            // 条件选择，目前只支持一个属性一个条件
            for (let key in conds.where) {
                let val = conds.where[key]
                if (val instanceof Array) {
                    switch (val[0]) {
                        case "<":
                            conds.where[key] = {
                                [Op.lt]: val[1]
                            }
                            break
                        case ">":
                            conds.where[key] = {
                                [Op.gt]: val[1]
                            }
                            break
                        case "<=":
                            conds.where[key] = {
                                [Op.lte]: val[1]
                            }
                            break
                        case ">=":
                            conds.where[key] = {
                                [Op.gte]: val[1]
                            }
                            break
                        case "==":
                            conds.where[key] = {
                                [Op.eq]: val[1]
                            }
                            break
                        case "!=":
                            conds.where[key] = {
                                [Op.ne]: val[1]
                            }
                            break
                        case "in":
                            conds.where[key] = {
                                [Op.in]: val[1]
                            }
                            break
                    }
                }
            }
        }
        if (options.selCols) {
            conds["attributes"] = options.selCols
        }
        if (options.rawQuery) {
            conds.raw = options.rawQuery
        }
        return mdlInf.model.findAll(conds).catch(err => getErrContent(err))
    }

    exec(sql, params, options) {
        const type = (options && options.type) || Sequelize.QueryTypes.SELECT
        return this.connect().query(sql, { replacements: params }, type)
    }

    async save(mdlInf, values, condition, options) {
        if (!options) { options = {} }
        if (!options.updMode) { options.updMode = "cover" }
        options.updMode = options.updMode.toLowerCase()

        if (condition) {
            let result = await this.select(mdlInf.model, condition, null)
            return Promise.all(result.map(entity => {
                for (let key in values) {
                    let value = values[key]
                    if (options.updMode === "append") {
                        let propType = this.models[mdlInf.name].struct[key]
                        if (propType instanceof String) {
                            entity[key] += value
                        } else if (propType instanceof Array) {
                            // https://github.com/Automattic/mongoose/issues/4455
                            entity[key] = entity[key].concat([value])
                        } else if (propType instanceof Number) {
                            entity[key] += value
                        } else {
                            entity[key] = value
                        }
                    } else {
                        entity[key] = value
                    }
                }
                return entity.save().then(result => Promise.resolve(result.toJSON()))
            })).catch(err => getErrContent(err))
        } else {
            return mdlInf.model.build(values).save()
                .then(result => Promise.resolve(result.toJSON()))
                .catch(err => getErrContent(err))
        }
    }

    del(mdlInf, condition, _options) {
        if (condition.id) {
            condition.id = parseInt(condition.id)
        }
        return mdlInf.model.destroy({ where: condition }).catch(err => getErrContent(err))
    }

    genPreRoutes() {
        for (const [mdlNam, mdlInf] of Object.entries(this.models)) {
            _.forIn(this._getRefCollection(mdlInf.struct), (colNam, prop) => {
                colNam = _.upperFirst(colNam)
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

    sync(mdlInf) {
        return mdlInf.model.sync({ force: true })
    }

    count (mdlInf) {
        return mdlInf.model.count()
    }
}

export default Mysql
