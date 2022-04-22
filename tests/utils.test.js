import 'core-js/stable'
import 'regenerator-runtime/runtime'
import { beforeAll, beforeEach, afterAll, expect, test } from '@jest/globals'
import Path from 'path'
import { access } from 'fs/promises'
import { accessSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import {
  scanPath,
  copyDir,
  fixStartsWith,
  fixEndsWith,
  rmvStartsOf,
  rmvEndsOf,
  getErrContent,
  pickProp,
} from '../utils/index.js'

describe('# 工具包', () => {
  describe('# scanPath', () => {
    test('# 无参数扫描', () => {
      for (const flPath of scanPath(Path.resolve('tests'))) {
        expect(() => access(Path.resolve('tests', flPath))).not.toThrowError()
      }
    })

    test('# 带ignores参数', () => {
      scanPath(Path.resolve('tests'), { ignores: ['db.dev.toml'] }).map(
        (file) => expect(file).not.toContain('db.dev.toml')
      )
    })

    test('# 限制后缀', () => {
      scanPath(Path.resolve('tests'), { ext: 'toml' }).map((file) =>
        expect(() => file.endsWith('.toml')).toBeTruthy()
      )
    })
  })

  describe('# copyDir', () => {
    const destPath = Path.resolve('tests', 'dest', 'configs')

    beforeAll(() => {
      try {
        accessSync(destPath)
        rmSync(destPath, { recursive: true })
      } catch (e) {}
    })

    test('# 目标目录不存在', () => {
      copyDir(Path.resolve('tests', 'configs'), destPath)
      expect(() => accessSync(Path.join(destPath, 'db.dev.toml'))).not.toThrow()
    })

    describe('# 先在configs中创建临时文件/夹', () => {
      const tempPath = Path.resolve('tests', 'configs', 'temp')

      beforeAll(() => {
        mkdirSync(tempPath, { recursive: true })
        writeFileSync(Path.join(tempPath, 'abcd'), '1234')
      })

      test('# 目标目录存在', () => {
        copyDir(Path.resolve('tests', 'configs'), destPath)
        expect(() =>
          accessSync(Path.join(destPath, 'temp', 'abcd'))
        ).not.toThrow()
      })

      afterAll(() => {
        rmSync(tempPath, { recursive: true })
      })
    })

    describe('# 先删除dest目录', () => {
      beforeAll(() => {
        rmSync(destPath, { recursive: true })
      })

      test('# 带ignores参数', () => {
        copyDir(Path.resolve('tests', 'configs'), destPath, {
          ignores: ['db.dev.toml'],
        })
        expect(() => accessSync(Path.join(destPath, 'db.dev.toml'))).toThrow()
      })
    })

    afterAll(() => {
      rmSync(Path.resolve('tests', 'dest'), { recursive: true })
    })
  })

  describe('# fixStartsWith', () => {
    test('# 无前缀', () => {
      const a = fixStartsWith('abcd', '1234')
      expect(() => a.startsWith('1234')).toBeTruthy()
    })

    test('# 已带前缀', () => {
      expect(fixStartsWith('123tttt', '123')).toEqual('123tttt')
    })
  })

  describe('# fixEndsWith', () => {
    test('# 无后缀', () => {
      expect(fixEndsWith('abcd', '1234')).toEqual('abcd1234')
    })

    test('# 已带后缀', () => {
      expect(fixEndsWith('tttt123', '123')).toEqual('tttt123')
    })
  })

  describe('# rmvStartsOf', () => {
    test('# 有前缀', () => {
      expect(rmvStartsOf('1234abcd', '1234')).toEqual('abcd')
    })

    test('# 无前缀', () => {
      expect(rmvStartsOf('abcd', '123')).toEqual('abcd')
    })
  })

  describe('# rmvEndsOf', () => {
    test('# 有前缀', () => {
      expect(rmvEndsOf('abcd1234', '1234')).toEqual('abcd')
    })

    test('# 无前缀', () => {
      expect(rmvEndsOf('abcd', '123')).toEqual('abcd')
    })
  })

  describe('# getErrContent', () => {
    test('# 字符串', () => {
      expect(getErrContent('abcd')).toEqual('abcd')
    })

    test('# 带message分量', () => {
      expect(getErrContent({ message: 'abcd' })).toEqual('abcd')
    })

    test('# 带content分量', () => {
      expect(getErrContent({ content: 'abcd' })).toEqual('abcd')
    })
  })

  describe('# pickProp', () => {
    const tstObj = {
      num: 123,
      ary: ['2', 45, 'tttt'],
      objAry: [
        { name: 'a', age: 12 },
        { name: 'b', age: 55 },
      ],
      obj: {
        tt: 'wrewrw',
        gg: [123, 213.4, 55],
        sub: {
          str: '456456',
        },
      },
    }

    test('# 访问直接分量', () => {
      expect(pickProp(tstObj, 'num')).toEqual(123)
    })

    test('# 访问数组元素', () => {
      expect(pickProp(tstObj, 'ary[1]')).toEqual(45)
    })

    test('# 访问数组元素（错误：无字段）', () => {
      expect(() => pickProp(tstObj, '[1]')).toThrowError()
    })

    test('# 访问数组元素（错误：下标非数字）', () => {
      expect(() => pickProp(tstObj, 'ary[h]')).toThrowError()
    })

    test('# 访问多层字段', () => {
      expect(pickProp(tstObj, 'obj.sub.str')).toEqual('456456')
    })

    test('# 访问多层对象数组元素', () => {
      expect(() => {
        expect(pickProp(tstObj, 'objAry[{name:a}]')).toHaveProperty('age', 12)
      }).not.toThrowError()
    })
  })
})
