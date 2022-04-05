
context('Home Page', () => {
  it('no login', () => {
    cy.visit('/')

    cy.intercept({
      method: 'GET',
      url: '/api/all-experiments',
    }, {
      statusCode: 200,
      body: ['test-exp'],
      headers: { 'access-control-allow-origin': '*' },
    }).as('allExps')

    // setup keycloak token and load vue.js
    const obj = {
      authenticated: false,
      login: ()=>{},
      token: 'thetoken',
      tokenParsed: {
        username: 'user',
        groups: []
      },
      updateToken: ()=>{}
    }
    cy.window().then((win) => {
      win.set_keycloak(obj)
      win.vue_startup()
    })

    cy.get('.account .login-link').should('contain', 'Sign in')

    cy.get('article.home').should('include.text', 'Existing users should sign in')
    
    cy.spy(obj, 'login').as('login')
    cy.get('.account .login-link').click()
    cy.get('@login').should('have.been.called')
  })

  it('with login', () => {
    cy.visit('/')

    const obj = {
      authenticated: true,
      loadUserInfo: async function(){
        return {given_name: "Foo Bar"}
      },
      logout: ()=>{},
      token: 'thetoken',
      tokenParsed: {
        username: 'user',
        groups: []
      },
      updateToken: ()=>{}
    }
    cy.window().then((win) => {
      win.set_keycloak(obj)
      win.vue_startup()
    })

    cy.get('.account').should('include.text', 'Foo Bar')
    cy.get('.account .login-link').should('contain', 'Sign out')

    cy.get('article.home .join button').should('exist')

    cy.spy(obj, 'logout').as('logout')
    cy.get('.account .login-link').click()
    cy.get('@logout').should('have.been.called')
  })
})
