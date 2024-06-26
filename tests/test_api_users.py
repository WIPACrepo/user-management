import asyncio

import pytest
from rest_tools.client import AsyncSession

import krs.users
import krs.groups
import krs.email

from .krs_util import keycloak_bootstrap
from .util import port, server, mongo_client, reg_token_client, email_patch

import user_mgmt.users



def test_invalid_orcid():
    assert user_mgmt.users.is_orcid('0001-0002-0003-0004')
    assert user_mgmt.users.is_orcid('0000-0001-8945-6722')
    assert user_mgmt.users.is_orcid('0001-0002-0003-000X')
    with pytest.raises(Exception):
        assert user_mgmt.users.is_orcid('0001-0002-0003-000Y')
    with pytest.raises(Exception):
        assert user_mgmt.users.is_orcid('0001-0002-0003-00XX')
    with pytest.raises(Exception):
        assert user_mgmt.users.is_orcid('1-2-3-4')
    with pytest.raises(Exception):
        assert user_mgmt.users.is_orcid('foo')


@pytest.mark.asyncio
async def test_user(server):
    rest, krs_client, *_ = server
    client = await rest('test')

    ret = await client.request('GET', '/api/users/test')
    assert ret['firstName'] == 'first'
    assert ret['lastName'] == 'last'
    assert ret['email'] == 'test@test'

@pytest.mark.asyncio
async def test_user_dash(server):
    rest, krs_client, *_ = server
    client = await rest('test-user')

    ret = await client.request('GET', '/api/users/test-user')
    assert ret['firstName'] == 'first'
    assert ret['lastName'] == 'last'
    assert ret['email'] == 'test-user@test'


@pytest.mark.asyncio
async def test_user_put(server):
    rest, krs_client, *_ = server
    client = await rest('test')

    await client.request('PUT', '/api/users/test', {'author_name': 'F. Bar', 'author_email': 'foo@bar'})

    ret = await krs.users.user_info('test', rest_client=krs_client)
    assert ret['attributes']['author_name'] == 'F. Bar'
    assert ret['attributes']['author_email'] == 'foo@bar'

    with pytest.raises(Exception):
        await client.request('PUT', '/api/users/test', {'author_email': 'foo'})

    await client.request('PUT', '/api/users/test', {'orcid': '0001-0002-0003-0004'})
    ret = await krs.users.user_info('test', rest_client=krs_client)
    assert ret['attributes']['orcid'] == '0001-0002-0003-0004'

    await client.request('PUT', '/api/users/test', {'orcid': '0000-0001-8945-6722'})
    ret = await krs.users.user_info('test', rest_client=krs_client)
    assert ret['attributes']['orcid'] == '0000-0001-8945-6722'

    await client.request('PUT', '/api/users/test', {'orcid': '0001-0002-0003-000X'})
    ret = await krs.users.user_info('test', rest_client=krs_client)
    assert ret['attributes']['orcid'] == '0001-0002-0003-000X'

    with pytest.raises(Exception):
        await client.request('PUT', '/api/users/test', {'orcid': '1-2-3-4'})

    with pytest.raises(Exception):
        await client.request('PUT', '/api/users/test', {'orcid': 'foo'})

    with pytest.raises(Exception):
        await client.request('PUT', '/api/users/test', {'phd_year': 'bar'})

    with pytest.raises(Exception):
        await client.request('PUT', '/api/users/test', {'phd_year': '12'})

    await client.request('PUT', '/api/users/test', {'loginShell': '/bin/zsh'})
    ret = await krs.users.user_info('test', rest_client=krs_client)
    assert ret['attributes']['loginShell'] == '/bin/zsh'

    with pytest.raises(Exception):
        await client.request('PUT', '/api/users/test', {'loginShell': 'foo'})

    # Sometime after version 15, Keycloak started to delete empty attributes
    # (not sure if this still applies if user profiles are enabled)
    await client.request('PUT', '/api/users/test', {'loginShell': ''})
    ret = await krs.users.user_info('test', rest_client=krs_client)
    assert 'loginShell' not in ret['attributes']


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

    await krs.users.create_user('fbarbar', 'foo', 'barbar', 'foo@bar', rest_client=krs_client)
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

    await krs.users.create_user('fbar0', 'foo', 'bar', 'foo@bar', rest_client=krs_client)
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

    await krs.users.create_user('fbarbar', 'foo', 'bar', 'foo@bar', rest_client=krs_client)
    with pytest.raises(Exception):
        await client.request('POST', '/api/username', args)


invalid_usernames = [
    'foo',  # too short
    'fooooooooooooooooooooooooo',  # too long
    'foò',  # unicode
    'fo=o',  # invalid char
    'fo o',  # space
    'f\'oo',  # quote
    'f-oo',  # dash
    'f.oo',  # dot
    'f_oo',  # underscore
    'Foo',  # uppercase
    'foO',  # uppercase
]
# put is less strict
valid_usernames_put = [
    'foo',  # too short
    'fooooooooooooooooooooooooo',  # too long
    'f-oo',  # dash
    'f.oo',  # dot
    'f_oo',  # underscore
# can't test these last two without experimental Keycloak support
#    'Foo',  # uppercase
#    'foO',  # uppercase
]
invalid_usernames_put = [
    'foò',  # unicode
]

@pytest.mark.parametrize('username', valid_usernames_put)
@pytest.mark.asyncio
async def test_user_put_valid(username, server):
    rest, krs_client, *_ = server
    client = await rest(username)

    await client.request('PUT', f'/api/users/{username}', {'author_name': 'F. Bar', 'author_email': 'foo@bar'})


@pytest.mark.parametrize('username', invalid_usernames_put)
@pytest.mark.asyncio
async def test_user_put_invalid(username, server):
    rest, krs_client, *_ = server
    client = await rest(username)

    with pytest.raises(Exception):
        await client.request('PUT', f'/api/users/{username}', {'author_name': 'F. Bar', 'author_email': 'foo@bar'})


@pytest.mark.parametrize('username', invalid_usernames)
def test_invalid_usernames(username):
    assert not user_mgmt.users.Username._username_valid(username)

@pytest.mark.parametrize('username', invalid_usernames)
@pytest.mark.asyncio
async def test_username_invalid(username, server, reg_token_client, monkeypatch):
    rest, krs_client, *_ = server
    client = await reg_token_client()

    args = {
        'first_name': 'Foo',
        'last_name': 'Bar',
        'username': username
    }
    with pytest.raises(Exception):
        await client.request('POST', '/api/username', args)

@pytest.mark.asyncio
async def test_username_invalid_bad_word(server, reg_token_client, monkeypatch):
    monkeypatch.setattr(user_mgmt.users, 'BAD_WORDS', ['bad'])

    args = {
        'first_name': 'Foo',
        'last_name': 'Bar',
        'username': 'fobado'
    }
    with pytest.raises(Exception):
        await client.request('POST', '/api/username', args)

async def test_associates_single_user(server, reg_token_client):
    rest, krs_client, *_ = server
    client = await rest('test')
    await rest('test2')

    await krs.groups.create_group('/experiments', rest_client=krs_client)
    await krs.groups.create_group('/experiments/Test', rest_client=krs_client)
    await krs.groups.create_group('/experiments/Test/associates', rest_client=krs_client)

    ret = await client.request('GET', '/api/experiments/Test/associates', {'username': 'test'})
    assert ret == []

    ret = await client.request('GET', '/api/experiments/Test/associates')
    assert ret == []

    # add user as an associate
    await krs.groups.add_user_group('/experiments/Test/associates', 'test', rest_client=krs_client)

    ret = await client.request('GET', '/api/experiments/Test/associates', {'username': 'test'})
    assert ret == ['test']

    ret = await client.request('GET', '/api/experiments/Test/associates')
    assert ret == ['test']

    # add a second user to the group, and make sure not to get them
    await krs.groups.add_user_group('/experiments/Test/associates', 'test2', rest_client=krs_client)

    ret = await client.request('GET', '/api/experiments/Test/associates', {'username': 'test'})
    assert ret == ['test']

    ret = await client.request('GET', '/api/experiments/Test/associates')
    assert ret == ['test']

    # get a non-answer for a different user
    ret = await client.request('GET', '/api/experiments/Test/associates', {'username': 'test2'})
    assert ret == []
