const router = require("express").Router();
const { sql, poolPromise } = require("../config/db");
const { requireAuth, allowRoles } = require("../middleware/auth");

router.get("/", requireAuth, allowRoles("Manager", "Admin"), async (req, res, next) => {
  try {
    const pool = await poolPromise;
    // Replace table/column names below if your database schema uses different names.
    const summarySql = `
      SELECT
        (SELECT COUNT(*) FROM dbo.Projects) AS TotalProjects,
        (SELECT COUNT(*) FROM dbo.Users WHERE Role = 'Freelancer' AND IsActive = 1) AS ActiveFreelancers,
        (SELECT COALESCE(SUM(Amount), 0) FROM dbo.Payments WHERE PaymentStatus = 'Paid') AS TotalRevenue,
        (SELECT COALESCE(SUM(Amount), 0) FROM dbo.Payments WHERE PaymentStatus IN ('Pending','Processing')) AS PendingPayments;`;
    const summary = (await pool.request().query(summarySql)).recordset[0] || {};
    const revenue = (await pool.request().query(`
      SELECT YEAR(PaymentDate) AS [Year], MONTH(PaymentDate) AS [Month],
             SUM(Amount) AS Revenue
      FROM dbo.Payments
      WHERE PaymentStatus = 'Paid' AND PaymentDate >= DATEADD(MONTH, -11, CAST(GETDATE() AS date))
      GROUP BY YEAR(PaymentDate), MONTH(PaymentDate)
      ORDER BY [Year], [Month];`)).recordset;
    const categories = (await pool.request().query(`
      SELECT CategoryName, COUNT(*) AS ProjectCount
      FROM dbo.Projects p
      INNER JOIN dbo.AICategories c ON c.CategoryID = p.CategoryID
      GROUP BY CategoryName ORDER BY ProjectCount DESC;`)).recordset;
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "").trim();
    const request = pool.request()
      .input("Search", sql.NVarChar(150), `%${search}%`)
      .input("Status", sql.NVarChar(30), status || null);
    const payments = (await request.query(`
      SELECT TOP 250 *
      FROM dbo.vw_ProjectPaymentSummary
      WHERE (@Search = '%%' OR ProjectTitle LIKE @Search OR ClientName LIKE @Search OR FreelancerName LIKE @Search)
        AND (@Status IS NULL OR PaymentStatus = @Status)
      ORDER BY CreatedAt DESC;`)).recordset;
    res.render("manager/dashboard", { title: "Manager dashboard", summary, revenue, categories, payments, filters: { search, status } });
  } catch (err) { next(err); }
});
module.exports = router;
