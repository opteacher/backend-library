export default db => db.defineModel('sub', {
  array: db.PropTypes.Array,
  bool: db.PropTypes.Boolean,
  num: db.PropTypes.Number,
}, {
  router: {
    methods: ['POST', 'DELETE', 'PUT', 'GET'],
  }
})
