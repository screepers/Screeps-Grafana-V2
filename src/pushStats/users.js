import fs from 'fs';
import net from 'net';

const SERVER_PORT = parseInt(/** @type {string} */ (process.env.SERVER_PORT), 10) ?? 21025;

/**
 * Check whether there's a server nearby
 * @returns {Promise<[string, number]>}
 */
async function checkLocalhostServer() {
  const hosts = [
    'localhost',
    'host.docker.internal',
    '172.17.0.1',
  ];
  /** @type {Promise<[string, number]>[]} */
  const promises = [];
  for (const host of hosts) {
    const p = new Promise((resolve, reject) => {
      const sock = new net.Socket();
      sock.setTimeout(2500);
      console.log(`[${host}:${SERVER_PORT}] attempting connection`);
      sock
        .on('connect', () => {
          sock.destroy();
          resolve([host, SERVER_PORT]);
        })
        .on('error', () => {
          sock.destroy();
          reject();
        })
        .on('timeout', () => {
          sock.destroy();
          reject();
        })
        .connect(SERVER_PORT, host);
    });
    promises.push(p);
  }
  return Promise.any(promises);
}

/**
 *
 * @param {UserType} type
 * @returns {[string, number]}
 */
function getHostInfoFromType(type) {
  switch (type) {
    case 'mmo':
      return ['screeps.com', 443];
    case 'season':
      return ['screeps.com/season', 443];
    default:
      throw new Error(`no idea what type ${type} is`);
  }
}

export default async function loadUsers() {
  /** @type {UserInfo[]} */
  const users = JSON.parse(fs.readFileSync('users.json').toString('utf8'));
  /** @type {UserInfo[]} */
  const validUsers = [];
  const localServer = await checkLocalhostServer();
  for (const user of users) {
    if (typeof user.username !== 'string' || user.username.length <= 0) {
      console.log('Missing username!');
      continue;
    }
    if (user.username.includes('.') && !user.replaceName) {
      // Just yank the dot from the name
      user.replaceName = user.username.replace(/\./g, '');
    }
    if (user.type && !['mmo', 'season', 'private'].includes(user.type)) {
      console.log(`Invalid type for user ${user.username}, ignoring.`);
      continue;
    }
    if (!user.host) {
      try {
        if (user.type === 'private') {
          [user.host, user.port] = localServer;
        } else {
          [user.host, user.port] = getHostInfoFromType(user.type);
        }
      } catch {
        console.log(`Cannot get host for user ${user.username}, ignoring.`);
        continue;
      }
    }
    if (!user.host || !user.port) {
      console.log(`Missing host or port for user ${user.username}, ignoring.`);
      continue;
    }
    if (!user.password && !user.token) {
      console.log(`Missing password or token for user ${user.username}, ignoring.`);
      continue;
    }
    if (!Array.isArray(user.shards) || !user.shards.every((s) => typeof s === 'string')) {
      console.log(`Missing or invalid shard for user ${user.username}, ignoring.`);
      continue;
    }
    validUsers.push(user);
  }
  return validUsers;
}
