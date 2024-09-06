const User = require("../models/User");
const Token = require("../models/Token");
const { StatusCodes } = require("http-status-codes");
const CustomError = require("../errors");
const {
  attachCookiesToResponse,
  createTokenUser,
  sendVerificationEmail,
  sendResetPasswordEmail,
  createHash,
} = require("../utils");
const crypto = require("crypto");

const register = async (req, res) => {
  const {
    email,
    name,
    password,
    registerRole,
    phone,
    logo,
    address,
    postcode,
  } = req.body;

  const emailAlreadyExists = await User.findOne({ email });
  if (emailAlreadyExists) {
    throw new CustomError.BadRequestError("Email already exists");
  }

  // first registered user is an admin
  const isFirstAccount = (await User.countDocuments({})) === 0;
  const role = isFirstAccount ? "admin" : registerRole;

  // added in auth workflow
  const verificationToken = crypto.randomBytes(40).toString("hex");

  let user;
  if (role === "agent") {
    user = await User.create({
      name,
      email,
      password,
      role,
      verificationToken,
      phone,
      logo,
      address,
      postcode,
    });
  } else {
    user = await User.create({
      name,
      email,
      password,
      role,
      verificationToken,
    });
  }

  // programmatically accessing origin on the req object
  // const protocol = req.protocol;
  // const host = req.get("host");
  // const forwardedHost = req.get("x-forwarded-host");
  // const forwardedProtocol = req.get("x-forwarded-proto");
  // const origin = req.get("origin");
  // console.log({ protocol, host, forwardedHost, forwardedProtocol, origin });
  // instead of x-forwarded-host try req.get('referer') or req.headers.referer
  // console.log(req.headers);

  await sendVerificationEmail({
    email: user.email,
    name: user.name,
    verificationToken: user.verificationToken,
    role: user.role,
    origin: process.env.FRONTEND_URL,
  });

  res.status(StatusCodes.CREATED).json({
    msg: `Success! Please check your email to verify account`,
  });
};
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new CustomError.BadRequestError("Please provide email and password");
  }
  const user = await User.findOne({ email });

  if (!user) {
    throw new CustomError.UnauthenticatedError("Invalid Credentials");
  }
  const isPasswordCorrect = await user.comparePassword(password);
  if (!isPasswordCorrect) {
    throw new CustomError.UnauthenticatedError("Invalid Credentials");
  }
  if (!user.isVerified) {
    throw new CustomError.UnauthenticatedError("Please verify your email");
  }
  const tokenUser = createTokenUser(user);

  // create refresh token
  let refreshToken = "";

  // check for existing token
  const existingToken = await Token.findOne({ user: user._id });

  if (existingToken) {
    const { isValid } = existingToken;

    if (!isValid) {
      throw new CustomError.UnauthenticatedError("Invalid Credentials");
    }
    refreshToken = existingToken.refreshToken;
    attachCookiesToResponse({ res, user: tokenUser, refreshToken });

    res.status(StatusCodes.OK).json({ user: tokenUser });
    return;
  }
  refreshToken = crypto.randomBytes(40).toString("hex");
  const userAgent = req.headers["user-agent"];
  const ip = req.ip;
  const userToken = { refreshToken, ip, userAgent, user: user._id };

  await Token.create(userToken);

  attachCookiesToResponse({ res, user: tokenUser, refreshToken });

  res.status(StatusCodes.OK).json({ user: tokenUser });
};
const logout = async (req, res) => {
  await Token.findOneAndDelete({ user: req.user.userId });

  res.cookie("accessToken", "logout", {
    httpOnly: true,
    expires: new Date(Date.now()),
  });

  res.cookie("refreshToken", "logout", {
    httpOnly: true,
    expires: new Date(Date.now()),
  });
  res.status(StatusCodes.OK).json({ msg: "user logged out!" });
};

const verifyEmail = async (req, res) => {
  const { email, verificationToken } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    throw new CustomError.UnauthenticatedError("Verification failed");
  }
  if (user.isVerified) {
    throw new CustomError.BadRequestError("Email is already verified");
  }
  if (verificationToken !== user.verificationToken) {
    throw new CustomError.UnauthenticatedError("Verification failed");
  }
  user.isVerified = true;
  user.verified = Date.now();
  user.verificationToken = "";
  user.status = "active";
  user.save();

  res.status(StatusCodes.OK).json({ msg: "Email verified" });
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    throw new CustomError.BadRequestError("Please provide email");
  }
  const user = await User.findOne({ email });
  // dont do this!>>> because it lets attackers know who is registered
  // if (!user) {
  //   throw new CustomError.NotFoundError(
  //     "This email is not registered with us"
  //   );
  // }

  if (user) {
    const passwordToken = crypto.randomBytes(70).toString("hex");
    // send email
    await sendResetPasswordEmail({
      name: user.name,
      email: user.email,
      token: passwordToken,
      role: user.role,
      origin: process.env.FRONTEND_URL,
    });
    const tenMinutes = 1000 * 60 * 10;
    const passwordTokenExpirationDate = new Date(Date.now() + tenMinutes);
    user.passwordToken = createHash(passwordToken);
    user.passwordTokenExpirationDate = passwordTokenExpirationDate;
    await user.save();
  }

  res.status(StatusCodes.OK).json({
    msg: "Please check your email for reset password link. This link is valid for 10 minutes",
  });
};

const resetPassword = async (req, res) => {
  const { token, email, password } = req.body;
  if (!token || !email || !password) {
    throw new CustomError.BadRequestError("Please provide all values");
  }

  const user = await User.findOne({ email });

  if (user) {
    const currentDate = new Date();
    if (
      user.passwordToken === createHash(token) &&
      user.passwordTokenExpirationDate > currentDate
    ) {
      user.password = password;
      user.passwordToken = null;
      user.passwordTokenExpirationDate = null;
      await user.save();
    }
  }

  res.status(StatusCodes.OK).json({ msg: "Success! Password reset" });
};

module.exports = {
  register,
  login,
  logout,
  verifyEmail,
  forgotPassword,
  resetPassword,
};
