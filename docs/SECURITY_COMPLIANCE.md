# Security & Compliance Documentation

## Overview
This document outlines the security measures, legal considerations, and compliance requirements for the Aviation project.

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
