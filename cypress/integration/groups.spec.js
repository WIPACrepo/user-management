
import keycloak from '../support/keycloak'

context('Groups Page', () => {
  it('group admin', () => {
    cy.visit('/groups')
    keycloak({
      admin_groups: {'groupA': ['userA', 'userB']}
    })

    cy.get('#nav .active').contains('groups', {matchCase: false})
    cy.get('#nav li').should('have.length', 2)

    cy.get('[data-test="administered-groups"]').contains('groupA', {matchCase: false})
    cy.get('[data-test="administered-groups"]').within(() => {
      cy.get('[data-test="/tokens/groupA"]').contains('userA', {matchCase: false})
      cy.get('[data-test="/tokens/groupA"]').contains('userB', {matchCase: false})
      cy.get('[data-test="/tokens/groupA"]').contains('userB', {matchCase: false})

      cy.get('[data-test="/tokens/groupA"] [data-test="userB"] button').click()
      cy.get('@api-group-user-delete').its('request.url').should('include', 'userB')
    })

    cy.get('[data-test="administered-groups"] [data-test="/tokens/groupA"] .add').within(() => {
      cy.get('input').type('userC')
      cy.get('button').click()
      cy.get('@api-group-user-put').its('request.url').should('include', 'userC')
    })
  })

  it('group approvals', () => {
    cy.visit('/groups')
    keycloak({
      admin_groups: {'groupA': ['userA']},
      group_approvals: {'groupA': ['userB']}
    })

    cy.get('#nav .active').contains('groups', {matchCase: false})
    cy.get('#nav li').should('have.length', 2)

    cy.get('[data-test="approvals"]').contains('groupA', {matchCase: false})
    cy.get('[data-test="approvals"]').within(() => {
      cy.get('[data-test="userB"]').should('exist')
      cy.get('[data-test="userB"] [data-test="approve"]').click()
      cy.get('@api-group-approvals-approve').its('request.url').should('include', 'userB')
    })

    cy.get('[data-test="approvals"]').within(() => {
      cy.get('[data-test="userB"] [data-test="deny"]').click()
      cy.get('@api-group-approvals-deny').its('request.url').should('include', 'userB')
    })
  })
})
