/**
 * Local-dev data store.
 *
 * This scaffold uses a plain in-memory store so the whole backend runs with
 * zero external services while you wire up the app. Swap this file for a
 * real connection (Postgres via pg/knex/Prisma, or Mongo via mongoose)
 * before shipping — nothing else in the codebase needs to change as long as
 * you keep the same method signatures (find, findById, insert, update).
 */

const collections = {
  users: new Map(),
  subscriptions: new Map(),
  servers: new Map(),
  pingLogs: [],
  games: new Map(),
  sessions: new Map(),
};

function makeCollection(name) {
  const store = collections[name];
  return {
    all: () => Array.from(store.values()),
    findById: (id) => store.get(id) || null,
    find: (predicate) => Array.from(store.values()).filter(predicate),
    insert: (record) => {
      store.set(record.id, record);
      return record;
    },
    update: (id, patch) => {
      const existing = store.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...patch };
      store.set(id, updated);
      return updated;
    },
    remove: (id) => store.delete(id),
  };
}

module.exports = {
  Users: makeCollection("users"),
  Subscriptions: makeCollection("subscriptions"),
  Servers: makeCollection("servers"),
  Games: makeCollection("games"),
  Sessions: makeCollection("sessions"),
  pingLogs: collections.pingLogs,
};
