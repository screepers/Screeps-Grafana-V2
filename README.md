# An easy-to-use, high-performance Graphite + Grafana service

## Requirements

* Docker-Compose
* Node (any version)

## Installation

1. Clone this repository
2. Run `npm install` to install dependencies

## Setup

1. Update all .example files and/or folders to match your needs. This step is not required if you are using the default setup.
2. Add your own Grafana variables in `grafanaConfig/.env.grafana`. This file will be updated after a volume reset.

### User Setup

1. Remove all users from the setup
2. Add users in the following format:

A. MMO:

```json
{
"prefix": "a.b.c",
"username": "PandaMaster",
"type": "mmo",
"shards": ["shard0"],
"token": "TOKEN_FOR_THIS_USER!",
}
```

B. Private:

```json
{
"prefix": "a.b.c",
"username": "W1N1",
"type": "private",
"shards": ["screeps"],
"password": "password",
}
```

If the private server is not hosted on localhost, add the host to the user:

```json
{
"username": "W1N1",
"type": "private",
"shards": ["screeps"],
"password": "password",
"host": "123.456.789",
}
```

If the segment of the stats is not memory, add it to the user:

```json
{
"username": "W1N1",
"type": "private",
"shards": ["screeps"],
"password": "password",
"host": "123.456.789",
"segment": 0,
}
```

Update all .example files and/or folders to match your needs. This step is not required if you are using the default setup.

### Run Commands

#### Config

* `--force`: force the non .example config files to be overwritten.
* `--debug`: listen to setup Docker logs
* `--traefik`: Add traefik labels to the docker-compose.yml file, reverse proxy for docker containers.
* `--username`: overwrite the username for the Grafana admin user
* `--password`: overwrite the password for the Grafana admin user
* `--defaultRetention`: overwrite the default retention for the default retention polic of all not regex'd retention paths.
* `--enableAnonymousAccess`: enable anonymous access to Grafana
* `--traefikHost`: use only traefik forwarding

#### Network

* `--grafanaDomain`: Overwrite grafana.ini domain
* `--grafanaPort`: port for Grafana to run on
* `--relayPort`: port for relay-ng to run on (default: 2003)

#### Exporting

* `--deleteLogs`: deletes the logs folder
* `--removeWhisper`: Deletes the carbon whisper folder
* `--removeVolumes`: Remove all volumes, including the grafana database.

## Usage

* `npm run setup`: to execute setup only
* `npm run start:standalone`: to configure and start it
* `npm run start:standalone-traefik` to confgiure with traefik and start it
* For other run commands like eslint, check out package.json scripts object.

Go to [localhost:3000](http://localhost:3000) (if you used port 3000) and login with `admin` and `password` (or your custom set login info).

Its possible to use https for your grafana instance, check out this [tutorial](https://www.turbogeek.co.uk/grafana-how-to-configure-ssl-https-in-grafana/) for example on how to do this, enough info online about it. I dont support this (yet)
