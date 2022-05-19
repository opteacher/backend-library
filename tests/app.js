import Path from 'path'
import Koa from 'koa'
import koaBody from 'koa-body'
import json from 'koa-json'
import logger from 'koa-logger'
import cors from 'koa2-cors'

import { genApiRoutes } from '../router'
import { genMdlRoutes } from '../models'

export default async function (db) {
  const router = await genApiRoutes(Path.resolve('tests', 'routes'))
  const models = await genMdlRoutes(
    Path.resolve('tests', 'models'),
    Path.resolve('tests', 'configs', 'models'),
    db
  )

  const app = new Koa()

  // 日志输出
  app.use(logger())
  // 跨域配置
  app.use(cors())
  // 上传配置
  app.use(
    koaBody({
      multipart: true,
      formidable: {
        maxFileSize: 200 * 1024 * 1024, // 设置上传文件大小最大限制，默认2M
      },
      jsonLimit: '100mb',
      onError: function (err, ctx) {
        ctx.throw(400, `Error happened! ${err}`)
      },
    })
  )
  // json解析
  app.use(json())
  // 模型路由
  app.use(models.router.routes()).use(models.router.allowedMethods())
  // 路径分配
  app.use(router.routes()).use(router.allowedMethods())

  app.listen(4000, undefined, () => {
    console.log(`服务已部署，占用端口：${4000}`)
  })

  return app
}
