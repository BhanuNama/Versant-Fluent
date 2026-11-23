import fs from 'node:fs';
import path from 'node:path';
import type { Collection, Filter, FindOpts, Store } from './store.ts';

/**
 * Zero-setup JSON file store for local development and demos.
 * Implements the same small query surface as the Mongo store
 * (equality, $in, $nin, $ne, $lt, $lte, $gt, $gte, $exists).
 */

function matchValue(value: unknown, cond: unknown): boolean {
  if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
    const c = cond as Record<string, unknown>;
    const ops = Object.keys(c);
    if (ops.length && ops.every((k) => k.startsWith('$'))) {
      return ops.every((op) => {
        const arg = c[op] as any;
        switch (op) {
          case '$in': return (arg as unknown[]).includes(value);
          case '$nin': return !(arg as unknown[]).includes(value);
          case '$ne': return value !== arg;
          case '$lt': return (value as any) < arg;
          case '$lte': return (value as any) <= arg;
          case '$gt': return (value as any) > arg;
          case '$gte': return (value as any) >= arg;
          case '$exists': return arg ? value !== undefined && value !== null : value === undefined || value === null;
          default: return false;
        }
      });
    }
  }
  return value === cond;
}

export function matches(doc: Record<string, unknown>, filter: Filter): boolean {
  return Object.entries(filter).every(([k, cond]) => matchValue(doc[k], cond));
}

function sortDocs<T>(docs: T[], sort?: Record<string, 1 | -1>): T[] {
  if (!sort) return docs;
  const keys = Object.entries(sort);
  return [...docs].sort((a: any, b: any) => {
    for (const [k, dir] of keys) {
      if (a[k] < b[k]) return -1 * dir;
      if (a[k] > b[k]) return 1 * dir;
    }
    return 0;
  });
}

const clone = <T>(v: T): T => structuredClone(v);

export function createFileStore(dataDir: string): Store {
  const file = path.join(dataDir, 'db.json');
  let data: Record<string, Record<string, any>> = {};
  if (fs.existsSync(file)) {
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      console.warn('[store] db.json unreadable, starting fresh');
    }
  }
  const persist = () => {
    try {
      const tmp = file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
      fs.renameSync(tmp, file);
    } catch (err) {
      console.error('[store] failed to persist db.json:', err);
    }
  };

  function coll<T extends { _id: string }>(name: string): Collection<T> {
    data[name] ??= {};
    const map = () => data[name] as Record<string, T>;
    return {
      async insert(doc) {
        if (map()[doc._id]) throw new Error(`duplicate _id ${doc._id}`);
        map()[doc._id] = clone(doc);
        persist();
        return clone(doc);
      },
      async get(id) {
        const d = map()[id];
        return d ? clone(d) : null;
      },
      async findOne(filter) {
        const d = Object.values(map()).find((x) => matches(x as any, filter));
        return d ? clone(d) : null;
      },
      async find(filter, opts?: FindOpts) {
        let docs = Object.values(map()).filter((x) => matches(x as any, filter));
        docs = sortDocs(docs, opts?.sort);
        if (opts?.limit) docs = docs.slice(0, opts.limit);
        return docs.map(clone);
      },
      async update(id, set) {
        const d = map()[id];
        if (!d) return null;
        Object.assign(d, clone(set));
        persist();
        return clone(d);
      },
      async claim(filter, set, sort) {
        const docs = sortDocs(Object.values(map()).filter((x) => matches(x as any, filter)), sort);
        const d = docs[0];
        if (!d) return null;
        Object.assign(d, clone(set));
        persist();
        return clone(d);
      },
      async deleteMany(filter) {
        let n = 0;
        for (const [id, d] of Object.entries(map())) {
          if (matches(d as any, filter)) {
            delete map()[id];
            n++;
          }
        }
        if (n) persist();
        return n;
      },
      async count(filter) {
        return Object.values(map()).filter((x) => matches(x as any, filter)).length;
      },
    };
  }

  return {
    kind: 'file',
    users: coll('users'),
    items: coll('items'),
    sessions: coll('sessions'),
    answers: coll('answers'),
    results: coll('results'),
    jobs: coll('jobs'),
    cache: coll('cache'),
    calibration: coll('calibration'),
    async close() {
      fs.writeFileSync(file, JSON.stringify(data, null, 2));
    },
  };
}
