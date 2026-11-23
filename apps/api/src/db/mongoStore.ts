import { MongoClient, type Db, type Document } from 'mongodb';
import type { Collection, Store } from './store.ts';

function wrap<T extends { _id: string }>(db: Db, name: string): Collection<T> {
  const c = db.collection<Document>(name);
  const strip = (d: Document | null) => (d ? (d as unknown as T) : null);
  return {
    async insert(doc) {
      await c.insertOne(doc as unknown as Document);
      return doc;
    },
    async get(id) {
      return strip(await c.findOne({ _id: id as any }));
    },
    async findOne(filter) {
      return strip(await c.findOne(filter as Document));
    },
    async find(filter, opts) {
      let cur = c.find(filter as Document);
      if (opts?.sort) cur = cur.sort(opts.sort);
      if (opts?.limit) cur = cur.limit(opts.limit);
      return (await cur.toArray()) as unknown as T[];
    },
    async update(id, set) {
      const { _id, ...rest } = set as any;
      const r = await c.findOneAndUpdate({ _id: id as any }, { $set: rest }, { returnDocument: 'after' });
      return strip(r);
    },
    async claim(filter, set, sort) {
      const { _id, ...rest } = set as any;
      const r = await c.findOneAndUpdate(filter as Document, { $set: rest }, { sort, returnDocument: 'after' });
      return strip(r);
    },
    async deleteMany(filter) {
      const r = await c.deleteMany(filter as Document);
      return r.deletedCount;
    },
    async count(filter) {
      return c.countDocuments(filter as Document);
    },
  };
}

export async function createMongoStore(uri: string): Promise<Store> {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
  await client.connect();
  const db = client.db();
  await Promise.all([
    db.collection('users').createIndex({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } }),
    db.collection('items').createIndex({ part: 1, status: 1 }),
    db.collection('answers').createIndex({ sessionId: 1 }),
    db.collection('answers').createIndex({ sessionId: 1, key: 1 }, { unique: true }),
    db.collection('sessions').createIndex({ userId: 1, createdAt: -1 }),
    db.collection('results').createIndex({ userId: 1, createdAt: -1 }),
    db.collection('results').createIndex({ sessionId: 1 }),
    db.collection('jobs').createIndex({ status: 1, runAfter: 1 }),
    db.collection('jobs').createIndex({ sessionId: 1 }),
  ]);
  return {
    kind: 'mongo',
    users: wrap(db, 'users'),
    items: wrap(db, 'items'),
    sessions: wrap(db, 'sessions'),
    answers: wrap(db, 'answers'),
    results: wrap(db, 'results'),
    jobs: wrap(db, 'jobs'),
    cache: wrap(db, 'cache'),
    calibration: wrap(db, 'calibration'),
    close: () => client.close(),
  };
}
