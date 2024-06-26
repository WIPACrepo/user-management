"""
Handle user institution-based actions.
"""
import logging
import uuid
import random
import string

from tornado.web import HTTPError
from rest_tools.server import catch_error, authenticated

import krs.users
import krs.groups
import krs.email

from .handler import MyHandler
from .users import Username

audit_logger = logging.getLogger('audit')


class Experiments(MyHandler):
    @catch_error
    async def get(self):
        """Get a list of experiments"""
        ret = await self.group_cache.list_groups()
        exps = set()
        for group in ret:
            val = group.strip('/').split('/')
            if len(val) == 2 and val[0] == 'institutions':
                exps.add(val[1])
        logging.info(f'exps: {exps}')
        self.write(sorted(exps))


class MultiInstitutions(MyHandler):
    @catch_error
    async def get(self, experiment):
        """
        Get a list of institutions in the experiment.

        Args:
            experiment (str): experiment name
        """
        ret = await self.group_cache.list_groups()
        insts = set()
        for group in ret:
            val = group.strip('/').split('/')
            if len(val) == 3 and val[0] == 'institutions' and val[1] == experiment:
                insts.add(val[2])
        self.write(sorted(insts))


class Institution(MyHandler):
    @catch_error
    async def get(self, experiment, institution):
        """
        Get information about an institution.

        Args:
            experiment (str): experiment name
            institution (str): institution name
        """
        inst_group = f'/institutions/{experiment}/{institution}'

        # get child groups
        try:
            group_info = await krs.groups.group_info(inst_group, rest_client=self.krs_client)
        except Exception:
            raise HTTPError(404, reason='institution does not exist')

        ret = {
            'subgroups': [child['name'] for child in group_info['subGroups'] if not child['name'].startswith('_')],
            'attributes': group_info.get('attributes', {})
        }
        self.write(ret)


class AllExperiments(MyHandler):
    @catch_error
    async def get(self):
        """
        Get institution subgroups in all experiments.

        Returns:
            dict: {experiment: {institution: dict}
        """
        ret = await self.group_cache.list_groups()

        exps = {}
        for group in ret:
            val = group.strip('/').split('/')
            if (not val) or val[0] != 'institutions' or any(v.startswith('_') for v in val):
                continue
            if len(val) >= 2 and val[1] not in exps:
                exps[val[1]] = {}
            if len(val) >= 3 and val[2] not in exps[val[1]]:
                exps[val[1]][val[2]] = {'subgroups': []}
            if len(val) == 4:
                exps[val[1]][val[2]]['subgroups'].append(val[3])
        self.write(exps)


class InstitutionMultiUsers(MyHandler):
    @authenticated
    @catch_error
    async def get(self, experiment, institution):
        """
        Get users in institution.

        Args:
            experiment (str): experiment name
            institution (str): institution name
        """
        insts = await self.get_admin_institutions()
        if experiment not in insts or institution not in insts[experiment]:
            raise HTTPError(403, reason='invalid authorization')

        inst_group = f'/institutions/{experiment}/{institution}'

        # get child groups
        try:
            group_info = await krs.groups.group_info(inst_group, rest_client=self.krs_client)
        except Exception:
            raise HTTPError(404, reason='institution does not exist')

        # get main membership
        ret = {}
        ret['users'] = await self.group_cache.get_members(inst_group)

        # get child groups, like the author list
        for child in group_info['subGroups']:
            if not child['name'].startswith('_'):
                ret[child['name']] = await self.group_cache.get_members(child['path'])

        self.write(ret)


class InstitutionUser(MyHandler):
    @authenticated
    @catch_error
    async def put(self, experiment, institution, username):
        """
        Add/update a user for an institution.

        Must be admin.

        Body json:
            subgroup_name (bool): user is/is not a sub-group member

        Args:
            experiment (str): experiment name
            institution (str): institution name
            username (str): username
        """
        insts = await self.get_admin_institutions()
        if experiment not in insts or institution not in insts[experiment]:
            raise HTTPError(403, reason='invalid authorization')

        try:
            await self.user_cache.get_user(username)
        except Exception:
            raise HTTPError(400, reason='invalid username')

        # check assocates
        if await self.is_associate(experiment, username):
            raise HTTPError(400, reason='cannot modify associate members. contact help@icecube.wisc.edu')

        inst_group = f'/institutions/{experiment}/{institution}'

        # get child groups
        try:
            group_info = await krs.groups.group_info(inst_group, rest_client=self.krs_client)
        except Exception:
            raise HTTPError(404, reason='institution does not exist')
        child_groups = [child['name'] for child in group_info['subGroups'] if not child['name'].startswith('_')]

        opt_fields = {key: bool for key in child_groups}
        data = self.json_filter({}, opt_fields)

        await krs.groups.add_user_group(inst_group, username, rest_client=self.krs_client)
        for name in child_groups:
            if name in data and data[name]:
                await krs.groups.add_user_group(f'{inst_group}/{name}', username, rest_client=self.krs_client)
            else:
                await krs.groups.remove_user_group(f'{inst_group}/{name}', username, rest_client=self.krs_client)
        self.group_cache.invalidate(inst_group)

        self.write({})

    @authenticated
    @catch_error
    async def delete(self, experiment, institution, username):
        """
        Delete user from institution.

        Must be admin or the user in question.

        Args:
            experiment (str): experiment name
            institution (str): institution name
            username (str): username
        """
        inst_group = f'/institutions/{experiment}/{institution}'
        insts = await self.get_admin_institutions()
        if (experiment not in insts or institution not in insts[experiment]) and inst_group not in self.auth_data['groups']:
            raise HTTPError(403, reason='invalid authorization')

        try:
            await self.user_cache.get_user(username)
        except Exception:
            raise HTTPError(400, reason='invalid username')

        # check assocates
        if await self.is_associate(experiment, username):
            raise HTTPError(400, reason='cannot modify associate members. contact help@icecube.wisc.edu')

        # get child groups
        try:
            group_info = await krs.groups.group_info(inst_group, rest_client=self.krs_client)
        except Exception:
            raise HTTPError(404, reason='institution does not exist')
        child_groups = [child['name'] for child in group_info['subGroups'] if not child['name'].startswith('_')]

        await krs.groups.remove_user_group(inst_group, username, rest_client=self.krs_client)
        for name in child_groups:
            await krs.groups.remove_user_group(f'{inst_group}/{name}', username, rest_client=self.krs_client)
        self.group_cache.invalidate(inst_group)

        self.write({})


class InstApprovals(MyHandler):
    @catch_error
    async def post(self):
        """New institution approval request"""
        if self.current_user:
            logging.info('existing user with new institution')
            user = self.auth_data['username']

            req_fields = {
                'experiment': str,
                'institution': str,
            }
            opt_fields = {
                'authorlist': bool,
                'remove_institution': str,
            }
            approval_data = self.json_filter(req_fields, opt_fields)
            approval_data['username'] = user

            # check assocates
            if await self.is_associate(approval_data['experiment'], user):
                raise HTTPError(400, reason='cannot modify associate members. contact help@icecube.wisc.edu')

        else:
            logging.info('new user registration')
            req_fields = {
                'experiment': str,
                'institution': str,
                'first_name': str,
                'last_name': str,
                'username': str,
                'email': str,
            }
            opt_fields = {
                'authorlist': bool,
                'author_name': str,
            }
            data = self.json_filter(req_fields, opt_fields)

            username = data['username']

            # check if username is valid
            if not Username._username_valid(username):
                raise HTTPError(400, reason='invalid username')

            # check for existing username
            ret = await self.db.inst_approvals.find_one({"username": username})
            if ret:
                raise HTTPError(400, reason='invalid username')
            try:
                await krs.users.user_info(username, rest_client=self.krs_client)
            except krs.users.UserDoesNotExist:
                pass  # username is available
            else:
                raise HTTPError(400, reason='invalid username')

            user_data = {
                'id': uuid.uuid1().hex,
                'username': username,
                'first_name': data['first_name'],
                'last_name': data['last_name'],
                'external_email': data['email'],
                'author_name': data['author_name'] if 'author_name' in data else '',
            }
            await self.db.user_registrations.insert_one(user_data)

            approval_data = {
                'experiment': data['experiment'],
                'institution': data['institution'],
                'newuser': user_data['id'],
                'username': username,
            }
            if 'authorlist' in data:
                approval_data['authorlist'] = data['authorlist']

        approval_data['id'] = uuid.uuid1().hex
        await self.db.inst_approvals.insert_one(approval_data)

        # send email to admins
        inst_group = f'/institutions/{approval_data["experiment"]}/{approval_data["institution"]}'
        await self.send_admin_email(inst_group, f'''IceCube Institution Request

A request for membership to {approval_data["experiment"]}/{approval_data["institution"]}
has been made by user {approval_data["username"]}.

Please approve or deny this request by going to:
  https://user-management.icecube.aq/institutions

Documentation is located at:
  https://docs.icecube.aq/Madison-account/user-workflow/admin_insts/
''')

        self.set_status(201)
        self.write({'id': approval_data['id']})

    @authenticated
    @catch_error
    async def get(self):
        """Get list of requests a user can approve"""
        insts = await self.get_admin_institutions()
        if not insts:
            raise HTTPError(403, reason='invalid authorization')

        search = {'$or': [{'experiment': exp, 'institution': inst} for exp in insts for inst in insts[exp]]}
        ret = []
        async for row in self.db.inst_approvals.find(search, projection={'_id': False}):
            if 'newuser' in row:
                ret2 = await self.db.user_registrations.find_one({'id': row['newuser']}, projection={'_id': False})
                for key in ret2:
                    if key not in row:
                        row[key] = ret2[key]
            ret.append(row)
        self.write(ret)


class InstitutionMultiApprovals(MyHandler):
    @authenticated
    @catch_error
    async def get(self, experiment, institution):
        """
        Get approvals for institution.

        Args:
            experiment (str): experiment name
            institution (str): institution name
        """
        insts = await self.get_admin_institutions()
        if experiment not in insts or institution not in insts[experiment]:
            raise HTTPError(403, reason='invalid authorization')

        search = {'experiment': experiment, 'institution': institution}
        ret = []
        async for row in self.db.inst_approvals.find(search, projection={'_id': False}):
            if 'newuser' in row:
                ret2 = await self.db.user_registrations.find_one({'id': row['newuser']}, projection={'_id': False})
                for key in ret2:
                    if key not in row:
                        row[key] = ret2[key]
            ret.append(row)
        self.write(ret)


class InstApprovalsActionApprove(MyHandler):
    @authenticated
    @catch_error
    async def post(self, approval_id):
        """
        Approve a institution approval.

        Args:
            approval_id (str): id of inst approval request
        """
        insts = await self.get_admin_institutions()
        ret = await self.db.inst_approvals.find_one({'id': approval_id})
        if not ret:
            raise HTTPError(404, reason='no record for approval_id')
        if not any(ret['experiment'] == exp and ret['institution'] in insts[exp] for exp in insts):
            raise HTTPError(403, reason='invalid authorization')

        newuser = 'newuser' in ret and ret['newuser']

        audit_logger.info(f'{self.auth_data["username"]} is approving request {approval_id}')
        if newuser:
            # create new user account
            user_data = await self.db.user_registrations.find_one({'id': ret['newuser']})
            if not user_data:
                raise HTTPError(400, reason='invalid new user')
            args = {
                "username": user_data['username'],
                "first_name": user_data['first_name'],
                "last_name": user_data['last_name'],
                "email": user_data['external_email'],
                "attribs": {},
            }
            if user_data.get('author_name', ''):
                args['attribs']['author_name'] = user_data['author_name']
            await krs.users.create_user(rest_client=self.krs_client, **args)
            password = ''.join(random.choices(string.ascii_letters+string.digits, k=16))
            await krs.users.set_user_password(args['username'], password, temporary=True, rest_client=self.krs_client)

            # posix by default
            await krs.groups.add_user_group('/posix', args['username'], rest_client=self.krs_client)

            await self.db.user_registrations.delete_one({'id': ret['newuser']})

        # add user to institution
        inst_group = f'/institutions/{ret["experiment"]}/{ret["institution"]}'
        await krs.groups.add_user_group(inst_group, ret['username'], rest_client=self.krs_client)
        if 'authorlist' in ret and ret['authorlist']:
            await krs.groups.add_user_group(inst_group+'/authorlist', ret['username'], rest_client=self.krs_client)
        self.group_cache.invalidate(inst_group)

        # also add to gen2 institution
        if ret['experiment'] == 'IceCube':
            gen2_inst_group = f'/institutions/IceCube-Gen2/{ret["institution"]}'
            ret2 = await self.group_cache.list_groups()
            if gen2_inst_group in ret2:
                await krs.groups.add_user_group(gen2_inst_group, ret['username'], rest_client=self.krs_client)
                if 'authorlist' in ret and ret['authorlist']:
                    await krs.groups.add_user_group(gen2_inst_group+'/authorlist', ret['username'], rest_client=self.krs_client)
                self.group_cache.invalidate(gen2_inst_group)

        if 'remove_institution' in ret and ret['remove_institution']:
            inst_group = f'/institutions/{ret["experiment"]}/{ret["remove_institution"]}'
            await krs.groups.remove_user_group(inst_group, ret['username'], rest_client=self.krs_client)
            await krs.groups.remove_user_group(inst_group+'/authorlist', ret['username'], rest_client=self.krs_client)
            self.group_cache.invalidate(inst_group)

            # also remove gen2 institution
            if ret['experiment'] == 'IceCube':
                gen2_inst_group = f'/institutions/IceCube-Gen2/{ret["remove_institution"]}'
                ret2 = await self.group_cache.list_groups()
                if gen2_inst_group in ret2:
                    await krs.groups.remove_user_group(gen2_inst_group, ret['username'], rest_client=self.krs_client)
                    await krs.groups.remove_user_group(gen2_inst_group+'/authorlist', ret['username'], rest_client=self.krs_client)
                    self.group_cache.invalidate(gen2_inst_group)

        await self.db.inst_approvals.delete_one({'id': approval_id})

        # send email
        try:
            if newuser:
                krs.email.send_email(
                    recipient={'name': f'{args["first_name"]} {args["last_name"]}', 'email': args['email']},
                    subject='IceCube Account Approved',
                    content=f'''Welcome to IceCube {args["first_name"]} {args["last_name"]}!

You have a new account with the IceCube project at UW-Madison.

Username:  {args["username"]}
Password:  {password}
E-mail Address:  {args["username"]}@icecube.wisc.edu

Please change your password immediately. Go to the password reset page to do so:
  https://keycloak.icecube.wisc.edu/auth/realms/IceCube/account/

Many IceCube resources, including the IceCube wiki, are protected with a
generic set of user credentials. If you see a window asking for security
credentials, enter the generic IceCube credentials below.
  Username:  icecube
  Password:  skua

More information about your account and resources available to you can be
found in the wiki:
  https://wiki.icecube.wisc.edu/index.php/Newbies

Please send requests for desktop or server support to: help@icecube.wisc.edu.


This account will be terminated when your association ends with the IceCube
Project. When your account is terminated, you may request email forwarding to
another address for up to six months.

By using this account, you agree to the IceCube IT Acceptable Use Policy.
  https://wiki.icecube.wisc.edu/index.php/Acceptable_Use_Policy

IceCube accounts are also subject to University of Wisconsin-Madison policies
listed in the "Other Governing Agreements" section of the policy linked above.
''')
            else:
                try:
                    args = await self.user_cache.get_user(ret['username'])
                except Exception:
                    raise HTTPError(400, reason='invalid username')
                krs.email.send_email(
                    recipient={'name': f'{args["firstName"]} {args["lastName"]}', 'email': args['email']},
                    subject='IceCube Account Institution Changes',
                    content=f'''IceCube Institution Change

Your account with the IceCube project at UW-Madison has been altered.
You are now a member of {ret["experiment"]}/{ret["institution"]}.
''')
        except Exception:
            logging.warning('failed to send email for inst approval', exc_info=True)

        self.write({})


class InstApprovalsActionDeny(MyHandler):
    @authenticated
    @catch_error
    async def post(self, approval_id):
        """
        Approve a institution approval.

        Args:
            approval_id (str): id of inst approval request
        """
        insts = await self.get_admin_institutions()
        ret = await self.db.inst_approvals.find_one({'id': approval_id})
        if not ret:
            raise HTTPError(404, reason='no record for approval_id')
        if not any(ret['experiment'] == exp and ret['institution'] in insts[exp] for exp in insts):
            raise HTTPError(403, reason='invalid authorization')

        newuser = 'newuser' in ret and ret['newuser']

        audit_logger.info(f'{self.auth_data["username"]} is denying request {approval_id}')
        if newuser:
            user_data = await self.db.user_registrations.find_one({'id': ret['newuser']})
            if not user_data:
                raise HTTPError(400, reason='invalid new user')
            await self.db.user_registrations.delete_one({'id': ret['newuser']})
        await self.db.inst_approvals.delete_one({'id': approval_id})

        # send email
        try:
            if newuser:
                args = {
                    "username": user_data['username'],
                    "firstName": user_data['first_name'],
                    "lastName": user_data['last_name'],
                    "email": user_data['external_email'],
                }
            else:
                try:
                    args = await self.user_cache.get_user(ret['username'])
                except Exception:
                    raise HTTPError(400, reason='invalid username')
            krs.email.send_email(
                recipient={'name': f'{args["firstName"]} {args["lastName"]}', 'email': args['email']},
                subject='IceCube Account Request Denied',
                content=f'''IceCube Account Request Denied

Your account request for {ret["experiment"]}/{ret["institution"]} is denied.
''')
        except Exception:
            logging.warning('failed to send email for inst deny', exc_info=True)

        self.write({})
