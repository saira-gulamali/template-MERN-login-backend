const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide name"],
      minlength: 3,
      maxlength: 50,
    },
    email: {
      type: String,
      unique: true,
      required: [true, "Please provide email"],
      validate: {
        validator: validator.isEmail,
        message: "Please provide valid email",
      },
    },
    password: {
      type: String,
      required: [true, "Please provide password"],
      minlength: 6,
    },
    role: {
      type: String,
      enum: ["admin", "user", "agent"],
      default: "user",
      required: true,
    },

    // Fields for agent
    phone: {
      type: String,
      required: [
        function () {
          return this.role === "agent";
        },
        "Hello Please enter a telephone number",
      ],
    },
    logo: {
      type: String,
      required: [
        function () {
          return this.role === "agent";
        },
        "Please enter a logo",
      ],
    },
    address: {
      type: String,
      required: [
        function () {
          return this.role === "agent";
        },
        "Please enter an address",
      ],
    },
    postcode: {
      type: String,
      required: [
        function () {
          return this.role === "agent";
        },
        "Please enter a postcode",
      ],
    },
    // added in auth workflow
    verificationToken: String,
    isVerified: {
      type: Boolean,
      default: false,
    },
    verified: Date,
    passwordToken: { type: String },
    passwordTokenExpirationDate: { type: Date },
    status: {
      type: String,
      enum: ["pending", "active", "suspended"],
      default: "pending",
    },
  },
  { timestamps: true }
);

UserSchema.pre("save", async function () {
  // console.log(this.modifiedPaths());
  // console.log(this.isModified('name'));
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

UserSchema.methods.comparePassword = async function (canditatePassword) {
  const isMatch = await bcrypt.compare(canditatePassword, this.password);
  return isMatch;
};

module.exports = mongoose.model("User", UserSchema);
