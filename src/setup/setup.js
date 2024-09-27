const fs = require('fs');
const { join } = require('path');
const { execSync } = require('child_process');

let argv;
/** @type {import('winston').Logger} */
let logger;

function resetFolders() {
  const logsPath = join(__dirname, '../../logs');
  let logsExist = fs.existsSync(logsPath);
  if (logsExist && argv.deleteLogs) {
    fs.rmdirSync(logsPath, { recursive: true });
    logsExist = false;
  }
  if (!logsExist) fs.mkdirSync(logsPath, { recursive: true });
}

async function Setup(cli) {
  argv = cli.args;
  logger = cli.logger;

  const usersFile = join(__dirname, '../../users.json');
  if (!fs.existsSync(usersFile)) {
    logger.error('missing users.json file');
    process.exit(-1);
  }
}

module.exports = Setup;

module.exports.commands = async function Commands(grafanaApiUrl) {
  logger.info(`Grafana API URL: ${grafanaApiUrl}, serverPort: ${argv.serverPort}`);

  const commands = [
    { command: `docker compose down ${argv.removeVolumes ? '--volumes' : ''} --remove-orphans`, name: 'docker-compose down' },
    { command: 'docker compose up -d', name: 'docker-compose up' },
  ];

  logger.info('Executing start commands:');
  for (let i = 0; i < commands.length; i += 1) {
    const commandInfo = commands[i];
    try {
      logger.info(`Running command ${commandInfo.name}`);
      execSync(commandInfo.command, { stdio: argv.debug ? 'inherit' : 'ignore' });
      if (commandInfo.name.startsWith('docker-compose down')) resetFolders();
    } catch (error) {
      logger.error(`Command ${commandInfo.name} errored`, error);
      logger.error('Stopping setup');
      process.exit(1);
    }
  }
};
