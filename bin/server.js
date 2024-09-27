#!/usr/bin/env node

const { execSync } = require('child_process');
const { join } = require('path');
require('dotenv').config({ path: join(__dirname, '../.env') });

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
