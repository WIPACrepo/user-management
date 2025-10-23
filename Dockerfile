FROM python:3.10

RUN useradd -m -U keycloak

RUN mkdir /app && chown keycloak:keycloak /app

WORKDIR /app
USER keycloak

COPY pyproject.toml /app/pyproject.toml
COPY user_mgmt /app/user_mgmt

USER root

RUN --mount=type=bind,source=.git,target=.git,ro pip install --no-cache .

USER keycloak

CMD ["python", "-m", "user_mgmt"]
