
import keycloak from '../support/keycloak'

context('Institutions Page', () => {
  it('inst approvals', () => {
    cy.visit('/institutions')
    keycloak({
      admin_insts: {instA:{users:['userA', 'userB'], "authorlist-physics":['userA'], "authorlist-astro":[]}},
      inst_approvals: {instA: ['userC']}
    })

    cy.get('#nav .active').contains('institutions', {matchCase: false})
    cy.get('#nav li').should('have.length', 3)

    cy.get('.approvals [data-test="userC"]').should('exist')
    cy.get('.approvals [data-test="approve"]').should('exist').click()
    cy.wait('@api-inst-approvals-approve').its('request.url').should('include', 'userC')

    cy.get('.approvals [data-test="deny"]').should('exist').click()
    cy.wait('@api-inst-approvals-deny').its('request.url').should('include', 'userC')
  })

  it('inst table', () => {
    cy.visit('/institutions')
    keycloak({
      admin_insts: {instA:{users:['userA', 'userB', 'user'], "authorlist-physics":['userA'], "authorlist-astro":[]}},
      username: 'user',
      user_profile: {firstName: 'Foo', lastName: 'Bar', email: 'foo@bar'}
    })
    cy.wait('@api-experiments-associates').should(({ request, response }) => {
      expect(request.url).to.include('userA')
      expect(request.url).to.include('userB')
      expect(response.body).to.deep.eq([])
    })

    cy.get('[data-test="userA"]').within(() => {
      cy.get('.username').contains('userA', {matchCase: false})
      cy.get('button.update').should('not.exist')
      cy.get('input[name=authorlist-physics]').should('be.checked')
      cy.get('input[name=authorlist-astro]').should('not.be.checked').check()
      cy.get('button.update').should('exist').click()
      cy.wait('@api-institution-users-update').should(({ request, response }) => {
        expect(request.url).to.include('userA')
        expect(request.body).to.deep.eq({
          "authorlist-physics": true,
          "authorlist-astro": true
        })
      })
    })
    cy.get('[data-test="user"]').within(() => {
      cy.get('.username').contains('Foo Bar')
    })
  })

  it('inst table associate user', () => {
    cy.visit('/institutions')
    keycloak({
      admin_insts: {instA:{users:['userA', 'userB', 'user'], "authorlist-physics":['userA'], "authorlist-astro":[]}},
      user_associates: ['userB'],
      username: 'user',
      user_profile: {firstName: 'Foo', lastName: 'Bar', email: 'foo@bar'}
    })
    cy.wait('@api-experiments-associates').should(({ request, response }) => {
      expect(request.url).to.include('userA')
      expect(request.url).to.include('userB')
      expect(response.body).to.deep.eq(['userB'])
    })

    cy.get('[data-test="userA"]').within(() => {
      cy.get('.username').contains('userA', {matchCase: false})
      cy.get('button.update').should('not.exist')
      cy.get('input[name=authorlist-physics]').should('be.checked')
      cy.get('input[name=authorlist-astro]').should('not.be.checked').check()
      cy.get('button.update').should('exist').click()
      cy.wait('@api-institution-users-update').should(({ request, response }) => {
        expect(request.url).to.include('userA')
        expect(request.body).to.deep.eq({
          "authorlist-physics": true,
          "authorlist-astro": true
        })
      })
    })
    cy.get('[data-test="userB"]').within(() => {
      cy.get('span.associate-badge').should('exist')
      cy.get('.username').contains('userB', {matchCase: false})
      cy.get('button.update').should('not.exist')
      cy.get('input[name=authorlist-physics]').should('be.disabled')
      cy.get('input[name=authorlist-astro]').should('be.disabled')
    })
    cy.get('[data-test="user"]').within(() => {
      cy.get('.username').contains('Foo Bar')
    })
  })

  it('inst delete user', () => {
    cy.visit('/institutions')
    keycloak({
      admin_insts: {instA:{users:['userA', 'userB'], "authorlist-physics":['userA'], "authorlist-astro":[]}}
    })

    cy.get('[data-test="userA"] .delete').click()
    cy.wait('@api-institution-users-delete').its('request.url').should('include', 'userA')
  })

  it('inst add user group', () => {
    cy.visit('/institutions')
    keycloak({
      admin_insts: {instA:{users:['userA', 'userB'], "authorlist-physics":['userA'], "authorlist-astro":[]}}
    })

    cy.get('[data-test="userB"]').within(() => {
      cy.get('.username').contains('userB', {matchCase: false})
      cy.get('button.update').should('not.exist')
      cy.get('input[name=authorlist-physics]').should('not.be.checked')
      cy.get('input[name=authorlist-astro]').should('not.be.checked').check()
      cy.get('button.update').should('exist').click()
      cy.wait('@api-institution-users-update').should(({ request, response }) => {
        expect(request.url).to.include('userB')
        expect(request.body).to.deep.eq({
          "authorlist-physics": false,
          "authorlist-astro": true
        })
      })
    })
  })

  it('inst add user group', () => {
    cy.visit('/institutions')
    keycloak({
      admin_insts: {instA:{users:['userA', 'userB'], "authorlist":['userA']}}
    })

    cy.get('[data-test="userA"]').within(() => {
      cy.get('.username').contains('userA', {matchCase: false})
      cy.get('button.update').should('not.exist')
      cy.get('input[name=authorlist]').should('be.checked').uncheck()
      cy.get('button.update').should('exist').click()
      cy.wait('@api-institution-users-update').should(({ request, response }) => {
        expect(request.url).to.include('userA')
        expect(request.body).to.deep.eq({
          "authorlist": false
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

  it('inst register new user', () => {
    cy.visit('/institutions')
    keycloak({
      admin_insts: {instA:{users:['userA', 'userB'], "authorlist-physics":['userA'], "authorlist-astro":[]}},
      token_raw: 'tokentoken'
    })

    cy.get('[data-test="registration-link"]').should('exist')
  })

  it('inst edit user profile', () => {
    cy.visit('/institutions')
    keycloak({
      admin_insts: {instA:{users:['userA', 'userB'], "authorlist-physics":['userA'], "authorlist-astro":[]}},
      user_profile: {'firstName': 'Foo', 'lastName': 'Bar', 'email': 'foo@bar', 'orcid': '0000-0000-0000-0000'}
    })

    cy.get('[data-test="userA"] .profile').click()
    
    cy.get('.profile').should('exist')

    cy.get('.profile [name="orcid"]').should('have.value', '0000-0000-0000-0000').type('{selectAll}{del}1234-1234-1234-1234')
    cy.get('.profile button').click()

    cy.wait('@api-user-profile-put').should(({ request, response }) => {
      expect(request.url).to.include('userA')
      expect(request.body).to.deep.eq({
        'firstName': 'Foo',
        'lastName': 'Bar',
        'email': 'foo@bar',
        'mailing_list_email': '',
        'author_name': '',
        'author_firstName': '',
        'author_lastName': '',
        'author_email': '',
        'orcid': '1234-1234-1234-1234',
        'github': '',
        'slack': '',
        'mobile': '',
        'phd_year': '',
        'loginShell': ''
      })
    })
  })
})
