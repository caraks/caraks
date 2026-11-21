# Architecture
- Shareable Turing tests use separate test, guest-participant, and message tables with capability-token RPC access; guest links never bypass account protection on other pages.
- Turing administration is validated in database functions against user_roles; browser state is not an authorization source.
- Test invitation QR codes are generated locally with qrcode.react and fixed high-contrast scan tokens to avoid exposing links to third-party services.