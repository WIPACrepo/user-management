/** Insts route **/

import {get_my_inst_admins} from '../helpers.js'

export default {
  data: function(){
    return {
      keycloak: null
    }
  },
  props: ['keycloak'],
  asyncComputed: {
    institutions: {
      get: async function() {
        try {
          const inst_admins = await get_my_inst_admins(this.keycloak);
          return inst_admins
        } catch (error) {
          this.error = "Error getting institutions: "+error['message']
          return []
        }
      },
      default: []
    }
  },
  template: `
<article class="institutions">
  <div v-if="$asyncComputed.institutions.success">
    <h3>Administered institutions:</h3>
    <inst :keycloak="keycloak" :group_path="inst" v-for="inst in institutions"></inst>
  </div>
</article>`
}

Vue.component('inst', {
  data: function(){
    return {
      keycloak: null,
      error: '',
      group_path: '',
      refresh: 0
    }
  },
  props: ['keycloak', 'group_path'],
  computed: {
    experiment: function() {
      const parts = this.group_path.split('/')
      return parts[2]
    },
    institution: function() {
      const parts = this.group_path.split('/')
      return parts[3]
    },
    ready: function() {
      return this.$asyncComputed.approvals.success && this.$asyncComputed.members.success
    }
  },
  asyncComputed: {
    approvals: {
      get: async function() {
        try {
          const token = await this.keycloak.get_token();
          const ret = await axios.get('/api/experiments/'+this.experiment+'/institutions/'+this.institution+'/approvals', {
            headers: {'Authorization': 'bearer '+token}
          })
          return ret.data
        } catch (error) {
          console.log('error getting approvals', error)
          this.error = "Error getting approvals: "+error['message']
          return []
        }
      },
      default: [],
      watch: ['refresh']
    },
    reg_token: {
      get: async function() {
        try {
          const token = await this.keycloak.get_token();
          const ret = await axios.post('/api/reg_token', {
            headers: {'Authorization': 'bearer '+token}
          })
          return ret.data.token
        } catch (error) {
          console.log('error getting registration token', error)
          this.error = "Error getting registration token: "+error['message']
          return ''
        }
      },
      default: ''
    },
    members: {
      get: async function() {
        try {
          const token = await this.keycloak.get_token();
          const ret = await axios.get('/api/experiments/'+this.experiment+'/institutions/'+this.institution+'/users', {
            headers: {'Authorization': 'bearer '+token}
          })
          // convert from membership lists to user-based attributes
          console.log('users raw', ret.data)
          let entry = {groups: {}, members: {}}
          for (const key in ret.data) {
            if (key == 'users') {
              for (const username of ret.data.users) {
                if (!(username in entry.members)) {
                  entry.members[username] = {groups: {}}
                }
              }
            } else {
              entry.groups[key] = key.replace(/-/g, ' - ')
              for (const username of ret.data[key]) {
                if (!(username in entry.members)) {
                  entry.members[username] = {groups: {}}
                }
                entry.members[username].groups[key] = true
              }
            }
          }
          let params = new URLSearchParams()
          for (const username in entry.members) {
            params.append('username', username)
          }
          let fut = axios.get('/api/users', {
            headers: {'Authorization': 'bearer '+token},
            params: params
          })
          for (let username in entry.members) {
            for (const name in entry.groups) {
              if (!(name in entry.members[username].groups)) {
                entry.members[username].groups[name] = false
              }
            }
          }
          const ret2 = await fut
          for (const username in ret2.data) {
            Object.assign(entry.members[username], ret2.data[username])
          }
          console.log('members', entry)
          return entry
        } catch (error) {
          console.log('error getting inst members', error)
          this.error = "Error getting inst members: "+error['message']
          return {groups: {}, members: {}}
        }
      },
      default: {groups: {}, members: {}},
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
    addMember: async function(username) {
      if (username == '') {
        this.error = "Error adding user: did not enter user name"
        return
      }

      let confirm_msg = 'Are you sure you want to add the user '+username+' to '+this.institution+'?';
      if (!window.confirm(confirm_msg)) {
        return;
      }

      try {
        const token = await this.keycloak.get_token();
        await axios.put('/api/experiments/'+this.experiment+'/institutions/'+this.institution+'/users/'+username, {}, {
          headers: {'Authorization': 'bearer '+token}
        })
        this.error = ""
        this.refresh = this.refresh+1
      } catch (error) {
        this.error = "Error adding user: "+error['message']
      }
    },
    updateMember: async function(username, groups={}) {
      if (username == '') {
        this.error = "Error updating user: did not enter user name"
        return
      }

      let confirm_msg = 'Are you sure you want to updating the user '+username+' from '+this.institution+'?';
      if (!window.confirm(confirm_msg)) {
        return
      }

      try {
        const token = await this.keycloak.get_token();
        await axios.put('/api/experiments/'+this.experiment+'/institutions/'+this.institution+'/users/'+username, groups, {
          headers: {'Authorization': 'bearer '+token}
        })
        this.error = ""
        this.refresh = this.refresh+1
      } catch (error) {
        this.error = "Error removing user: "+error['message']
      }
    },
    removeMember: async function(username) {
      if (username == '') {
        this.error = "Error removing user: did not enter user name"
        return
      }

      let confirm_msg = 'Are you sure you want to remove the user '+username+' from '+this.institution+'?';
      if (!window.confirm(confirm_msg)) {
        return
      }

      try {
        const token = await this.keycloak.get_token();
        await axios.delete('/api/experiments/'+this.experiment+'/institutions/'+this.institution+'/users/'+username, {
          headers: {'Authorization': 'bearer '+token}
        })
        this.error = ""
        this.refresh = this.refresh+1
      } catch (error) {
        this.error = "Error removing user: "+error['message']
      }
    },
    go_to_profile: function(username) {
      this.$router.push({path: "/userprofile", query: {username: username}})
    }
  },
  template: `
<div class="inst">
  <h3>{{ experiment }} - {{ institution }}</h3>
  <div class="error_box red" v-if="error">{{ error }}</div>
  <div class="indent" v-if="ready">
    <h4>Users needing approval:</h4>
    <div v-if="approvals.length > 0" class="indent approvals">
      <div class="user" v-for="approval in approvals" :data-test="approval.username">
        <span class="newuser" v-if="'newuser' in approval">New</span>
        <span class="username">{{ approval['username'] }}</span>
        <span class="name" v-if="'first_name' in approval">{{ approval['first_name'] }} {{ approval['last_name'] }}</span>
        <span class="author" v-if="'authorlist' in approval">Author</span>
        <button @click="approve(approval)" data-test="approve">Approve</button>
        <button @click="deny(approval)" data-test="deny">Deny</button>
      </div>
    </div>
    <div v-else class="indent">No approvals waiting</div>
    <h4>Institution members:</h4>
    <div class="insttable indent">
      <table class="inst-members">
        <thead>
          <tr>
            <th>Member</th>
            <th v-for="(title, name) in members.groups">{{ title }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <instmember :username="username" :memberdata="data" :group_names="members.groups"
              :remove="removeMember" :update="updateMember" :profile="go_to_profile"
              v-for="(data, username) in members.members">
          </instmember>
        </tbody>
      </table>
    </div>
    <h4>Add existing user:</h4>
    <div class="indent add">
      <addinstuser :submit="addMember"></addinstuser>
    </div>
    <h4>Register new user:</h4>
    <div class="indent add" v-if="$asyncComputed.reg_token.success && reg_token != ''" data-test="registration-link" :data-reg-token="reg_token">
      <div>New user page: <router-link :to="{name: 'register', query: {experiment: experiment, institution: institution, reg_token: reg_token} }">Register</router-link></div>
      <div class="invite">
        <label for="register-invite">You may also hand out this invite to new users, which expires in 7 days:</label><br>
        <textarea id="register-invite">Please fill out the form at this link to register for an account:
{{ window.location.protocol + '//' + window.location.host + $router.resolve({name: 'register', query: {experiment: experiment, institution: institution, reg_token: reg_token} }).href }}</textarea>
      </div>
    </div>
  </div>
  <div class="indent loading" v-else>Loading...</div>
</div>`
})

Vue.component('instmember', {
  data: function(){
    return {
      'username': '',
      'memberdata': null,
      'user_groups': {},
      'remove': null,
      'update': null
    }
  },
  props: ['username', 'memberdata', 'group_names', 'remove', 'update', 'profile'],
  created: function() {
    this.user_groups = Object.assign({}, this.memberdata.groups)
    console.log('user_groups:', this.user_groups)
  },
  computed: {
    changed: function() {
      let ret = false
      for (const g in this.group_names) {
        ret |= (this.memberdata.groups[g] != this.user_groups[g])
      }
      return ret
    },
    name: function() {
      if ('firstName' in this.memberdata && 'lastName' in this.memberdata) {
        return this.memberdata.firstName+' '+this.memberdata.lastName
      } else if ('lastName' in this.memberdata) {
        return this.memberdata.lastName
      } else {
        return this.username
      }
    }
  },
  template: `
<tr :data-test="username">
  <td><span class="username">{{ name }}</span> <span class="delete material-icons" @click="remove(username)">delete_forever</span></td>
  <td v-for="(title, name) in group_names"><input :name="name" type="checkbox" v-model="user_groups[name]" /></td>
  <td class="actions"><button class="profile" @click="profile(username)">Edit Profile</button> <button class="update" @click="update(username, user_groups)" v-if="changed">Update</button></td>
</tr>`
})

Vue.component('addinstuser', {
  data: function(){
    return {
      submit: null,
      username: ''
    }
  },
  props: ['submit'],
  template: `
<div>
  Existing user by username: <input name="username" v-model.trim="username" placeholder="username" @input="$emit('input', $event.target.value)" @keyup.enter="submit">
  <button @click="submit(username)">Add</button>
</div>`
})
