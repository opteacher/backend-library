/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import _ from 'lodash'
import Router from 'koa-router'
import Path from 'path'
import * as utils from '../utils/index.js'

const router = new Router()

export async function genMdlRoutes(db, mdlsPath, mdlCfgPath) {
  const cfg = utils.readConfig(mdlCfgPath)

  // @block{modelRoutes}:模型生成路由
  // @includes:lodash
  // @includes:koa-router
  // @includes:../db/数据库类型
  // @includes:../config/model.json

  // @steps{1}:引进所有模型
  const models = []
  const pathPfx = process.platform === 'win32' ? 'file://' : ''
  for (const mfile of utils.scanPath(mdlsPath, { ignores: ['index.js'] })) {
    const model = (await import(pathPfx + Path.resolve(mdlsPath, mfile))).default
    models.push(typeof model === 'function' ? model(db) : model)
  }

  // @step{}:同步数据库
  const syncFunc = async () => {
    if (cfg.sync && Array.isArray(cfg.sync)) {
      await Promise.all(
        cfg.sync.map((tname) =>
          db.sync(models.find((model) => model.name === tname))
        )
      )
      console.log('数据库模型同步完毕')
    } else if (cfg.sync) {
      await Promise.all(_.values(models).map((minfo) => db.sync(minfo)))
      console.log('数据库模型同步完毕')
    }
    if (cfg.inits) {
      for (const [mname, initFile] of Object.entries(cfg.inits)) {
        const numIpt = await db.dump(
          models.find((model) => model.name === mname),
          Path.resolve(initFile)
        )
        console.log(
          `从${initFile}文件内读取并导入了${numIpt}条记录到表${mname}中`
        )
      }
    }
  }
  await syncFunc()

  // @steps{3}:遍历所有模型
  console.log('模型生成的路由：')
  const mdlRoutes = []
  for (const minfo of models) {
    // @steps{3_2}:定义所有用到的URL
    const GetUrl = `/${cfg.prefix}/mdl/v${cfg.version}/${minfo.name}/:index`
    const AllUrl = `/${cfg.prefix}/mdl/v${cfg.version}/${minfo.name}s`
    const PostUrl = `/${cfg.prefix}/mdl/v${cfg.version}/${minfo.name}`
    const PutUrl = GetUrl
    const DelUrl = GetUrl

    // @steps{3_3}:遍历用户要求的method接口
    for (const method of minfo.options.router.methods) {
      // @steps{3_3_2}:根据method跳转到相应的处理逻辑中
      let path = ''
      let params = []
      switch (method.toLowerCase()) {
        case 'get':
          // @steps{3_3_2_1}:*GET*：根据id查找，**会联表**
          router.get(GetUrl, async (ctx) => {
            const data = await db.select(
              minfo,
              { _index: ctx.params.index },
              { ext: true }
            )
            if (typeof data === 'string') {
              ctx.body = {
                error: data,
              }
            } else {
              ctx.body = {
                data: data,
              }
            }
          })
          path = GetUrl
          console.log(`GET\t${GetUrl}`)
          break
        case 'all':
          // @steps{3_3_2_2}:*ALL*：查所有，**不会联表**
          router.get(AllUrl, async (ctx) => {
            ctx.body = {
              data: await db.select(minfo, ctx.query),
            }
          })
          path = AllUrl
          params.push(
            { order_by: 'Prop Name' },
            { limit: 'Number' },
            { page: 'Number' }
          )
          console.log(`GET\t${AllUrl}`)
          break
        case 'post':
          // @steps{3_3_2_3}:*POST*：**使用form表单提交**
          router.post(PostUrl, async (ctx) => {
            ctx.body = {
              data: await db.save(minfo, ctx.request.body),
            }
          })
          console.log(`POST\t${PostUrl}`)
          break
        case 'put':
          // @steps{3_3_2_4}:*PUT*：同POST
          router.put(PutUrl, async (ctx) => {
            const data = await db.saveOne(
              minfo,
              ctx.params.index,
              ctx.request.body
            )
            if (typeof data === 'string') {
              ctx.body = {
                error: data,
              }
            } else {
              ctx.body = {
                data,
              }
            }
          })
          path = PutUrl
          params.push({
            need_update_prop: 'value',
          })
          console.log(`PUT\t${PutUrl}`)
          break
        case 'delete':
          // @steps{3_3_2_5}:*DELETE*：同GET
          router.delete(DelUrl, async (ctx) => {
            ctx.body = {
              data: await db.del(minfo, {
                _index: ctx.params.index,
              }),
            }
          })
          path = DelUrl
          console.log(`DELETE\t${DelUrl}`)
          break
        case 'link':
          // @steps{3_3_2_6}:*LINK*：将对象关联到指定目标对象中（**对象已经被创建**）
          //             ```
          //             /mdl/vx/target/:tid/source/:sid
          //             // 意味着source[sid]关联到target[tid]
          //             ```
          for (const [prop, value] of Object.entries(minfo.struct)) {
            let val = value
            if (value instanceof Array) {
              val = value[0]
            }
            if (!val.ref) {
              continue
            }
            const LnkUrl = `/${cfg.prefix}/mdl/v${cfg.version}/${minfo.name}/:parent_idx/${prop}/:child_idx`
            router.put(LnkUrl, async (ctx) => {
              // 对于数组外键，不可重复绑定
              if (value instanceof Array) {
                const data = await db.select(minfo, {
                  _index: ctx.params.parent_idx,
                })
                if (data[prop].includes(ctx.params.child_idx)) {
                  ctx.body = { data }
                  return
                }
              }
              ctx.body = {
                data: await db.saveOne(
                  minfo,
                  ctx.params.parent_idx,
                  { [prop]: ctx.params.child_idx },
                  { updMode: 'append' }
                ),
              }
            })
            mdlRoutes.push({
              path: LnkUrl,
              method: 'PUT',
              params: [],
            })
            console.log(`PUT\t${LnkUrl}`)
            router.delete(LnkUrl, async (ctx) => {
              ctx.body = {
                data: await db.saveOne(
                  minfo,
                  ctx.params.parent_idx,
                  { [prop]: ctx.params.child_idx },
                  { updMode: 'delete' }
                ),
              }
            })
            mdlRoutes.push({
              path: LnkUrl,
              method: 'DELETE',
              params: [],
            })
            console.log(`DELETE\t${LnkUrl}`)
            const ClrUrl = `/${cfg.prefix}/mdl/v${cfg.version}/${minfo.name}/:parent_idx/${prop}`
            router.delete(ClrUrl, async (ctx) => {
              ctx.body = {
                data: await db.save(
                  minfo,
                  ctx.params.parent_idx,
                  { [prop]: value instanceof Array ? [] : '' },
                  { updMode: 'cover' }
                ),
              }
            })
            mdlRoutes.push({
              path: ClrUrl,
              method: 'DELETE',
              params: [],
            })
            console.log(`DELETE\t${ClrUrl}`)
          }
          continue
      }
      mdlRoutes.push({
        path,
        method,
        params,
      })
    }
  }
  router.get(`/${cfg.prefix}/mdl/v${cfg.version}`, async (ctx) => {
    ctx.body = { version: cfg.version, routes: mdlRoutes }
  })
  console.log(`GET\t/${cfg.prefix}/mdl/v${cfg.version}`)
  return { router, models, db }
}
