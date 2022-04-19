// ES2015 module export function
// which simply concats a class selector
// to the string argument

export default (params) => {
  params = Object.assign({
    exp: 'test-exp',
    insts: [],              // insts user belongs to
    admin_insts: {},        // insts user is admin of = {instname: {users, authorlist, ...}}
    inst_approvals: {},     // inst approvals = {instname: [users]}
    groups: [],             // groups user belongs to
    admin_groups: {},       // groups user is admin for = {groupname: [users]}
    group_approvals: {},    // group approvals = {groupname: [users]}
    authenticated: true,    // is user logged in?
    username: 'user',
    given_name: 'Foo Bar'
  }, params)

  let raw_groups = []
  let api_insts = {}
  let api_groups = {}
  let api_group_details = {}
  for (const i of params.insts) {
    raw_groups.push('/institutions/'+params.exp+'/'+i)
    api_insts[i] = {'users': [params.username]}
  }
  for (const i in params.admin_insts) {
    if (!(i in api_insts)) {
      api_insts[i] = {}
    }
    for (const k in params.admin_insts[i]) {
      if (!(k in api_insts[i])) {
        api_insts[i][k] = []
      }
      for (const v of params.admin_insts[i][k]) {
        api_insts[i][k].push(v)
      }
    }
    raw_groups.push('/institutions/'+params.exp+'/'+i+'/_admin')
  }
  for (const g of params.groups) {
    const group_path = '/tokens/'+g
    const group_id = g+'-id'
    api_groups[group_path] = group_id
    api_group_details[group_id] = {name: g, users: [params.username]}
    raw_groups.push(group_path)
  }
  for (const g in params.admin_groups) {
    const group_path = '/tokens/'+g
    const group_id = g+'-id'
    if (!(g in api_groups)) {
      api_groups[group_path] = group_id
      api_group_details[group_id] = {name: g, users: []}
    }
    for (const v of params.admin_groups[g]) {
      api_group_details[group_id].users.push(v)
    }
    raw_groups.push(group_path+'/_admin')
  }

  let api_all_exps = {}
  api_all_exps[params.exp] = {}
  for (const i in api_insts) {
    let subs = []
    for (const k in api_insts[i]) {
      if (k.startsWith('author')) {
        subs.push(k)
      }
    }
    api_all_exps[params.exp][i] = {'subgroups': subs}
  }

  let inst_approvals = []
  for (const i in params.inst_approvals) {
    for (const u of params.inst_approvals[i]) {
      inst_approvals.push({
        experiment: params.exp,
        institution: i,
        username: u
      })
    }
  }

  let group_approvals = []
  for (const g in params.group_approvals) {
    for (const u of params.group_approvals[g]) {
      group_approvals.push({
        group: g,
        group_id: g+'-id',
        id: g+u+'-id',
        username: u
      })
    }
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
    body: Object.keys(api_insts).sort(),
    headers: { 'access-control-allow-origin': '*' },
  }).as('api-institutions')

  cy.intercept({
    method: 'GET',
    url: '/api/experiments/*/institutions/*',
  }, (req) => {
    const parts = req.url.split('/')
    const instname = parts[parts.length-1]
    if (instname in api_all_exps) {
      req.reply({
        statusCode: 200,
        body: api_all_exps[instname],
      })
    } else {
      req.reply({statusCode: 404, body: {}})
    }
  }).as('api-institution')

  cy.intercept({
    method: 'GET',
    url: '/api/experiments/*/institutions/*/users',
  }, (req) => {
    const parts = req.url.split('/')
    const instname = parts[parts.length-2]
    console.log('api-institution-users: inst='+instname)
    if (instname in api_insts) {
      req.reply({
        statusCode: 200,
        body: api_insts[instname],
      })
    } else {
      req.reply({statusCode: 404, body: {}})
    }
  }).as('api-institution-users')

  cy.intercept({
    method: 'PUT',
    url: '/api/experiments/*/institutions/*/users/*',
  }, {
    statusCode: 200,
    body: {},
    headers: { 'access-control-allow-origin': '*' },
  }).as('api-institution-users-update')

  cy.intercept({
    method: 'DELETE',
    url: '/api/experiments/*/institutions/*/users/*',
  }, {
    statusCode: 200,
    body: {},
    headers: { 'access-control-allow-origin': '*' },
  }).as('api-institution-users-delete')

  cy.intercept({
    method: 'GET',
    url: '/api/inst_approvals',
  }, {
    statusCode: 200,
    body: inst_approvals,
    headers: { 'access-control-allow-origin': '*' },
  }).as('api-inst-approvals')

  cy.intercept({
    method: 'GET',
    url: '/api/groups',
  }, {
    statusCode: 200,
    body: api_groups,
    headers: { 'access-control-allow-origin': '*' },
  }).as('api-groups')

  cy.intercept({
    method: 'GET',
    url: '/api/groups/*',
  }, (req) => {
    console.log('api-group')
    const parts = req.url.split('/')
    const group_id = parts[parts.length-1]
    console.log('api-group: '+group_id)
    try {
      if (!group_id in api_group_details) {
        req.reply({statusCode: 404, body: {}})
      } else if (!api_group_details[group_id].name in params.admin_groups) {
        req.reply({statusCode: 403, body: {}})
      } else {
        req.reply({
          statusCode: 200,
          body: api_group_details[group_id].users,
        })
      }
    } catch (error) {
      console.log('error', error)
      req.reply({statusCode: 500})
    }
  }).as('api-group')

  cy.intercept({
    method: 'DELETE',
    url: '/api/groups/*/*',
  }, {
    statusCode: 200,
    body: {},
    headers: { 'access-control-allow-origin': '*' },
  }).as('api-group-user-delete')

  cy.intercept({
    method: 'PUT',
    url: '/api/groups/*/*',
  }, {
    statusCode: 200,
    body: {},
    headers: { 'access-control-allow-origin': '*' },
  }).as('api-group-user-put')

  cy.intercept({
    method: 'GET',
    url: '/api/group_approvals',
  }, {
    statusCode: 200,
    body: group_approvals,
    headers: { 'access-control-allow-origin': '*' },
  }).as('api-group-approvals')

  cy.intercept({
    method: 'POST',
    url: '/api/group_approvals/*/actions/approve',
  }, {
    statusCode: 200,
    body: {},
    headers: { 'access-control-allow-origin': '*' },
  }).as('api-group-approvals-approve')

  cy.intercept({
    method: 'POST',
    url: '/api/group_approvals/*/actions/deny',
  }, {
    statusCode: 200,
    body: {},
    headers: { 'access-control-allow-origin': '*' },
  }).as('api-group-approvals-deny')

  const obj = {
    authenticated: () => params.authenticated,
    login: async function(){},
    logout: async function(){},
    get_token: async function(){ return 'thetoken' },
    get_tokenParsed: async function(){ return {
      username: params.username,
      groups: raw_groups
    }},
    get_userInfo: async function(){
      return {given_name: params.given_name}
    }
  }
  cy.spy(obj, 'login').as('login')
  cy.spy(obj, 'logout').as('logout')
  cy.window().then((win) => {
    win.vue_startup(obj)
  })

  console.log('keycloak obj: ', obj)
  console.log('exp info: ', api_all_exps)
  console.log('inst info: ', api_insts)
  console.log('group list: ', api_groups)
  console.log('group info: ', api_group_details)
  return obj
}