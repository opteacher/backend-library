import 'core-js/stable'
import 'regenerator-runtime/runtime'
import { beforeAll, beforeEach, afterAll, expect } from '@jest/globals'
import Path from 'path'
import { getDbByName } from '../databases'
import { buildCfgFromPcs } from '../utils'

describe('# getDbByName', () => {
  describe('# 从配置文件读取', () => {
    beforeAll(() => {
      process.env.NODE_ENV = 'dev'
    })

    test('# 1', async () => {
      const db = await getDbByName(
        'mongo',
        Path.resolve('tests', 'configs', 'db')
      )
      expect(db).toHaveProperty('config')
      expect(db.config).toHaveProperty('database', 'test')
    })
  })

  describe('# 用配置对象获取', () => {
    beforeAll(() => {
      process.env['db.database'] = 'test'
      process.env['db.username'] = 'root'
      process.env['db.password'] = '12345'
      process.env['db.host'] = 'localhost'
      process.env['db.port'] = 3000
    })
    test('# 1', async () => {
      const config = buildCfgFromPcs(
        ['database', 'username', 'password', 'host', 'port'],
        'db'
      )
      const db = await getDbByName('mongo', config)
      expect(db).toHaveProperty('config')
      expect(db.config).toHaveProperty('database', 'test')
    })
  })
})
