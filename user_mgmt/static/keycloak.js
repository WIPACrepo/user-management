
const insertScript = (path) =>
  new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = path;
    s.onload = () => resolve(s);  // resolve with script, not event
    s.onerror = reject;
    document.body.appendChild(s);
  });

export default function(keycloak_url, keycloak_realm){
  // Keycloak object
  let _keycloak = null;

  return {
    init: async function() {
      try {
        await insertScript(keycloak_url+'/auth/js/keycloak.js')
        _keycloak = new Keycloak({
          url: keycloak_url+'/auth',
          realm: keycloak_realm,
          clientId: 'user_mgmt'
        })
        await _keycloak.init({
          onLoad: 'check-sso',
          checkLoginIframe: false
        })
      } catch (error) {
        console.log("error loading keycloak", error)
      }
    },
    authenticated: function() {
      return _keycloak.authenticated
    },
    login: async function(redirectUri=null) {
      if (redirectUri == null) {
        redirectUri = window.location
      }
      await _keycloak.login({redirectUri: redirectUri})
    },
    logout: async function(redirectUri=null) {
      if (redirectUri == null) {
        redirectUri = window.location
      }
      await _keycloak.logout({redirectUri: redirectUri})
    },
    get_token: async function() {
      await _keycloak.updateToken(5)
      return _keycloak.token
    },
    get_tokenParsed: async function() {
      await _keycloak.updateToken(5)
      return _keycloak.tokenParsed
    },
    get_userInfo: async function() {
      await _keycloak.updateToken(5)
      const ret = await _keycloak.loadUserInfo()
      return ret
    }
  }
}
