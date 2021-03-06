/** Register route **/

import {get_all_inst_subgroups} from '../helpers.js'

export default {
  data: function(){
    return {
      experiment: '',
      institution: '',
      reg_token: '',
      firstName: '',
      lastName: '',
      username: '',
      email: '',
      valid: true,
      errMessage: '',
      submitted: false
    }
  },
  props: ['experiment', 'institution', 'reg_token'],
  created: function() {
    this.validate_token()
  },
  computed: {
    validFirstName: function() {
      return this.firstName
    },
    validLastName: function() {
      return this.lastName
    },
    validEmail: function() {
      return this.email.indexOf('@',1) > 0
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
    validUsername: async function() {
      if (!(this.validFirstName && this.validLastName)) {
        return true
      }
      try {
        let args = {
            first_name: this.firstName,
            last_name: this.lastName
        }
        if (this.username != '') {
          args.username = this.username
        }
        const resp = await axios.post('/api/username', args, {
          headers: {'Authorization': 'bearer '+this.reg_token}
        });
        if (this.username != resp.data['username']) {
          this.username = resp.data['username']
        }
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
  methods: {
    validate_token: async function() {
      try {
        await axios.get('/api/reg_token/'+this.reg_token);
      } catch(error) {
        console.log('invalid reg_token')
        this.$router.push({name: 'home'})
        return false
      }
      return true
    },
      submit: async function(e) {
          // validate
          this.valid = (this.validExperiment && this.validInstitution && this.validFirstName
                  && this.validLastName && this.validUsername && this.validEmail)

          // now submit
          if (this.valid) {
              this.errMessage = 'Submission processing';
              try {
                  const resp = await axios.post('/api/inst_approvals', {
                      experiment: this.experiment,
                      institution: this.institution,
                      first_name: this.firstName,
                      last_name: this.lastName,
                      username: this.username,
                      email: this.email
                  }, {
                    headers: {'Authorization': 'bearer '+this.reg_token}
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
      <textinput name="First Name" inputName="first_name" v-model.trim="firstName"
       required=true :valid="validFirstName" :allValid="valid"></textinput>
      <textinput name="Last Name" inputName="last_name" v-model.trim="lastName"
       required=true :valid="validLastName" :allValid="valid"></textinput>
      <textinput name="Username" inputName="username" v-model.trim="username"
       required=true :valid="validUsername" :allValid="valid" helptext="Note: must be between 5-16 characters"></textinput>
      <textinput name="External Email Address" inputName="email" v-model.trim="email"
       required=true :valid="validEmail" :allValid="valid"></textinput>
      <div v-if="errMessage" class="error_box" v-html="errMessage"></div>
      <div class="entry" v-if="!submitted">
        <input type="submit" data-test="submit" value="Submit Registration">
      </div>
    </form>
</article>`
}