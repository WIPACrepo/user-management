FROM python:3.10

RUN useradd -m -U keycloak

RUN mkdir /app && chown keycloak:keycloak /app

WORKDIR /app
USER keycloak

COPY . .

USER root

RUN pip install -e .

USER keycloak

CMD ["python", "-m", "user_mgmt"]
