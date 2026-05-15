# Security policy

## Supported versions

Security fixes are provided for the latest published minor release of
`jspdf-blend-modes`.

| Version      | Supported   |
| ------------ | ----------- |
| Latest minor | Yes         |
| Older minors | Best effort |

This library is a build-time/runtime helper for PDF generation. It does not
handle credentials, authentication, networking, or untrusted code execution by
itself. Still, malformed SVG or PDF-generation inputs can matter in downstream
applications, so we treat credible denial-of-service, data exposure, prototype
pollution, or unsafe DOM/PDF output reports seriously.

## Reporting a vulnerability

Please **do not open a public GitHub issue** for security-sensitive reports.

Use GitHub's private vulnerability reporting flow for this repository when it
is enabled. If it is not enabled, contact the maintainers through the
repository's published private maintainer channel before sharing details in
public. Include:

- A short description of the issue and impact.
- A minimal reproduction or proof of concept.
- Affected versions.
- Any known mitigations or workarounds.
- Whether you plan to request a CVE.

We will acknowledge receipt within **7 calendar days** and aim to provide an
initial assessment within **14 calendar days**. If the report is accepted, we
will coordinate a fix and disclosure timeline with you.

## Disclosure process

1. Maintainers reproduce and confirm the issue.
2. A fix is prepared privately.
3. A patched release is published.
4. The vulnerability is disclosed with credit to the reporter unless they ask
   to remain anonymous.

Please give us a reasonable window to ship a fix before public disclosure.

## Out of scope

The following are usually out of scope unless they demonstrate a practical
security impact in `jspdf-blend-modes` itself:

- Vulnerabilities in `jspdf`, `svg2pdf.js`, browser PDF viewers, Node.js, or
  bundlers that are not caused by this package.
- Issues requiring a malicious dependency already installed in the consumer's
  project.
- Social engineering, phishing, or attacks against maintainer accounts.
- Reports generated solely by automated scanners without a working
  reproduction.

## Safe harbour

We will not pursue legal action against good-faith security research that:

- Avoids privacy violations, data destruction, and service disruption.
- Gives us time to remediate before public disclosure.
- Does not access or modify data that does not belong to you.
- Complies with applicable laws.
