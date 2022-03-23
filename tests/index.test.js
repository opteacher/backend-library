import 'core-js/stable'
import 'regenerator-runtime/runtime'
import { beforeAll, beforeEach, afterAll, expect } from '@jest/globals'
import Path from 'path'
import { getDbByName } from '../databases/index.js'

const dbCfgPath = Path.resolve('tests', 'configs', 'db')
const tstDatPath = Path.resolve('tests', 'resources')

describe('# 数据库', () => {
  describe('# MongoDB', () => {
    let db = null
    let User = null
    const record = {
      username: 'abcd',
      password: 'frfrfr',
      age: 12,
    }
    beforeAll(async () => {
      db = await getDbByName('mongo', dbCfgPath)

      User = db.defineModel(
        {
          __modelName: 'user',
          username: db.PropTypes.String,
          password: db.PropTypes.String,
          age: db.PropTypes.Number,
          tags: db.PropTypes.Array,
          subItem: {
            name: db.PropTypes.String,
            thing: db.PropTypes.Any,
          },
        },
        {
          router: {
            methods: ['POST', 'DELETE', 'PUT', 'GET', 'ALL'],
          },
        }
      )
    })

    describe('# 新增记录', () => {
      beforeEach(() => db.sync(User))

      test('# 增db.save()，数据库中应增加一条新纪录', async () => {
        // 新增的用户id不为空
        expect((await db.save(User, record)).id).not.toBe('')
      })
    })

    describe('# 删除记录', () => {
      let _index = ''
      const username = record.username
      beforeEach(async () => {
        await db.sync(User)
        _index = (await db.save(User, record)).id
      })

      test('# 删db.del()，按字段', async () => {
        let result = await db.select(User, { username })
        // 现存有数据
        expect(result.length).toBeGreaterThanOrEqual(1)
        const num = await db.del(User, { username })
        // 有删除的记录
        expect(num).not.toBe(0)
        result = await db.select(User, { username })
        // 删除之后的记录数为0
        expect(result).toHaveLength(0)
      })

      test('# 删db.del()，按ID', async () => {
        let result = await db.select(User, { _index })
        // 现存有数据
        expect(result).toBeDefined()
        const num = await db.del(User, { _index })
        // 有删除的记录
        expect(num).not.toBe(0)
        result = await db.select(User, { _index })
        // 删除之后的记录数为0
        expect(result).toBeNull()
      })
    })

    describe('# 修改记录', () => {
      let user = null
      beforeAll(async () => {
        await db.sync(User)
        user = await db.save(User, record)
      })

      test('# 改db.save()，修改基本类型字段（字符串）', async () => {
        await db.saveOne(User, user.id, { password: 'iiii' })
        user = await db.select(User, { _index: user.id })
        // 修改之后记录数据刷新
        expect(user.password).toBe('iiii')
      })

      test('# 改db.save()，修改基本类型字段（数字）', async () => {
        await db.saveOne(User, user.id, { age: 23 })
        user = await db.select(User, { _index: user.id })
        // 修改之后记录数据刷新
        expect(user.age).toBe(23)
      })

      test('# 改db.save()，修改数组类型字段（元素）', async () => {
        await db.saveOne(User, user.id, { tags: 12 })
        user = await db.select(User, { _index: user.id })
        // 修改之后记录数据刷新
        expect(user.tags).toContain(12)
      })

      test('# 改db.save()，修改数组类型字段（数组）', async () => {
        await db.saveOne(User, user.id, { tags: ['hhhh', '7777'] })
        user = await db.select(User, { _index: user.id })
        // 修改之后记录数据刷新
        expect(user.tags).not.toContain(12)
        expect(user.tags).toContain('hhhh')
        expect(user.tags).toContain('7777')
      })

      test('# 改db.save()，追加数组类型字段（元素）', async () => {
        await db.saveOne(User, user.id, { tags: 100 }, { updMode: 'append' })
        user = await db.select(User, { _index: user.id })
        // 追加之后记录数据刷新
        expect(user.tags).toContain('hhhh')
        expect(user.tags).toContain('7777')
        expect(user.tags).toContain(100)
      })

      test('# 改db.save()，追加数组类型字段（数组）', async () => {
        await db.saveOne(
          User,
          user.id,
          { tags: ['3333', true] },
          { updMode: 'append' }
        )
        user = await db.select(User, { _index: user.id })
        // 修改之后记录数据刷新
        expect(user.tags).toContain('hhhh')
        expect(user.tags).toContain('7777')
        expect(user.tags).toContain(100)
        expect(user.tags).toContain('3333')
        expect(user.tags).toContain(true)
      })

      test('# 改db.save()，删除数组类型字段的元素', async () => {
        await db.saveOne(User, user.id, { tags: 'hhhh' }, { updMode: 'delete' })
        user = await db.select(User, { _index: user.id })
        // 删除之后记录数据刷新
        expect(user.tags).not.toContain('hhhh')
      })
    })

    describe('# 导入功能', () => {
      beforeAll(() => db.sync(User))

      test('# 导入六条记录', async () => {
        await db.dump(User, Path.join(tstDatPath, 'records.json'))
        expect(await db.select(User)).toHaveLength(6)
      })
    })

    describe('# 查询记录', () => {
      let user = null
      beforeAll(async () => {
        await db.sync(User)
        await db.dump(User, Path.join(tstDatPath, 'records.json'))
        user = (await db.select(User, { limit: 1 }))[0]
      })

      test('# 查db.select()，指定id', async () => {
        expect((await db.select(User, { _index: user.id })).username).toBe(
          user.username
        )
      })

      test('# 查db.select()，全查', async () => {
        expect((await db.select(User)).length).toBeGreaterThanOrEqual(1)
      })

      test('# 查db.select()，排序', async () => {
        (await db.select(User, { order_by: { age: -1 } })).reduce((prev, curr) => {
          expect(prev.age).toBeGreaterThanOrEqual(curr.age)
          return curr
        })
      })

      test('# 查db.select()，偏移量', async () => {
        expect(await db.select(User, { offset: 2 })).toHaveLength(4)
      })

      test('# 查db.select()，查询量', async () => {
        expect(await db.select(User, { limit: 2 })).toHaveLength(2)
      })
    })

    describe('# 同步（重构清空表）', () => {
      beforeAll(async () => {
        // 插入一条数据用于测试
        await db.save(User, { username: 'uuuuu' })
      })

      test('# 同步db.sync()，清空表', async () => {
        expect(await db.select(User)).not.toHaveLength(0)
        await db.sync(User)
        expect(await db.select(User)).toHaveLength(0)
      })
    })

    afterAll(() => db.disconnect())
  })
})
