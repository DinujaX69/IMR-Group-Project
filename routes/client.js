const router = require("express").Router();
const { body, validationResult } = require("express-validator");
const { sql, poolPromise } = require("../config/db");
const { requireAuth, allowRoles } = require("../middleware/auth");

router.get("/projects/new", requireAuth, allowRoles("Client"), async (req, res, next) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT SkillID, SkillName FROM dbo.Skills WHERE IsActive = 1 ORDER BY SkillName");
    res.render("client/post-project", { title: "Post a new project", skills: result.recordset, old: {} });
  } catch (err) { next(err); }
});

router.post("/projects", requireAuth, allowRoles("Client"),
  [
    body("title").trim().isLength({ min: 5, max: 150 }).withMessage("Title must be between 5 and 150 characters."),
    body("description").trim().isLength({ min: 20, max: 4000 }).withMessage("Description must be between 20 and 4,000 characters."),
    body("budget").isFloat({ min: 1 }).withMessage("Enter a budget greater than zero."),
    body("deadline").isISO8601().withMessage("Choose a valid deadline."),
    body("skills").isArray({ min: 1 }).withMessage("Select at least one skill.")
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    const old = { title: req.body.title, description: req.body.description, budget: req.body.budget, deadline: req.body.deadline, skills: req.body.skills || [] };
    try {
      const pool = await poolPromise;
      const skillIDs = (Array.isArray(req.body.skills) ? req.body.skills : [req.body.skills])
        .map(Number).filter(n => Number.isInteger(n) && n > 0);
      if (!errors.isEmpty() || !skillIDs.length) {
        const skills = (await pool.request().query("SELECT SkillID, SkillName FROM dbo.Skills WHERE IsActive = 1 ORDER BY SkillName")).recordset;
        return res.status(422).render("client/post-project", {
          title: "Post a new project", skills, old,
          validationErrors: errors.array().map(e => e.msg).concat(skillIDs.length ? [] : ["Select at least one valid skill."])
        });
      }
      const deadline = new Date(req.body.deadline);
      if (Number.isNaN(deadline.getTime()) || deadline <= new Date()) {
        const skills = (await pool.request().query("SELECT SkillID, SkillName FROM dbo.Skills WHERE IsActive = 1 ORDER BY SkillName")).recordset;
        return res.status(422).render("client/post-project", { title: "Post a new project", skills, old, validationErrors: ["Deadline must be a future date."] });
      }
      // SkillIDs is passed as a comma-separated string; adapt this to your stored procedure's TVP if required.
      await pool.request()
        .input("ClientID", sql.Int, req.session.user.id)
        .input("Title", sql.NVarChar(150), old.title)
        .input("Description", sql.NVarChar(sql.MAX), old.description)
        .input("Budget", sql.Decimal(12, 2), Number(old.budget))
        .input("Deadline", sql.Date, deadline)
        .input("SkillIDs", sql.NVarChar(sql.MAX), skillIDs.join(","))
        .execute("dbo.sp_RegisterProject");
      req.flash("success", "Your project has been posted successfully.");
      res.redirect("/client/projects/new");
    } catch (err) { next(err); }
  }
);
module.exports = router;
