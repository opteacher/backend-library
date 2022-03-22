import 'core-js/stable'
import 'regenerator-runtime/runtime'
import Path from 'path'
import { beforeAll, afterAll, expect } from '@jest/globals'
import { getDbByName } from '../databases/index.js'

const dbCfgPath = Path.resolve('tests', 'configs', 'db')

describe('# 数据库', function () {
  describe('# MongoDB', function () {

    let db = null
    let User = null
    let user = null
    beforeAll(() => (async function () {
      db = await getDbByName('mongo', dbCfgPath)
      User = db.defineModel({
        __modelName: 'user',
        username: db.PropTypes.String,
        password: db.PropTypes.String,
        age: db.PropTypes.Number,
        tags: db.PropTypes.Array,
        subItem: {
          name: db.PropTypes.String,
          thing: db.PropTypes.Any
        }
      }, {
        router: {
          methods: ['POST', 'DELETE', 'PUT', 'GET', 'ALL']
        }
      })
      await db.sync(User)

      // 新增一条用于修改的记录
      user = await db.save(User, {
        username: 'test',
        password: 'abcd'
      })
    })())

    test('# 增db.save()，数据库中应增加一条新纪录', async function () {
      const user = await db.save(User, {
        username: 'abcd',
        password: 'frfrfr',
        age: 12
      })
      // 新增的用户id不为空
      expect(user.id).not.toBe('')
    })

    test('# 删db.del()，上一步新增的记录将无法从数据库查询到', async function () {
      let result = await db.select(User, { username: 'abcd' })
      // 现存有数据
      expect(result.length).toBeGreaterThanOrEqual(1)
      const num = await db.del(User, { username: 'abcd' })
      // 有删除的记录
      expect(num).not.toBe(0)
      result = await db.select(User, { username: 'abcd' })
      // 删除之后的记录数为0
      expect(result).toHaveLength(0)
    })

    test('# 改db.save()，修改基本类型字段（字符串）', async function () {
      await db.saveOne(User, user.id, { password: 'iiii' })
      user = await db.select(User, { _index: user.id })
      // 修改之后记录数据刷新
      expect(user.password).toBe('iiii')
    })

    test('# 改db.save()，修改基本类型字段（数字）', async function () {
      await db.saveOne(User, user.id, { age: 23 })
      user = await db.select(User, { _index: user.id })
      // 修改之后记录数据刷新
      expect(user.age).toBe(23)
    })

    test('# 改db.save()，修改数组类型字段（元素）', async function () {
      await db.saveOne(User, user.id, { tags: 12 })
      user = await db.select(User, { _index: user.id })
      // 修改之后记录数据刷新
      expect(user.tags).toContain(12)
    })

    test('# 改db.save()，修改数组类型字段（数组）', async function () {
      await db.saveOne(User, user.id, { tags: ['hhhh', '7777'] })
      user = await db.select(User, { _index: user.id })
      // 修改之后记录数据刷新
      expect(user.tags).not.toContain(12)
      expect(user.tags).toContain('hhhh')
      expect(user.tags).toContain('7777')
    })

    test('# 改db.save()，追加数组类型字段（元素）', async function () {
      await db.saveOne(User, user.id, { tags: 100 }, { updMode: 'append' })
      user = await db.select(User, { _index: user.id })
      // 追加之后记录数据刷新
      expect(user.tags).toContain('hhhh')
      expect(user.tags).toContain('7777')
      expect(user.tags).toContain(100)
    })

    test('# 改db.save()，追加数组类型字段（数组）', async function () {
      await db.saveOne(User, user.id, { tags: ['3333', true] }, { updMode: 'append' })
      user = await db.select(User, { _index: user.id })
      // 修改之后记录数据刷新
      expect(user.tags).toContain('hhhh')
      expect(user.tags).toContain('7777')
      expect(user.tags).toContain(100)
      expect(user.tags).toContain('3333')
      expect(user.tags).toContain(true)
    })

    test('# 改db.save()，删除数组类型字段的元素', async function () {
      await db.saveOne(User, user.id, { tags: 'hhhh' }, { updMode: 'delete' })
      user = await db.select(User, { _index: user.id })
      // 删除之后记录数据刷新
      expect(user.tags).not.toContain('hhhh')
    })

    test('# 查db.select()，指定id', async function () {
      const selUsr = await db.select(User, { _index: user.id })
      expect(selUsr.username).toBe(user.username)
    })

    test('# 查db.select()，全查', async function () {
      const result = await db.select(User)
      expect(result.length).toBeGreaterThanOrEqual(1)
    })

    test('# 同步db.sync()，清空表', async function () {
      await db.sync(User)
      const result = await db.select(User)
      expect(result).toHaveLength(0)
    })

    afterAll(() => db.disconnect())
  })
})
