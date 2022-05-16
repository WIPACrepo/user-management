/** User profile route **/

import {profileMixin} from '../helpers.js'

export default {
  data: function(){
    return {
      keycloak: null,
      username: '',
    }
  },
  props: ['keycloak'],
  created: function() {
    if (this.$route.query.username) {
      this.username = this.$route.query.username
    } else {
      console.log('no username specified')
      this.$router.push({name: 'home'})
    }
  },
  asyncComputed: {
  },
  template: `
<article class="userprofile">
  <h2>Editing User Profile: {{ username }}</h2>
  <profile :keycloak="keycloak" :username="username"></profile>
</article>`
}

Vue.component('profile', {
  mixins: [profileMixin]
})