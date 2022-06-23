"""
Handle user profile updates.
"""
import logging

from tornado.web import HTTPError
from rest_tools.server import catch_error, authenticated

import krs.users
import krs.groups

from .handler import MyHandler


VALID_FIELDS = {
    'firstName': str,
    'lastName': str,
    'email': str,
    'github': str,
    'slack': str,
    'mobile': str,
    'author_name': str,
    'author_firstName': str,
    'author_lastName': str,
    'author_email': str,
    'orcid': str,
}


def is_admin_of_inst_member(admin_insts, user_groups):
    for exp in admin_insts:
        for inst in admin_insts[exp]:
            group_name = f'/institutions/{exp}/{inst}'
            if group_name in user_groups:
                return True
    return False


class User(MyHandler):
    async def check_auth(self, username):
        """
        Check auth

        Should match either as the user in question, or an admin of an
        institution they are a member of.
        """
        if username != self.auth_data['username']:
            insts = await self.get_admin_institutions()
            try:
                user_groups = await krs.groups.get_user_groups(username, rest_client=self.krs_client)
            except Exception:
                raise HTTPError(404, 'invalid username')
            if not is_admin_of_inst_member(insts, user_groups):
                raise HTTPError(403, 'invalid authorization')

    @authenticated
    @catch_error
    async def get(self, username):
        """
        Get user profile.

        Args:
            username (str): username of user
        Returns:
            dict: user profile
        """
        logging.info('get user %s', username)
        await self.check_auth(username)
        logging.info('auth is good')

        try:
            user_info = await krs.users.user_info(username, rest_client=self.krs_client)
        except Exception:
            raise HTTPError(404, 'invalid username')
        logging.info('valid username')

        profile = {}
        for k in ('firstName', 'lastName', 'email', 'username'):
            profile[k] = user_info[k]
        attrs = user_info.get('attributes', {})
        for k in attrs:
            if k.startswith('author_') or k in ('orcid', 'github', 'slack', 'mobile'):
                profile[k] = attrs[k]
        logging.info('profile: %r', profile)

        self.write(profile)

    @authenticated
    @catch_error
    async def put(self, username):
        """
        Set values in user profile.

        Body json (new user profile keys):
            key (str): new value, or null to remove

        Args:
            username (str): username of user
        """
        await self.check_auth(username)

        try:
            await krs.users.user_info(username, rest_client=self.krs_client)
        except Exception:
            raise HTTPError(404, 'invalid username')

        data = self.json_filter({}, VALID_FIELDS)

        args = {}
        for k,v in {'firstName': 'first_name', 'lastName': 'last_name', 'email': 'email'}.items():
            if k in data:
                val = data.pop(k)
                args[v] = None if not val else val
        assert all(k.startswith('author_') or k in ('orcid', 'github', 'slack', 'mobile') for k in data)
        args['attribs'] = data

        try:
            await krs.users.modify_user(username, **args, rest_client=self.krs_client)
        except Exception:
            raise HTTPError(400, 'bad update')

        self.write({})
