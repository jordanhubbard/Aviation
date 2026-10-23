# Security Policy

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of the Aviation Missions App seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Please Do NOT:
- Open a public GitHub issue for security vulnerabilities
- Share the vulnerability details publicly before it has been addressed

### Please DO:
1. **Email**: Send details to [security contact email] (or use GitHub Security Advisories)
2. **Provide Details**: Include as much information as possible:
   - Type of vulnerability (e.g., SQL injection, XSS, authentication bypass)
   - Full paths of source file(s) related to the vulnerability
   - Location of the affected source code (tag/branch/commit or direct URL)
   - Step-by-step instructions to reproduce the issue
   - Proof-of-concept or exploit code (if possible)
   - Impact of the vulnerability

### What to Expect:
- **Acknowledgment**: We'll acknowledge receipt within 48 hours
- **Assessment**: We'll assess the vulnerability and determine its impact
- **Fix**: We'll work on a fix and keep you updated on progress
- **Disclosure**: We'll coordinate public disclosure after the fix is available
- **Credit**: We'll credit you in the security advisory (if desired)

## Security Measures

### Authentication & Authorization
- Admin passwords hashed with bcrypt
- JWT tokens for session management (8-hour expiration)
- Protected API endpoints with middleware
- Case-insensitive email lookup
- Password requirements (minimum 8 characters)

### Data Protection
- H2 database with file-based storage
- Admin credentials stored in JSON with bcrypt hashes
- No plain-text passwords in storage or logs
- Session tokens stored securely in localStorage

### Application Security
- Input validation on all user inputs
- XSS protection through proper escaping
- CORS configuration for API access
- Docker container isolation
- Regular dependency updates via Dependabot

### Monitoring & Logging
- Application health checks
- Error logging without sensitive data exposure
- Failed login attempt logging
- Admin action logging

## Security Best Practices for Deployment

### Production Deployment
1. **HTTPS Only**: Always use HTTPS in production
2. **Environment Variables**: Never commit secrets to git
3. **Admin Credentials**: Change default admin email before deployment
4. **File Permissions**: Restrict access to `data/admins.json` (chmod 600)
5. **Firewall**: Configure firewall rules appropriately
6. **Updates**: Keep Docker images and dependencies updated
7. **Backups**: Regular backups of `data/` directory
8. **Monitoring**: Set up health check monitoring and alerting

### Secrets Management
- Use GitHub Secrets for CI/CD secrets
- Use environment variables for production secrets
- Never hardcode API keys or passwords
- Rotate credentials regularly
- Use secret scanning tools

### Docker Security
- Use minimal base images (Alpine)
- Run containers as non-root user (where possible)
- Scan images for vulnerabilities (Trivy)
- Keep base images updated
- Use multi-stage builds to minimize attack surface

## Vulnerability Disclosure Policy

We follow responsible disclosure practices:

1. **Private Disclosure**: Report vulnerabilities privately
2. **Assessment Period**: 90 days to assess and fix
3. **Coordinated Disclosure**: We'll coordinate public disclosure with reporters
4. **Security Advisories**: We'll publish GitHub Security Advisories for confirmed vulnerabilities
5. **CVE Assignment**: We'll request CVE IDs for significant vulnerabilities

## Security Updates

Security updates are released as soon as possible after a vulnerability is confirmed and fixed. We recommend:

- Subscribe to GitHub releases for notifications
- Enable Dependabot security updates
- Review security advisories regularly
- Test updates in staging before production deployment

## Compliance

This project implements security controls aligned with:
- OWASP Top 10 Web Application Security Risks
- CWE/SANS Top 25 Most Dangerous Software Errors
- Docker CIS Benchmarks

## Security Checklist for Contributors

Before submitting code:
- [ ] No hardcoded secrets or credentials
- [ ] Input validation implemented
- [ ] Output properly escaped (XSS prevention)
- [ ] Authentication/authorization checks in place
- [ ] Error messages don't expose sensitive information
- [ ] Dependencies are up to date
- [ ] Security tests included
- [ ] Documentation updated

## Contact

For security-related questions or concerns:
- Email: [security contact]
- GitHub Security Advisories: https://github.com/jordanhubbard/aviation-missions-app/security/advisories

---

*Last Updated: 2025-11-23*
