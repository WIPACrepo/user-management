/** helper functions **/

export async function get_username(keycloak) {
  if (!keycloak.authenticated())
    return ''
  try {
    const tokenParsed = await keycloak.get_tokenParsed()
    console.log(tokenParsed)
    return tokenParsed['username']
  } catch (error) {
    console.log("error getting username from token")
    return ''
  }
};

export async function get_my_experiments(keycloak) {
  if (!keycloak.authenticated())
    return []
  try {
    let experiments = []
    const tokenParsed = await keycloak.get_tokenParsed()
    console.log(tokenParsed)
    for (const group of tokenParsed.groups) {
      if (group.startsWith('/institutions')) {
        const parts = group.split('/')
        if (parts.length != 4)
          continue
        const exp = parts[2]
        if (!experiments.includes(exp))
          experiments.push(exp)
      }
    }
    console.log("get_my_experiments() - "+JSON.stringify(experiments))
    return experiments
  } catch (error) {
    console.log("error getting experiments from token")
    return []
  }
};

export async function get_my_institutions(keycloak, experiment) {
  if (!keycloak.authenticated())
    return []
  try {
    const tokenParsed = await keycloak.get_tokenParsed()
    console.log(tokenParsed)
    let institutions = {}
    for (const group of tokenParsed.groups) {
      if (group.startsWith('/institutions')) {
        const parts = group.split('/')
        if (parts.length >= 4 && parts[2] == experiment) {
          const inst = parts[3]
          if (parts.length == 4 || (parts.length == 5 && !parts[4].startsWith('_'))) {
            if (!(inst in institutions))
              institutions[inst] = {subgroups: []}
            if (parts.length == 5)
              institutions[inst].subgroups.push(parts[4])
          }
        }
      }
    }
    console.log("get_my_institutions() - "+JSON.stringify(institutions))
    return institutions
  } catch (error) {
    console.log("error getting institutions from token")
    console.log(error)
    return []
  }
};

export async function get_my_groups(keycloak) {
  if (!keycloak.authenticated())
    return []
  try {
    const tokenParsed = await keycloak.get_tokenParsed()
    console.log(tokenParsed)
    let groups = []
    for (const group of tokenParsed.groups) {
      if (!group.startsWith('/institutions')) {
        const parts = group.split('/')
        if (parts[parts.length-1].startsWith('_'))
          continue
        groups.push(group)
      }
    }
    console.log("get_my_groups() - "+JSON.stringify(groups))
    return groups
  } catch (error) {
    console.log("error getting groups from token")
    console.log(error)
    return []
  }
};

export async function get_my_inst_admins(keycloak) {
  if (!keycloak.authenticated())
    return []
  try {
    const tokenParsed = await keycloak.get_tokenParsed()
    console.log(tokenParsed)
    let institutions = []
    for (const group of tokenParsed.groups) {
      if (group == '/admin') {
        console.log("super admin - all insts")
        institutions = [];
        const ret = await get_all_inst_subgroups();
        for (const exp in ret) {
          for (const inst in ret[exp]) {
            institutions.push('/institutions/'+exp+'/'+inst);
          }
        }
        break;
      }
      if (group.startsWith('/institutions')) {
        const parts = group.split('/')
        if (parts.length == 5 && parts[4] == '_admin') {
          let inst = parts.slice(0,4).join('/')
          if (!institutions.includes(inst))
            institutions.push(inst)
        }
      }
    }
    institutions.sort();
    console.log("get_my_inst_admins() - "+JSON.stringify(institutions))
    return institutions
  } catch (error) {
    console.log("error getting admin institutions from token")
    return []
  }
};

export async function get_my_group_admins(keycloak) {
  if (!keycloak.authenticated())
    return []
  try {
    const tokenParsed = await keycloak.get_tokenParsed()
    console.log(tokenParsed)
    let groups = [];
    for (const group of tokenParsed.groups) {
      if (group == '/admin') {
        console.log("super admin - all groups")
        groups = [];
        const ret = await get_all_groups(keycloak);
        for (const g in ret) {
            groups.push(g);
        }
        break;
      }
      if (!group.startsWith('/institutions')) {
        const parts = group.split('/')
        if (parts.length > 2 && parts[parts.length-1] == '_admin') {
          let grp = parts.slice(0,parts.length-1).join('/')
          if (!groups.includes(grp))
            groups.push(grp)
        }
      }
    }
    console.log("get_my_group_admins() - "+JSON.stringify(groups))
    return groups
  } catch (error) {
    console.log("error getting admin groups from token")
    return []
  }
};

export async function get_all_inst_subgroups() {
  try {
    const resp = await axios.get('/api/all-experiments');
    return resp.data
  } catch (error) {
    console.log("error getting all inst_subgroups")
    console.log(error)
    return {}
  }
};

export async function get_all_groups(keycloak) {
  if (!keycloak.authenticated())
    return {}
  try {
    const token = await keycloak.get_token()
    const resp = await axios.get('/api/groups', {
      headers: {'Authorization': 'bearer '+token}
    })
    console.log('/api/groups ret:', resp.data)
    return resp.data
  } catch(error) {
    console.log(error)
    return {}
  }
};

// mixin for profile
export var profileMixin = {
  data: function() {
    return {
      keycloak: null,
      error: null,
      success: false,
      form_fields: {},
      field_names: {
        'firstName': 'First Name',
        'lastName': 'Last Name',
        'email': 'Email',
        'mailing_list_email': 'List Email',
        'github': 'GitHub Profile',
        'slack': 'Slack Profile',
        'mobile': 'Phone',
        'author_name': 'Author List Printed Name',
        'author_firstName': 'Author List First Name',
        'author_lastName': 'Author List Last Name',
        'author_email': 'Author List Email',
        'orcid': 'ORCID',
        'phd_year': 'PhD Year',
        'loginShell': 'Login Shell'
      },
      field_desc: {
        'firstName': null,
        'lastName': null,
        'email': 'External email (for password resets)',
        'mailing_list_email': 'Override your icecube.wisc.edu address for mailing lists',
        'github': 'GitHub username',
        'slack': 'Slack username',
        'mobile': 'Phone / mobile number',
        'author_name': 'Short author name (F. Last)',
        'author_firstName': 'Override first name for author lists',
        'author_lastName': 'Override last name for author lists',
        'author_email': 'Override email for author lists',
        'orcid': 'ORCID code (0000-0000-0000-0000)',
        'phd_year': '4 digit year of PhD, if attained',
        'loginShell': 'Linux login shell in Madison'
      }
    }
  },
  props: ['username', 'keycloak'],
  created: function() {
    this.download()
  },
  asyncComputed: {
    associate: {
      get: async function() {
        let ret = []
        try {
          const token = await this.keycloak.get_token();
          const experiments = await get_my_experiments(this.keycloak);
          for (const exp of experiments) {
            let params = new URLSearchParams()
            params.append('username', this.username)
            const ret = await axios.get('/api/experiments/'+exp+'/assocates', {
              headers: {'Authorization': 'bearer '+token},
              params: params
            })
            for (const username of ret.data) {
              if (this.username == username) {
                ret.append(exp)
              }
            }
          }
          return ret
        } catch (error) {
          console.log('error getting associate status', error)
          this.error = "Error getting associate status: "+error['message']
          return []
        }
      },
      default: []
    }
  },
  methods: {
    download: async function(){
      if (!this.keycloak.authenticated())
        return
      try {
        const token = await this.keycloak.get_token()
        const resp = await axios.get('/api/users/'+this.username, {
          headers: {'Authorization': 'bearer '+token}
        })
        console.log('/api/users/XXX ret:', resp.data)
        let newfields = {}
        for (const k in this.field_names) {
          if (k in resp.data) {
            console.log('set form field '+k+' to '+resp.data[k])
            newfields[k] = resp.data[k]
          } else {
            newfields[k] = ''
          }
        }
        this.form_fields = newfields
        this.error = null
      } catch(error) {
        console.log(error.toJSON())
        if ('error' in error.response.data) {
          error = error.response.data['error']
        }
        this.error = 'Error: '+error
      }
    },
    update: async function() {
      try {
        const token = await this.keycloak.get_token()
        await axios.put('/api/users/'+this.username, this.form_fields, {
          headers: {'Authorization': 'bearer '+token}
        })
        this.error = null
        this.success = true
        setInterval(() => { this.success = false }, 10000)
      } catch(error) {
        console.log(error.toJSON())
        if ('error' in error.response.data) {
          error = error.response.data['error']
        }
        this.error = 'Error: '+error
      }
    },
    disabled: function(key, val) {
      if (key == 'loginShell' && val == "/sbin/nologin") {
        return true
      }
      return false
    }
  },
  template: `
<div class="profile indent">
  <div v-if="associate != []">
    <span class="associate-badge">Associate</span> for <span v-for="exp in associate">{{ exp }} </span>
  </div>
  <div class="field" v-for="val, key in field_names">
    <label for="key">{{ val }}</label>
    <div>
      <input type="text" v-model="form_fields[key]" :name="key" :disabled="disabled(key, form_fields[key])" />
      <div class="help" v-if="field_desc[key] != null">{{ field_desc[key] }}</div>
    </div>
  </div>
  <div class="field">
    <label for="submit"></label>
    <button @click="update" data-test="submit">Update</button>
    <div data-test="submit-success" v-if="success">✅</div>
  </div>
  <div class="error" v-if="error">{{ error }}</div>
</div>`
};

export function debounce(fn, delay) {
  var timeoutID = null
  return function () {
    clearTimeout(timeoutID)
    var args = arguments
    var that = this
    timeoutID = setTimeout(function () {
      fn.apply(that, args)
    }, delay)
  }
};

export function sleep(ms) {                                                                                                                                                                                       
  return new Promise((resolve) => setTimeout(resolve, ms));                                                                                                                                                
};
