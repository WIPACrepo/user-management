// ES2015 module export function
// which simply concats a class selector
// to the string argument

export default (params) => {
  params = Object.assign({
    exp: 'test-exp',
    insts: [],              // insts user belongs to
    admin_insts: [],        // insts user is admin of
    groups: [],             // groups user belongs to
    admin_groups: [],       // groups user is admin for
    authenticated: true,    // is user logged in?
    username: 'user',
    given_name: 'Foo Bar'
  }, params)

  let raw_groups = []
  let api_insts = {}
  let api_groups = {}
  for (const i of params.insts) {
    const group_path = '/institutions/'+params.exp+'/'+i
    raw_groups.push(group_path)
    api_insts[group_path] = {'users': [params.username]}
  }
  for (const i of params.admin_insts) {
    const group_path = '/institutions/'+params.exp+'/'+i
    if (!(group_path in api_insts)) {
      api_insts[group_path] = {}
    }
    raw_groups.push(group_path+'/_admin')
  }
  for (const g of params.groups) {
    const group_path = '/tokens/'+g
    api_groups[group_path] = g+'-id'
    raw_groups.push(group_path)
  }
  for (const g of params.admin_groups) {
    const group_path = '/tokens/'+g
    if (!(group_path in api_groups)) {
      api_groups[group_path] = g+'-id'
    }
    raw_groups.push(group_path+'/_admin')
  }

  let api_all_exps = {}
  for (const i in api_insts) {
    let subs = []
    for (const k in api_insts[i]) {
      if (k.startsWith('author')) {
        subs.push(k)
      }
    }
    api_all_exps[i] = {'subgroups': subs}
  }

  cy.intercept({
    method: 'GET',
    url: '/api/all-experiments',
  }, {
    statusCode: 200,
    body: api_all_exps,
    headers: { 'access-control-allow-origin': '*' },
  }).as('api-all-experiments')

  cy.intercept({
    method: 'GET',
    url: '/api/experiments',
  }, {
    statusCode: 200,
    body: [params.exp],
    headers: { 'access-control-allow-origin': '*' },
  }).as('api-experiments')

  cy.intercept({
    method: 'GET',
    url: '/api/experiments/*/institutions',
  }, {
    statusCode: 200,
    body: api_insts,
    headers: { 'access-control-allow-origin': '*' },
  }).as('api-institutions')

  cy.intercept({
    method: 'GET',
    url: '/api/groups',
  }, {
    statusCode: 200,
    body: api_groups,
    headers: { 'access-control-allow-origin': '*' },
  }).as('api-groups')

  const obj = {
    authenticated: params.authenticated,
    loadUserInfo: async function(){
      return {given_name: params.given_name}
    },
    login: ()=>{},
    logout: ()=>{},
    token: 'thetoken',
    tokenParsed: {
      username: params.username,
      groups: raw_groups
    },
    updateToken: ()=>{}
  }
  console.log('keycloak obj:', obj)
  cy.spy(obj, 'login').as('login')
  cy.spy(obj, 'logout').as('logout')
  cy.window().then((win) => {
    win.set_keycloak(obj)
    win.vue_startup()
  })
  return obj
}
