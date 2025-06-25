import migrate_d3_posts from "./cores/dirty_posts.js";
import migrate_d3_users from "./cores/dirty_users.js";
import migrate_d3_comments from "./cores/dirty_comments.js";

import migrate_ftp_posts from "./cores/ftp_posts.js";
import migrate_ftp_comments from "./cores/ftp_comments.js";

import { mongo } from "./clients.js";

async function main() {
  try {
    console.log("🚀 Starting migration...");
    await mongo.connect();
    console.log("🔗 Connected to MongoDB");

    await migrate_d3_posts();
    await migrate_d3_users();
    await migrate_d3_comments();

    await migrate_ftp_comments();
    await migrate_ftp_posts();

    console.log("🎉 All migrations completed");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    await mongo.close();
  }
}

await main();
