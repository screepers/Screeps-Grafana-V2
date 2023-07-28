import http from 'http';
import https from 'https';
import net from 'net';
import util from 'util';
import zlib from 'zlib';
import fs from 'fs';
// import users from './users.json' assert {type: 'json'};
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { join, dirname } from 'path';

import { createLogger, format, transports } from 'winston';
import 'winston-daily-rotate-file';

const users = JSON.parse(fs.readFileSync('users.json'));

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, './.env') });
const needsPrivateHost = users.some((u) => u.type !== 'mmo' && !u.host);

const gunzipAsync = util.promisify(zlib.gunzip);
const { combine, timestamp, prettyPrint } = format;

const transport = new transports.DailyRotateFile({
  filename: 'logs/api-%DATE%.log',
  auditFile: 'logs/api-audit.json',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d'
});
const logger = createLogger({
  format: combine(
    timestamp(),
    prettyPrint(),
  ),
  transports: [transport],
});

async function gz(data) {
  if (!data) return {};
  const buf = Buffer.from(data.slice(3), 'base64');
  const ret = await gunzipAsync(buf);
  return JSON.parse(ret.toString());
}

function removeNonNumbers(obj) {
  if (!obj) return obj;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i += 1) {
      obj[i] = removeNonNumbers(obj[i]);
    }
  } else if (typeof obj === 'object') {
    Object.keys(obj).forEach((key) => {
      obj[key] = removeNonNumbers(obj[key]);
    });
  } else if (typeof obj !== 'number') {
    return null;
  }
  return obj;
}

let privateHost;
let serverPort = 21025;

function getPrivateHost() {
  serverPort = process.env.SERVER_PORT || 21025;
  const hosts = [
    'localhost',
    'host.docker.internal',
    '172.17.0.1',
  ];
  for (let h = 0; h < hosts.length; h += 1) {
    const host = hosts[h];
    const sock = new net.Socket();
    sock.setTimeout(2500);
    // eslint-disable-next-line no-loop-func
    sock.on('connect', () => {
      sock.destroy();
      privateHost = host;
    })
      .on('error', () => {
        sock.destroy();
      })
      .on('timeout', () => {
        sock.destroy();
      })
      .connect(serverPort, host);
  }
}

async function TryToGetPrivateHost() {
  if (!privateHost && needsPrivateHost) {
    getPrivateHost();
    if (!privateHost) console.log('No private host found to make connection with yet! Trying again in 60 seconds.');
    else console.log(`Private host found! Continuing with ${privateHost}.`);

    // eslint-disable-next-line
    await new Promise((resolve) => setTimeout(resolve, 60 * 1000));
    TryToGetPrivateHost();
  }
}

if (!privateHost && needsPrivateHost) {
  TryToGetPrivateHost();
}

async function getHost(host, type) {
  if (type === 'mmo') return 'screeps.com';
  if (type === 'season') return 'screeps.com/season';
  if (host) return host;
  return privateHost;
}

async function getRequestOptions(info, path, method = 'GET', body = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(JSON.stringify(body)),
  };

  if (info.username) headers['X-Username'] = info.username;
  if (info.token) headers['X-Token'] = info.token;
  return {
    host: await getHost(info.host, info.type),
    port: info.type === 'mmo' ? 443 : serverPort,
    path,
    method,
    headers,
    body,
    isHTTPS: info.type === 'mmo',
  };
}
async function req(options) {
  const reqBody = JSON.stringify(options.body);
  const { isHTTPS } = options;
  delete options.body;
  delete options.isHTTPS;

  const maxTime = new Promise((resolve) => {
    setTimeout(resolve, 10 * 1000, 'Timeout');
  });

  const executeReq = new Promise((resolve, reject) => {
    const request = (isHTTPS ? https : http).request(options, (res) => {
      res.setEncoding('utf8');
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          body = JSON.parse(body);
          resolve(body);
        } catch {
          resolve(body);
        }
      });
    });
    request.write(reqBody);
    request.on('error', (err) => {
      reject(err);
    });
    request.end();
  });

  return Promise.race([executeReq, maxTime])
    .then((result) => {
      if (result === 'Timeout') {
        logger.log('info', 'Timeout hit!', new Date(), JSON.stringify(options), reqBody);
        return;
      }
      // is result string
      if (typeof result === 'string' && result.startsWith('Rate limit exceeded')) logger.log('error', { data: result, options });
      else logger.log('info', { data: `${JSON.stringify(result).length / 1000} MB`, options });
      // eslint-disable-next-line consistent-return
      return result;
    })
    .catch((result) => {
      logger.log('error', { data: result, options });
      return result;
    });
}

export default class {
  static async getPrivateServerToken(info) {
    const options = await getRequestOptions({ type: 'private', username: info.username, host: info.host }, '/api/auth/signin', 'POST', {
      email: info.username,
      password: info.password,
    });
    const res = await req(options);
    if (!res) return undefined;
    return res.token;
  }

  static async getMemory(info, shard, statsPath = 'stats') {
    const options = await getRequestOptions(info, `/api/user/memory?path=${statsPath}&shard=${shard}`, 'GET');
    const res = await req(options);
    if (!res) return undefined;
    const data = await gz(res.data);
    return data;
  }

  static async getSegmentMemory(info, shard) {
    const options = await getRequestOptions(info, `/api/user/memory-segment?segment=${info.segment}&shard=${shard}`, 'GET');
    const res = await req(options);
    if (!res || res.data == null) return {};
    try {
      const data = JSON.parse(res.data);
      return data;
    } catch (error) {
      return {};
    }
  }

  static async getUserinfo(info) {
    const options = await getRequestOptions(info, '/api/auth/me', 'GET');
    const res = await req(options);
    return res;
  }

  static async getLeaderboard(info) {
    const options = await getRequestOptions(info, `/api/leaderboard/find?username=${info.username}&mode=world`, 'GET');
    const res = await req(options);
    return res;
  }

  static async getServerStats(host) {
    const serverHost = host || privateHost;
    const options = await getRequestOptions({ host: serverHost }, '/api/stats/server', 'GET');
    const res = await req(options);
    if (!res || !res.users) {
      logger.error(res);
      return undefined;
    }
    return removeNonNumbers(res);
  }

  static async getAdminUtilsServerStats(host) {
    const serverHost = host || privateHost;
    const options = await getRequestOptions({ host: serverHost }, '/stats', 'GET');
    const res = await req(options);
    if (!res || !res.gametime) {
      logger.error(res);
      return undefined;
    }

    delete res.ticks.ticks;
    const mUsers = {};
    res.users.forEach((user) => {
      mUsers[user.username] = user;
    });
    res.users = mUsers;

    return removeNonNumbers(res);
  }
}