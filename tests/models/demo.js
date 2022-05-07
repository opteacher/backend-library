export default db => db.defineModel('demo', {
  message: db.PropTypes.String,
  subs: [{ type: db.PropTypes.Id, ref: 'sub' }]
}, {
  router: {
    methods: ['POST', 'DELETE', 'PUT', 'GET', 'ALL', 'LINK'],
  }
})
