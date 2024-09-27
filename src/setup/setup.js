const fs = require('fs');
const fse = require('fs-extra');
const { join } = require('path');
const { execSync } = require('child_process');

let argv;
/** @type {import('winston').Logger} */
let logger;

const isWindows = process.platform === 'win32';
const regexEscape = isWindows ? '\r\n' : '\n';

function createRegexWithEscape(string) {
  return new RegExp(string.replace('\r\n', regexEscape));
}

function UpdateGrafanaConfigFolder() {
  const configDirPath = join(__dirname, '../../grafanaConfig');
  if (fs.existsSync(configDirPath) && !argv.force) {
    return logger.warn('Grafana config folder already exists, use --force to overwrite it');
  }

  fse.copySync(join(__dirname, '../../grafanaConfig.example'), configDirPath);
  const grafanaIniFile = join(configDirPath, './grafana/grafana.ini');
  let grafanaIniText = fs.readFileSync(grafanaIniFile, 'utf8');

  if (argv.username) grafanaIniText = grafanaIniText.replace(/admin_user = (.*)/, `admin_user = ${argv.username}`);
  if (argv.password) grafanaIniText = grafanaIniText.replace(/admin_password = (.*)/, `admin_password = ${argv.password}`);
  if (argv.grafanaDomain) {
    grafanaIniText = grafanaIniText.replace('domain = localhost', `domain = ${argv.grafanaDomain}`);
    grafanaIniText = grafanaIniText.replace('from_address = admin@localhost', `from_address = admin@${argv.grafanaDomain}`);
  }
  if (argv.grafanaPort) {
    grafanaIniText = grafanaIniText.replace('http_port = 3000', `http_port = ${argv.grafanaPort}`);
  }
  grafanaIniText = grafanaIniText.replace(
    createRegexWithEscape('enable anonymous access\r\nenabled = (.*)'),
    `enable anonymous access${regexEscape}enabled = ${argv.enableAnonymousAccess ? 'true' : 'false'}`,
  );
  fs.writeFileSync(grafanaIniFile, grafanaIniText);

  // This can just be set manually in the config folder.
  /*
  const storageSchemasFile = join(grafanaConfigFolder, './go-carbon/storage-schemas.conf');
  let storageSchemasText = fs.readFileSync(storageSchemasFile, 'utf8');
  const { defaultRetention } = argv;

  if (defaultRetention) {
    storageSchemasText = storageSchemasText.replace(
      createRegexWithEscape('pattern = .*\r\nretentions = (.*)'),
      `pattern = .*${regexEscape}retentions = ${defaultRetention}`,
    );
  }
  fs.writeFileSync(storageSchemasFile, storageSchemasText);
  */

  logger.info('Grafana config folder created');
}

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

  UpdateGrafanaConfigFolder();
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
