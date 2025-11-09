const { verifyToken } = require("../utils/auth");

async function createContext({ req }) {
  const authHeader =
    req && (req.headers.authorization || req.headers.Authorization);
  if (!authHeader || typeof authHeader !== "string") return { req, user: null };

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) return { req, user: null };

  const user = await Promise.resolve(verifyToken(token));
  return { req, user };
}

module.exports = { createContext };
