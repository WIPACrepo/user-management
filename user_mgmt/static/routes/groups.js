/** Groups route **/

import {get_my_group_admins} from '../helpers.js'

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
          console.log('group_admins', group_admins)
          let ret = await axios.get('/api/groups', {
            headers: {'Authorization': 'bearer '+token}
          })
          const all_groups = ret.data;
          console.log('all_groups:', all_groups)
          let groups = []
          let promises = [];
          for (const group of group_admins) {
            if (group in all_groups) {
              let token2 = await this.keycloak.get_token();
              promises.push(axios.get('/api/groups/'+all_groups[group], {
                headers: {'Authorization': 'bearer '+token2}
              }));
            }
          }
          console.log('promises', promises)
          let rets = await Promise.all(promises);
          console.log('promises_ret', rets)
          let j=0;
          let usernames = new URLSearchParams()
          for (let i=0;i<group_admins.length;i++) {
            const group = group_admins[i];
            if (group in all_groups) {
              const ret = rets[j];
              j += 1;
              let members = {}
              for (const username of ret.data) {
                usernames.append('username', username)
                members[username] = {}
              }
              let entry = {
                id: all_groups[group],
                name: group,
                members: members
              }
              groups.push(entry)
            }
          }
          const ret2 = await axios.get('/api/users', {
            headers: {'Authorization': 'bearer '+token},
            params: usernames
          })
          for (const entry of groups) {
            for (const username in entry.members) {
              if (username in ret2.data) {
                entry.members[username] = ret2.data[username]
              }
            }
          }
          console.log('groups:', groups)
          return groups
        } catch (error) {
          console.log('error getting groups', error)
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
    },
    getname: function(user, username) {
      if ('firstName' in user && 'lastName' in user) {
        return user.firstName+' '+user.lastName
      } else if ('lastName' in user) {
        return user.lastName
      } else {
        return username
      }
    }
  },
  template: `
<article class="groups">
  <div class="error_box red" v-if="error">{{ error }}</div>
  <div v-if="$asyncComputed.approvals.success" data-test="approvals">
    <h3>Users needing approval:</h3>
    <div v-if="approvals.length > 0" class="indent">
      <div class="group" v-for="group in approvals" :data-test="group.name">
        <h4>{{ group["name"] }}</h4>
        <div class="user indent" v-for="approval in group['members']" :data-test="approval.username">
          <span class="username">{{ approval['username'] }}</span>
          <span class="name" v-if="'first_name' in approval">{{ approval['first_name'] }} {{ approval['last_name'] }}</span>
          <button @click="approve(approval)" data-test="approve">Approve</button>
          <button @click="deny(approval)" data-test="deny">Deny</button>
        </div>
      </div>
    </div>
    <div v-else class="indent">No approvals waiting</div>
  </div>
  <div v-if="$asyncComputed.groups.success" data-test="administered-groups">
    <h3>Administered groups:</h3>
    <div class="group" v-for="group in groups" :data-test="group.name">
      <p>{{ group.name }}</p>
      <div class="double_indent" v-if="Object.keys(group.members).length > 0">
        <div class="user" v-for="(user, username) in group.members" :data-test="username">
          <span class="username">{{ getname(user, username) }}</span>
          <button @click="remove(group, username)">Remove</button>
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
