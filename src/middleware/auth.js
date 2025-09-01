const { verify } = require("../utils/jwt");

module.exports = function auth(required = true) {
  return (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      if (required) return res.status(401).json({ message: "Missing token" });
      return next();
    }
    try {
      const payload = verify(token);
      req.user = payload; // { sub, email, accountType, iat, exp }
      next();
    } catch (e) {
      return res.status(401).json({ message: "Invalid token" });
    }
  };
};
