import 'core-js/stable'
import 'regenerator-runtime/runtime'
import { beforeAll, beforeEach, afterAll, expect, test } from '@jest/globals'
import Path from 'path'
import { access } from 'fs/promises'
import { scanPath } from '../utils/index.js'

describe('# 工具包', () => {
  describe('# scanPath', () => {
    test('# 无参数扫描', () => {
      for (const flPath of scanPath(Path.resolve('tests'))) {
        expect(() => access(Path.resolve('tests', flPath))).not.toThrowError()
      }
    })

    test('# 带ignores参数', () => {
      console.log(scanPath(Path.resolve('tests'), { ignores: ['db.dev.toml'] }))
    })
  })
})
