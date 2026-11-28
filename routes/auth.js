const router = require("express").Router();
const { sql, poolPromise } = require("../config/db");
const bcrypt = require("bcryptjs");

router.get("/login", (req, res) => res.render("pages/login", { title: "Sign in" }));

// Demo-friendly login: expects a Users table with UserID, FullName, Email, PasswordHash, Role.
// Store bcrypt hashes in PasswordHash. Never store plain-text passwords.
router.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim();
    const password = String(req.body.password || "");
    if (!email || !password) {
      req.flash("error", "Enter your email and password.");
      return res.redirect("/login");
    }
    const pool = await poolPromise;
    const result = await pool.request()
      .input("Email", sql.NVarChar(255), email)
      .query("SELECT TOP 1 UserID, FullName, Email, PasswordHash, Role FROM dbo.Users WHERE Email = @Email AND IsActive = 1");
    const user = result.recordset[0];
    if (!user || !(await bcrypt.compare(password, user.PasswordHash))) {
      req.flash("error", "Invalid email or password.");
      return res.redirect("/login");
    }
    req.session.user = { id: user.UserID, name: user.FullName, email: user.Email, role: user.Role };
    res.redirect("/dashboard");
  } catch (err) { next(err); }
});

router.post("/logout", (req, res) => req.session.destroy(() => res.redirect("/")));
module.exports = router;
