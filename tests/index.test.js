import Path from 'path'
import assert from 'assert'
import { getDbByName } from '../databases/index.js'

const log = console.log
const dbCfgPath = Path.resolve('tests', 'configs', 'db')

describe('# 数据库', function () {
  describe('# MongoDB', function () {
    let db = null
    let User = null
    before(async function () {
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
      db.sync(User)
    })

    it('# 增db.save()，数据库中应增加一条新纪录', async function () {
      const user = await db.save(User, {
        username: 'abcd',
        password: 'frfrfr',
        age: 12
      })
      log(`\t新增的用户id为：${user.id}`)
      assert.notEqual(user.id, '')
    })

    it('# 删db.del()，上一步新增的记录将无法从数据库查询到', async function () {
      let result = await db.select(User, { username: 'abcd' })
      log(`\t现存查询到的数据量为：${result.length}`)
      assert.ok(result.length >= 1)
      const num = await db.del(User, { username: 'abcd' })
      log(`\t删除的记录数为：${num}`)
      assert.notEqual(num, 0)
      result = await db.select(User, { username: 'abcd' })
      log('\t删除之后的记录数为：0')
      assert.equal(result.length, 0)
    })

    let user = null
    before(async function () {
      user = await db.save(User, {
        username: 'test',
        password: 'abcd'
      })
      log(`\t新增一条用于修改的记录：${user.id}`)
    })

    it('# 改db.save()，修改基本类型字段（字符串）', async function () {
      await db.saveOne(User, user.id, { password: 'iiii' })
      user = await db.select(User, { _index: user.id })
      log(`\t修改用户密码为${user.password}`)
    })

    it('# 改db.save()，修改基本类型字段（数字）', async function () {
      await db.saveOne(User, user.id, { age: 23 })
      user = await db.select(User, { _index: user.id })
      log(`\t修改用户密码为${user.age}`)
    })

    it('# 改db.save()，修改数组类型字段（元素）', async function () {
      await db.saveOne(User, user.id, { tags: 12 })
      user = await db.select(User, { _index: user.id })
      log(`\t修改用户标签为${user.tags}`)
    })

    it('# 改db.save()，修改数组类型字段（数组）', async function () {
      await db.saveOne(User, user.id, { tags: ['hhhh', '7777'] })
      user = await db.select(User, { _index: user.id })
      log(`\t修改用户标签为${user.tags}`)
    })

    it('# 改db.save()，追加数组类型字段（元素）', async function () {
      await db.saveOne(User, user.id, { tags: 100 }, { updMode: 'append' })
      user = await db.select(User, { _index: user.id })
      log(`\t追加用户标签为${user.tags}`)
    })

    it('# 改db.save()，追加数组类型字段（数组）', async function () {
      await db.saveOne(User, user.id, { tags: ['3333', true] }, { updMode: 'append' })
      user = await db.select(User, { _index: user.id })
      log(`\t追加用户标签为${user.tags}`)
    })

    it('# 改db.save()，删除数组类型字段的元素', async function () {
      await db.saveOne(User, user.id, { tags: 'hhhh' }, { updMode: 'delete' })
      user = await db.select(User, { _index: user.id })
      log(`\t删除标签：hhhh；用户标签为${user.tags}`)
    })

    after(() => db.disconnect())
  })
})
