
import keycloak from '../support/keycloak'

context('Institutions Page', () => {
  it('inst approvals', () => {
    cy.visit('/institutions')
    keycloak({
      admin_insts: {instA:{users:['userA', 'userB'], "authorlist-physics":['userA'], "authorlist-astro":[]}},
      inst_approvals: {instA: ['userC']}
    })

    cy.get('#nav .active').contains('institutions', {matchCase: false})
    cy.get('#nav li').should('have.length', 2)

    cy.get('.approvals [data-test="userC"]').should('exist')
    cy.get('.approvals [data-test="approve"]').should('exist').click()
    cy.wait('@api-inst-approvals-approve').its('request.url').should('include', 'userC')

    cy.get('.approvals [data-test="deny"]').should('exist').click()
    cy.wait('@api-inst-approvals-deny').its('request.url').should('include', 'userC')
  })

  it('inst table', () => {
    cy.visit('/institutions')
    keycloak({
      admin_insts: {instA:{users:['userA', 'userB'], "authorlist-physics":['userA'], "authorlist-astro":[]}}
    })

    cy.get('[data-test="userA"]').within(() => {
      cy.get('.username').contains('userA', {matchCase: false})
      cy.get('button.update').should('not.exist')
      cy.get('input[name=authorlist-physics]').should('be.checked')
      cy.get('input[name=authorlist-astro]').should('not.be.checked').check()
      cy.get('button.update').should('exist').click()
      cy.wait('@api-institution-users-update').should(({ request, response }) => {
        expect(request.url).to.include('userA')
        expect(request.body).to.include({
          "authorlist-physics": true,
          "authorlist-astro": true
        })
      })
    })
    cy.get('[data-test="userA"] .delete').click()
    cy.wait('@api-institution-users-delete').its('request.url').should('include', 'userA')

    cy.get('[data-test="userB"]').within(() => {
      cy.get('.username').contains('userB', {matchCase: false})
      cy.get('button.update').should('not.exist')
      cy.get('input[name=authorlist-physics]').should('not.be.checked')
      cy.get('input[name=authorlist-astro]').should('not.be.checked').check()
      cy.get('button.update').should('exist').click()
      cy.wait('@api-institution-users-update').should(({ request, response }) => {
        expect(request.url).to.include('userB')
        expect(request.body).to.include({
          "authorlist-physics": false,
          "authorlist-astro": true
        })
      })
    })
  })

  it('inst add user', () => {
    cy.visit('/institutions')
    keycloak({
      admin_insts: {instA:{users:['userA', 'userB'], "authorlist-physics":['userA'], "authorlist-astro":[]}}
    })

    cy.get('[data-test="userB"] .delete').click()
    cy.wait('@api-institution-users-delete').its('request.url').should('include', 'userB')

    cy.get('.add input[name=username]').type('userD')
    cy.get('.add button').click()
    cy.wait('@api-institution-users-update').its('request.url').should('include', 'userD')
  })
})
