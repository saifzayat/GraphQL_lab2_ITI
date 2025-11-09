require("dotenv").config();
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;

function generateToken(user) {
  return jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, {
    expiresIn: "7d",
  });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

function guardResolver(resolver) {
  return (parent, args, context, info) => {
    if (!context.user) {
      throw new Error("Unauthorized");
    }
    return resolver(parent, args, context, info);
  };
}

module.exports = { generateToken, verifyToken, guardResolver };
