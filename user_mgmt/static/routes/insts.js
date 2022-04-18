/** Insts route **/

import {get_my_inst_admins} from '../helpers.js'

export default {
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
