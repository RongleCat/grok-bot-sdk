# Security

grok-bot-sdk holds an account access token for the Grok Bot desktop protocol. Treat that token, the refresh token, the login verifier, and any Keychain password as secrets.

- Do not open issues that contain tokens, emails, message text, or credential files.
- `grok-bot-sdk login` writes the session to a file you name and prints a redacted summary.
- The macOS adapter reads only the local Grok Bot Keychain item, and only after the system permission prompt.

Report a vulnerability in this repository to the maintainer on X: [@cgnot996](https://x.com/cgnot996).
