from collections import defaultdict
import logging

from tornado.web import HTTPError
from tornado.escape import json_decode, json_encode
from rest_tools.server import RestHandler

import krs.email
import krs.groups


class MyHandler(RestHandler):
    def initialize(self, db=None, krs_client=None, group_cache=None, user_cache=None, **kwargs):
        super().initialize(**kwargs)
        self.db = db
        self.krs_client = krs_client
        self.group_cache = group_cache
        self.user_cache = user_cache
        self._get_admin_groups_cache = None
        self._get_admin_institutions_cache = None

    def write(self, chunk):
        """
        Writes the given chunk to the output buffer.

        A copy of the Tornado src, without the list json restriction.
        """
        if self._finished:
            raise RuntimeError("Cannot write() after finish()")
        if not isinstance(chunk, (bytes, str, dict, list)):
            message = "write() only accepts bytes, str, dict, and list objects"
            raise TypeError(message)
        if isinstance(chunk, (dict, list)):
            chunk = json_encode(chunk)
            self.set_header("Content-Type", "application/json; charset=UTF-8")
        chunk = chunk if isinstance(chunk, bytes) else chunk.encode("utf-8")
        self._write_buffer.append(chunk)

    def json_filter(self, req_fields, opt_fields):
        """
        Filter json body data.

        Args:
            req_fields (dict): required fields and type
            opt_fields (dict): optional fields and type
        Returns:
            dict: data
        """
        incoming_data = json_decode(self.request.body)
        data = {}
        for f in req_fields:
            if f not in incoming_data:
                raise HTTPError(400, f'missing field "{f}"', reason=f'missing field "{f}"')
            elif not isinstance(incoming_data[f], req_fields[f]):
                raise HTTPError(400, reason=f'invalid type for field "{f}"')
            data[f] = incoming_data[f]
        for f in opt_fields:
            if f in incoming_data:
                if not isinstance(incoming_data[f], opt_fields[f]):
                    raise HTTPError(400, reason=f'invalid type for field "{f}"')
                data[f] = incoming_data[f]
        extra_fields = set(incoming_data)-set(req_fields)-set(opt_fields)
        if extra_fields:
            raise HTTPError(400, f'invalid fields: {extra_fields}', reason='extra invalid fields in request')
        return data

    async def is_associate(self, experiment, username):
        associate_group = f'/experiments/{experiment}/associates'
        self.group_cache.invalidate(associate_group)
        try:
            associates = await self.group_cache.get_members(associate_group)
        except krs.groups.GroupDoesNotExist:
            return False
        return username in associates

    def is_super_admin(self):
        """Is the current user a super admin?"""
        return '/admin' in self.auth_data.get('groups', [])

    async def get_admins(self, group_path):
        ret = await self.group_cache.get_members(group_path+'/_admin')
        users = {}
        for username in ret:
            ret2 = await self.user_cache.get_user(username)
            users[username] = ret2
        logging.info(f'get_admins: {users}')
        return users

    async def send_admin_email(self, group_path, body):
        subject = 'IceCube Account '
        if group_path.startswith('/institutions'):
            subject += 'Institution'
        else:
            subject += 'Group'
        subject += ' Request'

        try:
            admin_users = await self.get_admins(group_path)
            for user in admin_users.values():
                krs.email.send_email(
                    recipient={'name': f'{user["firstName"]} {user["lastName"]}', 'email': user['email']},
                    subject=subject,
                    content=body)
        except Exception:
            logging.warning(f'failed to send email for approval to {group_path}', exc_info=True)

    async def get_admin_groups(self):
        if self._get_admin_groups_cache:
            return self._get_admin_groups_cache
        if self.is_super_admin():  # super admin - all groups
            admin_groups = await self.group_cache.list_groups()
        else:
            admin_groups = [g[:-7] for g in self.auth_data.get('groups', []) if g.endswith('/_admin')]
        groups = set()
        for group in admin_groups:
            val = group.strip('/').split('/')
            if len(val) >= 1 and val[0] != 'institutions':
                groups.add(group)
        logging.info(f'get_admin_groups: {groups}')
        self._get_admin_groups_cache = groups
        return groups

    async def get_admin_institutions(self):
        if self._get_admin_institutions_cache:
            return self._get_admin_institutions_cache
        if self.is_super_admin():  # super admin - all institutions
            admin_groups = await self.group_cache.list_institutions()
            insts = defaultdict(list)
            for group in admin_groups:
                val = group.split('/')
                insts[val[2]].append(val[3])
        else:
            admin_groups = [g[:-7] for g in self.auth_data.get('groups', []) if g.endswith('/_admin')]
            insts = defaultdict(list)
            for group in admin_groups:
                val = group.strip('/').split('/')
                logging.debug(f'eval group: {group} | val: {val}')
                if len(val) == 3 and val[0] == 'institutions':
                    insts[val[1]].append(val[2])
        logging.info(f'get_admin_instutitons: {insts}')
        self._get_admin_institutions_cache = insts
        return insts
