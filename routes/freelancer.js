const router = require("express").Router();
const { requireAuth, allowRoles } = require("../middleware/auth");
router.get("/", requireAuth, allowRoles("Freelancer"), (req, res) => res.render("freelancer/dashboard", { title: "Freelancer dashboard" }));
module.exports = router;
