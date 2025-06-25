import { mongo, solr as slr } from "../clients.js";
const BATCH_SIZE = 1000;

const migrate = async () => {
  const solr = slr("ftp_posts");

  const db = mongo.db(process.env.MONGO_DB);
  const coll = db.collection("ftp_posts");
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

      delete d.version;
      delete d._version_;

      delete d.Title;
      delete d.Image;
      delete d.Rating;
      delete d.Tags;
      delete d.Content;
      delete d.CommentsCount;
      delete d.CreatedDate;
      delete d.ChangedDate;
      delete d.CreatedById;

      d.found = d.IsFound;
      delete d.IsFound;

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

      d.found_by_id = Number(d.FoundById) || d.FoundById;
      delete d.FoundById;
      if (!d.found_by_id) {
        delete d.found_by_id;
      }

      d.found_date = d.FoundDate;
      delete d.FoundDate;
      if (!d.found_date) {
        delete d.found_date;
      }

      ["found_date"].forEach((f) => {
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
