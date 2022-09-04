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
      process.env['db_database'] = 'server-package'
      process.env['db_username'] = 'root'
      process.env['db_password'] = '12345'
      process.env['db_host'] = 'localhost'
      process.env['db_port'] = 3000
    })
    test('# 1', async () => {
      const db = await getDbByName(
        'mongo',
        Path.resolve('tests', 'configs', 'db')
      )
      expect(db).toHaveProperty('config')
      expect(db.config).toHaveProperty('database', 'server-package')
    })
  })
})
