
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
        const ret = await get_all_groups();
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
    return resp.data
  } catch(error) {
    console.log(error)
    return {}
  }
};
