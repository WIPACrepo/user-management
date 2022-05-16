/** Home route **/

import {get_username, get_my_experiments, get_my_institutions, get_my_groups, get_all_inst_subgroups, get_all_groups, profileMixin} from '../helpers.js'

export default {
  data: function(){
    return {
      join_inst: false,
      join_group: false,
      experiment: '',
      institution: '',
      remove_institution: '',
      group: '',
      error: '',
      form_error: '',
      group_form_error: '',
      valid: true,
      submitted: false,
      refresh: 0
    }
  },
  props: ['keycloak'],
  asyncComputed: {
    my_username: async function() {
      return await get_username(this.keycloak)
    },
    my_experiments: {
      get: async function(){
        let exps = await get_my_experiments(this.keycloak)
        let ret = {}
        for (const exp of exps) {
          ret[exp] = await get_my_institutions(this.keycloak, exp)
        }
        return ret
      },
      watch: ['refresh']
    },
    my_groups: {
      get: async function(){
        let groups = await get_my_groups(this.keycloak)
        let ret = {}
        if (this.groups !== null) {
          for (const name in this.groups) {
            if (groups.includes(name))
              ret[name] = this.groups[name]
          }
        }
        return ret
      },
      watch: ['groups','refresh']
    },
    validExperiment: function() {
      try {
        return this.experiment != '' && this.experiments !== null && this.experiment in this.experiments
      } catch(error) {
        return false
      }
    },
    validInstitution: function() {
      try {
        return this.institution != '' && this.institutions !== null && this.institutions.includes(this.institution)
      } catch(error) {
        return false
      }
    },
    experiments: get_all_inst_subgroups,
    institutions: async function() {
      if (this.validExperiment) {
        try {
          let insts = []
          if (this.experiment in this.experiments) {
            if (!(this.experiment in this.my_experiments)) {
              insts = Object.keys(this.experiments[this.experiment])
            } else {
              for (const inst in this.experiments[this.experiment]) {
                if (!(inst in this.my_experiments[this.experiment]))
                  insts.push(inst)
              }
            }
          }
          return insts.sort()
        } catch (error) {
          console.log('error', error)
        }
      }
      return []
    },
    groups: async function() {
        return await get_all_groups(this.keycloak);
    },
    validGroup: function() {
      try {
        return this.group != '' && this.groups !== null && this.group in this.groups
      } catch(error) {
        return false
      }
    }
  },
  watch: {
    remove_institution: function(val) {
      this.form_error = ''
      if (val != '') {
        this.join_inst = false
      }
    },
    join_inst: function(val) {
      this.form_error = ''
      if (val)
        this.remove_institution = ''
    },
    join_group: function(val) {
      this.group_form_error = ''
    }
  },
  methods: {
    submit: async function(e) {
      // validate
      this.valid = (this.validExperiment && this.validInstitution)

      // now submit
      if (this.valid) {
        let data = {
          experiment: this.experiment,
          institution: this.institution,
        }
        let confirm_msg = 'Are you sure you want to '
        if (this.remove_institution != '') {
          data.remove_institution = this.remove_institution
          confirm_msg += 'change institutions from '+this.remove_institution+' to '+this.institution+'?'
        } else {
          confirm_msg += 'join the institution '+this.institution+'?'
        }
        if (!window.confirm(confirm_msg)) {
          return;
        }

        this.errMessage = 'Submission processing';
        try {
          const token = await this.keycloak.get_token()
          const resp = await axios.post('/api/inst_approvals', data, {
            headers: {'Authorization': 'bearer '+token}
          });
          console.log('Response:')
          console.log(resp)
          this.form_error = 'Submission successful'
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
          this.form_error = '<span class="red">Error in submission<br>'+error_message+'</span>'
        }
      } else {
        this.form_error = '<span class="red">Please fix invalid entries</span>'
      }
    },
    submit_group: async function(e) {
      if (this.validGroup) {
        let confirm_msg = 'Are you sure you want to join the group '+this.group+'?'
        if (!window.confirm(confirm_msg)) {
          return;
        }

        this.errMessage = 'Submission processing';
        try {
          const token = await this.keycloak.get_token()
          let data = {
            group: this.group
          }
          const resp = await axios.post('/api/group_approvals', data, {
            headers: {'Authorization': 'bearer '+token}
          });
          console.log('Response:')
          console.log(resp)
          this.form_error = 'Submission successful'
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
          this.group_form_error = '<span class="red">Error in submission<br>'+error_message+'</span>'
        }
      } else {
        this.group_form_error = '<span class="red">Please fix invalid entries</span>'
      }
    },
    leave_inst_action: async function(exp, inst) {
      let confirm_msg = 'Are you sure you want to leave the institution '+this.inst+'?'
      if (!window.confirm(confirm_msg)) {
        return;
      }

      try {
        const token = await this.keycloak.get_token()
        const username = await get_username();
        const resp = await axios.delete('/api/experiments/'+exp+'/institutions/'+inst+'/users/'+username, {
          headers: {'Authorization': 'bearer '+token}
        });
        console.log('Response:')
        console.log(resp)
        this.refresh = this.refresh+1
      } catch (error) {
        console.log('error')
        console.log(error)
        let error_message = 'undefined error';
        if (error.response && 'data' in error.response) {
          if ('code' in error.response.data) {
            error_message = 'Code: '+error.response.data['code']+'<br>Message: '+error.response.data['error'];
          } else {
            error_message = JSON.stringify(error.response.data)
          }
        } else if (error.request) {
          error_message = 'server did not respond';
        }
        this.error = '<span class="red">Error removing institution<br>'+error_message+'</span>'
      }
    },
    move_inst_action: function(exp, inst) {
      if (this.remove_institution != '') {
        this.experiment = ''
        this.instutition = ''
        this.remove_institution = ''
      } else {
        this.experiment = exp
        this.instutition = ''
        this.remove_institution = inst
      }
    },
    leave_subgroup_action: async function(exp, inst, sub) {
      let confirm_msg = 'Are you sure you want to leave the institution '+inst+' group '+sub+'?'
      if (!window.confirm(confirm_msg)) {
        return;
      }

      try {
        const token = await this.keycloak.get_token()
        const username = await get_username();
        let data = {}
        data[sub] = false
        for (const subgroup of this.experiments[exp][inst].subgroups) {
          if (sub != subgroup)
            data[subgroup] = true
        }
        const resp = await axios.put('/api/experiments/'+exp+'/institutions/'+inst+'/users/'+username, data, {
          headers: {'Authorization': 'bearer '+token}
        });
        console.log('Response:')
        console.log(resp)
        this.refresh = this.refresh+1
      } catch (error) {
        console.log('error')
        console.log(error)
        let error_message = 'undefined error';
        if (error.response && 'data' in error.response) {
          if ('code' in error.response.data) {
            error_message = 'Code: '+error.response.data['code']+'<br>Message: '+error.response.data['error'];
          } else {
            error_message = JSON.stringify(error.response.data)
          }
        } else if (error.request) {
          error_message = 'server did not respond';
        }
        this.error = '<span class="red">Error leaving subgroup<br>'+error_message+'</span>'
      }
    },
    leave_group_action: async function(group_id) {
      let confirm_msg = 'Are you sure you want to leave the group '+this.group+'?'
      if (!window.confirm(confirm_msg)) {
        return;
      }

      try {
        const token = await this.keycloak.get_token()
        const username = await get_username();
        const resp = await axios.delete('/api/groups/'+group_id+'/'+username, {
          headers: {'Authorization': 'bearer '+token}
        });
        console.log('Response:')
        console.log(resp)
        this.refresh = this.refresh+1
      } catch (error) {
        console.log('error')
        console.log(error)
        let error_message = 'undefined error';
        if (error.response && 'data' in error.response) {
          if ('code' in error.response.data) {
            error_message = 'Code: '+error.response.data['code']+'<br>Message: '+error.response.data['error'];
          } else {
            error_message = JSON.stringify(error.response.data)
          }
        } else if (error.request) {
          error_message = 'server did not respond';
        }
        this.error = '<span class="red">Error leaving group<br>'+error_message+'</span>'
      }
    }
  },
  template: `
<article class="home">
  <div v-if="keycloak.authenticated()">
    <h2 style="margin-bottom: 1em">My profile:</h2>
    <div class="error_box" v-if="error" v-html="error"></div>
    <my-profile :username="my_username" :keycloak="keycloak" v-if="my_username"></my-profile>
    <h3>Experiments / Institutions</h3>
    <div v-if="$asyncComputed.my_experiments.success">
      <div class="indent" v-for="exp in Object.keys(my_experiments).sort()">
        <p class="italics">{{ exp }}<p>
        <div class="double_indent institution" v-for="inst in Object.keys(my_experiments[exp]).sort()">
          <span class="italics">{{ inst }}</span>
          <button @click="move_inst_action(exp, inst)">Move institutions</button>
          <button @click="leave_inst_action(exp, inst)">Leave institution</button>
          <div class="double_indent" v-if="remove_institution != ''" >
            <form class="newuser" @submit.prevent="submit">
              <div class="entry">
                <p>Select institution:</p>
                <select v-model="institution">
                  <option disabled value="">Please select one</option>
                  <option v-for="inst2 in institutions">{{ inst2 }}</option>
                </select>
                <span class="red" v-if="!validInstitution">invalid entry</span>
              </div>
              <div class="error_box" v-if="form_error" v-html="form_error"></div>
              <div class="entry">
                <input type="submit" value="Submit Move Request">
              </div>
            </form>
          </div>
          <div class="double_indent subgroup" v-for="sub in my_experiments[exp][inst].subgroups">
            <span class="italics">{{ sub }}</span>
            <button @click="leave_subgroup_action(exp, inst, sub)">Leave sub-group</button>
          </div>
        </div>
      </div>
      <div class="indent" v-if="my_experiments.length <= 0">You do not belong to any institutions</div>
      <div class="join">
        <button @click="join_inst = !join_inst">Join an institution</button>
        <div class="double_indent" v-if="join_inst" >
          <form class="newuser" @submit.prevent="submit">
            <div class="entry">
              <p>Select experiment:</p>
              <select v-model="experiment">
                <option disabled value="">Please select one</option>
                <option v-for="exp in Object.keys(experiments).sort()">{{ exp }}</option>
              </select>
              <span class="red" v-if="!valid && !validExperiment">invalid entry</span>
            </div>
            <div class="entry">
              <p>Select institution:</p>
              <select v-model="institution">
                <option disabled value="">Please select one</option>
                <option v-for="inst in institutions">{{ inst }}</option>
              </select>
              <span class="red" v-if="!valid && !validInstitution">invalid entry</span>
            </div>
            <div class="error_box" v-if="form_error" v-html="form_error"></div>
            <div class="entry" v-if="!submitted">
              <input type="submit" value="Submit Join Request">
            </div>
          </form>
        </div>
      </div>
    </div>
    <div class="indent" v-else>Loading institution information...</div>
    <h3>Groups</h3>
    <div v-if="$asyncComputed.my_groups.success">
      <div class="indent group" v-for="grp in Object.keys(my_groups).sort()">
        <span class="italics">{{ grp }}</span>
        <button @click="leave_group_action(my_groups[grp])">Leave group</button>
      </div>
      <div class="indent" v-if="my_groups.length <= 0">You do not belong to any groups</div>
    </div>
    <div class="indent" v-else>Loading group information...</div>
    <div class="join">
      <button @click="join_group = !join_group">Join a group</button>
      <div class="double_indent" v-if="join_group" >
        <form class="newuser" @submit.prevent="submit_group">
          <div class="entry">
            <p>Select group:</p>
            <select v-model="group">
              <option disabled value="">Please select one</option>
              <option v-for="grp in Object.keys(groups).sort()">{{ grp }}</option>
            </select>
            <span class="red" v-if="!validGroup">invalid entry</span>
          </div>
          <div class="error_box" v-if="group_form_error" v-html="group_form_error"></div>
          <div class="entry">
            <input type="submit" value="Submit Join Request">
          </div>
        </form>
      </div>
    </div>
  </div>
  <div v-else class="welcome">
    <h3>Welcome to the IceCube Neutrino Observatory identity management console.</h3>
    <p>Existing users should <login :keycloak="keycloak"></login>.</p>
    <p>New users should <router-link :to="{name: 'register'}">register</router-link>.</p>
  </div>
</article>`
}

Vue.component('my-profile', {
  mixins: [profileMixin]
})