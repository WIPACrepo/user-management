"""
Handle user profile updates.
"""
import itertools
import os
import logging

from tornado.web import HTTPError
from rest_tools.server import catch_error, authenticated
import unidecode

import krs.users
import krs.groups

from .handler import MyHandler


#: user mgmt name : keycloak name
KEYCLOAK_ATTRS = {
    'username': 'username',
    'firstName': 'first_name',
    'lastName': 'last_name',
    'email': 'email',
}


def is_orcid(value):
    """ORCID validation"""
    logging.debug('testing orcid %r', value)
    parts = value.split('-')
    if len(parts) != 4:
        return False
    if any(len(x) != 4 or not x.isdigit() for x in parts[:3]):
        return False
    x = parts[3]
    logging.debug('handle last part: %s', x)
    if len(x) != 4 or not x[:3].isdigit():
        return False
    logging.debug('handle last char: %s', x[3])
    # special handling for checksum X
    if not (x[3].isdigit() or x[3] == 'X'):
        return False
    return True


#: attr name and validation function
EXTRA_ATTRS = {
    'mailing_list_email': lambda x: x == '' or '@' in x,
    'github': lambda x: True,
    'slack': lambda x: True,
    'mobile': lambda x: True,
    'author_name': lambda x: True,
    'author_firstName': lambda x: True,
    'author_lastName': lambda x: True,
    'author_email': lambda x: x == '' or '@' in x,
    'orcid': lambda x: x == '' or is_orcid(x),
    'phd_year': lambda x: x == '' or (len(x) == 4 and x.isdigit()),
    'loginShell': lambda x: x in ('', '/bin/bash', '/bin/zsh', '/bin/tcsh', '/sbin/nologin'),
}

#: valid writable attrs
VALID_FIELDS = {k: str for k in itertools.chain(KEYCLOAK_ATTRS, EXTRA_ATTRS) if k != 'username'}


# load bad words from file
BAD_WORDS = []
if 'BAD_WORDS_FILE' in os.environ:
    with open(os.environ['BAD_WORDS_FILE']) as f:
        BAD_WORDS = [x for x in map(lambda x: x.split('#', 1)[0].strip(), f.read().split('\n')) if x]


class Username(MyHandler):
    @staticmethod
    def _gen_username(first_name, last_name, number):
        """Make ascii username from first and last name."""
        ret = unidecode.unidecode(first_name[0] + last_name).replace("'", '').replace(' ', '').lower()
        if len(ret) < 5:
            ret = f'{ret:0<5s}'
        if len(ret) > 8:
            ret = ret[:8]
        if number > 0:
            ret += str(number)
        return ret

    @staticmethod
    def _username_valid(username):
        """Check if a username is valid - length, bad words."""
        ascii_username = unidecode.unidecode(username).replace("'", '').replace(' ', '').lower()
        if ascii_username != username:
            return False
        if len(username) < 5:
            return False
        if len(username) > 16:
            return False
        if any(word in username for word in BAD_WORDS):
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

    @catch_error
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
                username = self._gen_username(data['first_name'], data['last_name'], number)
                if not await self._username_in_use(username):
                    break
                number += 1
            else:
                raise HTTPError(500, reason='cannot generate unique username')
        else:
            # make sure username passes filters
            if not self._username_valid(username):
                raise HTTPError(400, reason='invalid username')

            # make sure username does not exist
            if await self._username_in_use(username):
                raise HTTPError(400, reason='username in use')

        self.write({'username': username})


class UserBase(MyHandler):
    async def check_auth(self, username):
        """
        Check auth.

        Should match either as the user in question, or an admin of an
        institution they are a member of.
        """
        if self.is_super_admin():
            return
        if username != self.auth_data['username']:
            # do inst admin check
            insts = await self.get_admin_institutions()
            for exp in insts:
                for inst in insts[exp]:
                    group_path = f'/institutions/{exp}/{inst}'
                    members = await self.group_cache.get_members(group_path)
                    if username in members:
                        return
            logging.warning('failed inst admin check for admin %r and username %r', self.current_user, username)
            raise HTTPError(403, reason='invalid authorization')

    async def check_auth_read_only(self, username):
        """
        Check auth - read only version.

        Should match either as the user in question, or an admin of an
        institution they are a member of, or an admin of a group they are
        a member of.
        """
        if self.is_super_admin():
            return
        if username != self.auth_data['username']:
            # do inst admin check
            insts = await self.get_admin_institutions()
            for exp in insts:
                for inst in insts[exp]:
                    group_path = f'/institutions/{exp}/{inst}'
                    members = await self.group_cache.get_members(group_path)
                    if username in members:
                        return
            # do group admin check
            groups = await self.get_admin_groups()
            for group_path in groups:
                members = await self.group_cache.get_members(group_path)
                if username in members:
                    return
            logging.warning('failed group or inst admin check for admin %r and username %r', self.current_user, username)
            raise HTTPError(403, reason='invalid authorization')


class MultiUser(UserBase):
    @authenticated
    @catch_error
    async def get(self):
        """
        Get user profiles.

        `username` argument can be repeated multiple times.

        Returns:
            dict: dict of username: profile
        """
        usernames = self.get_arguments('username')
        logging.info('get users %s', usernames)
        for username in usernames:
            await self.check_auth_read_only(username)
        logging.info('auth is good')

        ret = {}
        for username in usernames:
            try:
                user_info = await self.user_cache.get_user(username)
            except Exception:
                raise HTTPError(404, reason='invalid username')
            logging.info('valid username')

            profile = {}
            for k in KEYCLOAK_ATTRS:
                profile[k] = user_info.get(k, '')
            attrs = user_info.get('attributes', {})
            for k in attrs:
                if k in EXTRA_ATTRS:
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
        await self.check_auth_read_only(username)
        logging.info('auth is good')

        try:
            user_info = await self.user_cache.get_user(username)
        except Exception:
            raise HTTPError(404, reason='invalid username')
        logging.info('valid username')

        profile = {}
        for k in KEYCLOAK_ATTRS:
            profile[k] = user_info[k]
        attrs = user_info.get('attributes', {})
        for k in attrs:
            if k in EXTRA_ATTRS:
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
            raise HTTPError(404, reason='invalid username')

        data = self.json_filter({}, VALID_FIELDS)

        args = {}
        for k,v in KEYCLOAK_ATTRS.items():
            if k in data:
                val = data.pop(k)
                args[v] = None if not val else val
        for k in data:
            try:
                assert EXTRA_ATTRS[k](data[k])
            except Exception:
                logging.info('invalid field %r', k, exc_info=True)
                raise HTTPError(400, reason=f'invalid field {k}')

        args['attribs'] = data

        try:
            await krs.users.modify_user(username, **args, rest_client=self.krs_client)
        except Exception:
            raise HTTPError(400, reason='bad update')
        else:
            self.user_cache.invalidate([username])

        self.write({})


class AssociateUsers(UserBase):
    @authenticated
    @catch_error
    async def get(self, experiment):
        """
        Get list of associate users.

        `username` argument can be repeated multiple times. If empty, lists
        all assocates visible to user.

        Args:
            experiment (str): the experiment the users are an associate on

        Returns:
            list: usernames that are assocates
        """
        usernames = self.get_arguments('username')
        logging.info('get users %s', usernames)

        associate_group = f'/experiments/{experiment}/associates'
        self.group_cache.invalidate(associate_group)
        try:
            associates = await self.group_cache.get_members(associate_group)
        except krs.groups.GroupDoesNotExist:
            associates = []

        ret = []
        for username in associates:
            if usernames and username not in usernames:
                continue

            try:
                await self.user_cache.get_user(username)
            except Exception:
                logging.debug('invalid username %s', username)
                continue

            try:
                await self.check_auth_read_only(username)
            except HTTPError:
                logging.debug('bad auth for username %s', username)
                continue

            ret.append(username)

        self.write(sorted(ret))
