// debug flag
var krs_debug = false;

import {get_username, get_my_experiments, get_my_institutions, get_my_groups, get_my_inst_admins, get_my_group_admins, get_all_inst_subgroups, get_all_groups} from './helpers.js'


/** Routes **/
const Home = () => import('./routes/home.js')

const UserInfo = {
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

const Register = {
  data: function(){
    return {
      experiment: '',
      institution: '',
      firstName: '',
      lastName: '',
      authorListName: '',
      email: '',
      valid: true,
      errMessage: '',
      submitted: false
    }
  },
  props: ['experiment', 'institution'],
  computed: {
    validFirstName: function() {
      return this.firstName
    },
    validLastName: function() {
      return this.lastName
    },
    validAuthorListName: function() {
      return this.authorListName
    },
    validEmail: function() {
      return this.email.indexOf('@',1) > 0
    }
  },
  asyncComputed: {
    validExperiment: function() {
      try {
        return this.experiment != '' && this.experiments !== null && this.experiment in this.experiments
      } catch(error) {
        return false
      }
    },
    validInstitution: function() {
      try {
        return this.institution != '' && this.experiments !== null && this.experiment in this.experiments && this.institution in this.experiments[this.experiment]
      } catch(error) {
        return false
      }
    },
    experiments: get_all_inst_subgroups,
    institutions: function() {
      try {
        return this.experiments[this.experiment]
      } catch(error) {
        return {}
      }
    }
  },
  methods: {
      submit: async function(e) {
          // validate
          this.valid = (this.validExperiment && this.validInstitution && this.validFirstName
                  && this.validLastName && (!this.authorListName || this.validAuthorListName)
                  && this.validEmail)

          // now submit
          if (this.valid) {
              this.errMessage = 'Submission processing';
              try {
                  const resp = await axios.post('/api/inst_approvals', {
                      experiment: this.experiment,
                      institution: this.institution,
                      first_name: this.firstName,
                      last_name: this.lastName,
                      author_name: this.authorListName,
                      email: this.email
                  });
                  console.log('Response:')
                  console.log(resp)
                  this.errMessage = 'Submission successful'
                  this.submitted = true
              } catch (error) {
                  console.log('error')
                  console.log(error)
                  let error_message = 'undefined error';
                  if (error.response) {
                      if ('code' in error.response.data) {
                          error_message = 'Code: '+error.response.data['code']+'<br>Message: '+error.response.data['error'];
                      } else {
                          error_message = JSON.stringify(error.response.data)
                      }
                  } else if (error.request) {
                      error_message = 'server did not respond';
                  }
                  this.errMessage = '<span class="red">Error in submission<br>'+error_message+'</span>'
              }
          } else {
              this.errMessage = '<span class="red">Please fix invalid entries</span>'
          }
      }
  },
  template: `
<article class="register">
    <h2>Register a new account</h2>
    <form class="newuser" @submit.prevent="submit" v-if="$asyncComputed.experiments.success">
      <div class="entry">
        <span class="red">* entry is requred</span>
      </div>
      <div class="entry">
        <p>Select your experiment: <span class="red">*</span></p>
        <select v-model="experiment">
          <option disabled value="">Please select one</option>
          <option v-for="exp in Object.keys(experiments).sort()">{{ exp }}</option>
        </select>
        <span class="red" v-if="!valid && !validExperiment">invalid entry</span>
      </div>
      <div class="entry">
        <p>Select your institution: <span class="red">*</span></p>
        <select v-model="institution">
          <option disabled value="">Please select one</option>
          <option v-for="inst in Object.keys(institutions).sort()">{{ inst }}</option>
        </select>
        <span class="red" v-if="!valid && !validInstitution">invalid entry</span>
      </div>
      <textinput name="First Name" inputName="first_name" v-model.trim="firstName"
       required=true :valid="validFirstName" :allValid="valid"></textinput>
      <textinput name="Last Name" inputName="last_name" v-model.trim="lastName"
       required=true :valid="validLastName" :allValid="valid"></textinput>
      <textinput name="Author List Name (usually abbreviated)" inputName="authorname"
       v-model.trim="authorListName" :valid="validAuthorListName" :allValid="valid"></textinput>
      <textinput name="Email Address" inputName="email" v-model.trim="email"
       required=true :valid="validEmail" :allValid="valid"></textinput>
      <div v-if="errMessage" class="error_box" v-html="errMessage"></div>
      <div class="entry" v-if="!submitted">
        <input type="submit" value="Submit Registration">
      </div>
    </form>
</article>`
}

const Insts = {
  data: function(){
    return {
      refresh: 0,
      error: ''
    }
  },
  props: ['keycloak'],
  asyncComputed: {
    approvals: {
      get: async function() {
        try {
          const token = await this.keycloak.get_token();
          var ret = await axios.get('/api/inst_approvals', {
            headers: {'Authorization': 'bearer '+token}
          })
          let institutions = {}
          for (const entry of ret['data']) {
            let inst = entry['experiment']+entry['institution']
            if (!(inst in institutions)) {
              institutions[inst] = {
                experiment: entry['experiment'],
                institution: entry['institution'],
                users: []
              }
            }
            institutions[inst]['users'].push(entry)
          }
          return Object.values(institutions)
        } catch (error) {
          this.error = "Error getting approvals: "+error['message']
          return []
        }
      },
      default: [],
      watch: ['refresh']
    },
    institutions: {
      get: async function() {
        try {
          const inst_admins = await get_my_inst_admins(this.keycloak);
          let institutions = []
          const token = await this.keycloak.get_token();
          let promises = [];
          for (const inst of inst_admins) {
            let parts = inst.split('/')
            promises.push(axios.get('/api/experiments/'+parts[2]+'/institutions/'+parts[3]+'/users', {
              headers: {'Authorization': 'bearer '+token}
            }));
          }
          let rets = await Promise.all(promises);
          for (let i=0;i<inst_admins.length;i++) {
            let inst = inst_admins[i];
            let ret = rets[i];
            let parts = inst.split('/')
            let entry = {
              experiment: parts[2],
              institution: parts[3],
              groups: {},
              members: {}
            }
            // convert from membership lists to user-based attributes
            for (const key in ret.data) {
              if (key != 'users') {
                entry.groups[key] = key.replace(/-/g, ' - ')
              }
              for (const username of ret.data[key]) {
                if (!(username in entry.members)) {
                  entry.members[username] = {}
                }
                entry.members[username][key] = true
              }
            }
            for (let username in entry.members) {
              for (const name in entry.groups) {
                if (!(name in entry.members[username])) {
                  entry.members[username][name] = false
                }
              }
            }
            institutions.push(entry)
          }

          return institutions
        } catch (error) {
          this.error = "Error getting institutions: "+error['message']
          return []
        }
      },
      default: [],
      watch: ['refresh']
    }
  },
  methods: {
    approve: async function(approval) {
      let confirm_msg = 'Are you sure you want to approve the request for ';
      if ('first_name' in approval && 'last_name' in approval) {
        confirm_msg += approval['first_name']+' '+approval['last_name']+'?'
      } else {
        confirm_msg += approval['username']+'?'
      }
      if (!window.confirm(confirm_msg)) {
        return;
      }

      try {
        const token = await this.keycloak.get_token();
        await axios.post('/api/inst_approvals/'+approval['id']+'/actions/approve', {}, {
          headers: {'Authorization': 'bearer '+token}
        });
        this.error = ""
        this.refresh = this.refresh+1
      } catch (error) {
        this.error = "Error approving: "+error['message']
      }
    },
    deny: async function(approval) {
      let confirm_msg = 'Are you sure you want to deny the request for ';
      if ('first_name' in approval && 'last_name' in approval) {
        confirm_msg += approval['first_name']+' '+approval['last_name']+'?'
      } else {
        confirm_msg += approval['username']+'?'
      }
      if (!window.confirm(confirm_msg)) {
        return;
      }

      try {
        const token = await this.keycloak.get_token();
        await axios.post('/api/inst_approvals/'+approval['id']+'/actions/deny', {}, {
          headers: {'Authorization': 'bearer '+token}
        });
        this.error = ""
        this.refresh = this.refresh+1
      } catch (error) {
        this.error = "Error denying: "+error['message']
      }
    },
    add: async function(inst, name, username) {
      if (username == '') {
        this.error = "Error adding user: did not enter user name"
        return
      }

      let confirm_msg = 'Are you sure you want to add the user '+username+' to '+inst.institution+'?';
      if (!window.confirm(confirm_msg)) {
        return;
      }

      try {
        const token = await this.keycloak.get_token();
        let data = {}
        for (const key in inst.members) {
          if (key == 'users')
            continue
          if (name == key) {
            data[key] = true
          } else if (inst.members[key].includes(username)) {
            data[key] = true
          }
        }
        await axios.put('/api/experiments/'+inst.experiment+'/institutions/'+inst.institution+'/users/'+username, data, {
          headers: {'Authorization': 'bearer '+token}
        })
        this.error = ""
        this.refresh = this.refresh+1
      } catch (error) {
        this.error = "Error adding user: "+error['message']
      }
    },
    update: async function(inst, username) {
    },
    remove: async function(inst, name, username) {
      if (username == '') {
        this.error = "Error removing user: did not enter user name"
        return
      }

      let confirm_msg = 'Are you sure you want to remove the user '+username+' from '+inst.institution+'?';
      if (!window.confirm(confirm_msg)) {
        return
      }

      try {
        const token = await this.keycloak.get_token();
        if (name == 'users') {
          await axios.delete('/api/experiments/'+inst.experiment+'/institutions/'+inst.institution+'/users/'+username, {
            headers: {'Authorization': 'bearer '+token}
          })
        } else {
          let data = {}
          for (const key in inst.members) {
            if (key == 'users')
              continue
            if (name == key) {
              data[key] = false
            } else if (inst.members[key].includes(username)) {
              data[key] = true
            }
          }
          await axios.put('/api/experiments/'+inst.experiment+'/institutions/'+inst.institution+'/users/'+username, data, {
            headers: {'Authorization': 'bearer '+token}
          })
        }
        this.error = ""
        this.refresh = this.refresh+1
      } catch (error) {
        this.error = "Error removing user: "+error['message']
      }
    }
  },
  template: `
<article class="institutions">
  <div class="error_box red" v-if="error">{{ error }}</div>
  <div v-if="$asyncComputed.approvals.success">
    <h3>Users needing approval:</h3>
    <div v-if="approvals.length > 0" class="indent">
      <div class="inst" v-for="inst in approvals">
        <h4>{{ inst["experiment"] }} - {{ inst["institution"] }}</h4>
        <div class="user indent" v-for="approval in inst['users']">
          <span class="newuser" v-if="'newuser' in approval">New</span>
          <span class="username">{{ approval['username'] }}</span>
          <span class="name" v-if="'first_name' in approval">{{ approval['first_name'] }} {{ approval['last_name'] }}</span>
          <span class="author" v-if="'authorlist' in approval">Author</span>
          <button @click="approve(approval)">Approve</button>
          <button @click="deny(approval)">Deny</button>
        </div>
      </div>
    </div>
    <div v-else class="indent">No approvals waiting</div>
  </div>
  <div v-if="$asyncComputed.institutions.success">
    <h3>Administered institutions:</h3>
    <div class="inst" v-for="inst in institutions">
      <h4>{{ inst.experiment }} - {{ inst.institution }}</h4>
      <div class="indent">
        <insttable :inst="inst" :addFunc="add" :updateFunc="update"></insttable>
      </div>
    </div>
  </div>
</article>`
}

const Groups = {
  data: function(){
    return {
      refresh: 0,
      error: ''
    }
  },
  props: ['keycloak'],
  asyncComputed: {
    approvals: {
      get: async function() {
        try {
          const token = await this.keycloak.get_token();
          var ret = await axios.get('/api/group_approvals', {
            headers: {'Authorization': 'bearer '+token}
          })
          let groups = {}
          for (const entry of ret['data']) {
            let group = entry['group']
            if (!(group in groups)) {
              groups[group] = {
                id: entry['group_id'],
                name: group,
                members: []
              }
            }
            groups[group]['members'].push(entry)
          }
          return Object.values(groups)
        } catch (error) {
          this.error = "Error getting approvals: "+error['message']
          return []
        }
      },
      watch: ['refresh']
    },
    groups: {
      get: async function() {
        try {
          const token = await this.keycloak.get_token();
          const group_admins = await get_my_group_admins(this.keycloak);
          let ret = await axios.get('/api/groups', {
            headers: {'Authorization': 'bearer '+token}
          })
          const all_groups = ret.data;
          let groups = []
          let promises = [];
          for (const group of group_admins) {
            if (group in all_groups) {
              const token2 = await this.keycloak.get_token();
              promises.push(await axios.get('/api/groups/'+all_groups[group], {
                headers: {'Authorization': 'bearer '+token2}
              }));
            }
          }
          let rets = await Promise.all(promises);
          let j=0;
          for (let i=0;i<group_admins.length;i++) {
            const group = group_admins[i];
            if (group in all_groups) {
              const ret = rets[j];
              j += 1;
              let entry = {
                id: all_groups[group],
                name: group,
                members: ret.data
              }
              groups.push(entry)
            }
          }
          return groups
        } catch (error) {
          this.error = "Error getting groups: "+error['message']
          return []
        }
      },
      watch: ['refresh']
    }
  },
  methods: {
    approve: async function(approval) {
      let confirm_msg = 'Are you sure you want to approve the request for ';
      if ('first_name' in approval && 'last_name' in approval) {
        confirm_msg += approval['first_name']+' '+approval['last_name']+'?'
      } else {
        confirm_msg += approval['username']+'?'
      }
      if (!window.confirm(confirm_msg)) {
        return;
      }

      try {
        const token = await this.keycloak.get_token();
        await axios.post('/api/group_approvals/'+approval['id']+'/actions/approve', {}, {
          headers: {'Authorization': 'bearer '+token}
        });
        this.error = ""
        this.refresh = this.refresh+1
      } catch (error) {
        this.error = "Error approving: "+error['message']
      }
    },
    deny: async function(approval) {
      let confirm_msg = 'Are you sure you want to deny the request for ';
      if ('first_name' in approval && 'last_name' in approval) {
        confirm_msg += approval['first_name']+' '+approval['last_name']+'?'
      } else {
        confirm_msg += approval['username']+'?'
      }
      if (!window.confirm(confirm_msg)) {
        return;
      }

      try {
        const token = await this.keycloak.get_token();
        await axios.post('/api/group_approvals/'+approval['id']+'/actions/deny', {}, {
          headers: {'Authorization': 'bearer '+token}
        });
        this.error = ""
        this.refresh = this.refresh+1
      } catch (error) {
        this.error = "Error denying: "+error['message']
      }
    },
    add: async function(group, username) {
      let confirm_msg = 'Are you sure you want to add the user '+username+' to '+group['name']+'?';
      if (!window.confirm(confirm_msg)) {
        return;
      }

      try {
        if (username == '') {
          this.error = "Error adding user: did not enter user name"
          return
        }
        const token = await this.keycloak.get_token();
        await axios.put('/api/groups/'+group['id']+'/'+username, {}, {
          headers: {'Authorization': 'bearer '+token}
        })
        this.error = ""
        this.refresh = this.refresh+1
      } catch (error) {
        this.error = "Error adding user: "+error['message']
      }
    },
    remove: async function(group, username) {
      let confirm_msg = 'Are you sure you want to remove the user '+username+' from '+group['name']+'?';
      if (!window.confirm(confirm_msg)) {
        return;
      }

      try {
        const token = await this.keycloak.get_token();
        await axios.delete('/api/groups/'+group['id']+'/'+username, {
          headers: {'Authorization': 'bearer '+token}
        })
        this.error = ""
        this.refresh = this.refresh+1
      } catch (error) {
        this.error = "Error removing user: "+error['message']
      }
    }
  },
  template: `
<article class="groups">
  <div class="error_box red" v-if="error">{{ error }}</div>
  <div v-if="$asyncComputed.approvals.success">
    <h3>Users needing approval:</h3>
    <div v-if="approvals.length > 0" class="indent">
      <div class="group" v-for="group in approvals">
        <h4>{{ group["name"] }}</h4>
        <div class="user indent" v-for="approval in group['members']">
          <span class="username">{{ approval['username'] }}</span>
          <span class="name" v-if="'first_name' in approval">{{ approval['first_name'] }} {{ approval['last_name'] }}</span>
          <button @click="approve(approval)">Approve</button>
          <button @click="deny(approval)">Deny</button>
        </div>
      </div>
    </div>
    <div v-else class="indent">No approvals waiting</div>
  </div>
  <div v-if="$asyncComputed.groups.success">
    <h3>Administered groups:</h3>
    <div class="group" v-for="group in groups">
      <p>{{ group["name"] }}</p>
      <div class="double_indent" v-if="group['members'].length > 0">
        <div class="user" v-for="user in group['members']">
          <span class="username">{{ user }}</span>
          <button @click="remove(group, user)">Remove</button>
        </div>
      </div>
      <div class="double_indent" v-else>No members</div>
      <div class="double_indent add">
        <addgroupuser :addFunc="add" :group="group"></addgroupuser>
      </div>
    </div>
  </div>
</article>`
}


const Error404 = {
    data: function(){
        return {
        }
    },
    computed: {
        'pathMatch': function() {
            return this.$route.params[0];
        }
    },
    template: `
<article class="error">
    <h2>Error: page not found</h2>
    <p><span class="code">{{ pathMatch }}</span> does not exist</p>
</article>`
}


/** Vue components **/

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

Vue.component('insttable', {
  data: function(){
    return {
      addFunc: null,
      updateFunc: null,
      deleteFunc: null,
      inst: null,
      name: ''
    }
  },
  props: ['addFunc', 'updateFunc', 'deleteFunc', 'inst', 'name'],
  computed: {
    users: function(){
      ret = {}
      return ret
    }
  },
  methods: {
    add: function() {
      this.addFunc(this.inst, this.name, this.username)
    },
    update: function(username) {
      this.updateFunc(this.inst, this.name, this.username)
    }
  },
  template: `
<div class="insttable">
  <table class="inst-members">
    <thead>
      <tr>
        <th>Member</th>
        <th v-for="(title, name) in inst.groups">{{ title }}</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(groups, username) in inst.members">
        <td>{{ username }} <span class="delete material-icons" @click="remove(inst, 'users', username)">delete_forever</span></td>
        <td v-for="(title, name) in inst.groups"><input type="checkbox" v-model="groups[name]" /></td>
        <td><button @click="update(username)">Update</button></td>
      </tr>
    </tbody>
  </table>
  <div class="indent add">
    <addinstuser :addFunc="add" :inst="inst" :name="name"></addinstuser>
  </div>
</div>`
})

Vue.component('addinstuser', {
  data: function(){
    return {
      addFunc: null,
      inst: null,
      name: '',
      username: ''
    }
  },
  props: ['addFunc', 'inst', 'name'],
  methods: {
    submit: function() {
      this.addFunc(this.inst, this.name, this.username)
    }
  },
  template: `
<div>
  Add user: <input v-model.trim="username" placeholder="username" @input="$emit('input', $event.target.value)" @keyup.enter="submit">
  <button @click="submit">Add</button>
</div>`
})

Vue.component('addgroupuser', {
  data: function(){
    return {
      addFunc: null,
      group: '',
      username: ''
    }
  },
  props: ['addFunc', 'group'],
  methods: {
    submit: function() {
      this.addFunc(this.group, this.username)
    }
  },
  template: `
<div>
  Add user: <input v-model.trim="username" placeholder="username" @input="$emit('input', $event.target.value)" @keyup.enter="submit">
  <button @click="submit">Add</button>
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
