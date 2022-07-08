import asyncio

import pytest
from rest_tools.client import AsyncSession

import krs.groups

from .krs_util import keycloak_bootstrap
from .util import port, server, mongo_client, email_patch
import user_mgmt.registration

@pytest.mark.asyncio
async def test_valid_token(mongo_client):
    token = await user_mgmt.registration.create_token(mongo_client, 'test')
    await user_mgmt.registration.valid_token(mongo_client, token)

@pytest.mark.asyncio
async def test_invalid_token(mongo_client):
    token = await user_mgmt.registration.create_token(mongo_client, 'test', exp_seconds=0)
    await asyncio.sleep(0.01)
    with pytest.raises(Exception):
        await user_mgmt.registration.valid_token(mongo_client, token)

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
