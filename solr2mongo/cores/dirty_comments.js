import { mongo, solr as slr } from "../clients.js";
const BATCH_SIZE = 3000;

const migrate = async () => {
  const solr = slr("d3_comments");

  const db = mongo.db(process.env.MONGO_DB);
  const coll = db.collection("dirty_comments");
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

      d._id = Number(d.id);
      delete d.id;

      delete d.version;
      delete d._version_;

      if (d.parent_id && d.parent_id !== "") {
        d.parent_id = Number(d.parent_id);
      } else {
        delete d.parent_id;
      }

      d.text = d.body;
      delete d.body;

      d.post_id = Number(d.post_id);
      d.user_id = Number(d.user_id);

      ["created"].forEach((f) => {
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
