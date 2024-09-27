#!/usr/bin/env node

const { execSync } = require('child_process');
const { join } = require('path');
require('dotenv').config({ path: join(__dirname, '../.env') });

const nodeVersion = process.versions.node;
const nodeVersionMajor = Number(nodeVersion.split('.')[0]);
const { getPort } = nodeVersionMajor >= 14 ? require('get-port-please') : { getPort: async () => 3000 };

const minimist = require('minimist');
const { createLogger, format, transports } = require('winston');

const setup = require('../src/setup/setup');
const start = require('../src/setup/start');

const argv = minimist(process.argv.slice(2));

const { combine, timestamp, prettyPrint } = format;
const logger = createLogger({
  transports: [
    new transports.Console({
      format: combine(format.colorize(), format.simple()),
    }),
    new transports.File({
      filename: 'logs/setup.log',
      format: combine(
        timestamp(),
        prettyPrint(),
      ),
    })],
});

async function main() {
  argv.grafanaPort = argv.grafanaPort ?? await getPort({ portRange: [3000, 4000] });
  argv.serverPort = argv.serverPort ?? 21025;
  if (argv.pushStatusPort === true) {
    argv.pushStatusPort = 10004;
  } else {
    const port = Number(argv.pushStatusPort);
    if (!Number.isNaN(port)) {
      argv.pushStatusPort = port;
    } else {
      delete argv.pushStatusPort;
    }
  }

  const cli = {
    cmd: argv._.shift(),
    args: argv,
    logger,
  };

  switch (cli.cmd) {
    case 'setup':
      setup(cli);
      break;

    case 'start':
      start(cli);
      break;

    case 'stop':
      logger.info(`Stopping server from ${process.env.COMPOSE_FILE}`);
      execSync('docker-compose stop');
      break;

    default:
      logger.error(`expected command, got "${cli.cmd}"`);
      break;
  }
}

main();
