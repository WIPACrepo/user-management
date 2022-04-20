/** UserInfo route **/

export default {
  data: function(){
    return {
      title: ''
    }
  },
  props: ['keycloak'],
  asyncComputed: {
    userinfo: async function() {
      if (!this.keycloak.authenticated())
        return {}
      try {
        var ret = await this.keycloak.get_userInfo();
        return ret
      } catch (error) {
        return {"error": JSON.stringify(error)}
      }
    }
  },
  template: `
<article class="user-info">
  <h2>User details:</h2>
  <div v-for="(value, name) in userinfo">{{ name }}: {{ value }}</div>
</article>`
}
