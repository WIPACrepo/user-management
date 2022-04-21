<!--- Top of README Badges (automated) --->
[![GitHub release (latest by date including pre-releases)](https://img.shields.io/github/v/release/WIPACrepo/user-management?include_prereleases)](https://github.com/WIPACrepo/user-management/) [![Lines of code](https://img.shields.io/tokei/lines/github/WIPACrepo/user-management)](https://github.com/WIPACrepo/user-management/) [![GitHub issues](https://img.shields.io/github/issues/WIPACrepo/user-management)](https://github.com/WIPACrepo/user-management/issues?q=is%3Aissue+sort%3Aupdated-desc+is%3Aopen) [![GitHub pull requests](https://img.shields.io/github/issues-pr/WIPACrepo/user-management)](https://github.com/WIPACrepo/user-management/pulls?q=is%3Apr+sort%3Aupdated-desc+is%3Aopen) 
<!--- End of README Badges (automated) --->
# keycloak-rest-services
Services surrounding Keycloak, that use the REST API to read/update state.

[![CircleCI](https://circleci.com/gh/WIPACrepo/keycloak-rest-services.svg?style=svg&circle-token=87c420d0b5ba0dffb28337618e7cf0df7a905bf8)](https://circleci.com/gh/WIPACrepo/keycloak-rest-services)

* [Basic Design](#basic-design)
  + [Direct Actions](#direct-actions)
  + [Approval Actions](#approval-actions)
* [REST API](#rest-api)
* [Web App](#web-app)
* [Running Tests](#running-tests)
  + [Getting Test Coverage](#getting-test-coverage)
* [Manually Running Scripts](#manually-running-scripts)

## Basic Design

### Direct Actions

Any action that does not require approval will be made directly against
Keycloak using the REST API.

Examples include modifying users, groups, and applications.

### Approval Actions

Approval actions require temporary storage to hold the action until approval
has been granted. Any database would do, but we have chosen MongoDB for
several reasons:

1. We are already familiar with it and use it in several other projects.
2. It can expire entries automatically with TTL Indexes.
3. Tailable cursors allow "watching" changes in real time.

Once approval has been granted, the action will then be applied to Keycloak.

## REST API

The user-facing service has a REST API with the following routes:

           GET  /api/experiments
           GET  /api/experiments/<experiment>/institutions
           GET  /api/experiments/<experiment>/institutions/<institution>
    (auth) GET  /api/experiments/<experiment>/institutions/<institution>/users
    (auth) PUT  /api/experiments/<experiment>/institutions/<institution>/users/<user>
    (auth) DEL  /api/experiments/<experiment>/institutions/<institution>/users/<user>

           POST /api/inst_approvals   - new user
    (auth) POST /api/inst_approvals   - second/moving institution
    (auth) GET  /api/inst_approvals
    (auth) POST /api/inst_approvals/<approval_id>/actions/<approve/deny>


    (auth) GET  /api/groups
    (auth) GET  /api/groups/<group_id>
    (auth) PUT  /api/groups/<group_id>/<user>  - add member manually
    (auth) DEL  /api/groups/<group_id>/<user>  - remove member

    (auth) POST /api/group_approvals  - request membership
    (auth) GET  /api/group_approvals
    (auth) POST /api/group_approvals/<approval_id>/actions/<approve/deny>

## Web App

Primary access to the user-facing service is via a web application.
This is purely browser-based (JavaScript), and connects to the
[REST API](#rest-api) for actions. Authentication comes from connecting
to a Keycloak client specifically created for this and the REST API.

## Running Tests

The tests run automatically in CircleCI, but for those that want to run them
locally, there is a way.

First, build and load the local python environment:

    ./setupenv.sh
    . env/bin/activate

Then, start an instance of Keycloak in another terminal:

    docker run --rm -it -p 8080:8080 -e KEYCLOAK_USER=admin -e KEYCLOAK_PASSWORD=admin quay.io/keycloak/keycloak:latest -Djboss.bind.address.private=127.0.0.1 -Djboss.bind.address=0.0.0.0

Keycloak may take a minute to start. If it does not, check your network settings,
as it does not play well with VPNs and other more exotic network situations.

Finally, run the tests:

    keycloak_url=http://localhost:8080 username=admin password=admin pytest

### Getting Test Coverage

If you want a coverage report, instead of running pytest directly, run it
under the coverage tool:

    keycloak_url=http://localhost:8080 username=admin password=admin coverage run -m pytest
    coverage html --include='krs*'
