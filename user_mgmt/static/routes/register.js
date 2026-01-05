/** Register route **/

import {get_all_inst_subgroups, debounce, sleep} from '../helpers.js'

export default {
  data: function(){
    return {
      experiment: '',
      institution: '',
      firstName: '',
      debouncedFirstName: '',
      lastName: '',
      debouncedLastName: '',
      username: '',
      debouncedUsername: '',
      email: '',
      debouncedEmail: '',
      supervisor: '',
      valid: true,
      errMessage: '',
      submitted: false
    }
  },
  props: ['experiment', 'institution'],
  computed: {
    validFirstName: function() {
      return this.debouncedFirstName
    },
    validLastName: function() {
      return this.debouncedLastName
    },
    validEmail: function() {
      return this.debouncedEmail.indexOf('@',1) > 0
    },
    validSupervisor: function() {
      return this.admins.length === 0 || this.supervisor !== ''
    },
    institutions: function() {
      try {
        if (this.$asyncComputed.experiments.success && this.experiment in this.experiments) {
          console.log('experiments', this.experiments)
          console.log('institutions', this.experiments[this.experiment])
          return this.experiments[this.experiment]
        }
      } catch(e) { }
      return {}
    }
  },
  asyncComputed: {
    experiments: get_all_inst_subgroups,
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
    admins: {
      get: async function() {
        if (this.validInstitution) {
          try {
            const resp = await axios.get('/api/experiments/'+this.experiment+'/institutions/'+this.institution);
            if ('admins' in resp.data) {
              return resp.data['admins']
            }
          } catch(e) { console.log(e) }
        }
        return []
      },
      default: [],
      watch: ['institution']
    },
    validUsername: async function() {
      if (!(this.validFirstName && this.validLastName)) {
        return true
      }
      try {
        const orig_username = this.debouncedUsername;
        let args = {
            first_name: this.debouncedFirstName,
            last_name: this.debouncedLastName
        }
        if (orig_username != '') {
          args.username = orig_username
        }
        const resp = await axios.post('/api/username', args, {});
        if (orig_username != resp.data['username'] && this.username == orig_username) {
          this.username = resp.data['username']
        }
        this.errMessage = ''
        return true
      } catch(error) {
        console.log(error)
        let error_message = 'undefined error';
        if (error.response) {
            if ('error' in error.response.data) {
                error_message = 'Message: '+error.response.data['error'];
            } else {
                error_message = JSON.stringify(error.response.data)
            }
        } else if (error.request) {
            error_message = 'server did not respond';
        }
        this.errMessage = '<span class="red">Invalid username<br>'+error_message+'</span>'
        return false
      }
    }
  },
  watch: {
    firstName: debounce(function(newVal) {
      this.debouncedFirstName = newVal
      this.username = ''
      this.debouncedUsername = ''
    }, 250),
    lastName: debounce(function(newVal) {
      this.debouncedLastName = newVal
      this.username = ''
      this.debouncedUsername = ''
    }, 250),
    username: debounce(function(newVal) {
      this.debouncedUsername = newVal
    }, 250),
    email: debounce(function(newVal) {
      this.debouncedEmail = newVal
    }, 250),
    admins: function(newVal) {
      if (newVal.length === 1) {
        this.supervisor = newVal[0].username
      } else {
        this.supervisor = ''
      }
    }
  },
  methods: {
    submit: async function(e) {
      // wait for debounce
      await sleep(250)

      // validate
      this.valid = (this.validExperiment && this.validInstitution && this.validFirstName
                    && this.validLastName && this.validUsername && this.validEmail && this.validSupervisor)

      // now submit
      if (this.valid) {
        this.errMessage = 'Submission processing';
        try {
          let args = {
            experiment: this.experiment,
            institution: this.institution,
            first_name: this.firstName,
            last_name: this.lastName,
            username: this.username,
            email: this.email
          }
          if (this.supervisor != '') {
            args.supervisor = this.supervisor
          }
          const resp = await axios.post('/api/inst_approvals', args, {});
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
        <select v-model="experiment" data-test="experiment">
          <option disabled value="">Please select one</option>
          <option v-for="exp in Object.keys(experiments).sort()">{{ exp }}</option>
        </select>
        <span class="red" v-if="!valid && !validExperiment">invalid entry</span>
      </div>
      <div class="entry">
        <p>Select your institution: <span class="red">*</span></p>
        <select v-model="institution" :disabled="Object.keys(institutions).length < 1" data-test="institution">
          <option disabled value="">Please select one</option>
          <option v-for="inst in Object.keys(institutions).sort()">{{ inst }}</option>
        </select>
        <span class="red" v-if="!valid && !validInstitution">invalid entry</span>
        <div class="help">Note: You cannot select your institution until you've selected your experiment</div>
      </div>
      <div class="entry" v-if="admins.length > 0">
        <p>Select your supervisor: <span class="red">*</span></p>
        <select v-model="supervisor" data-test="supervisor">
          <option disabled value="">Please select one</option>
          <option v-for="admin in admins" :value="admin.username">{{ admin.firstName }} {{ admin.lastName }}</option>
        </select>
        <span class="red" v-if="!valid && !validSupervisor">invalid entry</span>
      </div>
      <textinput name="First Name" inputName="first_name" v-model.trim="firstName"
       required=true :valid="validFirstName" :allValid="valid"></textinput>
      <textinput name="Last Name" inputName="last_name" v-model.trim="lastName"
       required=true :valid="validLastName" :allValid="valid"></textinput>
      <textinput name="Username" inputName="username" v-model.trim="username"
       required=true :valid="validUsername" :allValid="valid" helptext="Note: must be between 5-16 characters, ascii lowercase and numbers"></textinput>
      <textinput name="External Email Address" inputName="email" v-model.trim="email"
       required=true :valid="validEmail" :allValid="valid"></textinput>
      <div v-if="errMessage" class="error_box" v-html="errMessage"></div>
      <div class="entry" v-if="!submitted">
        <input type="submit" data-test="submit" value="Submit Registration">
      </div>
    </form>
</article>`
}