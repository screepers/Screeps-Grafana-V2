# An easy-to-use, high-performance Graphite + Grafana service

## Requirements

* Docker-Compose
* Node (any version)

## Installation

1. Clone this repository
2. Run `npm install` to install dependencies

## Setup

1. Edit `example.env` and `docker-compose.example.yml` to match your needs. This step is not required if you are using the default setup.
2. Copy `users.example.json` to `users.json` and edit it according to [User Setup](#User-Setup).
3. The configuration files for both Grafana and Graphite are in `config/grafana` and `config/graphite` respectively.
4. If you have a dashboard you want to auto-add, you can drop their JSON files into `config/grafana/provisioning/dashboards`
and they'll be auto-added to the instance.

## Usage

* `npm run start`: start the containers
* `npm run logs`: check the container's logs
* `npm run stop`: stop the containers
* `npm run reset`: remove the containers
* `npm run reset:hard`: remove the containers and their volumes
* `npm run rebuild`: rebuild the pushStats container and restart it; needed if you make changes to its code.

See the scripts section in the package.json file.

Go to [localhost:3000](http://localhost:3000) (if you used port 3000) and login with `admin` and `password` (or your custom set login info).

Its possible to use https for your grafana instance, check out this [tutorial](https://www.turbogeek.co.uk/grafana-how-to-configure-ssl-https-in-grafana/) for example on how to do this, enough info online about it. I dont support this (yet)


### User Setup

1. Remove all users from the setup
2. Add users in the following format:

A. MMO:

```json
{
    # Prefix is entirely optional
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
    # Prefix is entirely optional
    "prefix": "a.b.c",
    "username": "EMAIL",
    # If your email has a period in it, grafana displays it incorrectly
    # Its reccomended to change this to the username you set for MMO.
    "replaceName": "USERNAME HERE",
    "type": "private",
    "shards": ["screeps"],
    "password": "password",
}
```

If the private server is not hosted on localhost, add the host to the user:

```json
{
    "username": "EMAIL",
    "replaceName": "USERNAME",
    "type": "private",
    "shards": ["screeps"],
    "password": "password",
    "host": "192.168.1.10",
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
* `--username`: overwrite the username for the Grafana admin user
* `--password`: overwrite the password for the Grafana admin user
* `--enableAnonymousAccess`: enable anonymous access to Grafana

#### Network

* `--grafanaDomain`: Overwrite grafana.ini domain
* `--grafanaPort`: port for Grafana to run on
* `--relayPort`: port for relay-ng to run on (default: 2003)
* `--pushStatusPort`: port for the stats-getter push API (default: false)
  true will set it to 10004, otherwise specify a port number it'll listen to

#### Exporting

* `--deleteLogs`: deletes the logs folder
* `--removeWhisper`: Deletes the carbon whisper folder
* `--removeVolumes`: Remove all volumes, including the grafana database.

## Usage

* `npm run setup`: to execute setup only
* `npm run start`: to configure and start it
* For other run commands like eslint, check out package.json scripts object.

Go to [localhost:3000](http://localhost:3000) (if you used port 3000) and login with `admin` and `password` (or your custom set login info).

Its possible to use https for your grafana instance, check out this [tutorial](https://www.turbogeek.co.uk/grafana-how-to-configure-ssl-https-in-grafana/) for example on how to do this, enough info online about it. I dont support this (yet)
