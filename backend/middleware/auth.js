const auth = (req, res, next) => {
  req.userId = 'default_user';
  next();
};

module.exports = auth;
