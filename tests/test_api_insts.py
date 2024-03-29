import asyncio

import pytest
from rest_tools.client import AsyncSession

import krs.users
import krs.groups
import krs.email

from .krs_util import keycloak_bootstrap
from .util import port, server, mongo_client, reg_token_client, email_patch


@pytest.mark.asyncio
async def test_experiments_empty(server):
    rest, krs_client, *_ = server
    client = await rest('test')
    ret = await client.request('GET', '/api/experiments')
    assert ret == []

@pytest.mark.asyncio
async def test_experiments(server):
    rest, krs_client, *_ = server
    client = await rest('test')

    await krs.groups.create_group('/institutions', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube', rest_client=krs_client)

    ret = await client.request('GET', '/api/experiments')
    assert ret == ['IceCube']

@pytest.mark.asyncio
async def test_institutions_empty(server):
    rest, krs_client, *_ = server
    client = await rest('test')

    await krs.groups.create_group('/institutions', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube', rest_client=krs_client)

    ret = await client.request('GET', '/api/experiments/IceCube/institutions')
    assert ret == []

@pytest.mark.asyncio
async def test_institutions(server):
    rest, krs_client, *_ = server
    client = await rest('test')

    await krs.groups.create_group('/institutions', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/UW-Madison', rest_client=krs_client)

    ret = await client.request('GET', '/api/experiments/IceCube/institutions')
    assert ret == ['UW-Madison']

@pytest.mark.asyncio
async def test_institution_subgroups_empty(server):
    rest, krs_client, *_ = server
    client = await rest('test')

    await krs.groups.create_group('/institutions', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/UW-Madison', rest_client=krs_client)

    ret = await client.request('GET', '/api/experiments/IceCube/institutions/UW-Madison')
    assert ret['subgroups'] == []

@pytest.mark.asyncio
async def test_institution_subgroups(server):
    rest, krs_client, *_ = server
    client = await rest('test')

    await krs.groups.create_group('/institutions', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/UW-Madison', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/UW-Madison/authorlist', rest_client=krs_client)

    ret = await client.request('GET', '/api/experiments/IceCube/institutions/UW-Madison')
    assert ret['subgroups'] == ['authorlist']

@pytest.mark.asyncio
async def test_institution_associate(server):
    rest, krs_client, *_ = server
    client = await rest('test')

    await krs.groups.create_group('/institutions', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/UW-Madison', attrs={'associate': True}, rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/UW-Madison/authorlist', rest_client=krs_client)

    ret = await client.request('GET', '/api/experiments/IceCube/institutions/UW-Madison')
    assert ret['attributes'] == {'associate': 'true'}

@pytest.mark.asyncio
async def test_all_experiments(server):
    rest, krs_client, *_ = server
    client = await rest('test')

    await krs.groups.create_group('/institutions', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/UW-Madison', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/UW-Madison/authorlist', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/UW-RF', rest_client=krs_client)
    await krs.groups.create_group('/institutions/Gen2', rest_client=krs_client)
    await krs.groups.create_group('/institutions/Gen2/UW-RF', rest_client=krs_client)
    await krs.groups.create_group('/institutions/Gen2/UW-RF/authorlist', rest_client=krs_client)

    ret = await client.request('GET', '/api/all-experiments')
    expected = {
        'IceCube': {
            'UW-Madison': {'subgroups':['authorlist']},
            'UW-RF': {'subgroups':[]},
        },
        'Gen2': {
            'UW-RF': {'subgroups':['authorlist']},
        },
    }
    assert ret == expected

@pytest.mark.asyncio
async def test_institution_users(server):
    rest, krs_client, *_ = server
    client = await rest('test')

    await krs.groups.create_group('/institutions', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/UW-Madison', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/UW-Madison/authorlist', rest_client=krs_client)

    with pytest.raises(Exception):
        await client.request('GET', '/api/experiments/IceCube/institutions/UW-Madison/users')

    client2 = await rest('test2', groups=['/institutions/IceCube/UW-Madison/_admin'])

    ret = await client2.request('GET', '/api/experiments/IceCube/institutions/UW-Madison/users')
    assert ret == {'users': [], 'authorlist': []}

@pytest.mark.asyncio
async def test_institution_users_superadmin(server):
    rest, krs_client, *_ = server
    client = await rest('test', groups=['/admin'])

    await krs.groups.create_group('/institutions', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/UW-Madison', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/UW-Madison/authorlist', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/UW-RiverFalls', rest_client=krs_client)

    ret = await client.request('GET', '/api/experiments/IceCube/institutions/UW-Madison/users')
    assert ret == {'users': [], 'authorlist': []}

@pytest.mark.asyncio
async def test_institution_adduser(server):
    rest, krs_client, *_ = server
    client = await rest('test')

    await krs.groups.create_group('/institutions', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/UW-Madison', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/UW-Madison/authorlist', rest_client=krs_client)

    client2 = await rest('test2', groups=['/institutions/IceCube/UW-Madison/_admin'])

    ret = await client2.request('GET', '/api/experiments/IceCube/institutions/UW-Madison/users')
    assert ret == {'users': [], 'authorlist': []}

    await client2.request('PUT', '/api/experiments/IceCube/institutions/UW-Madison/users/test')
    ret = await client2.request('GET', '/api/experiments/IceCube/institutions/UW-Madison/users')
    assert ret == {'users': ['test'], 'authorlist': []}

    await client2.request('PUT', '/api/experiments/IceCube/institutions/UW-Madison/users/test', {'authorlist': True})
    ret = await client2.request('GET', '/api/experiments/IceCube/institutions/UW-Madison/users')
    assert ret == {'users': ['test'], 'authorlist': ['test']}

@pytest.mark.asyncio
async def test_institution_removeuser(server):
    rest, krs_client, *_ = server
    client = await rest('test')

    await krs.groups.create_group('/institutions', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/UW-Madison', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/UW-Madison/authorlist', rest_client=krs_client)

    await krs.groups.add_user_group('/institutions/IceCube/UW-Madison', 'test', rest_client=krs_client)
    await krs.groups.add_user_group('/institutions/IceCube/UW-Madison/authorlist', 'test', rest_client=krs_client)

    client2 = await rest('test2', groups=['/institutions/IceCube/UW-Madison/_admin'])

    ret = await client2.request('GET', '/api/experiments/IceCube/institutions/UW-Madison/users')
    assert ret == {'users': ['test'], 'authorlist': ['test']}

    await client2.request('PUT', '/api/experiments/IceCube/institutions/UW-Madison/users/test', {'authorlist': False})
    ret = await client2.request('GET', '/api/experiments/IceCube/institutions/UW-Madison/users')
    assert ret == {'users': ['test'], 'authorlist': []}

    await krs.groups.add_user_group('/institutions/IceCube/UW-Madison/authorlist', 'test', rest_client=krs_client)
    await client2.request('DELETE', '/api/experiments/IceCube/institutions/UW-Madison/users/test')
    ret = await client2.request('GET', '/api/experiments/IceCube/institutions/UW-Madison/users')
    assert ret == {'users': [], 'authorlist': []}

@pytest.mark.asyncio
async def test_inst_approvals_register(server, mongo_client, reg_token_client, email_patch):
    _, krs_client, address, *_ = server
    client = await reg_token_client()

    await krs.groups.create_group('/institutions', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/UW-Madison', rest_client=krs_client)

    with pytest.raises(Exception):
        await client.request('POST', '/api/inst_approvals')

    data = {
        'experiment': 'IceCube',
        'institution': 'UW-Madison',
        'first_name': 'First',
        'last_name': 'Last',
        'username': 'flast',
        'email': 'test@test',
    }
    ret = await client.request('POST', '/api/inst_approvals', data)
    approval_id = ret['id']

    email_patch.assert_not_called()

    ret = await mongo_client.user_registrations.find().to_list(10)
    assert len(ret) == 1
    assert ret[0]['first_name'] == data['first_name']
    assert ret[0]['username'] == 'flast'

    ret = await mongo_client.inst_approvals.find().to_list(10)
    assert len(ret) == 1
    assert ret[0]['id'] == approval_id
    assert ret[0]['experiment'] == data['experiment']
    assert ret[0]['institution'] == data['institution']

@pytest.mark.asyncio
async def test_inst_approvals_register_with_admins(server, mongo_client, reg_token_client, email_patch):
    rest, krs_client, address, *_ = server
    client = await reg_token_client()

    await krs.groups.create_group('/institutions', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/UW-Madison', rest_client=krs_client)

    client2 = await rest('test2', groups=['/institutions/IceCube/UW-Madison/_admin'])

    data = {
        'experiment': 'IceCube',
        'institution': 'UW-Madison',
        'first_name': 'First',
        'last_name': 'Last',
        'username': 'flast',
        'email': 'test@test',
    }
    ret = await client.request('POST', '/api/inst_approvals', data)
    approval_id = ret['id']

    email_patch.assert_called()

    ret = await mongo_client.user_registrations.find().to_list(10)
    assert len(ret) == 1
    assert ret[0]['first_name'] == data['first_name']
    assert ret[0]['username'] == 'flast'

    ret = await mongo_client.inst_approvals.find().to_list(10)
    assert len(ret) == 1
    assert ret[0]['id'] == approval_id
    assert ret[0]['experiment'] == data['experiment']
    assert ret[0]['institution'] == data['institution']

@pytest.mark.asyncio
async def test_inst_approvals_second(server, mongo_client, email_patch):
    rest, krs_client, *_ = server

    await krs.groups.create_group('/institutions', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/UW-Madison', rest_client=krs_client)

    client = await rest('test')

    with pytest.raises(Exception):
        await client.request('POST', '/api/inst_approvals')

    data = {
        'experiment': 'IceCube',
        'institution': 'UW-Madison',
    }
    ret = await client.request('POST', '/api/inst_approvals', data)
    approval_id = ret['id']

    email_patch.assert_not_called()

    ret = await mongo_client.user_registrations.find().to_list(10)
    assert len(ret) == 0

    ret = await mongo_client.inst_approvals.find().to_list(10)
    assert len(ret) == 1
    assert ret[0]['id'] == approval_id
    assert ret[0]['experiment'] == data['experiment']
    assert ret[0]['institution'] == data['institution']
    assert ret[0]['username'] == 'test'

@pytest.mark.asyncio
async def test_inst_approvals_second_with_admin(server, mongo_client, email_patch):
    rest, krs_client, *_ = server

    await krs.groups.create_group('/institutions', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/UW-Madison', rest_client=krs_client)

    client = await rest('test')
    client2 = await rest('test2', groups=['/institutions/IceCube/UW-Madison/_admin'])
    client2 = await rest('test3', groups=['/institutions/IceCube/UW-Madison/_admin'])

    data = {
        'experiment': 'IceCube',
        'institution': 'UW-Madison',
    }
    ret = await client.request('POST', '/api/inst_approvals', data)
    approval_id = ret['id']

    assert email_patch.call_count == 2

    ret = await mongo_client.user_registrations.find().to_list(10)
    assert len(ret) == 0

    ret = await mongo_client.inst_approvals.find().to_list(10)
    assert len(ret) == 1
    assert ret[0]['id'] == approval_id
    assert ret[0]['experiment'] == data['experiment']
    assert ret[0]['institution'] == data['institution']
    assert ret[0]['username'] == 'test'

@pytest.mark.asyncio
async def test_inst_approvals_move(server, mongo_client, email_patch):
    rest, krs_client, *_ = server

    await krs.groups.create_group('/institutions', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/OldInst', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/UW-Madison', rest_client=krs_client)

    client = await rest('test', groups=['/institutions/IceCube/OldInst'])

    with pytest.raises(Exception):
        await client.request('POST', '/api/inst_approvals')

    data = {
        'experiment': 'IceCube',
        'institution': 'UW-Madison',
        'remove_institution': 'OldInst',
    }
    ret = await client.request('POST', '/api/inst_approvals', data)
    approval_id = ret['id']

    email_patch.assert_not_called()

    ret = await mongo_client.user_registrations.find().to_list(10)
    assert len(ret) == 0

    ret = await mongo_client.inst_approvals.find().to_list(10)
    assert len(ret) == 1
    assert ret[0]['id'] == approval_id
    assert ret[0]['experiment'] == data['experiment']
    assert ret[0]['institution'] == data['institution']
    assert ret[0]['remove_institution'] == data['remove_institution']
    assert ret[0]['username'] == 'test'

@pytest.mark.asyncio
async def test_inst_approvals_move_with_admin(server, mongo_client, email_patch):
    rest, krs_client, *_ = server

    await krs.groups.create_group('/institutions', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/OldInst', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/UW-Madison', rest_client=krs_client)

    client = await rest('test', groups=['/institutions/IceCube/OldInst'])
    client2 = await rest('test2', groups=['/institutions/IceCube/UW-Madison/_admin'])

    with pytest.raises(Exception):
        await client.request('POST', '/api/inst_approvals')

    data = {
        'experiment': 'IceCube',
        'institution': 'UW-Madison',
        'remove_institution': 'OldInst',
    }
    ret = await client.request('POST', '/api/inst_approvals', data)
    approval_id = ret['id']

    email_patch.assert_called()

    ret = await mongo_client.user_registrations.find().to_list(10)
    assert len(ret) == 0

    ret = await mongo_client.inst_approvals.find().to_list(10)
    assert len(ret) == 1
    assert ret[0]['id'] == approval_id
    assert ret[0]['experiment'] == data['experiment']
    assert ret[0]['institution'] == data['institution']
    assert ret[0]['remove_institution'] == data['remove_institution']
    assert ret[0]['username'] == 'test'

@pytest.mark.asyncio
async def test_inst_approvals_get(server, mongo_client, email_patch):
    rest, krs_client, *_ = server

    await krs.groups.create_group('/institutions', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/UW-Madison', rest_client=krs_client)

    client = await rest('test')
    client2 = await rest('test2', groups=['/institutions/IceCube/UW-Madison/_admin'])

    data = {
        'experiment': 'IceCube',
        'institution': 'UW-Madison',
    }
    ret = await client.request('POST', '/api/inst_approvals', data)
    approval_id = ret['id']

    email_patch.assert_called()

    # no auth
    with pytest.raises(Exception):
        await client.request('GET', '/api/inst_approvals')

    # success
    ret = await client2.request('GET', '/api/inst_approvals')

    assert len(ret) == 1
    assert ret[0]['id'] == approval_id
    assert ret[0]['experiment'] == data['experiment']
    assert ret[0]['institution'] == data['institution']
    assert ret[0]['username'] == 'test'

@pytest.mark.asyncio
async def test_inst_approvals_get_inst(server, mongo_client, email_patch):
    rest, krs_client, *_ = server

    await krs.groups.create_group('/institutions', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/UW-Madison', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/Empty', rest_client=krs_client)

    client = await rest('test')
    client2 = await rest('test2', groups=['/institutions/IceCube/UW-Madison/_admin'])
    client2 = await rest('test2', groups=['/institutions/IceCube/Empty/_admin'])

    data = {
        'experiment': 'IceCube',
        'institution': 'UW-Madison',
    }
    ret = await client.request('POST', '/api/inst_approvals', data)
    approval_id = ret['id']

    email_patch.assert_called()

    # no auth
    with pytest.raises(Exception):
        await client.request('GET', '/api/experiments/IceCube/institutions/UW-Madison/approvals')

    # empty
    ret = await client2.request('GET', '/api/experiments/IceCube/institutions/Empty/approvals')
    assert not ret

    # success
    ret = await client2.request('GET', '/api/experiments/IceCube/institutions/UW-Madison/approvals')

    assert len(ret) == 1
    assert ret[0]['id'] == approval_id
    assert ret[0]['experiment'] == data['experiment']
    assert ret[0]['institution'] == data['institution']
    assert ret[0]['username'] == 'test'

@pytest.mark.asyncio
async def test_inst_approvals_actions_approve(server, mongo_client, email_patch):
    rest, krs_client, *_ = server

    await krs.groups.create_group('/institutions', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/UW-Madison', rest_client=krs_client)

    client = await rest('test')
    client2 = await rest('test2', groups=['/institutions/IceCube/UW-Madison/_admin'])

    data = {
        'experiment': 'IceCube',
        'institution': 'UW-Madison',
    }
    ret = await client.request('POST', '/api/inst_approvals', data)
    approval_id = ret['id']

    email_patch.assert_called()
    email_patch.reset_mock()

    # no auth
    with pytest.raises(Exception):
        await client.request('POST', f'/api/inst_approvals/{approval_id}/actions/approve')

    ret = await mongo_client.inst_approvals.find().to_list(10)
    assert len(ret) == 1
    assert ret[0]['id'] == approval_id

    email_patch.assert_not_called()

    ret = await krs.groups.get_group_membership('/institutions/IceCube/UW-Madison', rest_client=krs_client)
    assert 'test' not in ret

    # success
    await client2.request('POST', f'/api/inst_approvals/{approval_id}/actions/approve')

    ret = await mongo_client.inst_approvals.find().to_list(10)
    assert len(ret) == 0

    email_patch.assert_called()

    ret = await krs.groups.get_group_membership('/institutions/IceCube/UW-Madison', rest_client=krs_client)
    assert 'test' in ret

@pytest.mark.asyncio
async def test_inst_approvals_actions_approve_gen2(server, mongo_client, email_patch):
    rest, krs_client, *_ = server

    await krs.groups.create_group('/institutions', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/UW-Madison', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube-Gen2', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube-Gen2/UW-Madison', rest_client=krs_client)

    client = await rest('test')
    client2 = await rest('test2', groups=['/institutions/IceCube/UW-Madison/_admin'])

    data = {
        'experiment': 'IceCube',
        'institution': 'UW-Madison',
    }
    ret = await client.request('POST', '/api/inst_approvals', data)
    approval_id = ret['id']

    email_patch.assert_called()
    email_patch.reset_mock()

    await client2.request('POST', f'/api/inst_approvals/{approval_id}/actions/approve')

    ret = await mongo_client.inst_approvals.find().to_list(10)
    assert len(ret) == 0

    email_patch.assert_called()

    ret = await krs.groups.get_group_membership('/institutions/IceCube/UW-Madison', rest_client=krs_client)
    assert 'test' in ret
    ret = await krs.groups.get_group_membership('/institutions/IceCube-Gen2/UW-Madison', rest_client=krs_client)
    assert 'test' in ret

@pytest.mark.asyncio
async def test_inst_approvals_actions_approve_posix(server, mongo_client, reg_token_client, email_patch):
    rest, krs_client, *_ = server

    await krs.groups.create_group('/institutions', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/UW-Madison', rest_client=krs_client)
    await krs.groups.create_group('/posix', rest_client=krs_client)

    client2 = await rest('test2', groups=['/institutions/IceCube/UW-Madison/_admin'])

    data = {
        'experiment': 'IceCube',
        'institution': 'UW-Madison',
        'first_name': 'first',
        'last_name': 'last',
        'username': 'flast',
        'email': 'test@test',
    }
    client = await reg_token_client()
    ret = await client.request('POST', '/api/inst_approvals', data)
    approval_id = ret['id']

    email_patch.assert_called()
    email_patch.reset_mock()

    await client2.request('POST', f'/api/inst_approvals/{approval_id}/actions/approve')

    ret = await mongo_client.inst_approvals.find().to_list(10)
    assert len(ret) == 0

    email_patch.assert_called()

    ret = await krs.groups.get_group_membership('/institutions/IceCube/UW-Madison', rest_client=krs_client)
    assert 'flast' in ret
    ret = await krs.groups.get_group_membership('/posix', rest_client=krs_client)
    assert 'flast' in ret

@pytest.mark.asyncio
async def test_inst_approvals_actions_deny(server, mongo_client, email_patch):
    rest, krs_client, *_ = server

    await krs.groups.create_group('/institutions', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube', rest_client=krs_client)
    await krs.groups.create_group('/institutions/IceCube/UW-Madison', rest_client=krs_client)

    client = await rest('test')
    client2 = await rest('test2', groups=['/institutions/IceCube/UW-Madison/_admin'])

    data = {
        'experiment': 'IceCube',
        'institution': 'UW-Madison',
    }
    ret = await client.request('POST', '/api/inst_approvals', data)
    approval_id = ret['id']

    email_patch.assert_called()
    email_patch.reset_mock()

    # no auth
    with pytest.raises(Exception):
        await client.request('POST', f'/api/inst_approvals/{approval_id}/actions/deny')

    ret = await mongo_client.inst_approvals.find().to_list(10)
    assert len(ret) == 1
    assert ret[0]['id'] == approval_id

    email_patch.assert_not_called()

    ret = await krs.groups.get_group_membership('/institutions/IceCube/UW-Madison', rest_client=krs_client)
    assert 'test' not in ret

    # success
    await client2.request('POST', f'/api/inst_approvals/{approval_id}/actions/deny')

    ret = await mongo_client.inst_approvals.find().to_list(10)
    assert len(ret) == 0

    email_patch.assert_called()

    ret = await krs.groups.get_group_membership('/institutions/IceCube/UW-Madison', rest_client=krs_client)
    assert 'test' not in ret
