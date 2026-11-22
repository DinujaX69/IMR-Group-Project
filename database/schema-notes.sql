/*
  SCHEMA CONTRACT / ADAPTATION NOTES
  This project expects these objects in DB_DATABASE. Rename columns/objects in
  routes if your university database uses different names.

  dbo.Users:
    UserID INT PK, FullName NVARCHAR(150), Email NVARCHAR(255) UNIQUE,
    PasswordHash NVARCHAR(255), Role NVARCHAR(20), IsActive BIT

  dbo.Skills:
    SkillID INT PK, SkillName NVARCHAR(100), IsActive BIT

  dbo.Projects:
    ProjectID INT PK, Title NVARCHAR(150), ClientID INT, CategoryID INT,
    CreatedAt DATETIME2

  dbo.Payments:
    PaymentID INT PK, ProjectID INT, Amount DECIMAL(12,2),
    PaymentStatus NVARCHAR(30), PaymentDate DATETIME2

  dbo.AICategories:
    CategoryID INT PK, CategoryName NVARCHAR(100)

  dbo.vw_ProjectPaymentSummary must expose:
    ProjectTitle, ClientName, FreelancerName, Amount, PaymentStatus, CreatedAt

  Stored procedure expected:
    dbo.sp_RegisterProject
      @ClientID INT, @Title NVARCHAR(150), @Description NVARCHAR(MAX),
      @Budget DECIMAL(12,2), @Deadline DATE, @SkillIDs NVARCHAR(MAX)

  SkillIDs format used here is comma-separated, e.g. '2,4,8'. The procedure
  should safely split it with STRING_SPLIT and validate referenced SkillIDs.
  If your procedure uses a table-valued parameter, change the route to send
  that TVP instead of the comma-separated NVARCHAR parameter.

  IMPORTANT: Adjust this contract to match your existing schema; do not run
  CREATE TABLE statements blindly against an existing university database.
*/
