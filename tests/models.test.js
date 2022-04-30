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
  let demoId = ''
  beforeAll(async () => {
    db = await getDbByName('mongo', cfgPath)
    request = supertest((await startApp(db)).callback())
  })

  test('# 正常开启', async () => {
    const resp = await request.get('/backend-library/mdl/v1').expect(200)
    expect(resp.body).not.toBeUndefined()
  })

  describe('# 增加', () => {
    test('# 基础增', async () => {
      const resp = await request
        .post('/backend-library/mdl/v1/demo')
        .send({ message: 'Hello World' })
        .expect(200)
      const postRes = resp.body.data
      expect(postRes).not.toBeUndefined()
      expect(postRes._id).not.toEqual('')
      demoId = postRes._id
      expect(postRes.message).toEqual('Hello World')
    })
  })

  describe('# 查询', () => {
    test('# 全查', async () => {
      const resp = await request
        .get('/backend-library/mdl/v1/demos')
        .expect(200)
      const allRes = resp.body.data
      expect(allRes).not.toBeUndefined()
      expect(allRes.length).toBeGreaterThan(0)
    })
  })

  describe('# 修改', () => {
    test('# 直接字段', async () => {
      const resp = await request
        .put(`/backend-library/mdl/v1/demo/${demoId}`)
        .send({ message: 'abcd' })
        .expect(200)
      const putRes = resp.body.data
      expect(putRes).not.toBeUndefined()
      expect(putRes.message).toEqual('abcd')
    })
  })

  describe('# 删除', () => {
    test('# 根据id', async () => {
      let resp = await request
        .delete(`/backend-library/mdl/v1/demo/${demoId}`)
        .expect(200)
      const delRes = resp.body.data
      expect(delRes).not.toBeUndefined()
      resp = await request.get(`/backend-library/mdl/v1/demo/${demoId}`)
      expect(resp.body.data).toBeNull()
    })
  })

  describe('# 关联', () => {
    let subId = ''
    beforeAll(async () => {
      const resp = await request
        .post('/backend-library/mdl/v1/demo')
        .send({ message: 'abcd' })
      demoId = resp.body.data._id
    })

    test('# 新增一条子记录并关联', async () => {
      let resp = await request
        .post('/backend-library/mdl/v1/sub')
        .send({
          array: [12, 43, 66, 'afsdf'],
          bool: true,
          num: 23,
        })
        .expect(200)
      const newSub = resp.body.data
      subId = newSub._id
      expect(subId).not.toBeUndefined()
      expect(subId).not.toEqual('')
      resp = await request
        .put(`/backend-library/mdl/v1/demo/${demoId}/subs/${subId}`)
        .expect(200)
      resp = await request
        .get(`/backend-library/mdl/v1/demo/${demoId}`)
        .expect(200)
      const demoIns = resp.body.data
      expect(demoIns.subs.length).toBeGreaterThan(0)
    })

    test('# 重复关联', async () => {
      await request
        .put(`/backend-library/mdl/v1/demo/${demoId}/subs/${subId}`)
        .expect(200)
    })

    test('# 解除关联', async () => {
      await request
        .delete(`/backend-library/mdl/v1/demo/${demoId}/subs/${subId}`)
        .expect(200)
      const resp = await request
        .get(`/backend-library/mdl/v1/demo/${demoId}`)
        .expect(200)
      const demoIns = resp.body.data
      expect(demoIns.subs).not.toContain(subId)
    })

    describe('# 清除关联', () => {
      beforeAll(async () => {
        const subs = []
        let resp = await request.post('/backend-library/mdl/v1/sub').send({
          array: [11, 44, 66],
          bool: false,
          num: 50,
        })
        subs.push(resp.body.data._id)
        resp = await request.post('/backend-library/mdl/v1/sub').send({
          array: [2321, 3455, 66],
          bool: true,
          num: 23423,
        })
        subs.push(resp.body.data._id)
        for (const sbId of subs) {
          await request.put(
            `/backend-library/mdl/v1/demo/${demoId}/subs/${sbId}`
          )
        }
      })

      test('# 子文档为空', async () => {
        let resp = await request
          .get(`/backend-library/mdl/v1/demo/${demoId}`)
          .expect(200)
        let demoIns = resp.body.data
        expect(demoIns.subs.length).not.toEqual(0)
        await request
          .delete(`/backend-library/mdl/v1/demo/${demoId}/subs`)
          .expect(200)
        resp = await request
          .get(`/backend-library/mdl/v1/demo/${demoId}`)
          .expect(200)
        demoIns = resp.body.data
        expect(demoIns.subs.length).toEqual(0)
      })
    })
  })
})
