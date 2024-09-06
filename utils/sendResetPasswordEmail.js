const sendEmail = require("./sendEmail");

const sendResetPasswordEmail = async ({ name, email, token, origin, role }) => {
  const resetPasswordUrl = `${origin}/user/reset-password?token=${token}&email=${email}&role=${role}`;
  const message = `<p>Please reset your password by clicking on the following link :<a href="${resetPasswordUrl}">Reset Password</a> </p>`;

  return sendEmail({
    to: email,
    subject: "Auth workflow - reset password link",
    html: `<h4>Hello, ${name}.</h4>
    ${message}`,
  });
};

module.exports = sendResetPasswordEmail;
