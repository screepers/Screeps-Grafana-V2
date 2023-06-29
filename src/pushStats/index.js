// eslint-disable-next-line import/no-unresolved
import cron from 'node-cron';
// eslint-disable-next-line import/no-unresolved
import graphite from 'graphite';
import { createLogger, format, transports } from 'winston';
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

const client = graphite.createClient('plaintext://carbon-relay-ng:2003/');
const { combine, timestamp, prettyPrint } = format;
const logger = createLogger({
  format: combine(
    timestamp(),
    prettyPrint(),
  ),
  transports: [new transports.File({ filename: 'logs/push.log' })],
});

const cronLogger = createLogger({
  format: combine(
    timestamp(),
    prettyPrint(),
  ),
  transports: [new transports.File({ filename: 'logs/cron.log' })],
});

class ManageStats {
  groupedStats;

  message;

  constructor() {
    this.groupedStats = {};
    this.message = '----------------------------------------------------------------\r\n';
  }

  async handleUsers(type) {
    const beginningOfMinute = new Date().getSeconds() < 15;
    const getStatsFunctions = [];
    users.forEach((user) => {
      try {
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
    await Promise.all(getStatsFunctions);

    const { groupedStats } = this;

    if (type === 'mmo') {
      if (Object.keys(groupedStats).length > 0) {
        if (!await ManageStats.reportStats({ stats: groupedStats })) return console.log('Error while pushing stats');
        this.message += `Pushed ${type} stats to graphite`;
        logger.info(this.message);
        return console.log(this.message);
      }
      if (beginningOfMinute) return console.log('No stats to push');
      return undefined;
    }
    if (type === 'season') {
      if (Object.keys(groupedStats).length > 0) {
        if (!await ManageStats.reportStats({ stats: groupedStats })) return console.log('Error while pushing stats');
        this.message += `Pushed ${type} stats to graphite`;
        logger.info(this.message);
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
        adminUtilsServerStats.users.forEach((user) => {
          groupedAdminStatsUsers[user.username] = user;
        });
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
      client.write({ [`${process.env.PREFIX ? `${process.env.PREFIX}.` : ''}screeps`]: stats }, (err) => {
        if (err) {
          console.log(err);
          logger.error(err);
          resolve(false);
        }
        lastUpload = new Date().getTime();
        resolve(true);
      });
    });
  }

  pushStats(userinfo, stats, shard) {
    if (Object.keys(stats).length === 0) return;
    this.groupedStats[(userinfo.prefix ? `${userinfo.prefix}.` : '') + userinfo.username] = userinfo.type === 'mmo' ? { [shard]: stats } : { shard: stats };
    this.message += `${userinfo.type}: Added stats object for ${userinfo.username} in ${shard}\r\n`;
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
  console.log(`\r\n${message}`);
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
	