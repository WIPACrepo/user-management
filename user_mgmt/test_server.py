import asyncio
import logging
import os

from rest_tools.server import RestServer
from wipac_dev_tools import from_environment

from .server import Main, Error


def test_server():
    static_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')

    default_config = {
        'HOST': 'localhost',
        'PORT': 8080,
        'DEBUG': True,
    }
    config = from_environment(default_config)

    logformat = '%(asctime)s %(levelname)s %(name)s %(module)s:%(lineno)s - %(message)s'
    logging.basicConfig(format=logformat, level='DEBUG' if config['DEBUG'] else 'INFO')

    args = {
        'keycloak_url': 'testing'
    }
    server = RestServer(static_path=static_path, template_path=static_path, debug=config['DEBUG'])
    server.add_route(r'/api/(.*)', Error)
    server.add_route(r'/(.*)', Main, args)
    server.startup(address=config['HOST'], port=config['PORT'])


if __name__ == '__main__':
    test_server()
    asyncio.get_event_loop().run_forever()
