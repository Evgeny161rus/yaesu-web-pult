# Security Policy

## Supported Versions

Security updates are provided for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 3.2.x   | :white_check_mark: |
| < 3.0   | :x:                |

## Security Considerations

### Network Security

**Yaesu Web Pult is designed for use on trusted local networks.**

- The web server binds to all interfaces (0.0.0.0) by default
- HTTPS is available with self-signed certificates
- Password authentication is optional but recommended
- WebSocket connections are used for real-time updates

### Recommended Practices

1. **Use on Local Network Only**
   - Do not expose the server directly to the internet
   - Use VPN for remote access
   - Consider firewall rules to restrict access

2. **Enable Authentication**
   - Set a strong password in server configuration
   - Change default passwords immediately

3. **Use HTTPS**
   - Enable HTTPS for encrypted communication
   - Accept the self-signed certificate or provide your own

4. **Keep Software Updated**
   - Regularly update to the latest version
   - Monitor security advisories

5. **Limit Physical Access**
   - Server has full control of the transceiver
   - Unauthorized access can result in transmissions
   - Consider read-only mode for observers

### Known Limitations

- **Self-signed Certificates**: Default HTTPS uses self-signed certificates
- **Password Storage**: Stored in config.json (restrict file permissions)
- **No User Management**: Single password for all users
- **No Rate Limiting**: Malicious clients could spam commands

### Safe Deployment

#### Recommended Network Setup
```
Internet ─╳─ Firewall ─── Local Network ─── Yaesu Web Pult Server
                          │
                          ├── Trusted PC
                          ├── Trusted Tablet
                          └── Trusted Phone
```

#### VPN Access (Recommended for Remote Use)
```
Internet ── VPN Server ── VPN Tunnel ── Local Network ── Server
            (e.g., WireGuard, OpenVPN)
```

#### Avoid Direct Exposure
```
Internet ─╳─ Port Forward ─╳─ Yaesu Web Pult
         (NOT RECOMMENDED)
```

## Reporting a Vulnerability

If you discover a security vulnerability, please:

1. **Do NOT open a public issue**
2. Email the maintainer with details:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

3. Allow reasonable time for a fix before public disclosure

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Varies by severity
  - Critical: 1-7 days
  - High: 7-30 days
  - Medium: 30-90 days
  - Low: Next release cycle

## Security Updates

Security updates will be:
- Released as patch versions (e.g., 3.2.1)
- Documented in CHANGELOG.md
- Announced in GitHub Releases
- Tagged as security fixes

## Threat Model

### In Scope

- Authentication bypass
- Command injection
- Path traversal
- Cross-site scripting (XSS)
- Cross-site request forgery (CSRF)
- Unauthorized transceiver control
- Information disclosure

### Out of Scope

- Physical attacks on hardware
- Social engineering
- Denial of service on local network
- Attacks requiring physical access
- Third-party library vulnerabilities (report upstream)

## Best Practices for Users

### File Permissions (Linux/macOS)
```bash
chmod 600 config.json
chmod 700 server/
```

### Firewall Rules (Example)
```bash
# Allow only local network
sudo ufw allow from 192.168.1.0/24 to any port 8080
sudo ufw deny 8080
```

### Docker Security
```yaml
# docker-compose.yml
services:
  yaesu-web-pult:
    network_mode: bridge
    # Do not use host mode unless necessary
```

### Password Requirements

Minimum recommended:
- 12+ characters
- Mix of uppercase, lowercase, numbers, symbols
- Not based on dictionary words
- Unique to this application

## Audit Log

The server logs:
- Connection attempts
- Authentication failures
- CAT commands executed
- Configuration changes
- Errors and warnings

Logs are stored in `logs/` directory (not committed to git).

## Third-Party Dependencies

We rely on:
- **Python standard library**
- **NumPy** (numeric operations)
- **sounddevice** (audio I/O)
- **Hamlib** (optional, external)

Security of these components:
- Monitor upstream advisories
- Update regularly via `pip install --upgrade`
- Pin versions in requirements.txt for stability

## Compliance

This software:
- Is designed for amateur radio use
- Requires appropriate licenses
- Must comply with local regulations
- User is responsible for transmissions

## Contact

For security concerns:
- GitHub Issues (non-security bugs)
- Email: [maintainer email]
- Amateur radio: R6AAF

---

**Remember**: Security is a shared responsibility. Follow best practices and stay informed.

**73!** 📻
