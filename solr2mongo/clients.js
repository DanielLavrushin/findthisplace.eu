import solrClient from "solr-client";
import { MongoClient } from "mongodb";
import * as dotenv from "dotenv";
dotenv.config();

const SOLR_OPTIONS = {
  host: process.env.SOLR_HOST,
  port: process.env.SOLR_PORT,
  protocol: process.env.SOLR_PROTOCOL,
};

const mongoUri = `mongodb://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_HOST}`;

const mongo = new MongoClient(mongoUri);
const solr = (core) => {
  SOLR_OPTIONS.core = core;
  return solrClient.createClient(SOLR_OPTIONS);
};

export { mongo, solr };
