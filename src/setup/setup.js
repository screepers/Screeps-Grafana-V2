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

function UpdateEnvFile() {
  const envFile = join(__dirname, '../../.env');
  if (fs.existsSync(envFile) && !argv.force) {
    return logger.warn('Env file already exists, use --force to overwrite it');
  }

  const exampleEnvFilePath = join(__dirname, '../../example.env');
  let contents = fs.readFileSync(exampleEnvFilePath, 'utf8');
  contents = contents
    .replace('GRAFANA_PORT=3000', `GRAFANA_PORT=${argv.grafanaPort}`)
    .replace('COMPOSE_PROJECT_NAME=screeps-grafana', `COMPOSE_PROJECT_NAME=screeps-grafana-${argv.grafanaPort}`)
    .replace('COMPOSE_FILE=./docker-compose.yml', `COMPOSE_FILE=${join(__dirname, '../../docker-compose.yml')}`);
  if (argv.serverPort) {
    contents = contents.replace('SERVER_PORT=21025', `SERVER_PORT=${argv.serverPort}`);
  }

  fs.writeFileSync(envFile, contents);
  logger.info('Env file created');
}

async function UpdateDockerComposeFile() {
  const dockerComposeFile = join(__dirname, '../../docker-compose.yml');
  if (fs.existsSync(dockerComposeFile) && !argv.force) {
    return logger.warn('Docker-compose file already exists, use --force to overwrite it');
  }

  const exampleDockerComposeFile = join(__dirname, '../../docker-compose.example.yml');
  let contents = fs.readFileSync(exampleDockerComposeFile, 'utf8');
  contents = contents.replace('3000:3000', `${argv.grafanaPort}:${argv.grafanaPort}`);
  contents = contents.replace('http://localhost:3000/login', `http://localhost:${argv.grafanaPort}/login`);

  if (argv.relayPort) {
    contents = contents.replace('2003:2003', `${argv.relayPort}:2003`);
  } else {
    contents = contents.replace(createRegexWithEscape('ports:\r\n      - 2003:2003'), '');
  }
  if (argv.serverPort) {
    contents = contents
      .replace('http://localhost:21025/web', `http://localhost:${argv.serverPort}/web`)
      .replace('SERVER_PORT: 21025', `SERVER_PORT: ${argv.serverPort}`);
  }
  if (argv.pushStatusPort) {
    contents = contents.replace(
      'INCLUDE_PUSH_STATUS_API=false',
      `INCLUDE_PUSH_STATUS_API=true${regexEscape}    ports:${regexEscape}        - ${argv.pushStatusPort}:${argv.pushStatusPort}`,
    );
  }
  if (argv.prefix) {
    contents = contents.replace('PREFIX=', `PREFIX=${argv.prefix}`);
  }

  fs.writeFileSync(dockerComposeFile, contents);
  logger.info('Docker-compose file created');
}

function UpdateUsersFile() {
  const usersFile = join(__dirname, '../../users.json');
  if (fs.existsSync(usersFile) && !argv.force) {
    return logger.warn('Users file already exists, use --force to overwrite it');
  }

  const exampleUsersFilePath = join(__dirname, '../../users.example.json');
  const exampleUsersText = fs.readFileSync(exampleUsersFilePath, 'utf8');
  fs.writeFileSync(usersFile, exampleUsersText);
  logger.info('Users file created');
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
  const carbonStoragePath = join(__dirname, '../../go-carbon-storage');
  let carbonStorageExists = fs.existsSync(carbonStoragePath);
  if (carbonStorageExists && argv.removeWhisper) {
    fs.rmdirSync(carbonStoragePath, { recursive: true });
    carbonStorageExists = false;
  }
  if (!carbonStorageExists) {
    fs.mkdirSync(carbonStoragePath, { recursive: true });
  }

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

  UpdateUsersFile();
  UpdateEnvFile();
  await UpdateDockerComposeFile();
  UpdateGrafanaConfigFolder();
}

module.exports = Setup;

module.exports.commands = async function Commands(grafanaApiUrl) {
  logger.info(`Grafana API URL: ${grafanaApiUrl}, serverPort: ${argv.serverPort}`);

  const commands = [
    { command: `docker compose down ${argv.removeVolumes ? '--volumes' : ''} --remove-orphans`, name: 'docker-compose down' },
    { command: 'docker compose build --no-cache', name: 'docker-compose build' },
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
