import fs from 'fs'
import path from 'path'
import Router from 'koa-router'
import { scanPath } from '../utils/index.js'

export async function genApiRoutes(routePath, ignores = []) {
    const router = new Router()
    console.log('API路由：')
    for (const file of scanPath(routePath, { ignores: ['.DS_Store'].concat(ignores) })) {
        const pthStat = path.parse(file)
        const preRoutePath = `/${pthStat.dir.replace(/\\/g, '/')}`
        const refIdx = (await import (path.resolve(routePath, file))).default
        const content = fs.readFileSync(path.resolve(routePath, file), 'utf8')
        for (let i = content.indexOf('router.'); i !== -1; i = content.indexOf('router.', i)) {
            i += 'router.'.length
            const bracket = content.indexOf('(', i)
            if (bracket === -1) {
                continue
            }
            const comma = content.indexOf(',', bracket)
            if (comma === -1) {
                continue
            }
            let subRoutePath = content.substring(bracket + 1, comma)
            subRoutePath = subRoutePath.substring(1, subRoutePath.length - 1)
            let routePath = ''
            if (subRoutePath !== '/') {
                routePath = preRoutePath + subRoutePath
            } else {
                routePath = preRoutePath
            }
            const method = content.substring(i, bracket).toLocaleUpperCase()
            console.log(`${method}\t${routePath}`)
        }
        router.use(preRoutePath, refIdx.routes(), refIdx.allowedMethods())
    }
    return Promise.resolve(router)
}
