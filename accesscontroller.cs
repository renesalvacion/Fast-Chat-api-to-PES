using FastNetCoreLibrary;
using ITRPFV2.Models;
using ITRPFV2.TokenAuthentication;
using ITPRFV2.Services.Templates;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Net.Mail;
using System.Net;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.RateLimiting;
//using NETCore.MailKit.Core;
using ITRPFV2.DTO;
using ITPRFV2.Services.Email_Services;
using ITPRFBACKEND.Services.Email_Services;
using Microsoft.Extensions.Options;
using ITRPFV2.Models.Settings;


namespace ITRPFV2.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AccessController : ControllerBase
    {
        Response response = new Response();
        private readonly itprfContext _dbContext;
        private readonly ITokenManager _tokenManager;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IEmailService _emailService;
        private readonly EmailSettings _settings;
        public AccessController(
            itprfContext dbContext,
            ITokenManager tokenManager,
            IHttpClientFactory httpClientFactory, IEmailService emailService,
    IOptions<EmailSettings> options)
        {
            _dbContext = dbContext;
            _tokenManager = tokenManager;
            _httpClientFactory = httpClientFactory;
            _settings = options.Value;
            _emailService = emailService;
        }

  
      // ─────────────────────────────────────────────────────────────────────
        // GET api/access/session
        // ─────────────────────────────────────────────────────────────────────
        [HttpGet("session")]
        public IActionResult GetSession()
        {
            if (User.Identity == null || !User.Identity.IsAuthenticated)
                return Unauthorized("No active session found.");

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var emailClaim = User.FindFirst(ClaimTypes.Email)?.Value;
            var nameClaim = User.FindFirst(ClaimTypes.Name)?.Value;
            var roleClaim = User.FindFirst(ClaimTypes.Role)?.Value;
            var departmentClaim = User.FindFirst("Department")?.Value;
            var branchNameClaim = User.FindFirst("Branch")?.Value;
            var empId = User.FindFirst("EmpId")?.Value;
            if (string.IsNullOrEmpty(userIdClaim))
                return Unauthorized("Session is invalid.");

            return Ok(new
            {
                userId = userIdClaim,
                email = emailClaim,
                name = nameClaim,
                role = roleClaim,
                department = departmentClaim,
                branchName = branchNameClaim,
                empid = empId,
            });
        }

        // ─────────────────────────────────────────────────────────────────────
        // GET api/access/it-people
        // ─────────────────────────────────────────────────────────────────────
        [HttpGet("it-people")]
        public async Task<IActionResult> FetchItDevController()
        {
            try
            {
                var idClaim = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(idClaim) || !int.TryParse(idClaim, out int userId))
                    return Unauthorized(new { Message = "Invalid user ID." });

                // Positions eligible to appear in the IT people / messenger list.
                var eligiblePositions = new[] { "IT PROGRAMMER" };

                // Base: active IT programmers at the branch, joined to their user record.
                var baseQuery = _dbContext.CoreVUsers
                    .Join(_dbContext.CoreVEmployeeDetails,
                          cu => cu.EmplId, ce => ce.EmplId,
                          (cu, ce) => new { cu, ce })
                    .Where(s =>
                        s.ce.CorporateName == "FAST SERVICES CORPORATION" &&
                        eligiblePositions.Contains(s.ce.Positionname) &&
                        s.ce.Branchname == "ALABANG" &&
                        s.ce.Typedescription == "ACTIVE" &&
                        s.cu.UserId != userId);

                // Left join to the supervisor's employee + user record via ImmediateID -> EmplId.
                var qUserProfile = baseQuery
                    .GroupJoin(_dbContext.CoreVEmployeeDetails,
                               s => s.ce.ImmediateId,
                               head => head.EmplId,
                               (s, heads) => new { s.cu, s.ce, heads })
                    .SelectMany(x => x.heads.DefaultIfEmpty(),
                               (x, headEmp) => new { x.cu, x.ce, headEmp })
                    .GroupJoin(_dbContext.CoreVUsers,
                               x => x.headEmp!.EmplId,
                               headUser => headUser.EmplId,
                               (x, headUsers) => new { x.cu, x.ce, x.headEmp, headUsers })
                    .SelectMany(x => x.headUsers.DefaultIfEmpty(),
                               (x, headUser) => new
                               {
                                   userid = x.cu.UserId,
                                   empid = x.cu.EmplId,
                                   fullname = x.cu.Employeename2,
                                   branchname = x.ce.Branchname,
                                   corporatename = x.ce.CorporateName,
                                   position = x.ce.Position,
                                   typedescription = x.ce.Typedescription,

                                   // Immediate head details (null if no match found)
                                   headuserid = headUser.UserId,
                                   headempid = x.headEmp.EmplId,
                                   headfullname = headUser.Employeename2,
                                   headposition = x.headEmp.Position
                               });

                return Ok(await qUserProfile.ToListAsync());
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "An error occurred while fetching IT people.", Error = ex.Message });
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // GET api/access/recipient-name/{userid}
        // ─────────────────────────────────────────────────────────────────────
        [HttpGet("recipient-name/{userid}")]
        public async Task<IActionResult> RecipientName(int userid)
        {
            var user = await _dbContext.CoreVUsers.FirstOrDefaultAsync(u => u.UserId == userid);
            if (user == null) return BadRequest(new { message = "User doesn't exist" });
            return Ok(user.Employeename2);
        }



        [HttpGet("Get-Menu")]
        public async Task<IActionResult> GetMenulist()
        {
            var menus = await _dbContext.CoreVAdminMenus
                .Where(x => x.SysId == 98)
                .ToListAsync();

            var maintenance = menus.FirstOrDefault(x => x.ParentName == "Maintenance");

            var children = menus
                .Where(x =>
                    x.ParentName == "System Application" ||
                    x.ParentName == "System Approver Group"
                )
                .ToList();

            return Ok(new
            {
                parent = maintenance,
                children
            });
        }

        [HttpGet("Get-People")]
        public async Task<IActionResult> GetPeopleController(
            string find,
            int page = 1,
            int pageSize = 20)
        {
            var idClaim = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(idClaim) || !int.TryParse(idClaim, out int userId))
                return Unauthorized(new { Message = "Invalid user ID." });

            var roleClaim = User?.FindFirst(ClaimTypes.Role)?.Value;
            if (roleClaim != "ADMIN")
                return Forbid();

            if (string.IsNullOrWhiteSpace(find))
                return Ok(new { data = new List<object>(), total = 0 });

            var searchTerms = find
                .ToLower()
                .Split(' ', StringSplitOptions.RemoveEmptyEntries);

            var query =
                from u in _dbContext.CoreVUsers
                join e in _dbContext.CoreVEmployeeDetails
                    on u.EmplId equals e.EmplId into empJoin
                from e in empJoin.DefaultIfEmpty()
                where(u.Usertype == "E")
                select new
                {
                    User = u,
                    Employee = e
                };

            // search filter
            foreach (var term in searchTerms)
            {
                var t = term;

                query = query.Where(x =>
                    (x.User.Username != null && x.User.Username.ToLower().Contains(t)) ||
                    (x.User.Employeename2 != null && x.User.Employeename2.ToLower().Contains(t)) ||
                    (x.User.Firstname != null && x.User.Firstname.ToLower().Contains(t)) ||
                    (x.User.Lastname != null && x.User.Lastname.ToLower().Contains(t)) ||
                    (x.User.Nickname != null && x.User.Nickname.ToLower().Contains(t)) ||
                    (x.User.EmplId != null && x.User.EmplId.ToLower().Contains(t)) ||
                    (x.User.Username != null && x.User.Username.ToLower().Contains(t)) ||

                    // employee details
                    (x.Employee.Branch != null && x.Employee.Branch.ToLower().Contains(t)) ||
                    (x.Employee.Branchname != null && x.Employee.Branchname.ToLower().Contains(t)) ||
                    (x.Employee.Department != null && x.Employee.Department.ToLower().Contains(t)) ||
                    (x.Employee.Departmentname != null && x.Employee.Departmentname.ToLower().Contains(t)) 
                );
            }

            var total = await query.CountAsync();

            var users = await query
                .OrderBy(x => x.User.Employeename2)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(x => new
                {
                    userId = x.User.UserId,
                    name = x.User.Employeename2,
                    username = x.User.Username,
                    empId = x.User.EmplId,

                    // added fields
                    branch = x.Employee != null ? x.Employee.Branch : null,
                    branchName = x.Employee != null ? x.Employee.Branchname : null,
                    department = x.Employee != null ? x.Employee.Department : null,
                    departmentName = x.Employee != null ? x.Employee.Departmentname : null
                })
                .ToListAsync();

            return Ok(new
            {
                data = users,
                total,
                page,
                pageSize,
                hasMore = (page * pageSize) < total
            });
        }

        



    }

    // ─────────────────────────────────────────────────────────────────────────
    // DTOs & Models
    // ─────────────────────────────────────────────────────────────────────────
    public class LoginLocationInfo
    {
        public string? IpAddress { get; set; }
        public string? Country { get; set; }
        public string? Region { get; set; }
        public string? City { get; set; }
        public string? Isp { get; set; }
        public string? Browser { get; set; }
        public DateTime LoginTime { get; set; }
    }

    public class Response
    {
        public string? status { get; set; }
        public string? message { get; set; }
        public string? stringParam1 { get; set; }
        public string? stringParam2 { get; set; }
        public object? objParam1 { get; set; }
        public object? objParam2 { get; set; }
        public object? objMenuList { get; set; }
        public object? branches { get; set; }
    }

    public class LoginModel
    {
        public string? loginname { get; set; }
        public string? password { get; set; }
    }
}
