import string

import pytest
from rest_tools.client import AsyncSession

import krs.users
import krs.groups
import user_mgmt.cache

from .krs_util import keycloak_bootstrap


@pytest.mark.asyncio
async def test_list_groups(keycloak_bootstrap):
    await krs.groups.create_group('/foo', rest_client=keycloak_bootstrap)

    cache = user_mgmt.cache.KeycloakGroupCache(ttl=1, krs_client=keycloak_bootstrap)

    ret = await cache.list_groups()
    assert list(ret.keys()) == ['/foo']

@pytest.mark.asyncio
async def test_get_group_id(keycloak_bootstrap):
    await krs.groups.create_group('/foo', rest_client=keycloak_bootstrap)
    grp = await krs.groups.group_info('/foo', rest_client=keycloak_bootstrap)

    cache = user_mgmt.cache.KeycloakGroupCache(krs_client=keycloak_bootstrap)

    ret = await cache.get_group_id('/foo')
    assert ret == grp['id']

@pytest.mark.asyncio
async def test_get_group_info_from_id(keycloak_bootstrap):
    await krs.groups.create_group('/foo', rest_client=keycloak_bootstrap)
    grp = await krs.groups.group_info('/foo', rest_client=keycloak_bootstrap)

    cache = user_mgmt.cache.KeycloakGroupCache(krs_client=keycloak_bootstrap)

    ret = await cache.get_group_info_from_id(grp['id'])
    assert ret == grp

@pytest.mark.asyncio
async def test_get_members_large(keycloak_bootstrap):
    users = [c*3 for c in string.ascii_lowercase]
    groups = [c*3 for c in string.ascii_lowercase]
    for u in users:
        await krs.users.create_user(u, 'first', 'last', f'{u}@email', rest_client=keycloak_bootstrap)
    for g in groups:
        await krs.groups.create_group(f'/{g}', rest_client=keycloak_bootstrap)
        for u in users:
            await krs.groups.add_user_group(f'/{g}', u, rest_client=keycloak_bootstrap)

    cache = user_mgmt.cache.KeycloakGroupCache(krs_client=keycloak_bootstrap)
    for g in groups:
        ret = await cache.get_members(f'/{g}')
        assert ret == users

    await krs.groups.remove_user_group('/aaa', 'aaa', rest_client=keycloak_bootstrap)
    ret = await cache.get_members('/aaa')
    assert ret == users

@pytest.mark.asyncio
async def test_invalidate_one(keycloak_bootstrap):
    await krs.groups.create_group('/foo', rest_client=keycloak_bootstrap)
    await krs.users.create_user('testuser', 'first', 'last', 'email@email', rest_client=keycloak_bootstrap)
    await krs.groups.add_user_group('/foo', 'testuser', rest_client=keycloak_bootstrap)

    cache = user_mgmt.cache.KeycloakGroupCache(krs_client=keycloak_bootstrap)
    ret = await cache.get_members('/foo')
    assert ret == ['testuser']

    await krs.groups.remove_user_group('/foo', 'testuser', rest_client=keycloak_bootstrap)
    ret = await cache.get_members('/foo')
    assert ret == ['testuser']

    cache.invalidate('/foo')
    ret = await cache.get_members('/foo')
    assert ret == []

@pytest.mark.asyncio
async def test_invalidate_all(keycloak_bootstrap):
    await krs.groups.create_group('/foo', rest_client=keycloak_bootstrap)
    await krs.users.create_user('testuser', 'first', 'last', 'email@email', rest_client=keycloak_bootstrap)
    await krs.groups.add_user_group('/foo', 'testuser', rest_client=keycloak_bootstrap)

    cache = user_mgmt.cache.KeycloakGroupCache(krs_client=keycloak_bootstrap)
    ret = await cache.get_members('/foo')
    assert ret == ['testuser']

    await krs.groups.remove_user_group('/foo', 'testuser', rest_client=keycloak_bootstrap)
    ret = await cache.get_members('/foo')
    assert ret == ['testuser']

    cache.invalidate()
    ret = await cache.get_members('/foo')
    assert ret == []

@pytest.mark.asyncio
async def test_list_users(keycloak_bootstrap):
    await krs.users.create_user('testuser', 'first', 'last', 'email@email', rest_client=keycloak_bootstrap)

    cache = user_mgmt.cache.KeycloakUserCache(ttl=1, krs_client=keycloak_bootstrap)

    ret = await cache.list_usernames()
    assert ret == ['testuser']

@pytest.mark.asyncio
async def test_get_user(keycloak_bootstrap):
    await krs.users.create_user('testuser', 'first', 'last', 'email@email', rest_client=keycloak_bootstrap)

    cache = user_mgmt.cache.KeycloakUserCache(ttl=1, krs_client=keycloak_bootstrap)

    ret = await cache.get_user('testuser')
    assert ret['firstName'] == 'first'

@pytest.mark.asyncio
async def test_get_users(keycloak_bootstrap):
    await krs.users.create_user('testuser', 'first', 'last', 'email@email', rest_client=keycloak_bootstrap)

    cache = user_mgmt.cache.KeycloakUserCache(ttl=1, krs_client=keycloak_bootstrap)

    ret = await cache.get_users(['testuser'])
    assert 'testuser' in ret
    assert ret['testuser']['firstName'] == 'first'
