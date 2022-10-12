import 'core-js/stable'
import 'regenerator-runtime/runtime'
import { beforeAll, beforeEach, afterAll, expect } from '@jest/globals'
import Path from 'path'
import { getDbByName } from '../databases'

const dataFile = Path.resolve('tests', 'resources', 'records.sql')

describe('# MySQL', () => {
  let mySqlDB = null
  let User = null
  let Organ = null
  const record = {
    username: 'abcd',
    password: 'frfrfr',
    age: 12,
    subObj: {
      asdasd: 'asfsdf',
      dfsff: 24234,
      sdgsdgsdg: false,
      asdwad: ['sdfsdf', 234],
      dsfsdf: { dsfsdf: 'dsfsdf' },
    },
  }
  beforeAll(async () => {
    mySqlDB = await getDbByName('mysql', Path.resolve('tests', 'configs', 'db'))
    User = mySqlDB.defineModel(
      'user',
      {
        username: mySqlDB.PropTypes.String,
        password: mySqlDB.PropTypes.String,
        age: mySqlDB.PropTypes.Number,
        tags: mySqlDB.PropTypes.Array,
        subObj: mySqlDB.PropTypes.Object,
      },
      {
        router: {
          methods: ['POST', 'DELETE', 'PUT', 'GET'],
        },
        middle: {
          unknown: () => {
            console.error('测试未知中间件')
          },
          create: {
            unknown: () => {
              console.error('测试未知过程')
            },
            before: () => {},
            doing: () => {},
            after: () => {},
          },
        },
      }
    )
    Organ = mySqlDB.defineModel('organ', {
      name: mySqlDB.PropTypes.String,
      users: [{ type: mySqlDB.PropTypes.Id, ref: 'user' }],
    })
    await mySqlDB.sync(User)
    await mySqlDB.sync(Organ)
  })

  describe('# 新增记录', () => {
    beforeAll(async () => {
      await mySqlDB.sync(User)
    })

    test('# 增db.save()，数据库中应增加一条新纪录', async () => {
      // 新增的用户id不为空
      const result = await mySqlDB.save(User, record)
      const user = await mySqlDB.select(User, { _index: result.id })
      expect(user.id).not.toBe('')
    })
  })

  describe('# 删除记录', () => {
    let _index = ''
    const username = record.username
    beforeEach(async () => {
      await mySqlDB.sync(User)
      _index = (await mySqlDB.save(User, record)).id
    })

    test('# 删db.remove()，按字段', async () => {
      let result = await mySqlDB.select(User, { username })
      // 现存有数据
      expect(result.length).toBeGreaterThanOrEqual(1)
      const num = await mySqlDB.remove(User, { username })
      // 有删除的记录
      expect(num).not.toBe(0)
      result = await mySqlDB.select(User, { username })
      // 删除之后的记录数为0
      expect(result).toHaveLength(0)
    })

    test('# 删db.remove()，按ID', async () => {
      let result = await mySqlDB.select(User, { _index })
      // 现存有数据
      expect(result).toBeDefined()
      const num = await mySqlDB.remove(User, { _index })
      // 有删除的记录
      expect(num).not.toBe(0)
      result = await mySqlDB.select(User, { _index })
      // 删除之后的记录数为0
      expect(result).toBeNull()
    })
  })

  describe('# 修改记录', () => {
    let userID = ''
    beforeAll(async () => {
      await mySqlDB.sync(User)
      await mySqlDB.dump(User, dataFile)
      const user = await mySqlDB.save(User, record)
      userID = user.id
    })

    test('# 改db.save()，修改基本类型字段（字符串）', async () => {
      await mySqlDB.saveOne(User, userID, { password: 'iiii' })
      expect(await mySqlDB.select(User, { _index: userID })).toHaveProperty(
        'password',
        'iiii'
      )
    })

    test('# 改db.save()，修改基本类型字段，用save函数', async () => {
      await mySqlDB.save(User, { password: 'yyyy' }, { _index: userID })
      expect(await mySqlDB.select(User, { _index: userID })).toHaveProperty(
        'password',
        'yyyy'
      )
    })

    test('# 改db.save()，修改基本类型字段（数字）', async () => {
      await mySqlDB.saveOne(User, userID, { age: 23 })
      expect(await mySqlDB.select(User, { _index: userID })).toHaveProperty(
        'age',
        23
      )
    })

    test('# 改db.save()，修改数组类型字段（元素）', async () => {
      await mySqlDB.saveOne(User, userID, { tags: [12] })
      const user = await mySqlDB.select(User, { _index: userID })
      expect(user.tags).toContain(12)
    })

    test('# 改db.save()，修改数组类型字段（数组）', async () => {
      await mySqlDB.saveOne(User, userID, { tags: ['hhhh', '7777'] })
      const user = await mySqlDB.select(User, { _index: userID })
      // 修改之后记录数据刷新
      expect(user.tags).not.toContain(12)
      expect(user.tags).toContain('hhhh')
      expect(user.tags).toContain('7777')
    })

    test('# 改db.save()，追加数组类型字段（元素）', async () => {
      await mySqlDB.saveOne(User, userID, { tags: 100 }, { updMode: 'append' })
      const user = await mySqlDB.select(User, { _index: userID })
      // 追加之后记录数据刷新
      expect(user.tags).toContain('hhhh')
      expect(user.tags).toContain('7777')
      expect(user.tags).toContain(100)
    })

    test('# 改db.save()，追加数组类型字段（数组）', async () => {
      await mySqlDB.saveOne(
        User,
        userID,
        { tags: ['3333', true] },
        { updMode: 'append' }
      )
      const user = await mySqlDB.select(User, { _index: userID })
      // 修改之后记录数据刷新
      expect(user.tags).toContain('hhhh')
      expect(user.tags).toContain('7777')
      expect(user.tags).toContain(100)
      expect(user.tags).toContain('3333')
      expect(user.tags).toContain(true)
    })

    test('# 改db.save()，删除数组类型字段的元素（用值）', async () => {
      await mySqlDB.saveOne(
        User,
        userID,
        { tags: 'hhhh' },
        { updMode: 'delete' }
      )
      const user = await mySqlDB.select(User, { _index: userID })
      // 删除之后记录数据刷新
      expect(user.tags).not.toContain('hhhh')
    })

    test('# 改db.save()，删除数组类型字段的元素（用索引）', async () => {
      let user = await mySqlDB.select(User, { _index: userID })
      const fstEle = user.tags[0]
      await mySqlDB.saveOne(
        User,
        userID,
        { 'tags[0]': null },
        { updMode: 'delete' }
      )
      user = await mySqlDB.select(User, { _index: userID })
      // 删除之后记录数据刷新
      expect(user.tags[0]).not.toEqual(fstEle)
    })

    describe('# 改db.save()，操作对象类型字段', () => {
      test('# 增加对象类型的字段', async () => {
        let user = await mySqlDB.select(User, { _index: userID })
        expect(user.subObj).not.toHaveProperty('test')
        await mySqlDB.saveOne(User, userID, {
          subObj: Object.assign(user.subObj, { test: 1234 }),
        })
        user = await mySqlDB.select(User, { _index: userID })
        expect(user.subObj).toHaveProperty('test', 1234)
      })

      test('# 修改对象类型的字段（普通类型）', async () => {
        let user = await mySqlDB.select(User, { _index: userID })
        expect(user.subObj.dfsff).toBe(24234)
        await mySqlDB.saveOne(User, userID, {
          'subObj.dfsff': 12345,
        })
        user = await mySqlDB.select(User, { _index: userID })
        expect(user.subObj.dfsff).toBe(12345)
      })

      test('# 修改对象类型的字段（数组类型）', async () => {
        let user = await mySqlDB.select(User, { _index: userID })
        expect(user.subObj.asdwad[0]).toBe('sdfsdf')
        await mySqlDB.saveOne(User, userID, {
          'subObj.asdwad[0]': 'abcd',
        })
        user = await mySqlDB.select(User, { _index: userID })
        expect(user.subObj.asdwad[0]).toBe('abcd')
      })

      test('# 修改对象类型的字段（对象类型）', async () => {
        let user = await mySqlDB.select(User, { _index: userID })
        expect(user.subObj.dsfsdf.dsfsdf).toBe('dsfsdf')
        await mySqlDB.saveOne(User, userID, {
          'subObj.dsfsdf.dsfsdf': 'abcdef',
        })
        user = await mySqlDB.select(User, { _index: userID })
        expect(user.subObj.dsfsdf.dsfsdf).toBe('abcdef')
      })

      test('# 删除对象类型的字段', async () => {
        let user = await mySqlDB.select(User, { _index: userID })
        expect(user.subObj).toHaveProperty('dsfsdf')
        await mySqlDB.saveOne(User, userID, {
          'subObj.dsfsdf': null,
        }, { updMode: 'delete' })
        user = await mySqlDB.select(User, { _index: userID })
        expect(user.subObj).not.toHaveProperty('dsfsdf')
      })
    })

    describe('# 改db.save()，修改多记录', () => {
      beforeAll(async () => {
        await mySqlDB.sync(User)
        await mySqlDB.dump(User, dataFile)
      })

      test('# 数据清除后再修改', async () => {
        await mySqlDB.save(User, { age: 50 }, { password: 'frfrfr' })

        const users = await mySqlDB.select(User, { password: 'frfrfr' })
        users.map((user) => expect(user).toHaveProperty('age', 50))
      })
    })
  })

  describe('# 查询记录', () => {
    let user = null

    beforeAll(async () => {
      await mySqlDB.sync(User)
      await mySqlDB.dump(User, dataFile)
      user = (await mySqlDB.select(User, { limit: 1 }))[0]
    })

    test('# 查db.select()，指定id', async () => {
      expect(await mySqlDB.select(User, { _index: user.id })).toHaveProperty(
        'username',
        user.username
      )
    })

    describe('# 查db.select()，全查', () => {
      test('# 全查', async () => {
        expect((await mySqlDB.select(User)).length).toBeGreaterThanOrEqual(1)
      })

      test('# 模糊查询', async () => {
        expect(await mySqlDB.select(User, { password: ['like', 'fr%'] })).toHaveProperty('length', 3)
      })
    })

    test('# 查db.select()，排序', async () => {
      const users = await mySqlDB.select(User, { order_by: { age: 'DESC' } })
      users.reduce((prev, curr) => {
        expect(prev.age).toBeGreaterThanOrEqual(curr.age)
        return curr
      })
    })

    test('# 查db.select()，指定列', async () => {
      user = await mySqlDB.select(
        User,
        { _index: user.id },
        { selCols: ['age'] }
      )
      expect(() => user).not.toHaveProperty('username')
    })

    test('# 查db.select()，偏移量', async () => {
      expect(await mySqlDB.select(User, { offset: 2 })).toHaveLength(4)
    })

    test('# 查db.select()，查询量', async () => {
      expect(await mySqlDB.select(User, { limit: 2 })).toHaveLength(2)
    })
  })

  describe('# 同步（重构清空表）', () => {
    beforeAll(async () => {
      // 插入一条数据用于测试
      await mySqlDB.save(User, { username: 'uuuuu' })
    })

    test('# 同步db.sync()，清空表', async () => {
      expect(await mySqlDB.select(User)).not.toHaveLength(0)
      await mySqlDB.sync(User)
      expect(await mySqlDB.select(User)).toHaveLength(0)
    })
  })

  describe('# 联表操作', () => {
    let _index = ''
    beforeAll(async () => {
      await mySqlDB.sync(User)
      await mySqlDB.dump(User, dataFile)
      await mySqlDB.sync(Organ)
      const organ = await mySqlDB.save(Organ, { name: 'abcd' })
      _index = organ.id
    })

    test('# 未关联前查询', async () => {
      const organ = await mySqlDB.select(Organ, { _index }, { ext: true })
      expect(organ).toHaveProperty('users', [])
    })

    test('# 关联所有用户', async () => {
      const users = (await mySqlDB.select(User)).map((user) => user.id)
      await mySqlDB.saveOne(Organ, _index, { users })
      const organ = await mySqlDB.select(Organ, { _index }, { ext: true })
      expect(organ.users).toHaveProperty('length', users.length)
      expect(users).toContain(organ.users[0].id)
    })

    test('# 扩展查询', async () => {
      const organ = await mySqlDB.select(Organ, { _index }, { ext: true })
      expect(organ.users[0]).toHaveProperty('username')
    })

    test('# 扩展查询（非id指定）', async () => {
      const organs = await mySqlDB.select(Organ, null, { ext: true })
      expect(organs.length).toBeGreaterThan(0)
      expect(organs[0].users[0]).toHaveProperty('username')
    })

    test('# 插入新用户', async () => {
      const user = await mySqlDB.save(User, {
        username: 'opteacher',
        password: 'adsdfs',
        age: 32,
        tags: ['married'],
      })
      await mySqlDB.saveOne(
        Organ,
        _index,
        { users: user.id },
        { updMode: 'append' }
      )
      const organ = await mySqlDB.select(Organ, { _index }, { ext: true })
      expect(organ.users.map((user) => user.id)).toContain(user.id)
    })
  })

  describe('# 聚合操作', () => {
    beforeAll(async () => {
      try {
        await mySqlDB.sync(User)
        await mySqlDB.dump(User, dataFile)
      } catch (e) {
        console.log(JSON.stringify(e))
      }
    })

    test('# count', async () => {
      expect(await mySqlDB.count(User)).toEqual(6)
    })

    test('# max', async () => {
      const users = await mySqlDB.select(User, {
        order_by: { age: 'DESC' },
        limit: 1,
      })
      expect(await mySqlDB.max(User, 'age')).toEqual(users[0].age)
    })
  })

  afterAll(() => mySqlDB.disconnect())
})
