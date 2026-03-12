---
name: api-security-best-practices
description: Core guidelines and best practices for developing, integrating, and maintaining secure APIs.
---
# API Security Best Practices Skill

This skill provides essential security guidelines when designing, reviewing, or implementing API endpoints and integrations.

## Core Best Practices

When asked to implement, configure, or review APIs, follow these guidelines consistently:

1. **Authentication & Authorization**
   - **Never hardcode secrets** (API keys, tokens, passwords) in the source code. Always use environment variables (`.env`) or secure secret managers (e.g., AWS Secrets Manager, Vercel Environment Variables).
   - Prefer modern authentication protocols like **OAuth 2.0** or **OIDC** instead of Basic Auth.
   - Use short-lived Access Tokens and implement secure Refresh Token rotation.
   - Apply the **Principle of Least Privilege**: Ensure scopes and permissions are strictly limited to the minimum necessary for the API/Agent to function.

2. **Data Privacy & Transport Security**
   - **HTTPS Everywhere**: Always enforce TLS/SSL for data in transit to prevent man-in-the-middle (MITM) attacks.
   - Encrypt sensitive data at rest and in transit.
   - Do not expose PII (Personally Identifiable Information) in URLs or query strings; use request bodies and proper headers.

3. **Input Validation & Data Sanitization**
   - **Never trust user input**. Strictly validate, sanitize, and type-check all incoming payloads, query parameters, and headers before processing.
   - Protect against common injection attacks (SQL Injection, NoSQL Injection, XSS) using object-relational mapping (ORM) libraries or parameterized queries.

4. **Rate Limiting & Throttling**
   - Implement rate limits per IP or per API Key to prevent Denial of Service (DoS) attacks and brute-force attempts.
   - Provide informative responses (`429 Too Many Requests`) structured according to standard web conventions.

5. **Error Handling & Information Disclosure**
   - Do not leak stack traces or detailed internal server errors to the client. Return generic, safe error messages (e.g., `500 Internal Server Error`) while logging the details securely on the server side.

6. **Logging & Monitoring**
   - Log access and audit trails for critical API interactions, especially authentication and authorization events.
   - Ensure that logs **do not contain** sensitive information like passwords, valid access tokens, or PII.

7. **CORS (Cross-Origin Resource Sharing)**
   - Configure strict CORS policies. Avoid using `Access-Control-Allow-Origin: *` in production environments; explicitly define allowed origins, methods, and headers.
