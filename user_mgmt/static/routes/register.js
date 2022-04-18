/** Register route **/

import {get_all_inst_subgroups} from '../helpers.js'

export default {
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