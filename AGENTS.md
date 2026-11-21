# Architecture
- Shareable Turing tests use separate test, guest-participant, and message tables with capability-token RPC access; guest links never bypass account protection on other pages.
- Turing administration is validated in database functions against user_roles; browser state is not an authorization source.