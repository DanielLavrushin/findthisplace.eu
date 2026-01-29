import { mongo, solr as slr } from "../clients.js";
const BATCH_SIZE = 1000;

const migrate = async () => {
  const solr = slr("d3_posts");

  const db = mongo.db(process.env.MONGO_DB);
  const coll = db.collection("dirty_posts");
  await coll.deleteMany({});

  let cursorMark = "*";
  let keepGoing = true;
  while (keepGoing) {
    const query = solr
      .query()
      .q("*:*")
      .rows(BATCH_SIZE)
      .sort({ id: "asc" })
      .cursorMark(cursorMark);

    const result = await solr.search(query);
    const docs = result.response.docs;

    if (!docs.length) break;

    const toInsert = docs.map((solrDoc) => {
      const d = { ...solrDoc };

      d._id = Number(d.id) || d.id;
      delete d.id;

      if (d.user_id != null) {
        d.user_id = Number(d.user_id) || d.user_id;
      }

      delete d.version;
      delete d._version_;

      ["created", "changed"].forEach((f) => {
        if (typeof d[f] === "string") {
          const dt = new Date(d[f]);
          if (!isNaN(dt)) d[f] = dt;
        }
      });

      return d;
    });

    const ops = toInsert.map((doc) => ({
      replaceOne: {
        filter: { _id: doc._id },
        replacement: doc,
        upsert: true,
      },
    }));
    await coll.bulkWrite(ops);

    const nextCursor = result.nextCursorMark;
    keepGoing = nextCursor && nextCursor !== cursorMark;
    cursorMark = nextCursor;
    console.log(`Migrated ${docs.length} docs, nextCursor=${cursorMark}`);
  }

  console.log("✅ Migration complete");
};

export default migrate;
