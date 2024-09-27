const dotenv = require('dotenv');
const axios = require('axios');
const { join } = require('path');
const fs = require('fs');

let grafanaApiUrl;

const setup = require('./setup.js');
const getDashboards = require('../../dashboards/helper.js');

/** @type {import('winston').Logger} */
let logger;

function sleep(milliseconds) {
  // eslint-disable-next-line no-promise-executor-return
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const dashboards = getDashboards();
let adminLogin;

function handleSuccess(type) {
  logger.info(`${type} dashboard setup done`);
}

function handleError(type, err) {
  logger.error(`${type} dashboard error: `, err);
}

async function SetupServiceInfoDashboard() {
  const type = 'Service-Info';
  try {
    const dashboard = dashboards.serviceInfo;
    await axios({
      url: `${grafanaApiUrl}/dashboards/db`,
      method: 'post',
      auth: adminLogin,
      data: dashboard,
    });
    handleSuccess(type);
  } catch (err) {
    handleError(type, err);
  }
}

async function Start(cli) {
  logger = cli.logger;
  await setup(cli);
  dotenv.config({ path: join(__dirname, '../../.env') });

  const grafanaIni = fs.readFileSync(join(__dirname, '../../grafanaConfig/grafana/grafana.ini'), 'utf8');
  const username = grafanaIni.match(/admin_user = (.*)/)[1];
  const password = grafanaIni.match(/admin_password = (.*)/)[1];
  adminLogin = { username, password };

  dotenv.config({ path: join(__dirname, '../../grafanaConfig/.env.grafana') });

  grafanaApiUrl = `http://localhost:${cli.args.grafanaPort}/api`;
  await setup.commands(grafanaApiUrl);
  logger.info('Pre setup done! Waiting for Grafana to start...');
  await sleep(30 * 1000);

  await SetupServiceInfoDashboard();
  logger.info('Setup done!');
}

module.exports = Start;
