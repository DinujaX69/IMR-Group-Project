const router = require("express").Router();
const { requireAuth } = require("../middleware/auth");
router.get("/", requireAuth, (req, res) => {
  const role = req.session.user.role;
  const paths = { Client: "/client/projects/new", Manager: "/manager", Admin: "/manager", Freelancer: "/freelancer" };
  res.redirect(paths[role] || "/login");
});
module.exports = router;
