const { mongoose, Schema } = require("mongoose");

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: [/.+@.+\..+/, "Please enter a valid email address"],
  },
  password: { type: String, required: true, minlength: 8 },
});

const User = mongoose.model("User", userSchema);

module.exports = User;
