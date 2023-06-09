const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/AppError");
const Email = require("../utils/email");
const { User, UserRole, School } = require("../models");
const bcrypt = require("bcrypt");
const { promisify } = require("util");
const jwt = require("jsonwebtoken");

exports.getAllUser = catchAsync(async (req, res) => {
  const users = await User.findAll({
    include: UserRole,
    attributes: ["id", "firstname", "lastname", "email"],
  });

  const usersJSON = users.map((user) => ({
    id: user.id,
    firstname: user.firstname,
    lastname: user.lastname,
    email: user.email,
    role: user.role.role,
  }));

  res.status(200).json({ users: usersJSON });
});

exports.createUser = catchAsync(async (req, res, next) => {
  // Vlaidating if user does not already exist and the school is valid
  const existingUser = await User.findOne({ where: { email: req.body.email } });
  const existingSchool = await School.findByPk(req.body.schoolId);

  if (existingUser)
    return next(
      new AppError("User already exist with the provided email.", 400)
    );

  if (!existingSchool)
    return next(new AppError("Provided school not found.", 404));

  // Creating new user
  const newUser = await User.create({
    firstname: req.body.firstname,
    lastname: req.body.lastname,
    email: req.body.email,
    schoolId: req.body.schoolId,
    roleId: req.body.roleId,
  });

  const token = jwt.sign({ id: newUser.id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

  // Sending user token to create a new password
  try {
    const URL = `http://localhost:5173/users/create-password?token=${token}`;

    const newUserJson = newUser.toJSON();
    await new Email(req.user, newUserJson, URL).sendPasswordCreate();

    res.status(200).json({
      message: `Email was sent to ${newUserJson.email} to create an account password`,
      userId: newUser.toJSON().id,
    });
  } catch (err) {
    await newUser.destroy();

    return next(
      new AppError(
        "There was an errorr sending an email. Try creating user later!",
        500
      )
    );
  }
});

exports.createPassword = catchAsync(async (req, res, next) => {
  const { password, passwordConfirm } = req.body;

  if (password !== passwordConfirm) {
    return next(new AppError(`Passwords do not match`, 400));
  }

  // 2) Verification of the token
  const decoded = await promisify(jwt.verify)(
    req.params.token,
    process.env.JWT_SECRET
  );

  // 3) Check if user still exists
  let user = await User.findByPk(decoded.id);
  if (!user) {
    return next(
      new AppError("The user belonging to this token no longer exists", 401)
    );
  }

  user.password = await bcrypt.hash(password, 10);
  await user.save();

  res.status(204).json({});
});

exports.getUser = catchAsync(async (req, res, next) => {
  const user = await User.findByPk(req.params.id, {
    include: UserRole,
    attributes: [
      "id",
      "firstname",
      "lastname",
      "email",
      ["school_fk", "schoolId"],
    ],
  });

  if (!user) return next(new AppError("User not found", 404));

  const userJSON = {
    id: user.id,
    firstname: user.firstname,
    lastname: user.lastname,
    email: user.email,
    role: user.role.role,
    schoolId: user.schoolId,
  };

  res.status(200).json({ user: userJSON });
});

exports.updateUser = catchAsync(async (req, res, next) => {
  const user = await User.findByPk(req.params.id);

  if (!user) {
    return next(
      new AppError(`The user with ID ${req.params.id} does not exist`, 404)
    );
  }

  await user.update(req.body);

  res.status(200).json({ success: true });
});

exports.getMe = catchAsync(async (req, res, next) => {
  let user = req.user;

  const school = await School.findByPk(user.schoolId);

  res.status(200).json({
    user: {
      id: user.id,
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      role: user.role,
      schoolName: school.name,
      schoolId: school.id,
    },
  });
});

exports.deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findByPk(req.params.id);

  if (!user) {
    return next(
      new AppError(`The user with ID ${req.params.id} does not exist`, 404)
    );
  }

  await User.destroy({
    where: { id: req.params.id },
  });

  res
    .status(200)
    .json({ success: true, message: "The user was successfully deleted." });
});
