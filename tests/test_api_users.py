import asyncio

import pytest
from rest_tools.client import AsyncSession

import krs.users
import krs.groups
import krs.email

from .krs_util import keycloak_bootstrap
from .util import port, server, mongo_client, email_patch


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
async def test_username_autogen(server):
    rest, krs_client, *_ = server
    client = await rest('test')

    args = {
        'first_name': 'Foo',
        'last_name': 'Bar',
    }
    ret = await client.request('POST', '/api/username', args)
    assert ret['username'] == 'fbar'

    await krs.users.create_user('fbar', 'foo', 'bar', 'foo@bar', rest_client=krs_client)
    ret = await client.request('POST', '/api/username', args)
    assert ret['username'] == 'fbar1'

@pytest.mark.asyncio
async def test_username_select(server):
    rest, krs_client, *_ = server
    client = await rest('test')

    args = {
        'first_name': 'Foo',
        'last_name': 'Bar',
        'username': 'fbar'
    }
    ret = await client.request('POST', '/api/username', args)
    assert ret['username'] == 'fbar'

    await krs.users.create_user('fbar', 'foo', 'bar', 'foo@bar', rest_client=krs_client)
    with pytest.raises(Exception):
        await client.request('POST', '/api/username', args)
    
