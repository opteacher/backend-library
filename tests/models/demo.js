export default db => db.defineModel({
  __modelName: 'demo',
  message: db.PropTypes.String,
  subs: [{ type: db.PropTypes.Id, ref: 'sub' }]
}, {
  router: {
    methods: ['POST', 'DELETE', 'PUT', 'GET', 'ALL', 'LINK'],
  }
})
