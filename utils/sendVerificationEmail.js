const sendEmail = require("./sendEmail");

const sendVerificationEmail = async ({
  name,
  email,
  verificationToken,
  origin,
  role,
}) => {
  const verifyEmail = `${origin}/user/verify-email?token=${verificationToken}&email=${email}&role=${role}`;
  const message = `<p>Please confirm your email by clicking on the following link :<a href="${verifyEmail}">Verify Email</a> </p>`;

  return sendEmail({
    to: email,
    subject: "Auth workflow email confirmation",
    html: `<h4>Hello, ${name}.</h4>
    ${message}`,
  });
};

module.exports = sendVerificationEmail;
