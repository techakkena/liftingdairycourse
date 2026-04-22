import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const createDb = () => drizzle(process.env.DATABASE_URL!, { schema });
type DbType = ReturnType<typeof createDb>;

let _db: DbType | undefined;

export const db = new Proxy({} as DbType, {
  get(_, prop: string | symbol) {
    if (!_db) _db = createDb();
    return _db[prop as keyof DbType];
  },
});
