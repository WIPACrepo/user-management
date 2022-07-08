// ES2015 module export function
// which simply concats a class selector
// to the string argument

export default (params) => {
  params = Object.assign({
    token: 'thetoken'
  }, params)

  let obj = {}

  cy.intercept({
    method: 'POST',
    url: '/api/reg_token',
  }, {
    statusCode: 200,
    body: {token: params.token},
  }).as('api-reg_token')

  cy.intercept({
    method: 'POST',
    url: '/api/reg_token/*',
  }, {
    statusCode: 200,
    body: {},
  }).as('api-reg_token-validate')
  
  return obj
}