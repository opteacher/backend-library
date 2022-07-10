import 'core-js/stable'
import 'regenerator-runtime/runtime'
import { beforeAll, beforeEach, afterAll, expect } from '@jest/globals'
import Path from 'path'
import { getDbByName } from '../databases'

const dataFile = Path.resolve('tests', 'resources', 'records.json')

describe('# MongoDB', () => {
  let mgoDB = null
  let User = null
  let Organ = null
  const record = {
    username: 'abcd',
    password: 'frfrfr',
    age: 12,
    subItem: {
      name: 'asfsdf',
      thing: false,
      num: 12
    },
    subArray: [{
      name: 'sdfsgrtgt',
      thing: { text: 'dsfsff' },
      num: 20
    }]
  }
  beforeAll(async () => {
    mgoDB = await getDbByName('mongo', Path.resolve('tests', 'configs', 'db'))
    User = mgoDB.defineModel('user',
      {
        username: mgoDB.PropTypes.String,
        password: mgoDB.PropTypes.String,
        age: mgoDB.PropTypes.Number,
        tags: mgoDB.PropTypes.Array,
        subItem: {
          name: mgoDB.PropTypes.String,
          thing: mgoDB.PropTypes.Any,
          num: mgoDB.PropTypes.Number,
        },
        subArray: [
          {
            name: mgoDB.PropTypes.String,
            thing: mgoDB.PropTypes.Any,
            num: mgoDB.PropTypes.Number,
          },
        ],
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
    Organ = mgoDB.defineModel('organ', {
      name: mgoDB.PropTypes.String,
      users: [{ type: mgoDB.PropTypes.Id, ref: 'user' }],
    })
    await mgoDB.sync(User)
    await mgoDB.sync(Organ)
  })

  describe('# 新增记录', () => {
    beforeAll(async () => {
      await mgoDB.sync(User)
    })

    test('# 增db.save()，数据库中应增加一条新纪录', async () => {
      // 新增的用户id不为空
      expect((await mgoDB.save(User, record)).id).not.toBe('')
    })
  })

  describe('# 删除记录', () => {
    let _index = ''
    const username = record.username
    beforeEach(async () => {
      await mgoDB.sync(User)
      _index = (await mgoDB.save(User, record)).id
    })

    test('# 删db.remove()，按字段', async () => {
      let result = await mgoDB.select(User, { username })
      // 现存有数据
      expect(result.length).toBeGreaterThanOrEqual(1)
      const num = await mgoDB.remove(User, { username })
      // 有删除的记录
      expect(num).not.toBe(0)
      result = await mgoDB.select(User, { username })
      // 删除之后的记录数为0
      expect(result).toHaveLength(0)
    })

    test('# 删db.remove()，按ID', async () => {
      let result = await mgoDB.select(User, { _index })
      // 现存有数据
      expect(result).toBeDefined()
      const num = await mgoDB.remove(User, { _index })
      // 有删除的记录
      expect(num).not.toBe(0)
      result = await mgoDB.select(User, { _index })
      // 删除之后的记录数为0
      expect(result).toBeNull()
    })
  })

  describe('# 修改记录', () => {
    let userID = ''
    beforeAll(async () => {
      await mgoDB.sync(User)
      await mgoDB.dump(User, dataFile)
      const user = await mgoDB.save(User, record)
      userID = user.id
    })

    test('# 改db.save()，修改基本类型字段（字符串）', async () => {
      await mgoDB.saveOne(User, userID, { password: 'iiii' })
      expect(await mgoDB.select(User, { _index: userID })).toHaveProperty(
        'password',
        'iiii'
      )
    })

    test('# 改db.save()，修改基本类型字段，用save函数', async () => {
      await mgoDB.save(User, { password: 'yyyy' }, { _index: userID })
      expect(await mgoDB.select(User, { _index: userID })).toHaveProperty(
        'password',
        'yyyy'
      )
    })

    test('# 改db.save()，修改基本类型字段（数字）', async () => {
      await mgoDB.saveOne(User, userID, { age: 23 })
      expect(await mgoDB.select(User, { _index: userID })).toHaveProperty(
        'age',
        23
      )
    })

    test('# 改db.save()，修改数组类型字段（元素）', async () => {
      await mgoDB.saveOne(User, userID, { tags: 12 })
      const user = await mgoDB.select(User, { _index: userID })
      expect(user.tags).toContain(12)
    })

    test('# 改db.save()，修改数组类型字段（数组）', async () => {
      await mgoDB.saveOne(User, userID, { tags: ['hhhh', '7777'] })
      const user = await mgoDB.select(User, { _index: userID })
      // 修改之后记录数据刷新
      expect(user.tags).not.toContain(12)
      expect(user.tags).toContain('hhhh')
      expect(user.tags).toContain('7777')
    })

    test('# 改db.save()，追加数组类型字段（元素）', async () => {
      await mgoDB.saveOne(User, userID, { tags: 100 }, { updMode: 'append' })
      const user = await mgoDB.select(User, { _index: userID })
      // 追加之后记录数据刷新
      expect(user.tags).toContain('hhhh')
      expect(user.tags).toContain('7777')
      expect(user.tags).toContain(100)
    })

    test('# 改db.save()，追加数组类型字段（数组）', async () => {
      await mgoDB.saveOne(
        User,
        userID,
        { tags: ['3333', true] },
        { updMode: 'append' }
      )
      const user = await mgoDB.select(User, { _index: userID })
      // 修改之后记录数据刷新
      expect(user.tags).toContain('hhhh')
      expect(user.tags).toContain('7777')
      expect(user.tags).toContain(100)
      expect(user.tags).toContain('3333')
      expect(user.tags).toContain(true)
    })

    test('# 改db.save()，删除数组类型字段的元素（用值）', async () => {
      await mgoDB.saveOne(User, userID, { tags: 'hhhh' }, { updMode: 'delete' })
      const user = await mgoDB.select(User, { _index: userID })
      // 删除之后记录数据刷新
      expect(user.tags).not.toContain('hhhh')
    })

    test('# 改db.save()，删除数组类型字段的元素（用索引）', async () => {
      let user = await mgoDB.select(User, { _index: userID })
      const fstEle = user.tags[0]
      await mgoDB.saveOne(User, userID, { 'tags[0]': null }, { updMode: 'delete' })
      user = await mgoDB.select(User, { _index: userID })
      // 删除之后记录数据刷新
      expect(user.tags[0]).not.toEqual(fstEle)
    })

    test('# 改db.save()，修改子字段（字符串）', async () => {
      await mgoDB.saveOne(User, userID, { 'subItem.name': 'aaaa' })
      const user = await mgoDB.select(User, { _index: userID })
      // 修改之后记录数据刷新
      expect(user.subItem.name).toEqual('aaaa')
    })

    test('# 改db.save()，修改子字段（数字）', async () => {
      await mgoDB.saveOne(User, userID, { 'subItem.num': 12 })
      const user = await mgoDB.select(User, { _index: userID })
      // 修改之后记录数据刷新
      expect(user.subItem.num).toEqual(12)
    })

    describe('# 改db.save()，操作对象数组字段', () => {
      test('# 增（从无到有）', async () => {
        await mgoDB.saveOne(
          User,
          userID,
          {
            subArray: {
              name: 'opteacher',
              thing: {
                a: 1,
                b: '34345',
                c: true,
              },
              num: 20,
            },
          },
          { updMode: 'append' }
        )
        const user = await mgoDB.select(User, { _index: userID })
        expect(user.subArray.length).toBeGreaterThan(0)
      })

      test('# 增（从有到有）', async () => {
        await mgoDB.saveOne(
          User,
          userID,
          {
            subArray: {
              name: 'opower',
              thing: {
                d: '3333',
                e: false,
              },
              num: 30,
            },
          },
          { updMode: 'append' }
        )
        const user = await mgoDB.select(User, { _index: userID })
        expect(user.subArray.length).toBeGreaterThan(1)
      })

      test('# 改1（根据索引）', async () => {
        await mgoDB.saveOne(User, userID, {
          'subArray[0].num': 15,
        })
        const user = await mgoDB.select(User, { _index: userID })
        expect(user.subArray[0].num).toEqual(15)
      })

      test('# 改2（根据字段值）', async () => {
        await mgoDB.saveOne(User, userID, {
          'subArray[{num:15}].name': 'abcd',
        })
        const user = await mgoDB.select(User, { _index: userID })
        expect(user.subArray[0].name).toEqual('abcd')
      })

      test('# merge改', async () => {
        await mgoDB.saveOne(User, userID, {
          'subItem': { num: 20 },
        }, { updMode: 'merge' })
        const user = await mgoDB.select(User, { _index: userID })
        expect(user.subItem.num).toEqual(20)
        expect(user.subItem.thing).toBeFalsy()
      })

      test('# merge改（数组元素）', async () => {
        await mgoDB.saveOne(User, userID, {
          'subArray[{name:abcd}]': { num: 25 }
        }, { updMode: 'merge' })
        const user = await mgoDB.select(User, { _index: userID })
        const subEl = user.subArray.find(el => el.name === 'abcd')
        expect(subEl.num).toEqual(25)
        expect(subEl.thing.text).toEqual('dsfsff')
      })

      test('# 删', async () => {
        await mgoDB.saveOne(
          User,
          userID,
          { 'subArray[{name:opower}]': undefined },
          { updMode: 'delete' }
        )
        const user = await mgoDB.select(User, { _index: userID })
        const subIdx = user.subArray.findIndex(ele => ele.name === 'opower')
        expect(subIdx).toEqual(-1)
      })
    })

    describe('# 改db.save()，修改多记录', () => {
      beforeAll(async () => {
        await mgoDB.sync(User)
        await mgoDB.dump(User, dataFile)
      })

      test('# 数据清除后再修改', async () => {
        await mgoDB.save(User, { age: 50 }, { password: 'frfrfr' })

        const users = await mgoDB.select(User, { password: 'frfrfr' })
        users.map((user) => expect(user).toHaveProperty('age', 50))
      })
    })
  })

  describe('# 查询记录', () => {
    let user = null

    beforeAll(async () => {
      await mgoDB.sync(User)
      await mgoDB.dump(User, dataFile)
      user = (await mgoDB.select(User, { limit: 1 }))[0]
    })

    test('# 查db.select()，指定id', async () => {
      expect(await mgoDB.select(User, { _index: user.id })).toHaveProperty(
        'username',
        user.username
      )
    })

    // test('# 查db.select()，错误id', async () => {
    //   expect(await mgoDB.select(User, { _index: 'ansdasd' })).toThrow()
    // })

    test('# 查db.select()，全查', async () => {
      expect((await mgoDB.select(User)).length).toBeGreaterThanOrEqual(1)
    })

    test('# 查db.select()，排序', async () => {
      const users = await mgoDB.select(User, { order_by: { age: 'DESC' } })
      users.reduce((prev, curr) => {
        expect(prev.age).toBeGreaterThanOrEqual(curr.age)
        return curr
      })
    })

    test('# 查db.select()，指定列', async () => {
      user = await mgoDB.select(User, { _index: user.id }, { selCols: ['age'] })
      expect(() => user).not.toHaveProperty('username')
    })

    test('# 查db.select()，偏移量', async () => {
      expect(await mgoDB.select(User, { offset: 2 })).toHaveLength(4)
    })

    test('# 查db.select()，查询量', async () => {
      expect(await mgoDB.select(User, { limit: 2 })).toHaveLength(2)
    })
  })

  describe('# 同步（重构清空表）', () => {
    beforeAll(async () => {
      // 插入一条数据用于测试
      await mgoDB.save(User, { username: 'uuuuu' })
    })

    test('# 同步db.sync()，清空表', async () => {
      expect(await mgoDB.select(User)).not.toHaveLength(0)
      await mgoDB.sync(User)
      expect(await mgoDB.select(User)).toHaveLength(0)
    })
  })

  describe('# 联表操作', () => {
    let _index = ''
    beforeAll(async () => {
      await mgoDB.sync(User)
      await mgoDB.dump(User, dataFile)
      await mgoDB.sync(Organ)
      const organ = await mgoDB.save(Organ, { name: 'abcd' })
      _index = organ.id
    })

    test('# 未关联前查询', async () => {
      const organ = await mgoDB.select(Organ, { _index }, { ext: true })
      expect(organ).toHaveProperty('users', [])
    })

    test('# 关联所有用户', async () => {
      const users = (await mgoDB.select(User)).map((user) => user.id)
      await mgoDB.save(Organ, { users }, { _index })
      const organ = await mgoDB.select(Organ, { _index })
      expect(organ.users).toHaveProperty('length', users.length)
      expect(organ.users[0].toString()).toEqual(users[0])
    })

    test('# 扩展查询', async () => {
      const organ = await mgoDB.select(Organ, { _index }, { ext: true })
      expect(organ.users[0]).toHaveProperty('username')
    })

    test('# 扩展查询（非id指定）', async () => {
      const organs = await mgoDB.select(Organ, null, { ext: true })
      expect(organs.length).toBeGreaterThan(0)
      expect(organs[0].users[0]).toHaveProperty('username')
    })

    test('# 插入新用户', async () => {
      const user = await mgoDB.save(User, {
        username: 'opteacher',
        password: 'adsdfs',
        age: 32,
        tags: ['married'],
      })
      await mgoDB.saveOne(
        Organ,
        _index,
        { users: user.id },
        { updMode: 'append' }
      )
      const organ = await mgoDB.select(Organ, { _index })
      expect(organ.users[organ.users.length - 1].toString()).toEqual(user.id)
    })
  })

  describe('# 聚合操作', () => {
    let testData = []
    beforeAll(async () => {
      await mgoDB.sync(User)
      await mgoDB.dump(User, dataFile)
      testData = (await import(dataFile)).data
    })

    test('# count', async () => {
      expect(await mgoDB.count(User)).toEqual(testData.length)
    })

    test('# max', async () => {
      const users = await mgoDB.select(User, {
        order_by: { age: 'DESC' },
        limit: 1,
      })
      expect(await mgoDB.max(User, 'age')).toEqual(users[0].age)
    })
  })

  afterAll(() => mgoDB.disconnect())
})
