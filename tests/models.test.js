import 'core-js/stable'
import 'regenerator-runtime/runtime'
import { beforeAll, afterAll, expect } from '@jest/globals'
import Path from 'path'
import startApp from './app'
import supertest from 'supertest'
import { getDbByName } from '../databases'

const cfgPath = Path.resolve('tests', 'configs', 'db')

describe('# 模型路由', () => {
  let db = null
  let request = null
  beforeAll(async () => {
    db = await getDbByName('mongo', cfgPath)
    request = supertest((await startApp(db)).callback())
  })

  test('# 正常开启增删改查路由', async () => {
    const resp = await request.get('/backend-library/mdl/v1')
    expect(resp).toHaveProperty('status', 200)
    expect(resp.body).not.toBeUndefined()
  })
})
