import asyncio

import pytest
from rest_tools.client import AsyncSession

import krs.users
import krs.groups
import krs.email

from .krs_util import keycloak_bootstrap
from .util import port, server, mongo_client, reg_token_client, email_patch

import user_mgmt.users


@pytest.mark.asyncio
async def test_user(server):
    rest, krs_client, *_ = server
    client = await rest('test')

    ret = await client.request('GET', '/api/users/test')
    assert ret['firstName'] == 'first'
    assert ret['lastName'] == 'last'
    assert ret['email'] == 'test@test'


@pytest.mark.asyncio
async def test_user_put(server):
    rest, krs_client, *_ = server
    client = await rest('test')

    await client.request('PUT', '/api/users/test', {'author_name': 'F. Bar'})

    ret = await krs.users.user_info('test', rest_client=krs_client)
    assert ret['attributes']['author_name'] == 'F. Bar'

@pytest.mark.asyncio
async def test_user_unauthorized(server):
    rest, krs_client, *_ = server
    await rest('test')
    client = await rest('test2')

    with pytest.raises(Exception):
        await client.request('GET', '/api/users/test')

@pytest.mark.asyncio
async def test_user_inst_admin(server):
    rest, krs_client, *_ = server
    
    await krs.groups.create_group('/institutions', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/UW-Madison', rest_client=krs_client)

    client = await rest('test', groups=['/institutions/IceCube/UW-Madison'])

    client2 = await rest('test2', groups=['/institutions/IceCube/UW-Madison/_admin'])
    
    ret = await client.request('GET', '/api/users/test')
    assert ret['firstName'] == 'first'
    assert ret['lastName'] == 'last'
    assert ret['email'] == 'test@test'


@pytest.mark.asyncio
async def test_username_autogen(server, reg_token_client):
    rest, krs_client, *_ = server
    client = await reg_token_client()

    args = {
        'first_name': 'Foo',
        'last_name': 'Barbar',
    }
    ret = await client.request('POST', '/api/username', args)
    assert ret['username'] == 'fbarbar'

    await krs.users.create_user('fbar', 'foo', 'barbar', 'foo@bar', rest_client=krs_client)
    ret = await client.request('POST', '/api/username', args)
    assert ret['username'] == 'fbarbar1'

@pytest.mark.asyncio
async def test_username_autogen_short(server, reg_token_client):
    rest, krs_client, *_ = server
    client = await reg_token_client()

    args = {
        'first_name': 'Foo',
        'last_name': 'Bar',
    }
    ret = await client.request('POST', '/api/username', args)
    assert ret['username'] == 'fbar0'

    await krs.users.create_user('fbar', 'foo', 'bar', 'foo@bar', rest_client=krs_client)
    ret = await client.request('POST', '/api/username', args)
    assert ret['username'] == 'fbar01'

@pytest.mark.asyncio
async def test_username_select(server, reg_token_client):
    rest, krs_client, *_ = server
    client = await reg_token_client()

    args = {
        'first_name': 'Foo',
        'last_name': 'Bar',
        'username': 'fbarbar'
    }
    ret = await client.request('POST', '/api/username', args)
    assert ret['username'] == 'fbarbar'

    await krs.users.create_user('fbar', 'foo', 'bar', 'foo@bar', rest_client=krs_client)
    with pytest.raises(Exception):
        await client.request('POST', '/api/username', args)

@pytest.mark.asyncio
async def test_username_auth(server, reg_token_client):
    rest, krs_client, *_ = server
    client = await rest('test')

    args = {
        'first_name': 'Foo',
        'last_name': 'Bar',
        'username': 'fbarbar'
    }
    with pytest.raises(Exception):
        await client.request('POST', '/api/username', args)

    client2 = await reg_token_client(exp_seconds=0)
    await asyncio.sleep(0.01)
    with pytest.raises(Exception):
        await client2.request('POST', '/api/username', args)

@pytest.mark.asyncio
async def test_username_invalid(server, reg_token_client, monkeypatch):
    rest, krs_client, *_ = server
    client = await reg_token_client()

    # short
    args = {
        'first_name': 'Foo',
        'last_name': 'Bar',
        'username': 'foo'
    }
    with pytest.raises(Exception):
        await client.request('POST', '/api/username', args)

    # long
    args = {
        'first_name': 'Foo',
        'last_name': 'Bar',
        'username': 'fooooooooooooooooooooooooo'
    }
    with pytest.raises(Exception):
        await client.request('POST', '/api/username', args)

    # non-ascii
    args = {
        'first_name': 'Foo',
        'last_name': 'Bar',
        'username': 'foò'
    }
    with pytest.raises(Exception):
        await client.request('POST', '/api/username', args)

    # bad word
    monkeypatch.setattr(user_mgmt.users, 'BAD_WORDS', ['bad'])

    args = {
        'first_name': 'Foo',
        'last_name': 'Bar',
        'username': 'fobado'
    }
    with pytest.raises(Exception):
        await client.request('POST', '/api/username', args)
