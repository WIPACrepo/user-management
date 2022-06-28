"""
Handle user profile updates.
"""
import os
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


# load bad words from file
BAD_WORDS = []
if 'BAD_WORDS_FILE' in os.environ:
    with open(os.environ['BAD_WORDS_FILE']) as f:
        BAD_WORDS = [x for x in map(lamba x: x.split('#', 1)[0].strip(), f.read().split('\n')) if x]


def is_admin_of_inst_member(admin_insts, user_groups):
    for exp in admin_insts:
        for inst in admin_insts[exp]:
            group_name = f'/institutions/{exp}/{inst}'
            if group_name in user_groups:
                return True
    return False


class Username(MyHandler):
    @staticmethod
    def _gen_username(first_name, last_name, number):
        """Make ascii username from first and last name."""
        ret = unidecode.unidecode(first_name[0] + last_name).replace("'", '').replace(' ', '').lower()
        if len(ret) > 16:
            ret = ret[:16]
        if number > 0:
            ret += str(number)
        return ret

    @staticmethod
    def _username_valid(username):
        """Check if a username is valid - length, bad words."""
        if len(username) > 16:
            return False
        if any(BAD_WORDS in username):
            return False
        return True

    async def _username_in_use(self, username):
        """Test if the username is already in use"""
        ret = await self.db.inst_approvals.find_one({"username": username})
        if not ret:
            try:
                await krs.users.user_info(username, rest_client=self.krs_client)
            except krs.users.UserDoesNotExist:
                return False  # username is available
        return True

    async def post(self):
        """
        Create a new username, or validate a given one.

        The username must not already exist, and must follow some rules.

        Body json:
            first_name (str): first name
            last_name (str): last name
            username (str): new username (optional)

        Returns:
            dict: {username: username} on success
        """
        req_fields = {
            'first_name': str,
            'last_name': str,
        }
        opt_fields = {
            'username': str,
        }
        data = self.json_filter(req_fields, opt_fields)

        username = data.get('username', None)
        if not username:
            # make a new username
            number = 0
            for _ in range(100):
                username = self.gen_username(data['first_name'], data['last_name'], number)
                if not await self._username_in_use(username):
                    break
                number += 1
            else:
                raise HTTPError(500, 'cannot generate unique username')
        else:
            # make sure username passes filters
            if not self._username_valid(username):
                raise HTTPError(400, 'invalid username')
    
            # make sure username does not exist
            if await self._username_in_use(username):
                raise HTTPError(400, 'username in use')

        return {'username': username}


class UserBase(MyHandler):
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


class MultiUser(UserBase):
    @authenticated
    @catch_error
    async def get(self):
        """
        Get user profiles.

        Returns:
            dict: dict of username: profile
        """
        usernames = self.get_arguments('username')
        logging.info('get users %s', usernames)
        for username in usernames:
            await self.check_auth(username)
        logging.info('auth is good')

        ret = {}
        for username in usernames:
            try:
                user_info = await self.user_cache.get_user(username)
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
            logging.debug('profile: %r', profile)
            ret[username] = profile

        self.write(ret)


class User(UserBase):
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
            user_info = await self.user_cache.get_user(username)
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
            await self.user_cache.get_user(username)
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
        else:
            self.user_cache.invalidate([username])

        self.write({})
