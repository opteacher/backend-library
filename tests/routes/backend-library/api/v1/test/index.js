import Router from 'koa-router'

const router = new Router()

router.get('/', ctx => {
  ctx.body = {
    result: { message: 'Hello World' }
  }
})

router.get('/active', ctx => {
  ctx.body = {
    result: { message: 'Hello Active' }
  }
})

export default router
