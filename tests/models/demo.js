export default db => db.defineModel({
  __modelName: 'demo',
  message: db.PropTypes.String,
}, {
  router: {
    methods: ['POST', 'DELETE', 'PUT', 'GET', 'ALL'],
  }
})
