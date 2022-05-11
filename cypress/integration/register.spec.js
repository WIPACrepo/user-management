
import keycloak from '../support/keycloak'

context('Registration Page', () => {
  it('register', () => {
    cy.visit('/register')
    keycloak({insts: ['instA']})

    cy.get('#nav .active').contains('register', {matchCase: false})

    cy.get('[data-test="institution"]').should('exist').should('be.disabled')

    cy.get('[data-test="experiment"]').should('exist').select('test-exp')
    cy.get('[data-test="institution"]').select('instA')

    cy.get('[name="first_name"]').type('foo')
    cy.get('[name="last_name"]').type('bar')
    cy.get('[name="email"]').type('foo@bar')
    cy.get('[data-test="submit"]').click()

    cy.wait('@api-inst-approvals-post').should(({ request, response }) => {
      expect(request.body).to.deep.eq({
        "experiment": "test-exp",
        "institution": "instA",
        "first_name": "foo",
        "last_name": "bar",
        "email": "foo@bar"
      })
    })
  })
})