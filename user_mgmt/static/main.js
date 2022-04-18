// debug flag
var krs_debug = false;

import {get_my_inst_admins, get_my_group_admins} from './helpers.js'


/** Routes **/
const Home = () => import('./routes/home.js')
const UserInfo = () => import('./routes/userinfo.js')
const Register = () => import('./routes/register.js')
const Insts = () => import('./routes/insts.js')
const Groups = () => import('./routes/groups.js')
const Error404 = () => import('./routes/error404.js')


/** Vue common components **/

Vue.component('textinput', {
  data: function(){
    return {
      required: false,
      valid: true,
      allValid: true
    }
  },
  props: ['name', 'inputName', 'value', 'required', 'valid', 'allValid'],
  template: `
<div class="entry">
  <p>{{ name }}: <span v-if="required" class="red">*</span></p>
  <input :name="inputName" :value="value" @input="$emit('input', $event.target.value)">
  <span class="red" v-if="!allValid && !valid && (required || value)">invalid entry</span>
</div>`
})

Vue.component('navpage', {
  data: function(){
    return {
      path: '',
      name: '',
      current: ''
    }
  },
  props: ['path', 'name', 'current'],
  computed: {
    classObj: function() {
      return {
        active: this.name == this.current
      }
    },
  },
  beforeRouteEnter(to, from, next) {
    this.current = to.params.route
    next()
  },
  template: '<li :class="classObj"><router-link :to="path">{{ name }}</router-link></li>'
});

Vue.component('account', {
  data: function(){
    return {
    }
  },
  props: ['keycloak'],
  asyncComputed: {
    name: async function() {
      if (!this.keycloak.authenticated())
        return ""
      try {
        var ret = await this.keycloak.get_userInfo();
        return ret['given_name']
      } catch (error) {
        return ""
      }
    }
  },
  template: `
<div class="account">
  <login v-if="!keycloak.authenticated()" :keycloak="keycloak" caps="true"></login>
  <div v-else>Signed in as <span class="username">{{ name }}</span><br><logout :keycloak="keycloak" caps="true"></logout></div>
</div>`
});

Vue.component('login', {
  data: function(){
    return {
      caps: "true",
    }
  },
  props: ['keycloak', 'caps'],
  computed: {
    name: function() {
      if (this.caps == "true")
        return 'Sign in'
      else
        return 'sign in'
    }
  },
  methods: {
    login: async function() {
      console.log('login')
      await this.keycloak.login({redirectUri:window.location})
    }
  },
  template: `<span class="login-link" @click="login">{{ name }}</span>`
});

Vue.component('logout', {
  data: function(){
    return {
      caps: false,
    }
  },
  props: ['keycloak', 'caps'],
  computed: {
    name: function() {
      if (this.caps)
        return 'Sign out'
      else
        return 'sign out'
    }
  },
  methods: {
    logout: async function() {
      console.log('logout')
      await this.keycloak.logout(window.location.origin)
    }
  },
  template: `<span class="login-link" @click="logout">{{ name }}</span>`
});


// scrollBehavior:
// - only available in html5 history mode
// - defaults to no scroll behavior
// - return false to prevent scroll
const scrollBehavior = function (to, from, savedPosition) {
  if (savedPosition) {
    // savedPosition is only available for popstate navigations.
    return savedPosition
  } else {
    const position = {}

    // scroll to anchor by returning the selector
    if (to.hash) {
      position.selector = to.hash

      // specify offset of the element
      if (to.hash === '#anchor2') {
        position.offset = { y: 100 }
      }

      // bypass #1number check
      if (/^#\d/.test(to.hash) || document.querySelector(to.hash)) {
        return position
      }

      // if the returned position is falsy or an empty object,
      // will retain current scroll position.
      return false
    }

    return new Promise(resolve => {
      // check if any matched route config has meta that requires scrolling to top
      if (to.matched.some(m => m.meta.scrollToTop)) {
        // coords will be used if no selector is provided,
        // or if the selector didn't match any element.
        position.x = 0
        position.y = 0
      }

      // wait for the out transition to complete (if necessary)
      this.app.$root.$once('triggerScroll', () => {
        // if the resolved position is falsy or an empty object,
        // will retain current scroll position.
        resolve(position)
      })
    })
  }
}


export default async function vue_startup(keycloak){
  const routes = [
    { path: '/', name: 'home', component: Home,
      props: {keycloak: keycloak}
    },
    { path: '/userinfo', name: 'userinfo', component: UserInfo,
      props: {keycloak: keycloak}, meta: { requiresAuth: true, testing: true }
    },
    { path: '/register', name: 'register', component: Register,
      props: (route) => ({
        experiment: route.query.experiment,
        institution: route.query.institution
      })
    },
    { path: '/institutions', name: 'Institutions', component: Insts,
      props: {keycloak: keycloak}, meta: { requiresAuth: true, requiresInstAdmin: true }
    },
    { path: '/groups', name: 'Groups', component: Groups,
      props: {keycloak: keycloak}, meta: { requiresAuth: true, requiresGroupAdmin: true }
    },
    { path: '*', name: '404', component: Error404, props: true }
  ];

  var router = new VueRouter({
    mode: 'history',
    routes: routes,
    scrollBehavior: scrollBehavior
  })
  router.beforeEach(async function(to, from, next){
    console.log('baseurl: '+window.location.origin)

    if (to.meta && to.meta.requiresAuth && !keycloak.authenticated()) {
      // do login process
      console.log("keycloak needs login")
      await keycloak.login(window.location.origin+to.path)
    }
    else next()
  })

  var app = new Vue({
    el: '#page-container',
    data: {
      routes: routes,
      keycloak: keycloak,
      current: 'home'
    },
    router: router,
    asyncComputed: {
      visibleRoutes: async function() {
        var current = this.current;
        var ret = []
        for (const r of this.routes) {
          if (r.path[0] == '*')
            continue
          if (r.path.startsWith('/register') && current != 'register')
            continue
          if (krs_debug !== true && r.meta && r.meta.testing) {
            console.log('skipping route because this is only for testing')
            continue
          }
          if (r.meta && r.meta.requiresAuth && !keycloak.authenticated()) {
            console.log('skipping route because we are not authenticated')
            continue
          }
          if (r.meta && r.meta.requiresInstAdmin && (await get_my_inst_admins(keycloak)).length <= 0) {
            console.log('skipping route because we are not an inst admin')
            continue
          }
          if (r.meta && r.meta.requiresGroupAdmin && (await get_my_group_admins(keycloak)).length <= 0) {
            console.log('skipping route because we are not a group admin')
            continue
          }
          ret.push(r)
        }
        console.log('routes',ret)
        return ret
      }
    },
    watch: {
      '$route.currentRoute.path': {
        handler: function() {
          console.log('currentPath update:'+router.currentRoute.path)
          this.current = router.currentRoute.name
        },
        deep: true,
        immediate: true,
      }
    }
  })
}
