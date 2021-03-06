
import keycloak from '../support/keycloak'
import reg_token from '../support/reg_token'

context('Registration Page', () => {
  it('register', () => {
    reg_token({token: 'foobar'})
    cy.visit('/register?reg_token=foobar')
    keycloak({
      insts: ['instA'],
      new_username: 'fbar'
    })

    cy.wait('@api-reg_token-validate').should(({ request, response }) => {
      expect(request.url).to.match(/foobar$/)
    })

    cy.get('#nav .active').contains('register', {matchCase: false})

    cy.get('[data-test="institution"]').should('exist').should('be.disabled')

    cy.get('[data-test="experiment"]').should('exist').select('test-exp')
    cy.get('[data-test="institution"]').select('instA')

    cy.get('[name="first_name"]').type('foo')
    cy.get('[name="last_name"]').type('bar')

    cy.wait('@api-username-post').should(({ request, response }) => {
      expect(request.headers).to.include({
        'authorization': 'bearer foobar'
      })
      expect(response.body).to.deep.eq({
        "username": "fbar"
      })
    })
    cy.get('[name="username"]').should('have.value', 'fbar')

    cy.get('[name="email"]').type('foo@bar')
    cy.get('[data-test="submit"]').click()

    cy.wait('@api-inst-approvals-post').should(({ request, response }) => {
      expect(request.headers).to.include({
        'authorization': 'bearer foobar'
      })
      expect(request.body).to.deep.eq({
        'experiment': 'test-exp',
        'institution': 'instA',
        'first_name': 'foo',
        'last_name': 'bar',
        'username': 'fbar',
        'email': 'foo@bar'
      })
    })
  })
})