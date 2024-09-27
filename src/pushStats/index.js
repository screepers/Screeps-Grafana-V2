// eslint-disable-next-line import/no-unresolved
import cron from 'node-cron';
// eslint-disable-next-line import/no-unresolved
import graphite from 'graphite';
import { createLogger, format, transports } from 'winston';
// eslint-disable-next-line import/no-unresolved
import 'winston-daily-rotate-file';
import fs from 'fs';
import * as dotenv from 'dotenv';
// eslint-disable-next-line import/no-unresolved
import express from 'express';
import ApiFunc from './apiFunctions.js';

const app = express();
const port = 10004;
let lastUpload = new Date().getTime();

const users = JSON.parse(fs.readFileSync('users.json'));
dotenv.config();

const pushTransport = new transports.DailyRotateFile({
  filename: 'logs/push-%DATE%.log',
  auditFile: 'logs/push-audit.json',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
});
const cronTransport = new transports.DailyRotateFile({
  filename: 'logs/cron-%DATE%.log',
  auditFile: 'logs/cron-audit.json',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
});

const client = graphite.createClient('plaintext://graphite:2003/');
const { combine, timestamp, prettyPrint } = format;
const logger = createLogger({
  format: combine(
    timestamp(),
    prettyPrint(),
  ),
  transports: [pushTransport],
});

const cronLogger = createLogger({
  format: combine(
    timestamp(),
    prettyPrint(),
  ),
  transports: [cronTransport],
});

class ManageStats {
  groupedStats;

  message;

  constructor() {
    this.groupedStats = {};
    this.message = '----------------------------------------------------------------\r\n';
  }

  async handleUsers(type) {
    console.log(`[${type}] Handling Users`);

    const beginningOfMinute = new Date().getSeconds() < 15;
    const getStatsFunctions = [];
    users.forEach((user) => {
      try {
        if (user.type !== type) return;

        const rightMinuteForShard = new Date().getMinutes() % user.shards.length === 0;
        const shouldContinue = !beginningOfMinute || !rightMinuteForShard;
        if (user.type === 'mmo' && shouldContinue) return;
        if (user.type === 'season' && shouldContinue) return;

        for (let y = 0; y < user.shards.length; y += 1) {
          const shard = user.shards[y];
          getStatsFunctions.push(this.getStats(user, shard, this.message));
        }
      } catch (error) {
        logger.error(error.message);
      }
    });

    console.log(`[${type}] Getting ${getStatsFunctions.length} statistics`);

    await Promise.all(getStatsFunctions);

    const { groupedStats } = this;

    if (type === 'mmo') {
      if (Object.keys(groupedStats).length > 0) {
        if (!await ManageStats.reportStats({ stats: groupedStats })) return console.log('Error while pushing stats');

        console.log(`[${type}] Pushed stats to graphite`);

        return console.log(this.message);
      }

      if (beginningOfMinute) return console.log('No stats to push');
      return undefined;
    }
    if (type === 'season') {
      if (Object.keys(groupedStats).length > 0) {
        if (!await ManageStats.reportStats({ stats: groupedStats })) return console.log('Error while pushing stats');

        console.log(`[${type}] Pushed stats to graphite`);

        return console.log(this.message);
      }
      if (beginningOfMinute) return console.log('No stats to push');
      return undefined;
    }

    const privateUser = users.find((user) => user.type === 'private' && user.host);
    const host = privateUser ? privateUser.host : undefined;
    const serverStats = await ApiFunc.getServerStats(host);
    const adminUtilsServerStats = await ApiFunc.getAdminUtilsServerStats(host);
    if (adminUtilsServerStats) {
      try {
        const groupedAdminStatsUsers = {};
        for (const [username, user] of Object.entries(adminUtilsServerStats)) {
          groupedAdminStatsUsers[username] = user;
        }

        adminUtilsServerStats.users = groupedAdminStatsUsers;
      } catch (error) {
        console.log(error);
      }
    }

    if (!await ManageStats.reportStats({ stats: groupedStats, serverStats, adminUtilsServerStats })) return console.log('Error while pushing stats');
    let statsPushed = '';
    if (Object.keys(groupedStats).length > 0) {
      statsPushed = `Pushed ${type} stats`;
    }
    if (serverStats) {
      statsPushed += statsPushed.length > 0 ? ', server stats' : 'Pushed server stats';
    }
    if (adminUtilsServerStats) {
      statsPushed += statsPushed.length > 0 ? ', adminUtilsServerStats' : 'Pushed server stats';
    }
    this.message += statsPushed.length > 0 ? `> ${statsPushed} to graphite` : '> Pushed no stats to graphite';
    logger.info(this.message);
    return console.log(this.message);
  }

  static async getLoginInfo(userinfo) {
    if (userinfo.type === 'private') {
      userinfo.token = await ApiFunc.getPrivateServerToken(userinfo);
    }
    return userinfo.token;
  }

  static async addLeaderboardData(userinfo) {
    try {
      const leaderboard = await ApiFunc.getLeaderboard(userinfo);
      if (!leaderboard) return { rank: 0, score: 0 };
      const leaderboardList = leaderboard.list;
      if (leaderboardList.length === 0) return { rank: 0, score: 0 };
      const { rank, score } = leaderboardList.slice(-1)[0];
      return { rank, score };
    } catch (error) {
      return { rank: 0, score: 0 };
    }
  }

  async getStats(userinfo, shard) {
    try {
      await ManageStats.getLoginInfo(userinfo);
      const stats = userinfo.segment === undefined
        ? await ApiFunc.getMemory(userinfo, shard)
        : await ApiFunc.getSegmentMemory(userinfo, shard);

      await this.processStats(userinfo, shard, stats);
      return 'success';
    } catch (error) {
      return error;
    }
  }

  async processStats(userinfo, shard, stats) {
    if (Object.keys(stats).length === 0) return;
    const me = await ApiFunc.getUserinfo(userinfo);
    if (me) stats.power = me.power || 0;
    stats.leaderboard = await ManageStats.addLeaderboardData(userinfo);
    this.pushStats(userinfo, stats, shard);
  }

  static async reportStats(stats) {
    return new Promise((resolve) => {
      console.log(`Writing stats ${JSON.stringify(stats)} to graphite`);
      client.write({ [`${process.env.PREFIX ? `${process.env.PREFIX}.` : ''}screeps`]: stats }, (err) => {
        if (err) {
          console.log(err);
          logger.error(err);
          resolve(false);
        }
        lastUpload = new Date().getTime();
        resolve(true);
      });
      // resolve(true);
    });
  }

  pushStats(userinfo, stats, shard) {
    if (Object.keys(stats).length === 0) return;
    const username = userinfo.replaceName !== undefined ? userinfo.replaceName : userinfo.username;
    this.groupedStats[(userinfo.prefix ? `${userinfo.prefix}.` : '') + username] = { [shard]: stats };

    console.log(`Pushing stats for ${(userinfo.prefix ? `${userinfo.prefix}.` : '') + username} in ${shard}`);
  }
}

const groupedUsers = users.reduce((group, user) => {
  const { type } = user;
  // eslint-disable-next-line no-param-reassign
  group[type] = group[type] ?? [];
  group[type].push(user);
  return group;
}, {});

cron.schedule('*/30 * * * * *', async () => {
  const message = `Cron event hit: ${new Date()}`;
  console.log(`\r\n${message}\n`);
  cronLogger.info(message);
  Object.keys(groupedUsers).forEach((type) => {
    new ManageStats(groupedUsers[type]).handleUsers(type);
  });
});

if (process.env.INCLUDE_PUSH_STATUS_API === 'true') {
  app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`);
  });
  app.get('/', (req, res) => {
    const diffCompleteMinutes = Math.ceil(
      Math.abs(parseInt(new Date().getTime(), 10) - parseInt(lastUpload, 10)) / (1000 * 60),
    );
    res.json({ result: diffCompleteMinutes < 300, lastUpload, diffCompleteMinutes });
  });
}
