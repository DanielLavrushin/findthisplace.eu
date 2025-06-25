import { mongo, solr as slr } from "../clients.js";
const BATCH_SIZE = 3000;

const migrate = async () => {
  const solr = slr("ftp_links");

  const db = mongo.db(process.env.MONGO_DB);
  const coll = db.collection("ftp_comments");
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

      d._id = Number(d.CommentId) || d.CommentId;
      delete d.id;
      delete d.CommentId;

      delete d.version;
      delete d._version_;

      delete d.UserId;
      delete d.PostId;
      delete d.Rating;
      delete d.CreatedDate;

      d.extracted = d.IsExtracted;
      delete d.IsExtracted;

      d.longitude = Number(d.Longitude) || d.Longitude;
      delete d.Longitude;
      if (!d.longitude) {
        delete d.longitude;
      }

      d.latitude = Number(d.Latitude) || d.Latitude;
      delete d.Latitude;
      if (!d.latitude) {
        delete d.latitude;
      }

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
