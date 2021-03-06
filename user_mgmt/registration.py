"""
Handle group mamagement actions.
"""
from functools import wraps
import logging
import time
import uuid

from tornado.web import HTTPError
from rest_tools.server import catch_error, authenticated

from .handler import MyHandler


TOKEN_EXP_SEC = 3600*24*7  # 7 days


async def create_token(db, username, exp_seconds=TOKEN_EXP_SEC):
    token = uuid.uuid1().hex
    now = time.time()
    exp = now+exp_seconds
    logging.debug('create token %s with exp %f (+%f)', token, exp, exp_seconds)
    await db.reg_tokens.insert_one({
        'token': token,
        'create': now,
        'exp': exp,
        'auth_user': username,
    })
    return token


async def valid_token(db, token):
    try:
        uuid.UUID(token)
    except Exception:
        raise HTTPError(403, 'invalid authorization')
    logging.debug('testing token for validity: %s', token)

    ret = await db.reg_tokens.find_one({'token': token}, projection={'_id': False})
    now = time.time()
    if (not ret) or ret.get('exp') < now:
        raise HTTPError(403, 'invalid authorization')
    logging.debug('valid token (now=%f): %r', now, ret)


def authenticate_reg_token(method):
    """Decorate methods with this to require that the Authorization header is
    filled with a valid token.

    On failure, raises a 403 error.

    Raises:
        :py:class:`tornado.web.HTTPError`
    """
    @wraps(method)
    async def wrapper(self, *args, **kwargs):
        try:
            type, token = self.request.headers['Authorization'].split(' ', 1)
            if type.lower() != 'bearer':
                raise Exception('bad header type')
            await valid_token(self.db, token)
        except Exception:
            logging.debug('failed registration token auth', exc_info=True)
            raise HTTPError(403, reason="authentication failed")
        return await method(self, *args, **kwargs)
    return wrapper


class RegistrationToken(MyHandler):
    @authenticated
    @catch_error
    async def post(self):
        """
        Create a new registration token.

        Only inst admins can create tokens.
        """
        insts = await self.get_admin_institutions()
        if not insts:
            raise HTTPError(403, 'invalid authorization')

        token = await create_token(self.db, self.auth_data['username'])
        self.write({'token': token})


class RegistrationTokenValid(MyHandler):
    @catch_error
    async def get(self, token):
        """Validate a registration token."""
        await valid_token(self.db, token)

        # success
        self.write({})
