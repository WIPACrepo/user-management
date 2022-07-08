import asyncio

import pytest
from rest_tools.client import AsyncSession

import krs.groups

from .krs_util import keycloak_bootstrap
from .util import port, server, mongo_client, email_patch
from user_mgmt.registration import valid_token

@pytest.mark.asyncio
async def test_valid_token(server, mongo_client):
    rest, krs_client, *_ = server

    await krs.groups.create_group('/institutions', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/UW-Madison', rest_client=krs_client)

    client = await rest('test')
    client2 = await rest('test2', groups=['/institutions/IceCube/UW-Madison/_admin'])

    ret = await client2.request('POST', '/api/reg_token')
    token = ret['token']

    valid_token(mongo_client, token)

@pytest.mark.asyncio
async def test_registration_token_create(server, mongo_client):
    rest, krs_client, *_ = server

    await krs.groups.create_group('/institutions', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/UW-Madison', rest_client=krs_client)

    client = await rest('test')

    with pytest.raises(Exception):
        await client.request('POST', '/api/reg_token')

    client2 = await rest('test2', groups=['/institutions/IceCube/UW-Madison/_admin'])

    ret = await client2.request('POST', '/api/reg_token')
    assert 'token' in ret

@pytest.mark.asyncio
async def test_registration_token_valid(server, mongo_client):
    rest, krs_client, *_ = server

    await krs.groups.create_group('/institutions', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/UW-Madison', rest_client=krs_client)

    client = await rest('test')
    client2 = await rest('test2', groups=['/institutions/IceCube/UW-Madison/_admin'])

    ret = await client2.request('POST', '/api/reg_token')
    token = ret['token']

    await client.request('GET', f'/api/reg_token/{token}')
