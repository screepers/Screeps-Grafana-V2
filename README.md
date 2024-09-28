# An easy-to-use, high-performance Graphite + Grafana service

## Requirements

* Docker-Compose
* Node (any version)

## Installation

1. Clone this repository
2. Run `npm install` to install dependencies

## Setup

1. Copy `.env.example` to `.env` and edit to match your needs.
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
    "port": 21025,
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
