
import keycloak from '../support/keycloak'

context('Registration Page', () => {
  it('register', () => {
    cy.visit('/register')
    keycloak({
      insts: ['instA'],
      inst_admins: ['myadmin1', 'myadmin2'],
      new_username: 'fbar'
    })

    cy.get('#nav .active').contains('register', {matchCase: false})

    cy.get('[data-test="institution"]').should('exist').should('be.disabled')

    cy.get('[data-test="experiment"]').should('exist').select('test-exp')
    cy.get('[data-test="institution"]').select('instA')

    cy.get('[name="first_name"]').type('foo')
    cy.get('[name="last_name"]').type('bar')

    cy.wait('@api-username-post').should(({ request, response }) => {
      expect(response.body).to.deep.eq({
        "username": "fbar"
      })
    })
    cy.get('[name="username"]').should('have.value', 'fbar')

    cy.get('[name="email"]').type('foo@bar')

    cy.get('[data-test="supervisor"]').should('exist').select('myadmin2')

    cy.get('[data-test="submit"]').click()

    cy.wait('@api-inst-approvals-post').should(({ request, response }) => {
      expect(request.body).to.deep.eq({
        'experiment': 'test-exp',
        'institution': 'instA',
        'first_name': 'foo',
        'last_name': 'bar',
        'username': 'fbar',
        'email': 'foo@bar',
        'supervisor': 'myadmin2'
      })
    })
  })

  it('clear-username', () => {
    cy.visit('/register')
    keycloak({
      insts: ['instA'],
      new_username: 'fbar'
    })

    cy.get('#nav .active').contains('register', {matchCase: false})

    cy.get('[data-test="institution"]').should('exist').should('be.disabled')

    cy.get('[data-test="experiment"]').should('exist').select('test-exp')
    cy.get('[data-test="institution"]').select('instA')

    cy.get('[name="first_name"]').type('foo')
    cy.get('[name="last_name"]').type('bar')

    cy.wait('@api-username-post').should(({ request, response }) => {
      expect(response.body).to.deep.eq({
        "username": "fbar"
      })
    })
    cy.get('[name="username"]').should('have.value', 'fbar')

    cy.get('[name="last_name"]').type('d')
    cy.get('[name="username"]').should('have.value', '')

    cy.wait('@api-username-post').should(({ request, response }) => {
      expect(response.body).to.deep.eq({
        "username": "fbar"
      })
    })
    cy.get('[name="username"]').should('have.value', 'fbar')
  })

  it('username-cycle-detect', () => {
    cy.visit('/register')
    keycloak({
      insts: ['instA'],
      new_username: function(input_username){
        console.log("input username: "+input_username)
        if (!input_username) {
          return 'fbar'
        } else {
          return input_username
        }
      }
    })

    cy.get('#nav .active').contains('register', {matchCase: false})

    cy.get('[data-test="institution"]').should('exist').should('be.disabled')

    cy.get('[data-test="experiment"]').should('exist').select('test-exp')
    cy.get('[data-test="institution"]').select('instA')

    cy.get('[name="first_name"]').type('foo')
    cy.get('[name="last_name"]').type('bar')

    cy.wait('@api-username-post').should(({ request, response }) => {
      expect(response.body).to.deep.eq({
        "username": "fbar"
      })
    })
    cy.get('[name="username"]').should('have.value', 'fbar')

    cy.get('[name="username"]').type('baaaa', {delay: 0})
    cy.wait(1000)
    cy.get('[name="username"]').should('have.value', 'fbarbaaaa')

    cy.wait('@api-username-post').should(({ request, response }) => {
      expect(response.body).to.deep.eq({
        "username": "fbarbaaaa"
      })
    })
  })
})