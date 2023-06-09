const jwt = require("jsonwebtoken");

const signToken = (id) =>
  jwt.sign({ id: id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

module.exports = (userId, statusCode, res) => {
  const token = signToken(userId);

  // const exp = new Date(
  //   Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
  // );

  // res.cookie("jwt", token, {
  //   expires: exp,
  //   httpOnly: true,
  //   sameSite: "none",
  //   secure: true,
  // });

  res.status(statusCode).json({ userId, token, expIn: jwt.decode(token).exp });
};
