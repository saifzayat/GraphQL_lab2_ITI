const express = require("express");
const { ApolloServer } = require("apollo-server-express");
const mongoose = require("mongoose");
require("dotenv").config();
const { createContext } = require("./GraphQl/context");

const typeDefs = require("./GraphQl/typeDefs");
const resolvers = require("./GraphQl/resolvers");

(async () => {
  const app = express();
  const MONGO_URI = process.env.MONGO_URI;
  try {
    await mongoose.connect(MONGO_URI);
    console.log(" ✅✅ Connected to MongoDB");
  } catch (err) {
    console.error("🚫🚫 Error connecting to MongoDB:", err);
    return;
  }
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: createContext,
  });
  await server.start();
  server.applyMiddleware({ app, path: "/graphql" });

  app.listen(4000, () => {
    console.log(` ✅✅ Up and running`);
  });
})();
