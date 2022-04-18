
import keycloak from '../support/keycloak'

context('Institutions Page', () => {
  it('inst admin', () => {
    cy.visit('/institutions')
    keycloak({
      admin_insts: {instA:{users:['userA', 'userB'], "authorlist-physics":['userA'], "authorlist-astro":[]}},
      inst_approvals: {instA: ['userC']}
    })

    cy.get('#nav .active').contains('institutions', {matchCase: false})
    cy.get('#nav li').should('have.length', 2)

    
  })
})
