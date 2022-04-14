
import keycloak from '../support/keycloak'

context('Home Page', () => {
  it('no login', () => {
    cy.visit('/')
    keycloak({authenticated: false})

    cy.get('#nav .active').contains('home', {matchCase: false})
    cy.get('#nav li').should('have.length', 1)

    cy.get('.account .login-link').should('contain', 'Sign in')

    cy.get('article.home').should('include.text', 'Existing users should sign in')

    cy.get('.account .login-link').click()
    cy.get('@login').should('have.been.called')
  })

  it('with login', () => {
    cy.visit('/')
    keycloak()

    cy.get('#nav .active').contains('home', {matchCase: false})
    cy.get('#nav li').should('have.length', 1)

    cy.get('.account').should('include.text', 'Foo Bar')
    cy.get('.account .login-link').should('contain', 'Sign out')

    cy.get('article.home .join button').should('exist')

    cy.get('.account .login-link').click()
    cy.get('@logout').should('have.been.called')
  })

  it('inst group member', () => {
    cy.visit('/')
    keycloak({insts: ['instA'], groups: ['groupB']})

    cy.get('#nav li').should('have.length', 1)

    cy.get('.institution').should('include.text', 'instA')
    cy.get('.group').should('include.text', 'groupB')
  })

  it('inst admin', () => {
    cy.visit('/')
    keycloak({admin_insts: {instA:['user']}, admin_groups: {groupB:['user']}})

    cy.get('#nav li').should('have.length', 3)

    cy.get('.account').should('exist')
  })
})
