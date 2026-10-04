const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const config = require('../config');
const logger = require('../utils/logger');

let SQL = null;
let dbInstance = null;
let isDirty = false;
let saveTimeout = null;

async function getSqlJs() {
  if (!SQL) {
    SQL = await initSqlJs();
  }
  return SQL;
}

function persist() {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    const dbDir = path.dirname(config.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    // Atomic write
    const tempPath = `${config.dbPath}.tmp`;
    fs.writeFileSync(tempPath, buffer);
    fs.renameSync(tempPath, config.dbPath);
    isDirty = false;
  } catch (err) {
    logger.error('Failed to persist SQLite database to disk', { error: err });
  }
}

function schedulePersist() {
  isDirty = true;
  if (saveTimeout) clearTimeout(saveTimeout);
  // Persist within 50ms to batch rapid operations while ensuring prompt durability
  saveTimeout = setTimeout(() => {
    persist();
  }, 50);
}

async function initDb(options = {}) {
  const sql = await getSqlJs();
  const dbPath = options.dbPath || config.dbPath;

  // In test environment, support in-memory mode if requested
  if (options.inMemory || process.env.NODE_ENV === 'test') {
    dbInstance = new sql.Database();
    logger.info('Initialized in-memory SQLite database');
    return dbInstance;
  }

  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    dbInstance = new sql.Database(fileBuffer);
    logger.info(`Loaded existing SQLite database from ${dbPath}`);
  } else {
    dbInstance = new sql.Database();
    persist();
    logger.info(`Created new SQLite database at ${dbPath}`);
  }

  return dbInstance;
}

const db = {
  init: initDb,
  getDbInstance: () => dbInstance,

  query: (sqlString, params = []) => {
    if (!dbInstance) throw new Error('Database not initialized');
    try {
      const stmt = dbInstance.prepare(sqlString);
      if (params && params.length > 0) {
        stmt.bind(params);
      }
      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return rows;
    } catch (err) {
      logger.error('Database query error', { sql: sqlString, params, error: err });
      throw err;
    }
  },

  queryOne: (sqlString, params = []) => {
    const rows = db.query(sqlString, params);
    return rows.length > 0 ? rows[0] : null;
  },

  run: (sqlString, params = []) => {
    if (!dbInstance) throw new Error('Database not initialized');
    try {
      if (params && params.length > 0) {
        dbInstance.run(sqlString, params);
      } else {
        dbInstance.run(sqlString);
      }

      // Fetch last insert id and changes
      const metaRes = dbInstance.exec('SELECT last_insert_rowid() AS lastId, changes() AS changes');
      let lastInsertRowid = 0;
      let changes = 0;
      if (metaRes.length > 0 && metaRes[0].values && metaRes[0].values.length > 0) {
        lastInsertRowid = metaRes[0].values[0][0];
        changes = metaRes[0].values[0][1];
      }

      if (process.env.NODE_ENV !== 'test') {
        schedulePersist();
      }

      return { lastInsertRowid, changes };
    } catch (err) {
      logger.error('Database run error', { sql: sqlString, params, error: err });
      throw err;
    }
  },

  exec: (sqlString) => {
    if (!dbInstance) throw new Error('Database not initialized');
    try {
      dbInstance.exec(sqlString);
      if (process.env.NODE_ENV !== 'test') {
        persist();
      }
    } catch (err) {
      logger.error('Database exec error', { sql: sqlString, error: err });
      throw err;
    }
  },

  transaction: (callback) => {
    if (!dbInstance) throw new Error('Database not initialized');
    db.exec('BEGIN TRANSACTION');
    try {
      const result = callback(db);
      db.exec('COMMIT');
      if (process.env.NODE_ENV !== 'test') {
        persist();
      }
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  },

  flush: () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    persist();
  }
};

module.exports = db;
