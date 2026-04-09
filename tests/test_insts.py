import logging
import pytest

import user_mgmt.insts


@pytest.mark.parametrize('n', [8, 10, 16, 24, 100, 1000])
def test_gen_password(n):
    logging.info('n = %d', n)
    p = user_mgmt.insts.gen_password(n)
    assert len(p) == n

@pytest.mark.parametrize('n', [-1, 0, 1, 3, 5, 7])
def test_gen_password_too_small(n):
    with pytest.raises(Exception):
        user_mgmt.insts.gen_password(n)
