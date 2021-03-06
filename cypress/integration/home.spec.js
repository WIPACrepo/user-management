
import keycloak from '../support/keycloak'

context('Home Page', () => {
  it('no login', () => {
    cy.visit('/')
    keycloak({authenticated: false})

    cy.get('#nav .active').contains('home', {matchCase: false})
    cy.get('#nav li').contains('institutions', {matchCase: false}).should('not.exist')

    cy.get('.account .login-link').should('contain', 'Sign in')

    cy.get('article.home').should('include.text', 'Existing users should sign in')

    cy.get('.account .login-link').click()
    cy.get('@login').should('have.been.called')
  })

  it('with login', () => {
    cy.visit('/')
    keycloak()

    cy.get('#nav .active').contains('home', {matchCase: false})

    cy.get('article.home .join button').should('exist')

    cy.get('.account .login-link').click()
    cy.get('@logout').should('have.been.called')
  })

  it('inst group member', () => {
    cy.visit('/')
    keycloak({insts: ['instA'], groups: ['groupB']})

    cy.get('.institution').should('include.text', 'instA')
    cy.get('.group').should('include.text', 'groupB')
  })

  it('inst admin', () => {
    cy.visit('/')
    keycloak({admin_insts: {instA:['user']}, admin_groups: {groupB:['user']}})

    cy.get('#nav li').contains('institutions', {matchCase: false}).should('exist')

    cy.get('.account').should('exist')
  })

  it('user profile', () => {
    cy.visit('/')
    keycloak({user_profile: {firstName: 'Foo', lastName: 'Bar', email: 'foo@bar', author_name: 'F. Bar'}})

    cy.get('.account').should('exist')

    cy.get('.profile').should('exist')

    cy.get('.profile [name="orcid"]').should('exist').type('1234-1234-1234-1234')
    cy.get('.profile button').click()

    
    cy.wait('@api-user-profile-put').should(({ request, response }) => {
      expect(request.url).to.include('user')
      expect(request.body).to.deep.eq({
        'firstName': 'Foo',
        'lastName': 'Bar',
        'email': 'foo@bar',
        'author_name': 'F. Bar',
        'author_firstName': '',
        'author_lastName': '',
        'author_email': '',
        'orcid': '1234-1234-1234-1234',
        'github': '',
        'slack': '',
        'mobile': ''
      })
    })
  })
})
