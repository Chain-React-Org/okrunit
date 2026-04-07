## 1.5.0

- New trigger! New Approval Request - triggers when a new approval is created
- Add status and priority filter fields to Approval Decided trigger
- Add priority filter to Find Approvals search
- Register hidden dropdown triggers (action types, team members, teams) in app definition
- Register Create Approval action in app definition
- Add output field definitions to all triggers
- Update tests for OAuth authentication flow

## 1.0.3

- Fix PKCE code_verifier not being sent during OAuth token exchange

## 1.0.2

- Fix OAuth token exchange failing due to URL redirect from okrunit.com to www.okrunit.com

## 1.0.1

- New trigger! trigger/approval_decided
- New action! create/create_approval
- New action! create/respond_to_approval
- New search! search/list_approvals
- New search! search/get_approval
- Update authentication to use OAuth 2.0

## 1.0.0

Initial release.
