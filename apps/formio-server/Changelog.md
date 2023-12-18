# Change Log
All notable changes to this project will be documented in this file

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased: 8.5.0-rc.1]
### Changed
 - FIO-7328: replace kickbox verify with node-fetch
 - FIO-7349: Fixes an issue where server crashes when user tries to load a view page of the deleted team
 - FIO-6566: fixed issue with exceeding project plan limit
 - FIO-7290: fixed ability set project plan without x-admin-key
 - FIO-5728: checking for unique email when adding user to team
 - FIO-7236: move to deprecate random keygen
 - FIO-7397: fixed server validation errors for reporting ui config form
 - FIO-7167: Isolated vm
 - FIO-7423: Fortis Payment Gateway Feature
 - FIO-7551: Revert "FIO-7423: Fortis Payment Gateway Feature" 
 - FIO-7400: fixed an issue where lookup operator with pipeline gives an уrror in DocumentDB
 - hotfix for failing tests
 - FIO 7239: add support for AWS S3 multipart uploads
 - FIO-7371: Adds hook that would allow to retrieve raw DB data
 - FIO-7391: refactored reporting-ui configuration form
 - FIO-7423: Failed to search current payment info in server
 - FIO-7423: Transaction Failed message user with no names
 - FIO-7460: Fix error during project creation
 - FIO-7538: Update vm-utils to 1.0.0-rc.1
 - FIO-7319: fixed an issue where submission changelog is available when sac is disabled and for hosted
 - Revert "Merge pull request #1363 from formio/isolated-vm"
 - FIO-7413: removed SQL Connector action from hosted platform
 - FIO-7492: Default Stage Feature
 - FIO-7621: Fixes tests failing on hosted environment
 - FIO-7536: added default form settings
 - FIO-3820: added ability to remove file from storage
 - FIO-7482: added the db update script for reportingui forms
 - [Snyk] Security upgrade crypto-js from 4.1.1 to 4.2.0
 - FIO-7542: Pin node image to node 18
 - FIO-7423: Transaction Failed empty message FIXED
 - FIO-7510: Revert "Merge pull request #1363 from formio/isolated-vm"
 - FIO-7423: Fortis Payment transaction error per description
 - Bump ecma version to 2022
   
 
## 8.4.0-rc.7
### Changed
 - [Snyk] Security upgrade mongodb from 4.16.0 to 4.17.0
 - [Snyk] Upgrade @braintree/sanitize-url from 6.0.2 to 6.0.4
 - [Snyk] Upgrade qrcode from 1.5.1 to 1.5.3
 - Bump mongoose from 6.10.4 to 6.12.0
 - Bump word-wrap from 1.2.3 to 1.2.5
 - FIO-7323: Fix issue involving Azure and PDF email attachments
 - FIO-5728 checking for unique email when adding user to team
   
## 8.4.0-rc.6
### Changed
 - Updated formio-app@8.4.0-rc.6
 - Updated formio@3.4.0-rc.5

### Fixes
 - bugfix: add descriptive error message to worker failure
 - FIO-7340-7357: fixed language/wording in reporting ui config form and removed default values
   
## 8.4.0-rc.5
### Changed
 - Updated formio-app@8.4.0-rc.5
 - Updated formiojs@4.18.0-rc.3
 - Updated formio@3.4.0-rc.4
 - Updated formio-workers@1.20.0-rc.4

## 8.4.0-rc.4
### Changed
 - Updated formio-app@8.4.0-rc.4
 - Updated formiojs@4.18.0-rc.2
 - Updated formio@3.4.0-rc.3
 - Updated formio-workers@1.20.0-rc.3
 - FIO-7297: Fixes no owner assigned to stage created with admin key
 - FIO-7350: added support for addFields aggregation operator (alternative to set) to provide reports loading when DocumentDB is used
   
## 8.4.0-rc.3
### Changed
 - Updated formio-app@8.4.0-rc.3

## 8.4.0-rc.2
### Changed
 - Updated formio-app@8.4.0-rc.2
 - Updated @formio/premium@1.22.0-rc.1

## 8.4.0-rc.1
### Changed
 - Updated formio-app@8.4.0-rc.1
 - Updated @formio/premium@1.21.0-rc.3
 - Updated formio@3.4.0-rc.2
 - Updated formio-workers@1.20.0-rc.2

### Changed
 - [Snyk] Upgrade acorn from 8.8.2 to 8.10.0
 - [Snyk] Upgrade dotenv from 16.0.3 to 16.3.1
 - [Snyk] Security upgrade @node-saml/node-saml from 4.0.4 to 4.0.5
   
### Fixed
 - Hotfix: Fix production issue that is crashing the hosted server
 - Fix tests for 6889
 - Revert "FIO-6859: migrate-aws-sdk-to-v3"
 - FIO-7180: fixed an issue when print to PDF does not show uploaded images
 - FIO-7149: fixed issue with getting settings for primary admin
 - FIO-7229: fixed an issue where stages did not inherit parent project plan in hosted env
 - FIO-7123 FIO-7124 FIO-7048: made form revisons and action logs available for onPremise only when sac is enabled and added sac functionality disabling in the from when sac is not enabled for license
 - FIO-6493: added reporting-ui form to default template once the license is validated and fixed formio-server test
 - fixed project plan tests for hosted env
 - FIO-7297: Fixes permission denied error when creating a stage while admin key is provided for authentication

### Added
 - FIO-3820: Ability to delete files inside the Storage Services
 - FIO-6493: reporting ui related changes
   
## 8.3.0-rc.2
### Changed
 - Updated formio-app@8.3.0-rc.2
 - Updated formiojs@4.17.0-rc.3
 - Updated @formio/premium@1.21.0-rc.2
 - Updated formio@3.3.0-rc.2
 - Updated formio-workers@1.19.0-rc.2
 - FIO-6859: migrate-aws-sdk-to-v3

## Fixed
 - FIO-7227: update mocked request object to include a path
 - FIO-7151: removed email action for project plan upgrade

## 8.3.0-rc.1
### Changed
 - Updated formio-app@8.3.0-rc.1
 - Updated formiojs@4.17.0-rc.2
 - Updated @formio/premium@1.21.0-rc.1
 - Updated formio@3.3.0-rc.1
 - Updated formio-workers@1.19.0-rc.1
 - FIO-6982: update major version dependency for passport-saml-metadata

### Fixed
 - FIO-7132 fixed error for pdfDownload Changelog
 - Fix for 7 vulnerabilities
 - Security upgrade jose and mongodb
 - FIO-5042: Removing URI from UserData

## 8.2.0-rc.7
### Changed
 - Updated formio-app@8.2.0-rc.8
 - Updated formiojs@4.16.0-rc.9
 - Updated formio@3.2.0-rc.7
 - Updated formio-workers@1.18.0-rc.5

## 8.2.0-rc.6
### Changed
 - Updated formio-app@8.2.0-rc.7
 - Updated formio@3.2.0-rc.6

### Fixed
 - Use mongodb features to determine if collation should be used
 - FIO-6601: Fixes submissions retrieval from custom submission collection
 - FIO-7166: Use mongodb features to determine if collation should be used
   
## 8.2.0-rc.5
### Changed
 - Updated formio-app@8.2.0-rc.6
 - Updated formio@3.2.0-rc.5

## 8.2.0-rc.4
### Changed
 - Updated formio-app@8.2.0-rc.4
 - Updated formiojs@4.16.0-rc.8
 - Updated formio@3.2.0-rc.4
 - Updated formio-workers@1.18.0-rc.4

### Fixed
 - FIO-6577: fixed an issue where unable to create a new stage for tenants If the stage limit exceeded for parent project

## 8.2.0-rc.3
### Changed
 - Updated formio-app@8.2.0-rc.3
 - Updated formiojs@4.16.0-rc.7
 - Updated @formio/premium@1.20.0-rc.2
 - Updated formio@3.2.0-rc.3
 - Updated formio-workers@1.18.0-rc.3

### Fixed
 - FIO-7060: Fixing the pdf-proxy to download and authenticate correctly
 - FIO-7103: fixed an issue where the webhook action would strip query parameters
 - FIO-7136, FIO-7137: Fixed issues with pdf-proxy authentication.
 - FIO-6981: replace deprecated azure storage dependency
 - FIO 7084: Synchronize indexes for submission collections
 - FIO-7006: added authority header to resolve host and logs to check errors and result
 - Fixed pdf proxy not stringifying request body for pdf download 

## 8.2.0-rc.2
### Changed
 - Updated formio-app@8.2.0-rc.2
 - Updated formiojs@4.16.0-rc.5
 - Updated formio@3.2.0-rc.2
 - Updated formio-workers@1.18.0-rc.2

### Changed
 - [Snyk] Security upgrade box-node-sdk from 2.10.0 to 3.0.0
 - FIO-6840: update email tokens query
 - FIO-7006: updated check for hosted form manager

### Fixed
 - FIO-6613: fixed an issue where 0 value is not shown in the Submission change log
 - FIO-6574: fixed an issue where datetime component shows up in Submission change log.
 - FIO-6857: Fixes team invitation not appearing for users which emails contain special characters
 - FIO-6649: Fixes an issue with SSO users being unable to create teams with Only_Primary_Write_Access enabled
 - FIO-6611: Added ability to delete archived projects in SaaS
 - Bump json-schema and jsprim in /test/licenseShim
 - FIO-7095: JSON POST requests from PDF proxy now stringify the body
   
## 8.2.0-rc.1
### Changed
 - Updated formio-app@8.2.0-rc.1
 - Updated formiojs@4.16.0-rc.2
 - Updated @formio/premium@1.20.0-rc.1
 - Updated formio@3.2.0-rc.1
 - Updated formio-workers@1.18.0-rc.1

### Fixed
 - FIO-6960: fixed pdf proxy for e2e ssl
 - FIO-6947: made licenseId available in formio-app for license server requests
 - FIO-6769: Use default template when creating empty stage
 - FIO-6566: added plan limit check for template importing
   
## 8.1.1-rc.1
### Changed
 - Updated formio-app@8.1.1-rc.1
 - Updated formiojs@4.15.1-rc.1
 - Updated formio@3.1.1-rc.1
 - Updated formio-workers@1.17.1-rc.1

## 8.1.0
### Changed
 - Official Release
 - Updated formio-app@8.1.0
 - Updated formiojs@4.15.0
 - Updated @formio/premium@1.19.0
 - Updated formio@3.1.0
 - Updated formio-workers@1.17.0

## 8.1.0-rc.16
### Changed
 - Updated formio-app@8.1.0-rc.15
 - Updated formiojs@4.15.0-rc.27
 - Updated formio@3.1.0-rc.16
 - Updated formio-workers@1.17.0-rc.10

### Fixed
 - Fix Archived Plan
 - FIO-6979: fix pdf proxy with subdomain alises not found

## 8.1.0-rc.15
### Changed
 - Updated formio-app@8.1.0-rc.14
 - Updated formiojs@4.15.0-rc.26
 - Updated @formio/premium@1.19.0-rc.12
 - Updated formio@3.1.0-rc.15
 - Updated formio-workers@1.17.0-rc.9

## Fixed
 - Revert "FIO-6559: added live project to count stages limit"
 - FIO-6729: removed logs of POST bodies and data
 
## 8.1.0-rc.14
### Changed
 - Updated formio-app@8.1.0-rc.13
 - Updated formio@3.1.0-rc.14

### Fixed
 - FIO-6840: Add case-insensitive index to schema

## 8.1.0-rc.13
### Changed
 - Updated formio-app@8.1.0-rc.12
 - Updated formiojs@4.15.0-rc.25
 - Updated @formio/premium@1.19.0-rc.11
 - Updated formio@3.1.0-rc.13
 - Updated formio-workers@1.17.0-rc.8

### Fixed
 - FIO-6559: added live project to count stages limit
 - FIO-5979: Enable ability for browsers to cache CORS
 - FIO-6273: added clean up for portal folder before copying build to formio-enterprise
 - FIO-6887: fixed an issue where form manager is always available on onPremise env despite of license configuration

## 8.1.0-rc.12
### Changed
 - Updated formio-app@8.1.0-rc.11
 - Updated formiojs@4.15.0-rc.24
 - Updated formio@3.1.0-rc.12
 - Updated formio-workers@1.17.0-rc.7

### Changed
 - FIO-6253: PDF proxy endpoint now handles PDF upload and download requests

## 8.1.0-rc.11
### Changed
 - Updated formio-app@8.1.0-rc.10
 - Updated formiojs@4.15.0-rc.23
 - Updated @formio/premium@1.19.0-rc.10
 - Updated formio@3.1.0-rc.11
 - Updated formio-workers@1.17.0-rc.6

### Fixed
 - FIO-6855: Load SSL_KEY and SSL_CERT optionally from a file path rather than a string value

## 8.1.0-rc.10
### Changed
 - Updated formio-app@8.1.0-rc.9
 - Updated @formio/premium@1.19.0-rc.9

### Fixed
 - FIO-6835: Fixing api server crash with the pdf-proxy middleware.
 - FIO-6662: Fixing issue where the session on login would not work if your database is using readSecondary for replica sets
 - FIO-6631: Do not require the secret keys for configuring S3 connection.
 - FIO-6774 Fixed the display of encrypted fields

## 8.1.0-rc.9
### Changed
 - Updated formio@3.1.0-rc.10

## 8.1.0-rc.8
### Changed
 - Updated formio-app@8.1.0-rc.8
 - Updated formiojs@4.15.0-rc.22
 - Updated @formio/premium@1.19.0-rc.8
 - Updated formio@3.1.0-rc.9
 - Updated formio-workers@1.17.0-rc.5

### Fixed
 - FIO-6417: Fixes archived project upgrade and adds tests for archived plan

## 8.1.0-rc.7
### Changed
 - Updated formio-app@8.1.0-rc.6
 - Updated formiojs@4.15.0-rc.21
 - Updated @formio/premium@1.19.0-rc.7
 - Updated formio@3.1.0-rc.8
 - Updated formio-workers@1.17.0-rc.4

## 8.1.0-rc.6
### Changed
 - Updated formio@3.1.0-rc.7

## 8.1.0-rc.5
### Changed
 - Updated formio-app@8.1.0-rc.5
 - Updated formiojs@4.15.0-rc.20
 - Updated @formio/premium@1.19.0-rc.6
 - Updated formio@3.1.0-rc.6
 - Updated formio-workers@1.17.0-rc.3

### Added
 - FIO-6579: add tests for template exporting
 - FIO-6627: Removed case-sensitivity for Teams emails
 - FIO-6613: fixed an issue where 0 value is not shown in the Submission
 - FIO-6513: Removing the remote redirect which causes infinite loops.
 - FIO-6509: remove file token from server2server
 - FIO-6417: Fixes archived project upgrade and adds tests for archived plan
 - FIO-6404: Add db update script to fix Date\Time values stored as string instead of ISODate format
 - FIO-5979: added the ability for browsers to cache CORS

## 8.1.0-rc.4
### Fixed
 - FIO-6523: Fixing stage and tenant project counts for offline license.
 
## 8.1.0-rc.3
### Changed
 - Updated formio-app@8.1.0-rc.4
 - Updated formiojs@4.15.0-rc.19
 - Updated @formio/premium@1.19.0-rc.5
 - Updated formio@3.1.0-rc.3
 - Updated formio-workers@1.17.0-rc.2

### Changed
 - Added opt-in environment variables for SAML Passport key paths

### Fixed
 - FIO-5613: refactor of webhook action allowing for interpolation of headers and better treatment of before-handled webhooks
 - FIO-6114: fixed an issue where signature fields in the box sign provider are not displayed in the order defined by the 'order' setting
 - FIO-6215: upgrade knex to 2.4.0
 - FIO-6228: remove unused xmldom dependency
 - FIO-6282: remove twilio dependency
 - FIO-6129: Display branding in form viewer by default
 - No longer treat descendants of `Error` as empty objects in webhook error response
 - FIO-6214 added updates for Enterprise plan
 - FIO-5688: Fixing the email limits for hosted environments.
 - FIO-6095: Fixed race condition between project license and SaC validation
 - FIO-6303: added middleware to pdf proxy to keep only essential headers
 - FIO-6320: fixed cors error for pdf proxy
 - FIO-4868: Fixing the wildcard cors to return the correct value for Access-Control-Allow-Origin
 - FIO-6320: Fix access-control-allow-headers issue
 - Made the team upgrade more resilient 
 - FIO-5889: Remove Redis as a dependency and replace with MongoDB
 - FIO-6347: made stages inherit parent project plan
 - FIO-6162-5540: improved performance when loading a project
 - FIO-6321: added plan property to the form in hosted environments
 - FIO-6330: Add middleware to archive projects with expired trial time and restrict Archived projects actions
 - Ensure we do not reject the server-to-server call from pdf to server
 - FIO-6444: fix async problem with archived projects
 - FIO-6422: postgres-settings-knex-raw-error
 - fixed pdf proxy removing content-type header
 - FIO-6472: fix issue where project upgrades/downgrades were failing
 - Fixed CORS error(s) on the portal-check endpoint
 - FIO-6327: /portal-check endpoint will sometimes hang the req/res cycle

## 8.1.0-rc.2
### Changed
 - Updated formio-app@8.1.0-rc.3
 - Updated formio@3.1.0-rc.2

### Fixed
 - Revert "FIO-5497: fixed DeprecationWarning for crypto.createDecipher"
 - FIO-6179: Ensure server does not crash if a pdf server is not running.

## 8.1.0-rc.1
### Changed
 - Updated formio-app@8.1.0-rc.2
 - Updated formiojs@4.15.0-rc.18
 - Updated @formio/premium@1.19.0-rc.4
 - Updated formio@3.1.0-rc.1
 - Updated formio-workers@1.17.0-rc.1

### Changed
 - Increment minor version.
 - FIO-5653: Get test suite in a runnable state
 - Security upgrade jsonwebtoken from 8.5.1 to 9.0.0
 - FIO-5497: fixed DeprecationWarning for crypto.createDecipher
 - FIO-5985: OIDC SSO Logout
 - FIO-5374: Add headers to prevent cascading webhook action execution

### Fixed
 - FIO-5033: fixed filetoken
 - FIO-5529: uid and uidNumber added into whitelist
 - FIO-5881: Removed the viewer from the alias token handler.
 - FIO-5348: clean up indexing behavior
 - FIO-5862: upgraded to node 18
 - FIO-5513 / FIO-5531
 - FIO-5536: added sso for LDAP user
 - FIO-4823: FJS box sign component
 - FIO-5885: hide labels for portal login form components
 - FIO-5348: S&C form validation edge case fix
 - FIO-5900: Removed ResetPassword form from PortalBase
 - FIO-5721: forbid repeated click on save/create/publish form button when prev api call is not finished
 - FIO-5175: Footer Logo
 - FIO-3611: Hide Edit profile when user is SSO
 - FIO-5898: removed ResetPasswod from list of available actions
 - FIO-5948: Fixed 'Delete project' in protected mode
 - FIO-5736: fixed an issue where diplay-as dropdown overlays stages dropdown.
 - FIO-5536: ldap users regular teams
 - FIO-5880: prevent server crash sso teams
 - FIO-5862: removed unnecessary updates
 - pdf server proxy added
 - FIO-5768: fixed an issue where emails are not sent for wizard forms with hidden page with nested file component on it
 - FIO-6055: fix regression in SaC Submission Collection behavior
 - FIO-5850: Allow for self-signed certificates when making webhook requests.
 - FIO-5033: fixed iframe work
 - FIO-5033: fixed cors for pdf-proxy
 - FIO-5688: removing email limits
 - FIO-5911: Email action no longer naively attaches PDF server response as attachment
 - FIO-6115: fixed an issue where box sign returns an error when using interpolation for Approvers and Final Signed Copy Recipients
 - FIO-6076: stage team permissions when upgrading stage issue fix
 - FIO-5889: fixed limits on Usage Page
 - FIO-6117: fixed an issue where anonymous users are not redirected to signbox webside page for signature
 - FIO-6041: fixed delete requests with query parameters set in url
 - FIO-6001: fixed an issue where it is impossible to add button to oauth action if it is inside layout/data components
 - FIO-5991: Replace deprecated node-saml with @node-saml/node-saml dependency
 - FIO-5941: added tests for /tag get req with x-token
 - FIO-6167: fixed an issue where tenant with stages is displayed as project in License Management 
 - FIO-6212, FIO-6213: Fixed the server to work with hosted pdf server configurations.
 - FIO-5889, FIO-6214: Fixing the hosted project usage.
 - FIO-6216: Update twilio and resourcejs versions
 - FIO-5229 fixed invalid alias error from hosted analytics route
 - FIO-5870: aggregate query replaced

## 8.0.0-rc.18
### Changed
 - Updated formio-app@8.0.0-rc.22
 - Updated @formio/premium@1.18.7-rc.3
 - Updated formio@3.0.0-rc.11

### Changed
 - FIO-5444: removed response object and updated placeholder (in Webhook action)
 - FIO-5495: added submission data for delete req
 - FIO-5774: added revisions of submissions collections
 - FIO-5747: fixed password displaying on submission changelog
 - FIO-5644: Unable to access Form Manager and FVP If the project was imported via Custom Project Template.
 - FIO-5665: Enable to add teams to a project when logged in with SSO

## 8.0.0-rc.17
### Changed
 - Updated formio-app@8.0.0-rc.21
 - Updated @formio/premium@1.18.6
 - Updated formio@3.0.0-rc.10

### Fixed
 - FIO-5435: fixed exists endpoint with submission collections

## 8.0.0-rc.16
### Changed
 - Updated formio-app@8.0.0-rc.20

### Fixed
 - Disable frame sameorigin
 - FIO-4484: License regression post request to create a project stage tenant does not check if there is an available slot for in a license

## 8.0.0-rc.15
### Changed
 - Updated formio-app@8.0.0-rc.19

## 8.0.0-rc.14
### Changed
 - Updated formio-app@8.0.0-rc.18

### Fixed
 - FIO-5539: Group Resource selects existing resource

## 8.0.0-rc.13
### Changed
 - Updated formio-app@8.0.0-rc.17

### Fixed
 - FIO-3834: fixed CSP for work FMG and PFV

## 8.0.0-rc.12
### Changed
 - Updated formio-app@8.0.0-rc.16

## 8.0.0-rc.11
### Changed
 - Updated formio-app@8.0.0-rc.15
 - Updated @formio/premium@1.18.6-rc.8

### Fixed
 - FIO-5457: Get the default PDF server URL based on the app origin

## 8.0.0-rc.10
### Changed
 - Updated formio-app@8.0.0-rc.14

### Fixed
 - FIO-5357: fixed PDF download with self signed certificates

## 8.0.0-rc.9
### Changed
 - Revert "FIO-3834: added CSP for the Next portal"

## 8.0.0-rc.8
### Changed
 - Updated formio-app@8.0.0-rc.13
 - Updated @formio/premium@1.18.6-rc.7
 - Updated formio@3.0.0-rc.9

## 8.0.0-rc.7
### Changed
 - Updated formio-app@8.0.0-rc.12
 - Updated @formio/premium@1.18.6-rc.5
 - Updated formio@3.0.0-rc.8

### Fixed
 - FIO-3787: LIC when trying to connect a tenant to an on premise environment receiving a 400 error
 - FIO-3764: lic tenants stages and project stages are registering as projects when connecting to a remote environment
 - FIO-5050: fixed headers for request without origin header
 - FIO-3834: added CSP for the Next portal

## 8.0.0-rc.6
### Changed
 - Updated formio-app@8.0.0-rc.11
 - Updated @formio/premium@1.18.6-rc.3
 - Updated formio@3.0.0-rc.7

### Fixed
 - FIO-5346: added the correct header type
 - FIO-5377: fixed processing of empty project search result
 - FIO-4714: Remove unused signrequest code
 - FIO-4483: fixed an issue where display of the Tenant/Form Manager button is not constant when switching the stages

## 8.0.0-rc.5
### Changed
 - Updated formio-app@8.0.0-rc.10
 - Updated formio@3.0.0-rc.6

### Fixed
 - FIO-5343: added generateNameIfMissing to project creation for not hosted licenses
 - FIO-4212: Fix permission denied error after getting team project

### Changed
 - Upgrade @formio/premium@1.18.6-rc.1

## 8.0.0-rc.4
### Changed
 - Updated formio-app@8.0.0-rc.9
 - Updated @formio/premium@1.18.5-rc.5
 - Updated formio@3.0.0-rc.5

### Fixed
 - FIO-5241: fixed an issue where are displayed wrong number of teams participants

## 8.0.0-rc.3
### Changed
 - FIO-5130: resolving vulnerability related to node-same dependency
 - Change remote license for 8.x
 - Fixing hosted licensing.
 - Adding esign support

### Fixed
 - FIO-5129: resolved vulnerability related to dicer
 - Added support to the allowAllSubmissionData setting

## 8.0.0-rc.2
### Changed
 - Updated formio-app@8.0.0-rc.7
 - Updated formio@3.0.0-rc.4

### Fixed
 - Broke up sqlconnector routes
 - License server crash mitigation
 - FIO-3833: FIX CORS in edge.form.io
 - FIO-4892: fixed submission change log second time opening
 - FIO-5163: Made email field required in team member invite form

## 8.0.0-rc.1
### Changed
 - Updated formio-app@8.0.0-rc.5
 - Updated formio@2.5.0

### Fixed
 - FIO-4642: changed not-boot to read-only mode for offline license, add… 
 - FIO-4645: updated license validation errors processing
 - FIO-1304: moving encrypted fields and submission collection for sac license only
 - FIO-3042: Add configuration to allow only primary admin has write access
 - FIO-3585: fixed an issue where wrong number of users display in teams when users reject invitation
 - FIO-3821: Add License Configuration to whitelabel
 - FIO-3557: Added guard to check for sac flag on project license when encrypting fields
 - FIO-4397: added Language resource in the portal base
 - FIO-3435: Fixed the order for the load revisions
 - FIO-4683: Added version to startup logs
 - FIO-4811: added updating the list of revisions when enable/disable submission revisions
 - FIO-4899: fixed new stages creating when project limit is reached
 - FIO-4353: allowed to disable protected mode
 - FIO-4890: enable of create/deploy/delete tags and import project JSON for remote license read-only mode
 - FIO-4633: fixed error handling
 - Adding recommended index to tag collection.
 - FIO-4353: fixed restricted mode and added it to remote license
 - FIO-4843: fixed getting actual data for submission with draft status
 - FIO-4681: removed extra columns in submission revisions change log table
 - FIO-3557: sac env variable removed
 - FIO-4836: file component submission revision
 - FIO-4923: Resolved issue with sendgrid not sending emails with pdf attachments
 - Added reverse compatibility for sac license
 - FIO-4849: fixed tagpad component displaying in changelog
 - FIO-5008: show delta symbol for all changes that were made
 - FIO-5052: added permissions to view all submissions and required condition for text fields
 - FIO-5011: added Language resource when creating a new DB
 - FIO-4772: Fixed issues with remote license attempting to load a license from the server and receiving invalid responses.
 - FIO-4974: allowed to process all types of requests without a body for the webhook action
 - FIO-5011: language resource needs to be included in the portal base project
 - FIO-5075: fix select data displaying in change log
 - FIO-5095: removed date rewrite from submission revisions.
 - FIO-5077: fixed displaying select in submission revisions change log
 - FIO-5090: form revisions transfer for stage deployment
 - FIO-4974: added pre-check for changes in submission data

### Added
 - ECR Deployments.
 - FOR-2793: Implements the email verification workflow.

## 7.4.0-rc.10
### Changed
 - Updated formio-app@7.4.0-rc.11
 - Updated formiojs@4.15.0-rc.7
 - Updated formio@2.5.0-rc.8

### Fixed
 - FIO-4781: Fixing email pdf attachments.
 - FIO-4781: Fixed issues with query strings passed to pdf server.
 - FIO-4798: Submission revision change log fix

## 7.4.0-rc.9
### Changed
 - Updated formio-app@7.4.0-rc.10

### Fixed
 - Ensuring the host, apiHost, and formioHost do not include ports twice.
 - Ensure we always attach bin pdf docs.
 - Fixed Select Boxes displaying and rows loss issues

## 7.4.0-rc.8
### Changed
 - Updated formio-app@7.4.0-rc.9
 - Updated formiojs@4.15.0-rc.6
 - Updated formio@2.5.0-rc.6

### Fixed
 - FIO-4668: Added ability to render signature and sketchpad components

## 7.4.0-rc.7
### Changed
 - New version.

## 7.4.0-rc.6
### Changed
 - Updated formio-app@7.4.0-rc.8
 - Updated formiojs@4.15.0-rc.5
 - Updated formio@2.5.0-rc.5

## 7.4.0-rc.5
### Changed
 - Updated formio-app@7.4.0-rc.7

### Changed
 - Updated formio-app@7.4.0-rc.6

### Changed
 - Updated formio-app@7.4.0-rc.5
 - Updated formiojs@4.15.0-rc.4
 - Updated @formio/premium@1.19.0-rc.1
 - Updated formio@2.5.0-rc.4

### Fixed
 - FIO-4692: Fixed issues with CSP errors when form building.
 - FIO-4692: Fixed issues with PDF subdomain communications.

## 7.4.0-rc.4
### Changed
 - Updated formio-app@7.4.0-rc.4
 - Updated formiojs@4.15.0-rc.3
 - Updated formio@2.5.0-rc.3

### Fixed
 - FIO-4216: Fixed issues where submission collections were not getting established correctly.

## 7.4.0-rc.3
### Changed
 - Updated formio-app@7.4.0-rc.3
 - Updated formiojs@4.15.0-rc.2
 - Updated formio@2.5.0-rc.2

### Fixed
 - FIO-4596: Fix issues with SAML and the 'authnContext' configuration.
 - FIO-4582: Fixed issues with CSP rejecting http requests from other domains.
 - FIO-4359: Submission revision issue fix

## 7.4.0-rc.2
### Changed
 - Updated formio-app@7.4.0-rc.2
 - Updated formiojs@4.14.1-rc.8
 - Updated @formio/premium@1.18.0-rc.2
 - Updated formio@2.5.0-rc.1

### Added
 - FIO-4359: Submission revisions

### Fixed
 - FIO-4487: Server crash when passed an invalid submission id during PATCH request
 - FIO-4473: Fixed server to work with latest saml library.
 - FIO-4437: disable SignRequest 
 - FIO-3468: transform payload miss data
 - FIO-1453: added template check before creating project by it
 - FIO-4365: fixed an issue where team owner displays as an admin
 - FIO-4216: 'Resource not found' when get submission form submission collection
 - FIO-4353: fixed project counting during offline license check
 - FIO-4335: Fixes reaching signrequest confirmation page and inserts dynamic copyright year on it
 - FIO-4338: Adds interpolation to signrequest component settings from submission variable
 - FIO-4339: Fixes invalid pdf file download url in signrequest action when updating the submission
 - FIO-4088: patching submission state with validation

## 7.4.0-rc.1
### Changed
 - Updated formio-app@7.4.0-rc.1
 - Updated formiojs@4.14.1-rc.4
 - Updated @formio/premium@1.17.2-rc.1
 - Updated formio@2.3.2-rc.2

### Changed
 - Adding PDF Auto Conversion features.

## 7.3.1-rc.1
### Fixed
 - FIO-4348: fix signrequest action triggered on deleting submission
 - FIO-4331: add check for no link to pdf file before it's signed
 - FIO-4350: fix finding signrequest components keys for wizard
 - FIO-4088: patch on draft submissions
 - FIO-4234: S3 files with Policy Expiration are getting AccessDenied

## 7.3.0
### Changed
 - Official Release
 - Updated formio-app@7.3.0
 - Updated formiojs@4.14.0
 - Updated @formio/premium@1.17.1
 - Updated formio@2.3.1

## 7.3.0-rc.11
### Changed
 - Updated formio-app@7.3.0-rc.12
 - Updated formiojs@4.14.0-rc.38
 - Updated @formio/premium@1.17.1-rc.1
 - Updated formio@2.3.1-rc.1

### Fixed
 - Sign request fixes.

## 7.3.0-rc.10
### Changed
 - Updated formio-app@7.3.0-rc.11

## 7.3.0-rc.9
### Fixed
 - Deployed portal to use the correct config.js path.

## 7.3.0-rc.8
### Changed
 - Updated formio-app@7.3.0-rc.10
 - Updated formiojs@4.14.0-rc.37
 - Updated @formio/premium@1.17.0
 - Updated formio@2.3.0

### Fixed
 - FIO-3971: SAML ACS Proper URL Sanitization
 - FIO-4214: Fixing the SAML user roles to use the roles from the SAML profile, and parse them correctly.
 - FIO-4105: Unable to create Tenants
 - FIO-4040: Fixed CSP configuration to be general unless explicitely provided.
 - FIO-4008: Moved webpack to dev dependencies
 - FIO-3885 LIC | License Utilization is counting a project against the license limit when a bogus project endpoint is entered in url
 - FIO-3317: updated projects plans according to the formio pricing page
 - Fixing major performance issues with server

### Added
 - FIO-2860: Sign Request integration.

## 7.3.0-rc.7
### Changed
 - Upgrade portal@8.0.0-rc.1
 - Upgrade aws-sdk@2.988.0, passport-saml-metadata@2.5.0
 - FIO-3678: specifying path to email property of uset object open

### Added
 - Enable 2FA into the server.

### Fixed
 - FIO-3945: fixed adding teams to project with stages
 - FIO-3775: Fixed deleting stage connected to on-premise environment issue
 - FIO-3953: displaying custom logo issue fix
 - FIO-3841: expanded set of submissions fields for interpolating into web hook URL
 - FIO-3971: Fixed XSS issues with SAML callback
 - FIO-3914 minify email when o auth and saml login
 - FIO-3893 Fixes an issue with SQL Connector crash
 - FIO-3952: PDF icon does not load form pro.formview.io

## 7.3.0-rc.6
### Upgrade
 - Upgrade portal@8.0.0-alpha.26
 - Upgrade formiojs@4.14.0-rc.25

## 7.3.0-rc.4
### Fixed
 - Upgrade portal@8.0.0-alpha.25

## 7.3.0-rc.3
### Fixed
 - Portal config

## 7.3.0-rc.2
### Changed
 - Upgrade formio@2.3.0-rc.6

## 7.3.0-rc.1
### Changed
 - Using Next portal.

## 7.2.0-rc.5
### Changed
 - Reverted portal back to 7.2.6.
 - Upgrade chance@1.1.8, jose@3.15.5, mailgun.js@3.5.8, webpack@5.51.2, mocha@9.1.1, aws-sdk@2.982.0, googleapis@85.0.0

### Added
 - FIO-2860 SignRequest Integration

## 7.2.0-rc.4
### Changed
 - Upgrade dependencies.

## 7.2.0-rc.3
### Fixed
 - FIO-1528: change default 'from' email address domain to use example in the deployment environment variable
 - FIO-2652 livestage => stage
 - FIO-1497: Fixes an issue when stages were loaded with disabled utilization and were limited by 10.
 - FIO-1541: added token swap automation testing
 - FIO-1565: Server | Form Manager | Revisions | Making changes to a Form with Revisions enabled the user is displayed as "anonymous". Want to show email of the user from FMG that made the change.
 - FIO-1536: Allow endpoint on API server to provide submission JSON to generate PDF
 - FIO-1439: increased max body size
 - FIO-1365: Fixes Authoring stage issues for master
 - FIO-1475-master: Fixes an issue when after update the server DB schema to 3.3.8, the owners of old teams won't set as the admin.
 - FIO-2672: added hook for database update (update all emails to be lower case)
 - Allow them to set the Minio port.
 - FIO-3006: API | JavaScript heap out of memory
 - FIO-2989: Fixes an issue when got an 400 error if a form has more then one oAuth actions.
 - FIO-3369: Removed the submissionCollection hook which was messing up submission collection
 - FIO-1377: limiting the number of projects on the api server for an offline license
 - FIO-922: Google Analytics doesn't apply for deployed
 - FIO-1442: Fixes an issue when export license file from new license resource it didn't export the license users.
 - FIO-2563: Role Assignment Action not working
 - Fixed an issue where project config is not available in builder mode when the user is not an admin or project owner…
 - FOR-3302: Allow project settings to be read with an API Key.
 - CRM actions fix 7.x
 - Fixing the CSP settings to use the correct domains.
 - FIO-2921: Ensuring that a misconnection with the license server allows both the PDF server and API Server to continue to function
 - FIO-3435: form definition downloading according query parameter
 - FIO-885: database error handling
 - FIO-3584: invitation pending status issue fix
 - FOR:-2852: Implements a restriction for TLS/SSL to DB connection for the dev license
 - FIO-3624: fixed problem on sending get request to /token endpoint using x-token header
 - fixed remote token issue
 - FIO-3644: Fixed issue where binding to port 80 gives error.

### Added
 - FIO-1398: Implements Submission Server Licensing
 - FIO-1038: limiting default email usage provider
 - FIO-3555, FIO-1538: Implements Two-Factor Authentication
 - FIO-3131: Implements Google Drive as a storage
 - FIO-3575: added CORS restrictions for dev license
 - Allow self-signed certs for pdf download

## 7.2.0-rc.2
### Added
 - Adding expiring action items.
 - FIO-889 and FIO-1368: Implements the CSP, Strict-Transport-Security and Referrer Policy. Implements the portal-check endpoint for CORS policy.
 - Made the health endpoint for ECB

### Fixed
 - FIO-1140: Fixes an issue where server adds formRevision property to the nested form

### Changed
 - Upgrade portal@7.3.0-rc.3
 - Upgrade formiojs@4.13.0-rc.10

## 7.1.8-rc.1
### Fixed
 - Increase max space size
 - Upgrade formio@2.2.4-rc.1
 - Upgrade formiojs@4.14.0-rc.18

## 7.1.7
### Changed
 - Upgrade formio@2.2.3
 - Upgrade portal@7.2.5

## 7.1.7-rc.11
### Changed
 - Upgrade formiojs@4.14.0-rc.17
 - Upgrade formio@2.2.3-rc.11
 - Upgrade portal@7.2.5-rc.8

## 7.1.7-rc.10
### Fixed
 - FIO-3441: resolve vulnerabilities
 - FIO-3259: Close ldap connection to resolve ldap auth crashes.

### Changed
 - Upgrade formiojs@4.14.0-rc.16
 - Upgrade formio@2.2.3-rc.10
 - Upgrade twilio@3.66.1, aws-sdk@2.959.0, javascript-obfuscator@2.18.1, eslint@7.32.0

## 7.1.7-rc.9
### Changed
 - Upgrade portal@7.2.5-rc.7

## 7.1.7-rc.8
### Changed
 - FIO-3099: Refactored the oAuth M2M token implementation and wrote tests for it

## 7.1.7-rc.7
### Fixed
 - FIO-3116: Fixes an issue files inside containers and editgrids weren't attaching to an email.
 - FIO-1566: add support for global pdf headers and footers

### Changed
 - Upgrade portal@7.2.5-rc.5
 - Upgrade formio@2.2.3-rc.9
 - Upgrade jose@3.14.3, aws-sdk@2.952.0, crypto-js@4.1.1, javascript-obfuscator@2.17.0

## 7.1.7-rc.5
### Changed
 - Upgrade portal@7.2.5-rc.4
 - Upgrade formio@2.2.3-rc.8
 - Upgrade formiojs@4.14.0-rc.15
 - Upgrade premium@1.16.4-rc.1

## 7.1.7-rc.4
### Changed
 - Upgrade portal@7.2.5-rc.3
 - Upgrade formio@2.2.3-rc.6
 - Upgrade formiojs@4.14.0-rc.14
 - Upgrade formio-workers@1.14.16

### Fixed
 - Fixing problem where project apis will fail if license is invalid.
 - FIO-3441: resolve vulnerabilities
 - FIO-2557: Use standard method of getting the Base URL for a deployment.
 - FIO-2885: Implements a non-root user for docker container
 - FIO-3259: Adding tests for proper LDAP login functionality
 - FIO-3370: Fixed OAuth Register and Login crashes, and also resolved owner issue with remote auth.
 - FIO-1371: fix issue with failing offline license and jose version update

## 7.1.7-rc.3
### Changed
 - Upgrade portal@7.2.5-rc.2

## 7.1.7-rc.2
### Fixed
 - Fixed typeo in portal initialization code.

## 7.1.7-rc.1
### Changed
 - FIO-3099: Implements oAuth2 Machine to Machine and OAUTH_M2M_ENABLED variable to turn on it. Adds variety for idPath in openId.
 - Upgrade formio@2.2.3-rc.1
 - Upgrade portal@7.2.5-rc.1

## 7.1.6-rc.2
### Fixed
 - FIO-3223: Fixes an issue with out of memory
 - Fixes issues with crashes occuring in the error handler.
 - FIO-2675: Fix wrong host and token fail on pdf submission with image

### Changed
 - Upgrade formio@2.2.2-rc.2
 - Upgrade formio-workers@1.14.15

## 7.1.6-rc.1
### Changed
 - FIO-3212: Fixing the OpenID access token for Active Directory.
 - FIO-3081: "The user aborted a request" issue
 - FIO-2914: Allow custom component validation to work on API Server
 - FIO-3040: Fixes an issue when wasn't handle the Webhook error and respond instead of spinning forever.
 - FIO-3095: Fixes an issue with an abusing in-built functionality leading to complete victim account takeover.
 - Upgrade premium@1.16.3-rc.1

## 7.1.5
### Changes
 - No changes. Released 7.1.5-rc.1 as official release.

## 7.1.5-rc.1
### Fixed
 - FIO-3006: API | JavaScript heap out of memory
 - FIO-2989: Fixes an issue when for the oAuth redirect URI as host that trigger conflicts with OpenID

## 7.1.4
### Changed
 - Upgrade portal@7.2.3
 - Upgrade formio@2.2.1
 - Upgrade premium@1.16.2

## 7.1.4-rc.4
### Changed
 - Upgrade portal@7.2.3-rc.4

## 7.1.4-rc.3
### Changed
 - Upgrade portal@7.2.3-rc.3

## 7.1.4-rc.2
### Fixed
 - Allow the minio port to be set in SSL mode.
 - FIO-2672: added hook for database update (update all emails to be lower case)

### Changed
 - Upgrade formiojs@4.14.0-rc.6
 - Upgrade formio@2.2.1-rc.2

## 7.1.4-rc.1
### Fixed
 - FIO-2924: Fixes an issue when the server was crashing while changing a password using a remote. And fixes an issue when got Unauthorized using a server without primary project.
 - FIO-2846: Fixes an issue when got an error "Cannot read property '_id' of null" and the server was crashing while trying to create a form with revisions using x-admin-key.
 - FIO-2823: Fixes an issue where a custom mongodb collection on a resource breaks the resource and the submission data cannot be accessed

### Changed
 - Upgrade formio@2.2.1-rc.1

## 7.1.3
### Changed
 - Upgrade portal@7.2.2
 - Upgrade formiojs@4.13.1
 - Upgrade premium@1.16.1

## 7.1.3-rc.8
### Changed
 - Upgrade portal@7.2.2-rc.7
 - FIO-2788: Oauth add Callback URL optional field

## 7.1.3-rc.7
### Changed
 - Upgrade portal@7.2.2-rc.6
 - Upgrade premium@1.16.1-rc.5

## 7.1.3-rc.6
### Changed
 - Upgrade portal@7.2.2-rc.5
 - Upgrade formiojs@4.13.1-rc.6
 - Upgrade premium@1.16.1-rc.4

### Fixed
 - FIO-2672: creation index field issue fix
 - FIO-2832: Fixing OpenID Connect to work with non-standard token paths.

## 7.1.3-rc.5
### Changed
 - Upgrade portal@7.2.2-rc.4
 - Upgrade formiojs@4.13.1-rc.6

## 7.1.3-rc.4
### Changed
 - Upgrade portal@7.2.2-rc.3
 - Upgrade formiojs@4.13.1-rc.5
 - Upgrade premium@1.16.1-rc.2

## 7.1.3-rc.3
### Fixed
 - FIO-2790: Fixing issues with SAML team authentication.

### Changed
 - Upgrade portal@7.2.2-rc.2

## 7.1.3-rc.2
### Fixed
 - FIO-2623, FIO-2605: Fixing anomalies with the x-token project API keys.

## 7.1.3-rc.1
### Changed
 - Upgrade portal @ 7.2.2-rc.2
 - Upgrade formiojs@4.13.1-rc.2
 - Upgrade premium@1.16.1-rc.1

### Changed
 - FIO-977: Allow x-token to be used to download pdfs.
 - FIO-2761: Fixes an issue when a user was created by an admin on the freshly deployed portal, he couldn't edit his profile.
 - FIO 2459: Increase timeout for PDF server response

## 7.1.2
### Changed
 - Official release of 7.1.2-rc.4

## 7.1.2-rc.4
### Fixed
 - FIO-2623, FIO-2605: Fixing anomalies with the x-token project API keys.

## 7.1.2-rc.3
### Changed
 - Downgrade portal to 7.2.1-rc.1

## 7.1.2-rc.2
### Changed
 - Upgrade formio@v2.2.0-rc.2

## 7.1.2-rc.1
### Changed
 - FIO-2484: Implements tests for Split Role
 - Upgrade formiojs@4.13.1-rc.1
 - Upgrade portal@7.2.2-rc.1

## 7.1.1
### Changed
 - Upgrade formio@2.1.1

## 7.1.1-rc.2
### Chagned
 - Upgrade formio@2.1.1-rc.2

### Fixed
 - Changed update hook to add try/catch around expiring index creation.

## 7.1.0
### Changed
 - Upgrade formiojs@4.13.0
 - Upgrade formio@2.1.0
 - Upgrade portal@7.2.0
 - Upgrade premium@1.16.0

## 7.1.0-rc.18
### Fixed
 - FIO-1452: added decoding of the authorization code

### Changed
 - Upgrade formiojs@4.13.0-rc.29
 - Upgrade portal@7.2.0-rc.16

## 7.1.0-rc.17
### Changed
 - Upgrade portal@7.2.0-rc.15

## 7.1.0-rc.16
### Changed
 - Upgrade portal@7.2.0-rc.14
 - Upgrade formiojs@4.13.0-rc.28
 - Upgrade premium@1.16.0-rc.11

## 7.1.0-rc.15
### Changed
 - Upgrade portal@7.2.0-rc.13
 - Upgrade formiojs@4.13.0-rc.27
 - Upgrade premium@1.16.0-rc.10
 - Upgrade formio@2.1.0-rc.18

## 7.1.0-rc.14
### Changed
 - Upgrade portal@7.2.0-rc.12
 - Upgrade formiojs@4.13.0-rc.26
 - Upgrade premium@1.16.0-rc.9
 - Upgrade formio@2.1.0-rc.17
 - Upgrade resourcejs@2.3.4

## 7.1.0-rc.13
### Fixed
 - FIO-2652 livestage => stage
 - FIO-1365: Fixes Authoring stage issues for master
 - FIO-1439: increased max body size
 - FIO-1536: Allow endpoint on API server to provide submission JSON to generate PDF
 - FIO-1565: Server | Form Manager | Revisions | Making changes to a Form with Revisions enabled the user is displayed as "anonymous". Want to show email of the user from FMG that made the change.
 - FIO-1497: Fixes an issue when stages were loaded with disabled utilization and were limited by 10
## Changed
 - Upgrade portal@7.2.0-rc.11
 - Upgrade formiojs@4.13.0-rc.25
 - Upgrade premium@1.16.0-rc.8
 - Upgrade formio@2.1.0-rc.16

## 7.1.0-rc.12
### Changed
 - Upgrade portal@7.2.0-rc.10

## 7.1.0-rc.11
### Changed
 - Upgrade formiojs@4.13.0-rc.24
 - Upgrade portal@7.2.0-rc.9

## 7.1.0-rc.10
### Changed
 - Upgrade formiojs@4.13.0-rc.23
 - Upgrade premium@1.16.0-rc.6
 - Upgrade formio@2.1.0-rc.15
 - Upgrade portal@7.2.0-rc.8

### Fixed
 - FIO-1546: clear license key typing issue fix
 - FIO-153: Fixes an issue where "revision" is added to Nested Forms when update a Parent form
 - FIO-2512-2518: Fixes security issues with the base image
 - FIO-2459: Increase timeout for PDF-server response
 - FIO-644: Fix pdf uploading with team_write permissions

## 7.1.0-rc.9
### Changed
 - Upgrade formiojs@4.13.0-rc.22
 - Upgrade portal@7.2.0-rc.7

## 7.1.0-rc.8
### Changed
 - Upgrade formiojs@4.13.0-rc.20
 - Upgrade portal@7.2.0-rc.6
 - Upgrade formio@2.1.0-rc.14
 - Upgrade premium@1.16.0-rc.4

## 7.1.0-rc.7
### Changed
 - Upgrade formiojs@4.13.0-rc.19
 - Upgrade portal@7.2.0-rc.5
 - Upgrade formio@2.1.0-rc.13
 - Upgrade premium@1.16.0-rc.3

## 7.1.0-rc.6
### Changed
 - cloneDeep the vm sandbox.
 - Upgrade formio@2.1.0-rc.10
 - Upgrade formio-workers@1.14.13

## 7.1.0-rc.5
### Fixed
 - FIO-1277: Fixing the evaluations to use vm2 to add more security.
 - Upgrade formio@2.1.0-rc.8

## 7.1.0-rc.4
### Fixed
 - Upgrade formiojs@4.13.0-rc.11
 - Upgrade portal@7.2.0-rc.4
 - Upgrade formio@2.1.0-rc.8

## 7.1.0-rc.3
### Fixed
 - Fixing issues where logging into some users would cause "Unauthorized" to show.

### Changed
 - FIO-1026: When creating a new stage or tenant, allow selecting which stage to copy from (instead of only live).

## 7.1.0-rc.2
>>>>>>> origin/7.1.x
### Added
 - FOR-2866: added hook for getting proper mongo collection
 - FIO-1196: Added SQLConector2 support.
 - FIO-841: Implements the Dev License.

### Fixed
 - FIO-1246: fix server fail after submitting an editted password field value
 - FIO-1282: Fixes an issue when the server was crashing if doesn't reach manager index.html
 - FOR-2709: Makes changing 'tags', 'controller', 'properties' and 'settings' form's properties cause creating a new revision if allowed
 - FIO-1138: Fixed possibility to update teams in protected mode.
 - FIO-128: Fix saving custom properties in form revision.
 - FOR-2763: Changed the default template for creating new projects that include the only Administrator for Read All
 - FIO-1026: When creating a new stage or tenant, allow selecting which stage to copy from (instead of only live).

### Changed
 - FIO-920: Adding email support for Teams.

### Fixed
 - FIO-1282: Fixes an issue when the server was crashing if doesn't reach manager index.html
 - FOR-2709: Makes changing 'tags', 'controller', 'properties' and 'settings' form's properties cause creating a new revision if allowed
 - FIO-1138: Fixed possibility to update teams in protected mode.
 - FIO-128: Fix saving custom properties in form revision.
 - FOR-2763: Changed the default template for creating new projects that include the only Administrator for Read All.

### Changed
 - FIO-920: Adding email support for Teams.
 - Upgrade formio@2.0.0-rc.43
 - Upgrade javascript-obfuscator@2.10.3, mongodb@3.6.4, passport-saml@2.0.5, twilio@3.55.1, sinon@9.2.4, aws-sdk@2.834.0, eslint@7.19.0

### Changed
 - Upgrade formiojs@4.12.7-rc.2
 - Upgrade portal@7.2.0-rc.2
 - Upgrade premium@1.15.4-rc.3

## 7.1.0-rc.1
### Fixed
 - FIO-1000: Fix an error for import with empty template

### Changed
 - Upgrade portal@7.2.0-rc.1

## 7.0.0-rc.68
### Changed
 - Upgrade formiojs@4.13.0-rc.6
 - Upgrade portal@7.1.17-rc.40
 - Upgrade resourcejs@2.3.3, formio@2.0.0-rc.39, formio-workers@1.14.10, aws-sdk@2.824.0

## 7.0.0-rc.67
### Fixed
 - FIO-1060: Added caching for project utilization to prevent blocking middlewares execution.
 - FIO-949: Stage Project Request Issues
 - FOR-2785: Form utilizations were not created until you edit form
 - FOR-2863: Stages are not deleted after deleting a project
### Changed
 - Upgrade formio@2.0.0-rc.38
 - Upgrade portal@7.1.17-rc.39
 - Upgrade @formio/premium@1.15.3-rc.2
 - Upgrade formiojs@4.13.0-rc.5

## 7.0.0-rc.66
### Fixed
 - FIO-785: Fixes creation a new stage/tenant in the utilization.
 - Fixing a crash that could occur in group role assignments.
 - Upgrade build process and saml dependencies.

### Changed
 - Upgrade formio@2.0.0-rc.37
 - Upgrade minio@7.0.18, uuid@8.3.2, sinon@9.2.2, aws-sdk@2.820.0, helmet@4.3.1, javascript-obfuscator@2.10.1, passport-saml-metadata@2.4.0, twilio@3.54.1,
eslint@7.17.0, passport-saml@2.0.2

## 7.0.0-rc.65
### Changed
 - Upgrade portal@7.1.17-rc.38

## 7.0.0-rc.64
### Changed
 - Upgrade portal@7.1.17-rc.37

## 7.0.0-rc.63
#### Changed
 - Upgrade portal@7.1.17-rc.36
 - Upgrade @formio/premium@1.15.3
 - Upgrade formiojs@4.12.4

## 7.0.0-rc.62
### Fixed
 - Issue where the server would crash if project=null was provided when saving the project settings.
 - Issue where the public project configurations would not get passed to formview pro and formmanager
 - FOR-2868: Adds the rejectUnauthorized flag to license utilization requests.
 - FOR-2889: Everyone role is not saved on Access page
 - FIO-975: Added possibility to configure server config log.

### Changed
 - Upgrade portal@7.1.17-rc.35
 - Upgrade formio@2.0.0-rc.36

## 7.0.0-rc.61
### Changed
 - Upgrade portal@7.1.17-rc.33
 - Changed application variables.

## 7.0.0-rc.60
### Changed
 - FOR-2862: Rewrote Docker files from node:14-alpine3.12 to alpine:latest. Solved an issue with nghttp2 v1.40

## 7.0.0-rc.59
### Changed
 - Upgrade portal@7.1.17-rc.32
 - Upgrade formiojs@4.12.2
 - Upgrade premium@1.15.2
 - Upgrade formio@2.0.0-rc.35
 - Upgrade semver@7.3.4, aws-sdk@2.804.0, twilio@3.53.0, eslint@7.15.0

### Fixed
 - FOR-2862: Updates the nghttp2 package. Updates alpine to v3.12 and node.js to v14.15
 - Optimizing queries for performance improvements with Report API + action items.

## 7.0.0-rc.58
### Changed
 - Upgrade portal@7.1.17-rc.31
 - Upgrade formiojs@4.12.2-rc.8
 - Upgrade premium@1.15.2-rc.4

## 7.0.0-rc.57
### Changed
 - Upgrade portal@7.1.17-rc.30
 - Upgrade formiojs@4.12.2-rc.6
 - Upgrade premium@1.15.2-rc.3

## 7.0.0-rc.56
### Added
 - FOR-2851: Adds an environment ID in the status endpoint

### Changed

## 7.0.0-rc.55
### Changed
 - Upgrade formio@2.0.0-rc.33
 - Upgrade portal@7.1.17-rc.28
 - Upgrade formiojs@4.12.2-rc.3
 - Upgrade premium@1.15.2-rc.1
### Fixed
 - Issues where SAML authentication would fail due to undefined method.
 - PDF download issue where local pdf-server to enterprise server would not make connection.
 - FOR-2819: PDF Download not calculating on Project Limits on Tenants and Stages
 - FOR-2830: Fixed issue when headers is undefined in sql connector action.
 - FOR-2760: Check settings before using pdfserver configurations.

### Changed
 - Upgrade formio@2.0.0-rc.32, formiojs@4.12.2-rc.3

## 7.0.0-rc.54
### Fixed
 - FOR-2840: Removed possibility to create a stage version and import project template with team write permission.
 - NFP-4: Require validations are not present

## 7.0.0-rc.53
### Fixed
 - FOR-2820: Stage Versions not showing up after you hit deploy button
 - FOR-2850: Restore old JSON response parsing mode of simple-oauth2

### Changed
 - Upgrade portal@7.1.17-rc.27
 - Upgrade formiojs@4.12.1
 - Upgrade premium@1.15.1
 - Upgrade formio@2.0.0-rc.31

## 7.0.0-rc.52
### Changed
 - Upgrade portal@7.1.17-rc.26
 - Upgrade formiojs@4.12.1-rc.28
 - Upgrade premium@1.15.1-rc.16

## 7.0.0-rc.51
### Fixed
 - Fixed an issue where server respond with InvalidAlias when updating submission of the NestedForm with revision number specified
 - FJS-1336, FJS-1337, FJS-1422: Adds a hook which adds premium components to Formio instance

### Changed
 - Upgrade formio@2.0.0-rc.30
 - Upgrade portal@7.1.17-rc.25
 - Upgrade formiojs@4.12.1-rc.27
 - Upgrade premium@1.15.1-rc.15

## 7.0.0-rc.50
### Changed
 - Upgrade formio@2.0.0-rc.28
 - Upgrade portal@7.1.17-rc.23
 - Upgrade formiojs@4.12.1-rc.24
 - Upgrade premium@1.15.1-rc.13

## 7.0.0-rc.49
### Changed
 - Upgrade formio@2.0.0-rc.27
 - Upgrade portal@7.1.17-rc.22
 - Upgrade formiojs@4.12.1-rc.23
 - Upgrade premium@1.15.1-rc.12

## 7.0.0-rc.48
### Fixed
 - FOR-2781: fixed an issue where validation is not triggered for password reset
 - FOR-2829: (SRF) Webhook action: Displays “externalId is not defined”
 - FOR-2797: Add remote token middleware for pdf requests
 - FOR-2796: Fix Not Found issue
 - FOR-2817/2818: Fixes an issue when you were able create a form, submissions etc. on the disabled tenant. And there is wasn't any notification that tenant is disabled. Also, fixed tests for this fix.

### Changed
 - Upgrade formio@2.0.0-rc.25
 - Upgrade portal@7.1.17-rc.21
 - Upgrade formiojs@4.12.1-rc.19
 - Upgrade premium@1.15.1-rc.11

## 7.0.0-rc.47
### Fixed
 - FJS-1337: Fixes an issue where multiple validation fails for DataSource
### Changed
 - Upgrade portal@7.1.17-rc.20
 - Upgrade formiojs@4.12.1-rc.16
 - Upgrade premium@1.15.1-rc.9

### Changed
 - Upgrade formio@2.0.0-rc.24
 - Upgrade base image to use Node 14
 - Upgrade aws-sdk@2.774.0, twilio@3.50.0, webpack-obfuscator@2.6.0, eslint@7.11.0, mocha@8.2.0

## 7.0.0-rc.46
### Fixed
 - Don't disable the primary project when moving it to a remote environment.

### Changed
 - Upgrade portal@7.1.17-rc.19
 - Upgrade formiojs@4.12.1-rc.14
 - Upgrade premium@1.15.1-rc.8

## 7.0.0-rc.44
### Fixed
 - FOR-2781: fixed an issue where validation is not triggered when resetting password.

### Changed
 - Upgrade portal@7.1.17-rc.18
 - Upgrade formiojs@4.12.1-rc.12

## 7.0.0-rc.43
### Changed
 - Added vpat and sac support for apps.
 - Set admin permissions in apiKey middleware if project owner does not exist.
 - Upgrade portal@7.1.17-rc.17
 - Upgrade formiojs@4.12.1-rc.10
 - Upgrade premium@1.15.1-rc.7

### Changed
 - Now using Alpine 3.12 base image.

## 7.0.0-rc.43
### Changed
 - Upgrade portal@7.1.17-rc.14
 -Upgrade formiojs@4.12.1-rc.9

## 7.0.0-rc.42
### Changed
 - Upgrade portal@7.1.17-rc.13
 -Upgrade formiojs@4.12.1-rc.8
### Changed
 - Added tpro3 payments

## 7.0.0-rc.41
### Changed
 - Upgrade portal@7.1.17-rc.12
 -Upgrade formiojs@4.12.1-rc.7

## 7.0.0-rc.40
### Fixed
 - Added an email attachment fallback to use url attachments when it works.

### Changed
 - Change the number of submission requests per month to 1000000 from 2000000
 - Upgrade formio@2.0.0-rc.21
 - Upgrade formiojs@4.12.1-rc.7

## 7.0.0-rc.39
### Changed
 - Upgrade portal@7.1.17-rc.11
 -Upgrade formiojs@4.12.1-rc.5

## 7.0.0-rc.39
### Changed
 - Upgrade portal@7.1.17-rc.11
 -Upgrade formiojs@4.12.1-rc.5

## 7.0.0-rc.39
### Changed
 - Upgrade portal@7.1.17-rc.11
 -Upgrade formiojs@4.12.1-rc.5

## 7.0.0
### Added
 - User Sessions
 - Isomorphic Validation
 - Audit logging
 - New Licensing system
 - Stage Types (Authoring and Live)
 - Group Roles and improvements to Group Assignment handling.

### Changed
 - Removed request.js and restler and replaced with node-fetch

### Removed
 - Method Override header functionality
 - Jira Action
 - Hubspot Action
 - Office365 Actions
 - Facebook, LinkedIn, Twitter, Dropbox OAuth providers

## 7.0.0-rc.38
### Fixed
 - FOR-2771: Fixed issue where calculated values (with allowOverride) would get overridden on the server.

### Changed
 - Upgrade formio@2.0.0-rc.20

## 7.0.0-rc.37
### Changed
 - Upgrade formio@2.0.0-rc.19

## 7.0.0-rc.36
### Changed
 - Fix Current endpoint token exchange to work with sessions.
 - Upgrade formiojs@4.12.1-rc.4
 - Upgrade formio@2.0.0-rc.18

## 7.0.0-rc.35
### Fixed
 - FOR-2757: Added a correct header for Authorization to sql-connector.
 - Upgrade formiojs@4.12.1-rc.2 to resolve issue with losing data in form submission.

## 7.0.0-rc.34
### Fixed
 - FOR-2717: Fixes an issue where SAML roles received like a string and have just one role that contains more than one word was being split each word to a special role.
 - Fix indexes so cosmos works.
 - Upgrade formio@2.0.0-rc.15
 - Upgrade simple-oauth2 to latest major version.
 - FOR-2722: Fixes an issue where Webhook Delete is not firing and not populating request with the submission data
 - Work on stages: Enable to rename Live stage, Added 2 default stages. PR for Master

### Changed
 - Upgraded helmet@4.1.1, mongodb@3.6.2, passport-saml@1.3.5, resourcejs@2.3.2, twilio@3.49.3, webpack@4.44.2, copy-webpack-plugin@6.1.1, @formio/premium@1.15.0, aws-sdk@2.759.0, debug@4.2.0, moment@2.29.0, webpack-obfuscator@2.3.1, eslint@7.9.0, jose@2.0.2

## 7.0.0-rc.32
### Changed
 - Upgrade portal@7.1.17-rc.9
 - Upgrade formio.js@4.12.0-rc.16

## 7.0.0-rc.31
### Changed
 - Upgrade formio@2.0.0-rc.14
 - Upgrade portal@7.1.17-rc.7

## 7.0.0-rc.28
### Fixed
 - Issue where portal was not accessible due to Helmet upgrade.

## 7.0.0-rc.27
### Changed
 - Upgrade portal@7.1.17-rc.4

## 7.0.0-rc.26
### Changed
 - Upgrade formio@2.0.0-rc.13

## 7.0.0-rc.25
### Fixed
 - Attach as PDF to work inline without the need for Save Submission.

## 7.0.0-rc.19
### Added
 - Feat: allowed admins pass "noValidate" flag when they create submissions

### Fixed
 - Fixes an issue related to externalIds in Webhooks.
 - FOR-2727: Change the message to upgrade
 - FOR-2699: added storageAccessHanler in init script

### Changed
 - Upgrade formio@2.0.0-rc.10
 - Upgrade formiojs@4.12.0-rc.7

## 6.10.8-rc.4
### Changed
 - Upgrade portal@7.0.38-rc.6
 - Upgrade formiojs@4.11.1-rc.6

## 6.10.8-rc.3
### Changed
 - Upgrade portal@7.0.38-rc.5

## 6.10.8-rc.2
### Changed
 - Upgrade portal@7.0.38-rc.4
 - Upgrade formiojs@4.11.1-rc.5

### Fixed
 - Passing project to pdf server to solve image displays.

## 6.10.8-rc.1
## 6.10.7-rc.2
### Changed
 - Upgrade portal@7.0.38-rc.2
 - Upgrade formiojs@4.11.1-rc.3

## 6.10.7-rc.1
### Changed
 - Upgrade portal@7.0.38-rc.1
 - Upgrade formiojs@4.11.1-rc.1

## 6.10.7
### Changed
 - Upgrade formio to 1.90.5 to fix mongo ssl connections.

## 6.10.6
### Changed
 - Upgrade formio to 1.90.2 to fix email crash on large emails.

## 6.10.5
### Changed
 - Upgrade formio to 1.90.1 to upgrade resourcejs to 2.3.1 to fix issue with limit and sort.

## 6.10.4
### No changes: Official build

## 6.10.4-rc.2
### Changed
 - Upgrade portal@7.0.36-rc.2
 - Upgrade formiojs@4.11.0-rc.4

## 6.10.4-rc.1
### Changed
 - Upgrade dependencies
 - Upgrade portal@7.0.36-rc.1
 - Upgrade formiojs@4.11.0-rc.2
 - Upgrade formio@1.90.0

### Fixed
 - FOR-2682: Fixes an issue where x-jwt-token from SAML was too big
 - fix: added next function calls

## 6.10.3
### Changed
 - Upgrade portal@7.0.35

## 6.10.2
### Changed
 - Upgrade formiojs@4.10.5
 - Upgrade portal@7.0.34

## 6.10.2-rc.7
### Changed
 - Upgrade portal@7.0.33

## 6.10.2-rc.6
### Changed
 - Upgrade portal@7.0.32

## 6.10.2-rc.5
### Changed
 - Upgrade portal@7.0.31

## 6.10.2-rc.4
### Changed
 - Upgrade portal@7.0.30

## 6.10.2-rc.3
### Changed
 - Upgrade portal@7.0.29

## 6.10.2-rc.2
### Changed
 - Upgrade formiojs@4.10.5-rc.4
 - Upgrade portal@7.0.28

## 6.10.2-rc.1
### Changed
 - Upgrade formiojs@4.10.5-rc.3
 - Upgrade portal@7.0.27

## 6.10.1-rc.6
### Changed
 - Upgrade formiojs@4.10.3
 - Upgrade portal@7.0.26
 - Upgrade formio@1.87.0
 - Upgrade mongodb@3.5.9, aws-sdk@2.701.0, helmet@3.23.1, moment@2.27.0, twilio@3.46.0

### Fixed
 - Removed default value for form controller.
 - FOR-2689: Fixed performance issue by changing aggregate to findOne
 - PDF 14 - Allow PDF Submission endpoint to be retrieved by 'Form Alias'

## 6.10.1-rc.5
### Changed
 - Upgrade formiojs@4.10.3-rc.5
 - Upgrade portal@7.0.23
 - Upgrade formio@1.86.0

## 6.10.1-rc.4
### Changed
 - Upgrade portal@7.0.22
 - Upgrade formiojs@4.10.3-rc.4

## 6.10.1-rc.3
### Changed
 - Upgrade portal@7.0.21
 - Upgrade formiojs@4.10.3-rc.3

## 6.10.1-rc.1
### Changed
 - Upgrade portal@7.0.20
 - Upgrade formiojs@4.10.3-rc.1

## 6.10.0
### Changed
 - Upgrade portal@7.0.19
 - Upgrade formiojs@4.10.0

## 6.10.0-rc.10
### Changed
 - Upgrade portal@7.0.16
 - Upgrade formiojs@4.10.0-rc.13

## 6.10.0-rc.9
### Changed
 - Upgrade portal@7.0.15
 - Upgrade formiojs@4.10.0-rc.12

### Fixed
 - Fixed resetting project path on PUT request without name.

## 6.10.0-rc.8
### Changed
 - Upgrade portal@7.0.14
 - Upgrade formio@1.85.0
 - Upgrade formio-workers@1.14.8
 - Generate form revision on import if revisions are enabled.

### Fixed
 - FOR-2683: Fix (Payment): converted expMonth and expDate to String before concatenation
 - Fixed issues with group permission errors not being proper English.

## 6.10.0-rc.7
### Changed
 - Upgrade portal@7.0.13

## 6.10.0-rc.6
### Changed
 - Upgrade formio@1.83.0

### Fixed
 - FOR-2665: Ensure calculate value eval context

## 6.10.0-rc.5
### Fixed
 - FJS-888 Unauthorized error when getting spec.json

### Added
 - Added formSave hook on template import.

### Changed
 - Upgrade formio-app@7.0.12
 - Upgrade formiojs@4.10.0-rc.6
 - Upgrade formio-workers@1.14.7
 - Upgrade formio@1.82.0
 - Upgrade mongodb@3.5.8

## 6.10.0-rc.4
### Changed
 - Adding recommended indexes.
 - Add config options for mongo ssl
 - Upgrade portal@7.0.11
 - Upgrade  chance@1.1.6, formio-workers@1.14.6, twilio@3.43.1, aws-sdk@2.683.0, moment@2.26.0, mocha@7.2.0, webpack-obfuscator@0.28.2

## 6.10.0-rc.3
### Changed
 - Upgrade formio-app@7.0.6 to fix submission table issues.

## 6.10.0-rc.2
### Changed
 - Upgrade formio-app@7.0.5
 - Upgrade formiojs@4.10.0-beta.17
 - Upgrade chance@1.1.5, formio-workers@1.14.6, aws-sdk@2.675.0

### 6.10.0-beta.1
### Changed
 - Upgrade portal@7.0.10
 - Adding mongo SSL.

## 6.9.38
### Changed
 - None. Released 6.9.38-rc.1

## 6.9.38-rc.1
### Changed
 - Upgrade formio@1.84.0
 - Added version id check to formSave alter for template exports/imports.

## 6.9.37
### Changed
 - Upgrade portal@7.0.8-1

## 6.9.36
### Changed
 - Upgrade formio@1.83.0
 - Upgrade formio-workers@1.14.7

### Fixed
 - FOR-2665: Ensure calculate value eval context
 - FJS-911: Date/Time data in email is displaying two times

## 6.9.35
### Added
 - Ability to add additional fields in template export

### Fixed
 - Creating a form with revisions during import will create an initial revision.

## 6.9.34
### Changed
 - Upgrade portal@7.0.8
 - Upgrade formiojs@4.9.27-rc.4
 - Upgrade formmanager@1.93.1
 - Upgrade pro.formview.io@1.93.1

## 6.10.0-rc.2
### Changed
 - Upgrade portal@7.0.8-beta.1
 - Upgrade formio@1.79.0

## 6.10.0-rc.1
### Changed
 - Upgrade formio-app@7.0.4
 - Upgrade formiojs@4.10.0-beta.16

### Added
 - Added formDefaults property to project.

## 6.9.33
### Changed
 - Upgrade formio@1.78.0
 - Upgrade formio-workers@1.14.4
 - Upgrade minio@7.0.16, mongodb@3.5.7, mocha@7.1.2, aws-sdk@2.670.0, moment@2.25.3, twilio@3.43.0, webpack-obfuscator@0.28.0
 - Remove adding project role to owners since it isn't needed.

## 6.9.32
### Changed
 - Upgrade formio@1.76.0
 - Upgrade formio-workers@1.15.0

## 6.9.31
### Changed
 - Upgrade portal to 7.0.3
 - Upgrade formiojs@4.9.22

## 6.9.30
### Changed
 - Upgrade portal to 7.0.2
 - Upgrade formiojs@4.9.21
 - Upgrade formio-app@7.0.2

## 6.9.29
### Changed
 - Upgrade portal to 7.0.1

## 6.9.29-rc.5
 - Upgrade portal to 7.0.1-rc.4

## 6.9.29-rc.4
 - Upgrade portal to 7.0.1-rc.2

## 6.9.29-rc.3
### Fixed
 - Upgraded formio@1.75.0 to fix issues with loading subforms with revisions.

## 6.9.29-rc.2
### Fixed
 - Issue with subforms not loading properly when full=true is used and formrevisions enabled.

## 6.9.29-rc.1
### Changed
 - Upgrade portal to 7.0.1-rc.1

## 6.9.28
### Changed
 - Upgrade portal to 7.0.0

## 6.9.28.rc.5
### Changed
 - Upgrade portal to 7.0.0-rc.92

## 6.9.28-rc.4
### Changed
 - Upgrade portal to 7.0.0-rc.91

### Fixed
 - Aggregatiomn to use allowDisk so large queries can be completed.

## 6.9.28-rc.2
### Changed
 - Upgrade portal to 7.0.0-rc.89

## 6.9.28-rc.1
### Changed
 - Upgrade portal to 7.0.0-rc.88

## 6.9.27
### Changed
 - Upgrade portal to 7.0.0-rc.87
 - Add config to interpolation for datasource on server side.

## 6.9.26
 - No changes:

## 6.9.26-rc.4
### Fixed
 - The checkbox components to properly validate when configured as radio.

### Chanaged
 - Upgrade portal to 7.0.0-rc.86
 - Upgrade formiojs@4.9.13

## 6.9.26-rc.1
### Changed
 - Upgrade portal to 7.0.0-rc.85
 - Upgrade formiojs@4.9.12

### Fixed
 - Crash issues with Webhook action.
 - Ensure process runs as node user.

## 6.9.25
### Changed
 - Upgrade portal to 7.0.0-rc.84
 - Upgrade formiojs@4.9.10

## 6.9.24
### Changed
 - Upgrade portal to 7.0.0-rc.83
 - Upgrade formiojs@4.9.9

## 6.9.23
### Changed
 - Adding debug output for DataSource request headers.
 - Upgrade portal to 7.0.0-rc.82
 - Upgrade formiojs@4.9.8

## 6.9.22
### Fixed
 - Ensure the DataSource header values are interpolated.

## 6.9.21
### Fixed
 - Issue where DataSource was not populating before validations occur.
 - Ensure form is loaded with public configurations when interpolating data source component.
 - Problem with Validate endpoint where only admins could use it.
 - Issue where the datasource component would hang up the request if it failed.
 - Issues where datasource checks would fail for any SSL errors that would occur.

### Added
 - Debug messaging to the data source component.

## 6.9.20
### Changed
 - Upgrade portal to 7.0.0-rc.80
 - Upgrade formiojs@4.9.6
 - Upgrade aws-sdk@2.644.0

## 6.9.19
### Changed
 - Upgrade portal to 7.0.0-rc.79
 - Upgrade formiojs@4.9.5

## 6.9.18
### Changed
 - Upgrade portal to 7.0.0-rc.78
 - Upgrade formiojs@4.9.4

## 6.9.17
### Changed
 - Upgrade portal to 7.0.0-rc.77
 - Upgrade formiojs@4.9.3

## 6.9.16
### Changed
 - Upgrade portal to 7.0.0-rc.76
 - Upgrade formiojs@4.9.2

## 6.9.15
### Changed
 - UPgrade portal to 7.0.0-rc.74

## 6.9.14
### Changed
 - Upgrade portal to 7.0.0-rc.73

## 6.9.13
### Changed
 - Upgrade portal to 7.0.0-rc.72

### Fixed
 - Issues with encrypted fields not working when persistent flag isn't set on a component.
 - CSV download issues when DateTime components are added.

## 6.9.12
### Chnaged
 - Upgrade portal to 7.0.0-rc.71

## 6.9.11
### Changed
 - Upgrade portal to 7.0.0-rc.70

### Fixed
 - Validate endpoint to work with aliases
 - Adding config and modules to form revision endpoints.
 - Data Source component to always trigger when validate endpoint is called.

## 6.9.10
### Changed
 - Upgrade portal to 7.0.0-rc.68

## 6.9.7
### Changed
 - Fixed deployed portal to resolve Exising Resources
 - Fixed issue with deployed portal erasing spaces in TextAreas.

## 6.9.6
### Changed
 - Build process to change from pkg to alpine-node.

## 6.9.5
### Added
 - Validate endpoint for forms to allow them to perform a validation only against a form.

## 6.9.4
### Changed
 - Fixed deployed portal to work better in situations where "access" is granted to primary and "read" is granted to stage.
 - Upgrade formio@4.9.0-rc.2
 - Upgrade portal@7.0.0-rc.64

## 6.9.3
### Changed
 - Upgrade portal to fix form manager loading issues.

## 6.9.2
### Added
 - Ability to use tokens in the evaluation context.

## 6.9.1
### Fixed
 - Update hooks to work when no primary project is found.

## 6.9.0
### Fixed
 - Update hook to work with deployments where there isn't a primary project.

## 6.9.0-rc.2
### Fixed
 - Permissions issues with team resources.

### Changed
 - Upgrade portal to 7.0.0-rc.62

## 6.9.0-rc.1
### Fixed
 - Issues with leaving teams.

### Changed
 - Upgrade twilio@3.39.5, aws-sdk@2.623.0
 - Upgrade portal to 7.0.0-rc.61
 - Upgrade formiojs@4.9.0-rc.1

## 6.9.0-beta.7
### Fixed
 - Potential server crash issue.

## 6.9.0-beta.6
### Fixed
 - Deployment issue.

## 6.9.0-beta.5
### Changed
 - Upgrade portal to 7.0.0-rc.60
 - Upgrade formio.js@4.9.0-beta.8
 - Upgrade formio@1.67.0

### Fixed
 - Ensure all renderer evaluations occur within a vm.
 - Removed the Login and Register with Github buttons on base installations.
 - Always include project public configs in the project variable.

## 6.9.0-beta.4
### Changed
 - Upgrade portal to 7.0.0-rc.59

### Added
 - A way to provide global modules within projects.
 - A way to exclude access within template exports.

## 6.9.0-beta.3
### Changed
 - Upgrade portal to 7.0.0-rc.58
 - Upgrade formio@1.65.0

### Added
 - Added new endpont for the latest form revision
 - Action Logs access for team admins.
 - Added support for x-actions headers.

### Fixed
 - Skip action import if there is no corresponding form or resource.
 - Replaced all calls to Array.map with lodash to perform null checks.

## 6.9.0-beta.2
### Fixed
 - Team join updates
 - Crashes against the team resource.

## 6.9.0-beta.1
### Added
 - Team invite support.

### Changed
 - Upgrade portal to 7.0.0-rc.57
 - Upgrade major dependencies.
 - Fixed many deprecation warnings.
 - Upgrade formio/formio@1.64.0

## 6.8.0-rc.4
### Changed
 - Upgraded portal to 7.0.0-rc.56
 - Upgrade formio.js to 4.9.0-beta.4
 - Upgrade form view pro to 1.56.0
 - Upgrade form manager to 1.57.0

## 6.8.0-rc.3
### Changed
 - Upgraded portal to 7.0.0-rc.55
 - Upgrade formio.js to 4.9.0-beta.3

### Fixed
 - Adding options to have SSO teams without enabling Portal SSO.

## 6.8.0-rc.2
### Changed
 - Separated the SSO Teams function to be controlled by its own independent variables.
 - Upgraded twilio@3.39.4, aws-sdk@2.613.0, passport-saml@1.3.0
 - Now default REDIS_SERVICE to false unless they specify otherwise.

## 6.8.0-rc.1
### Changed
 - Upgrade portal to 7.0.0-rc.54
 - Upgrade formio.js to 4.8.0
 - Upgrade form view pro to 1.57.0
 - Upgrade form manager to 1.56.0
 - Upgrade tenant manager to 1.6.0

## 6.8.0-beta.26
### Changed
 - Upgrade Formio App to 7.0.0-rc.53
 - Upgrade formio.js to 4.8.0-rc.13

## 6.8.0-beta.25
### Changed
 - Upgrade Formio App to 7.0.0-rc.50
 - Upgrade formiojs@4.8.0-rc.9

## 6.8.0-beta.24
### Changed
 - Upgrade app to use formiojs@4.8.0-rc.3

### Fixed
 - FOR-2576: Jira connector basic auth change
 - FOR-2573: Added correct handling of tenant project plan.
 - Allow form settings to be loaded as part of revisions.

## 6.8.0-beta.23
### Changed
 - Revert back to node10-alpine to determine if it resolves connection issues with MongoDB.

## 6.8.0-beta.22
### Changed
 - Upgrade base image to node:12-alpine
 - Upgrade formio.js@4.8.0-rc.1
 - Upgrade formio/formio@1.63.0

### Fixed
 - Upgraded formio@1.63.0 which resolves CSV export issue with wizards.
 - Build issues where pkg@4.4.1 broke our server.
 - Fix datasource field action to work with new system.
 - Issue with Docker Secrets where it would fault on certain VM's due to accessing a directory outside the bounds of the container.

## 6.8.0-beta.21
### Changed
 - Upgrade formiojs@4.8.0-beta.9
 - Upgrade portal to 7.0.0-rc.44
 - Upgrade other dependencies.

## 6.8.0-beta.20
### Changed
 - Upgrade formiojs@4.7.7
 - Upgrade portal to 7.0.0-rc.38
 - Upgrade twilio@3.37.1, aws-sdk@2.571.0

## 6.8.0-beta.19
### Changed
 - Upgrade portal to 7.0.0-rc.37
 - Upgrade formiojs@4.7.6, mongodb@3.3.4, aws-sdk@2.570.0

## 6.8.0-beta.18
### Fixed
 - DateTime problem where dates are getting saved as January 1, 1970
 - Next portal IE issues.

### Added
 - Premium components

## 6.8.0-beta.17
### Changed
 - Upgrade formio-app@7.0.0-rc.34
 - Upgrade formio.js@4.7.3

## 6.8.0-beta.16
### Changed
 - Upgrade formio-app@7.0.0-rc.33

## 6.8.0-beta.15
### Added
 - Added filesServer to pdf upload response.

### Fixed
 - Fix/openid mapping

### Changed
 - Upgrade formio-app@7.0.0-rc.32
 - Upgrade formiojs@4.7.0
 - Upgrade aws-sdk@2.562.0, twilio@3.37.0

## 6.8.0-beta.14
### Changed
 - Upgrade formio-app@7.0.0-rc.31
 - Upgrade formiojs@4.6.2, aws-sdk@2.559.0, resourcejs@1.37.0, formio@1.60.6

## 6.8.0-beta.13
### Changed
 - Upgrade formio@1.60.5 which adds submission query filters to export endpoints.

## 6.8.0-beta.12
### Changed
 - Upgrade formio.js to 4.6.0
 - Upgrade portal to 7.0.0-rc.30
 - Add helmet.js for security header to hosted portal.

### Added
 - Add datasource request fetching.

## 6.8.0-beta.10
### Changed
 - Upgrade portal to 7.0.0-rc.28

## 6.8.0-beta.9
### Changed
 - Upgrade portal to 7.0.0-rc.27

## 6.8.0-beta.8
### Changes
 - Upgrade portal to 7.0.0-rc.26 with many fixes and updated core renderer.
 - Upgrade bluebird@3.7.1, mongodb@3.3.3, webpack@4.41.2, aws-sdk@2.552.0, formiojs@4.4.1, twilio@3.36.0

## 6.8.0-beta.7
### Fixes
 - Fixes stages per tenant.

### Changes
 - Added console that helps people disable REDIS.
 - Upgrade portal to version 7.0.0-rc.25. Fixes stages per tenant, upgrades formio.js@4.3.3
 - Upgrade Form Manager to v1.45.0 https://github.com/formio/formmanager/blob/master/CHANGELOG.md#1450

## 6.7.40
### Fixed
 - Fix saving payeezy requests to db.

## 6.7.39
### Fixed
 - Stricter limits on payeezy integration.

## 6.7.38
### Fixed
 - Crash when trying to log projects.

### Changed
 - Upgrade formio@1.63.11

## 6.7.37
### Fixed
 - Problem where un-linking files that do not exist could make server crash.

### Changed
 - Upgrade formio@1.63.10
 - Upgrade formiojs@4.8.1, twilio@3.39.3, aws-sdk@2.611.0

## 6.7.36
### Fixed
 - Issues with the email BCC and CC actions.

## 6.7.35
### Fixed
 - Validations for file components.

### Added
 - BCC and CC support for Email Actions.

### Changed
 - Upgrade aws-sdk@2.608.0, mongodb@3.5.2, uuid@3.4.0

## 6.7.34
### Fixed
 - Fix crash if a card is not returned from payeezy.

## 6.7.33
### Fixed
 - More fixes to error messages for payeezy gateway

## 6.7.32
### Fixed
 - Error messages from payeezy gateway
>>>>>>> f3b06243888e205aa1dc846f62ffab05c5f6696d

## 6.7.31
### Added
 - Form controller property.

## 6.7.30
### Fixed
 - Payeezy integration updated to latest API.

## 6.7.29
### Fixed
 - Issue where the cc checks would not reset after an hour.

## 6.7.28
### Fixed
 - Update to not crash if no project is found.

## 6.7.27
### Fixed
 - Hosted platform to not allow many cc auth checks.

## 6.7.25
### Fixed
 - FOR-2576: Jira connector basic auth change
 - FOR-2573: Added correct handling of tenant project plan.
 - Allow form settings to be loaded as part of revisions.

### Changed
 - Upgrade Portal to 6.8.7
 - Upgrade mongodb@3.4.1, webpack@4.41.4, aws-sdk@2.594.0, twilio@3.39.1

## 6.7.24
### Fixed
 - Swagger IO interfaces from not returning any elements.

## 6.7.23
### Changed
 - Upgrade formio@1.63.4.
 - Resolved issues with server crashing due to Swagger io calls.

## 6.7.22
### Changed
 - Reverted the sort by modified within CSV exports.

## 6.7.21
### Changed
 - Upgrade formio@1.63.2 to resolve CSV export issue with wizards.

## 6.7.20
### Fixed
 - Upgraded formio@1.63.0 which resolves CSV export issue with wizards.
 - Build issues where pkg@4.4.1 broke our server.

## 6.7.19
### Changed
 - Upgrade formio.js@4.8.0-rc.1
 - Upgrade formio/formio@1.62.0

### Fixed
 - Fix datasource field action to work with new system.
 - Issue with Docker Secrets where it would fault on certain VM's due to accessing a directory outside the bounds of the container.

## 6.7.18
### Added
 - Support for Docker Secrets.
 - Adding ability to forward headers with data source component.
 - Upgrade formio/formio@1.61.0

## 6.7.17
### Fixed
 - Adding ignoreTLS for SMTP configurations so that certain SMTP servers can be configured.

## 6.7.16
### Fixed
 - Fixed issue where empty DateTime fields are getting saved as January 1, 1970.

## 6.7.15
### Fixed
 - Issues with OpenID authentication.

### Changed
 - Upgrade formio@1.60.6
 - Upgrade request-promise-native@1.0.8, aws-sdk@2.564.0, formiojs@4.7.2, twilio@3.37.0

## 6.7.14
### Added
 - Added filesServer to pdf upload response.

### Fixed
 - Fixed OpenID attribute mapping.

## 6.7.13
### Added
 - Ability to use the submission filter queries when exporting submissions as CSV.

### Changed
 - Upgrade all minor dependencies.

## 6.7.12
### Added
 - Print instructions for disabling Redis if using default settings

## 6.7.11
### Changed
 - Upgrade portal to version 6.8.6. Fixes stages per tenant.
 - Upgrade Form Manager to v1.45.0 https://github.com/formio/formmanager/blob/master/CHANGELOG.md#1450

## 6.7.10
## Changed
 - Upgraded portal to version 6.8.5, which fixes project limit size.

## 6.7.9
### Changed
 - Upgraded portal to version 6.8.4, which introduces stages per tenant.
 - Upgraded simple-oauth2@2.5.1, mocha@6.2.1, aws-sdk@2.540.0, bluebird@3.7.0

## 6.7.8
### Added
 - Added possibility to specify authorization method for OpenID.

### Changed
 - Upgraded Deployed portal to 6.8.3
 - Upgraded Deployed Form Manager to 1.43.0
 - Upgraded Deployed Form View Pro to 1.42.0
 - Upgraded Deployed Tenant Manager to 1.3.0
 - Upgraded formio@1.60.1 to fix Email action crashing
 - Upgraded aws-sdk@2.537.0, webpack@4.41.0, adal-node@0.2.1

## 6.7.7
### Changed
 - Upgraded portal to 6.8.2 which upgrades form manager to 1.42.0

## 6.7.6
### Changed
 - Upgraded portal, which includes new formview pro, form manager, and tenant manager for deployed servers.
 - Upgraded formio/formio which includes batch email processing.
 - Upgraded formio/formio-workers to 1.14.0 which solves some email templating issues.

### Fixed
 - Crash with the Google Sheets action when using PATCH method.
 - Crash with the Login Action when no settings are provided to the action.

## 6.7.5
### Fixed
 - Fix issue where field logic value settings were forced to a string
 - FOR-2489: Added configurable access endpoints.
 - FOR-2500: Added empty subsubmission data check before updating.
 - FOR-2493: Fix issue with files in submission index endpoint when URL is undefined

## 6.7.4
### Added
 - Added configurable access endpoint configurations so that it can be turned off per-project or per-deployment.

### Changed
 - Upgraded aws-sdk@2.524.0, twilio@3.34.0

## 6.7.3
### Fixed
 - Issues with the query parameters for "null", "true", and "false" to allow the filtering of properties with these values.

## 6.7.0
### Changed
 - Upgrade formio to 1.50.0 which adds token schema and other bug fixes
 - Temp tokens now use mongo instead of redis.
 - Default to pdf format in pdf download.

## 6.6.4
### Fixed
 - Compile issues that would create an invalid utils object and was causing crashing.

## 6.6.3
### Changed
 - The configuration to add public configurations to form json schemas to be at the project level instead of per-form. This improves performance for projects without this feature.

## 6.6.2
### Changed
 - Updated formio to 1.49.0 https://github.com/formio/formio/blob/master/Changelog.md#1490
 - Updated dependencies.
 - Upgrade formio-app to 6.6.2 which includes includeConfig form configuration.
 - Adding "cdn", "alpha", and "gamma" to list of reserved project names.

## 6.6.0
### Changed
 - Update formio to 1.48.0

## Added
 - Upload proxy for pdfs.
 - Setting Azure ADFS default role.

## 6.5.29
### Fixed
 - Some minor issues with deployed portal relating to tenant manager application.

## 6.5.28
### Added
 - A way to set project types.

## 6.5.27
### Fixed
 - Issue where the Minio server was getting wrong configurations for local environments through proxies.

### Changed
 - Upgraded formiojs@3.22.9, jira-connector@2.14.1, aws-sdk@2.479.0, webpack@4.35.0

## 6.5.26
### Changed
 - Upgraded portal to 6.4.10 which fixes inline embed not containing project and base for deployed portals.

## 6.5.25
### Changed
 - Upgraded minio@7.0.10, aws-sdk@2.478.0, formiojs@3.22.8, jira-connector@2.14.0, squel@5.13.0, twilio@3.32.0, webpack@4.34.0
 - Upgraded deployed portal to 6.4.9

## 6.5.24
### Fixed
 - Problem where invalid SAML configurations could make the server crash.

### Changed
 - Upgraded mongodb@3.2.7, aws-sdk@2.471.0, jira-connector@2.13.0, webpack@4.33.0

## 6.5.23
### Added
 - Ability to configure SAML using passport settings.

## 6.5.22
### Fixed
 - Issue where the SAML relay was not adding the correct query separator.

## 6.5.21
### Changed
 - Upgraded portal, form manager, and formview pro.

## 6.5.20
### Fixed
 - Fix issue where fields were not getting decrypted for pdfs.

### Changed
 - Upgraded all dependencies.
 - Upgraded deployed portal to 6.4.6

## 6.5.19
### Changed
 - Upgraded formiojs@3.20.14, minio@7.0.8, mongodb@3.2.4, twilio@3.30.3, aws-sdk@2.455.0, formio@1.46.0, passport-saml@1.1.0, webpack@4.31.0

### Fixed
 - Project template exports to include the "properties" on each form component.
 - Problems with the PDF download which includes forms with nested form components assigned to specific form revisions.

## 6.5.18
### Added
 - A way to download a PDF with any form by providing a "?form=" query parameter.

### Changed
 - Upgraded deployed portal to 6.4.4
 - Always mount the form manager.

## 6.5.17
### Fixed
 - Problems with the project import with regard to project access controls.

## 6.5.16
### Fixed
 - Other issues around remote access not getting correct permissions to do operations within the projects.

## 6.5.15
### Fixed
 - Problem with connecting to remote environments giving 401 unauthorized issue.

## 6.5.13, 6.5.14
### Fixed
 - Issues with the Form Manager application.

## 6.5.12
### Added
 - Group self access support.
 - Form Manager access section.
 - Form Manager click-away protection.
 - Form Manager merge form support.
 - Portal SSO custom logout url.
 - Force SSO authentication for portal and form manager on page refresh.
 - Form View Pro offline mode support.

### Changed
 - Upgraded minio@7.0.7, twilio@3.30.2, aws-sdk@2.446.0, body-parser@1.19.0, formiojs@3.20.4

## 6.5.11
### Added
 - Nested forms on forms with revisions enabled will automatically update when a new version is published.

## 6.5.10
### Changed
 - Upgraded azure-storage@2.10.3, formiojs@3.19.9, minio@7.0.6, twilio@3.30.1, mocha@6.1.3, sinon@7.3.2, aws-sdk@2.439.0, webpack@4.30.0

### Adding
 - A docker-compose file.
 - A way for groups to have self-access features.

## 6.5.9
### Changed
 - version number change only.

## 6.5.8
### Changed
 - Update formio-services to fix possible reconnect from redis if redis is unavailable for longer than 5 seconds.

## 6.5.7
### Fixed
 - Possible crash when generating submission pdfs.

## 6.5.6
### Changed
 - update formio-services to 6.5.6 to enable redis debugging.

## 6.5.5
### Fixed
 - form ?full=true not loading form revisions correctly for sub forms.

### Added
 - context variable to email and webhook actions.

## 6.5.4
### Fixed
 - Possible crash in the "loadForms" method affecting subforms for pdf downloads and "full=true" flag.

## 6.5.3
### Fixed
 - Improving PDF performance with nested forms.
 - Fixing issues with the SAML SSO for teams, and also added debugging.
 - Fixing api keys to always work with deployed servers.

### Changed
 - Remove bcrypt rebuild since we are no longer using it.
 - Allowing the deletion of roles from a submission (but not adding)
 - Moving the owner setting to submission handler so it works on all submissions.
 - Replace bcrypt with bcryptjs.

## 6.5.2
### Fixed
 - Hotfix to resolve remote team access.

## 6.5.1
### Fixed
 - Fixed problems with the SSO with portal and SAML.

### Changed
 - Upgraded form manager with sso fixes.
 - Ugpraded portal with sso fixes.

## 6.5.0
### Fixed
 - SQL Connector action.
 - Removed any risk of erroneous roles getting assigned or used for user permissions.

### Changed
 - Added "project" to submission to speed up performance and improve security.
 - Upgrade aws-sdk@2.426.0, mongodb@3.2.1
 - Load all of the subforms when generating PDF to improve the speed of the pdf renders for subforms.

### Removed
 - Moxtra integration.

## 6.4.6
### Updated
 - formio to v1.42.1

## 6.4.1-6.4.5
???

## 6.4.0
### Added
 - Added the Form Manager to each project. Can be seen by going to https://yourproject.form.io/manage
 - A way to add Public Configurations to projects. Seen within the Portal | Project | Settings | Public Configurations
 - Allow a public config.json to be exposed for your project @ https://yourproject.form.io/config.json

## 6.3.2
### Fixed
 - Fixed issues with subform validations and also update API's with subforms. Automated tests created
 - Fixed problem with the MongoDB queries for DocumentDB which didn't support $elemMatch within the $all query.

## 6.3.1
### Changed
 - Upgraded formio module to resolve issues with sub-form validation and errors.
 - Upgraded formiojs@3.15.6, twilio@3.28.1, eslint@5.14.1, sinon@7.2.4, webpack@4.29.5, aws-sdk@2.407.0, jsonwebtoken@8.5.0, mocha@6.0.0

## 6.3.0
### Added
 - SAML Single Sign On support
 - PATCH method for Submissions

### Changed
 - Upgrade to Node v10
 - Upgrade request-promise-native@1.0.7, webpack@4.29.4, aws-sdk@2.403.0, formiojs@3.15.2

### Fixed
 - Fix issue where changing password caused a user to not be able to login.

## 6.2.7
### Changed
 - Upgrade formio to 1.40.2 (fixes jwt token expired issue)

## 6.2.6
### Fixed
 - Issues where the project access would duplicate anytime that a project deploy to a protected project would occur.

### Changed
 - Upgrade aws-sdk@2.397.0

## 6.2.5
### Fixed
 - Problems with DocumentDB not working well with complex indexes with array values.

### Changed
 - Upgraded aws-sdk@2.396.0, twilio@3.28.0

## 6.2.4
### Changed
 - Upgrade the portal 6.1.4
 - Upgrade dependencies

## 6.2.2
### Fixed
 - The Azure Storage to work with aliased form endpoints.

### Changed
 - Upgraded formiojs@3.13.6, eslint@5.13.0

## 6.2.1
### Fixed
 - Don't limit requests for any plans when on premise.

## 6.2.0
### Added
 - Azure Blob Storage support
 - Possibility to access reCAPTCHA API Endpoint
 - Support import queries being ors
 - Add ability to parse tokens per project.

### Fixed
 - Removed some 500 error codes from being sent by the server
 - Problem with reporting in Kinesis where the form is unable to be determined.

### Changed
 - Upgrade docker container to Node 10
 - Upgraded minio@7.0.4, mongodb@3.1.13, sinon@7.2.3, supertest@3.4.2, aws-sdk@2.394.0, formiojs@3.13.0, moment@2.24.0, webpack@4.29.0

## 6.1.0
### Added
 - Ability to limit plans per project for forms, form requests and emails.
 - Portal app is now hosted from root of server.

### Fixed
 - FOR-1977: Group permissions to allow for index queries into the group controlled records.

### Changed
 - Upgrade formio to latest v1.38.0 which fixes the following issues. https://github.com/formio/formio/blob/master/Changelog.md#1380
 - Upgraded chance@1.0.18, debug@4.1.1, minio@7.0.2, aws-sdk@2.382.0, dotenv@6.2.0, formio-workers@1.9.0, formiojs@3.10.2, jira-connector@2.10.0, ldapauth-fork@4.1.0, moment@2.23.0, resourcejs@1.33.0, twilio@3.26.1, eslint@5.11.1, sinon@7.2.2, webpack@4.28.3

## 6.0.13
### Fixed
 - Correct method of adding missing file.

## 6.0.12
### Fixed
 - Missing thread file after build process
 - Crash after attempting to delete project.

## 6.0.11
### Changed
 - Update formio-workers to fix issue addressed in 6.0.10.

## 6.0.10
### Fixed
 - Issues with the build and formio-workers where it was using dynamic includes which was making email transports fail.

## 6.0.9
### Fixed
 - Upgrade formio@1.37.6 which fixes the following.
   - Fixed issues with Resource permissions where it would only work with a single resource added to a permission type.
   - Changed the install script to say "setup" instead of "install".

### Changed
 - Upgraded chance@1.0.18, formio@1.37.6, formiojs@3.9.3, minio@7.0.2, aws-sdk@2.373.0, dotenv@6.2.0, ldapauth-fork@4.1.0, resourcejs@1.33.0, twilio@3.25.0, eslint@5.10.0, webpack@4.27.1

## 6.0.8
### Fixed
 - Problems where some calls to the root domain https://api.form.io would load all forms and cause performance issues.

## 6.0.7
### Changed
 - Update formio to fix 500 errors
 - Allow for a few seconds of server drift for licenses.

## 6.0.5 (from 5.12.3 release)

## 6.0.4 (from 5.12.2 release)

## 6.0.3 (from 5.12.0 release)

## 6.0.2 (from 5.11.1 release)

## 6.0.1
### Updated
 - Pulled all changes from 5.10.0 release

## 6.0.0
### Added
 - Server licensing

### Removed
 - Websocket integration (remote middleware)

## 5.12.3
### Fixed
 - A crash within the spreadsheet action.

### Changed
 - Update formio@1.37.3, aws-sdk@2.361.0, formiojs@3.9.0, webpack@4.26.0

## 5.12.2
### Fixed
 - Many performance and memory issues with large indexes returned from Mongoose.

## 5.12.1
### Added
 - Logging when version tag deployed

### Changed
 - Fix for potential crash when deploying a bad template.

## 5.12.0
### Changed
 - Errors result in 400 instead of 500 now.

## 5.11.1
### Fixed
 - FOR-1436: Fixed Webhook action validation message again.
 - FOR-1703: Fixed file attachments having hard coded filter.

## 5.10.0
### Fixed
 - FOR-1810: Fix webhooks errors from crashing the server.
 - Fix issue where stage teams couldn't be saved on stages where plan had become basic.

### Added
 - FOR-1703: File attachment for email with Base64 storage.
 - Bubble changes to update project modified date and add lastDeploy
 - Add description field to tags and speed up tag index by excluding tag template.

### Changed
 - Switch LDAP fields to pre-defined whitelist to stop problem fields from crashing login.
 - Upgraded JSONStream@1.3.5, express@4.16.4, formio@1.35.2, formiojs@3.6.12, multer@1.4.1, mongodb@3.1.8, aws-sdk@2.344.0, ioredis@4.2.0, resourcej
   s@1.28.0, semver@5.6.0, twilio@3.23.1, eslint@5.8.0, webpack@4.23.1, sinon@7.1.0, universal-analytics@0.4.20

## 5.9.2
### Fixed
 - Upgraded dependencies which fixes issues with PDF mail attachments.

## 5.9.1
### Fixed
 - Issues with the build around formio/formio and server crashes.

### Changed
 - Updated ioredis@4.0.1, primus@7.2.3, eslint@5.6.1, sinon@6.3.5, aws-sdk@2.329.0, formiojs@3.6.5, jira-connector@2.9.0, multer@1.4.0, twilio@3.22.0, ws@6.1.0, webpack@4.20.2

## 5.9.0
### Added
 - Basic request logging with DEBUG=formio:log
 - Stage team permissions

### Fixed
 - Webhook validation.

## 5.8.10
### Added
 - More debugging for LDAP action.

## 5.8.8, 5.8.9
### Fixed
 - The Email PDF attachment to work with anonymous user submissions.

## 5.8.7
### Added
 - The ability to change the submission PDF filename that gets attached to the emails.

### Changed
 - Upgrade formio to 1.34.3 to allow for current endpoints to accept temp tokens.
 - Debugging for LDAP Login action

## 5.8.6
### Fixed
 - Remove another field from LDAP login from Exchange that causes a crash.

## 5.8.5
### Changed
 - Upgrade formio@1.34.2, formiojs@3.5.7, aws-sdk@2.320.0, resourcejs@1.27.0, twilio@3.20.0

### Added
 - Ability to attach submission PDF's to email's

## 5.8.4
### Fixed
 - FOR-1710: Don't forward host headers (and other headers) in webhooks.

## 5.8.3
### Fixed
 - Problems related to mail template services and importing bad versions of formiojs.

## 5.8.2
### Changed
 - Upgraded lodash@4.17.11, mongodb@3.1.6, aws-sdk@2.318.0, formiojs@3.5.5, resourcejs@1.26.0, eslint@5.6.0, sinon@6.3.4, webpack@4.19.1, debug@4.0.1, and formio@1.34.0

### Fixed
 - Mark project template imports as create only to not change existing settings.
 - FOR-1603, FOR-1639: Google sheets improvements.
 - FOR-1429: Add editgrid support for email rendering.
 - FOR-1584: Fixed PDF downloads to not expose encrypted passwords.
 - Expire all tokens when a password is reset.
 - Fixed the action condition checks to ensure it will not work for any empty field or conditions.
 - Fixed security issue where Actions were exposed with simple GET request.
 - Project staging issue where project settings could be overridden when importing a template such as title and name.

## 5.8.0
### Added
 - Added full Minio support
 - Added Encrypted S3 support
 - Allow more than one SSO token per email.

### Fixed
 - Fixed Team permissions to not remove permissions outside of project owner.
 - Problems with not working with SSL Redis servers.

## 5.7.2
### Changed
 - Added the ability to servicetize the Google Sheets actions.
 - Upgraded JSONStream@1.3.4 formio@1.33.2 resourcejs@1.25.1 aws-sdk@2.292.0
 - Upgraded sinon@6.1.4, webpack@4.16.2, twilio@3.18.0, eslint@5.2.0, method-override@3.0.0, ws@6.0.0, prepack@0.2.44

## 5.7.1
### Changed
 - Upgraded multer@1.3.1, resourcejs@1.24.1, squel@5.12.2, twilio@3.17.5, ws@5.2.2, aws-sdk@2.272.1, eslint@5.1.0, mongodb@3.1.1, sinon@6.1.3, webpack@4.16.0, prepack@0.2.42
 - Using the 3.x branch of formiojs.

### Fixed
 - Problems with renaming the stages and projects
 - Issue where team admins could not delete projects.
 - The admin project upgrade process.
 - Problems with the email counts not showing in the project overview page.

## 5.7.0
### Fixed
 - SQL Connector action for forms without Save Submission action.

### Added
 - Submission object for webhook when submission is deleted.

### Changed
 - Now able to use external hosted service for Nunjucks email templating.
 - Upgraded moment@2.22.2, mongoose@5.1.7, primus@7.2.2, twilio@3.17.4, ws@5.2.1, mongodb@3.0.10, aws-sdk@2.264.1, jsonwebtoken@8.3.
      0, webpack@4.12.1, dotenv@6.0.0, eslint@5.0.1, sinon@6.0.1, universal-analytics@0.4.17, prepack@0.2.40

## 5.6.10
### Fixed
 - Issues with the PDF download where it would fail if the server was not hosted in https.

## 5.6.6
### Changed
 - Allow the Nunjucks templating to happen within an external service.
 - Upgraded mongoose@5.1.3, aws-sdk@2.247.1, formio@1.30.0, formio-workers@1.5.0, resourcejs@1.24.0, webpack@4.10.1

## 5.6.5
### Fixed
 - PDF permissions not checked properly.

### Changed
 - Upgrade formio to 1.29.2

## 5.6.4
### Fixed
 - Redo fix for 5.6.3 to ensure it is called before.

## 5.6.3
### Fixed
 - Sometimes primary project is not loaded for form routes when not using redis.

## 5.6.2
### Fixed
 - Rerun 5.6.1 update with correct spelling of commercial.

## 5.6.1
### Fixed
 - Update all remote projects to commercial. Many were accidently set to trial.
 - Ensure all future remote projects are set at the minumum of the default.

## 5.6.0
### Added
 - Possibility to get report using form collection.
 - Submission states support.

### Fixed
 - Projects starting with a number causing issues with deployment.

## 5.5.0
 ???

## 5.4.4
### Updated
  - Formio to version 1.28.0

### Fixed
 - Mongoose update breaking change.
 - PDF uploading for team write members.
 - Roles fetching for multiple teams.

## 5.4.0
### Fixed
 - Issues where some sub-documents do not store ObjectId's correctly in database.
 - Added recommended database indexes for performance improvements.

## 5.3.4
### Fixed
 - Save-as-reference issue where updates could remove ObjectId's from references.

## 5.3.3
### Fixed
 - Crash in ldap server on error.

## 5.3.2
???

## 5.3.1
### Fixed - SECURITY UPDATE
 - Remove excess data from remote settings.

## 5.3.0
### Added
 - LDAP Authentication

???

## 5.1.8
### Fixed
 - Submission export problem when form configuration uses separate collection.

## 5.1.7
### Added
 - A way to create inline email tokens for submissions.

### Fixed
 - Case insensitive searching of team members.

## 5.1.3
### Changed
 - Upgrade formio to 1.23.3 to fix issue with importing subforms.

### Fixed
 - Only allow collections with valid characters.

## 5.1.2
### Fixed
 - Team support for remote environments to load project settings.

## 5.1.1
No changes

## 5.1.0
### Changed
 - Upgraded all dependencies.

### Fixed
 - Performance improvements with loading forms, resources, submissions, and projects.

### Added
 - Ability to save submissions into separate collections.
 - Ability to select certain fields as database indexes.

## 5.0.2
### Fixed
 - Crash in report API when no results are returned.

## 5.0.1
### Fixed
 - Fix permissions for report endpoint to properly read read_own permissions.
 - Filter out stages from list of team projects.

## 5.0.0
### Added
 - Remote environment support with remote authentication
 - New deployment options by sending the template with request
 - Add ADMIN_KEY option
 - Add no-cache headers
 - Added user management support with the moxtra login action.
 - Field encryption
 - Form Revisions
 - Staging and Tagging

### Removed
 - Install process for form.io project

## 4.1.17
### Removed
 - Passing API Keys as querystrings in CORS requests. Must use headers from now on.

## 4.1.16
### Updated
 - formio library to 1.8.11

## 4.1.14
### Fixed
 - Issue where the clearOnHide flag was clobbering data when it was unchecked.

## [Unreleased]
### Changed
 - Allow overriding of new plan restrictions based on an environment variable.

### Added
 - CRM Tigger when projects are updated

## 4.1.11
### Added
 - CRM Triggers for creating, upgrading and deleting projects.

## 4.1.10
### Added
 - Trial date to projects and update hook to set all basic to trials.

### Changed
 - Disallow environments, tagging and deploying on team plans.

### Fixed
 - Fixed issue with oauth action, where the roles weren't being filtered for non-deleted status.

### Changed
 - Changed the way team permissions were calculated and made them additive.
 - Updated formio to 1.17.6

## 4.1.8
### Added
 - When creating a tag, project is updated with that tag.

### Fixed
 - Protected projects can now update other settings that aren't protected.

## 4.1.7
### Changed
 - The submission pdf download to use POST instead of GET so it works with ELB.

## 4.1.6
### Added
 - Framework definition to project model.

### Changed
 - Removed Remove type and externalUrl from Project schema until On Site environments are set up later.

## 4.1.5
### Changed
 - Added keys to the temp tokens to allow easier GET requests.

## 4.1.4
### Changed
 - Now perform new base server build for every build.
 - Change node.js version to 6.x
 - Changed base linux to node:boron-slim

## 4.1.3
### Fixed
 - An issue that was crashing the server when Buffer does not use proper constructor for node versions.

## 4.1.2
### Fixed
 - Issue with the actionRoutes getting declared twice in the hooks/settings.js file.
 - Issue with download pdf using query to get the token and it is too long.

## 4.1.1
 - No changes.

## 4.1.0
### Added
 - New download PDF endpoint that allows for downloading submissions as PDFs using the file server.
 - Template import / export tests
 - External token support to skip dynamic user permission loading
 - Project access settings in export/import
 - Environment Support
 - Tags support

### Fixed
 - Authentication for websocket connections to allow API keys, and team authentication.
 - Fixed issues with import/export and machine names for actions.

### Changed
 - Template action import / export names to be in the format of "form:action"
 - Updated formio to 1.17.3
 - Updated primus to 5.2.2
 - Updated request to 2.81.0
 - Updated resourcejs to 1.7.0
 - Updated websockets to 1.1.4
 - Removed formio-utils dependency and replaced with formiojs.

## 4.0.0
### Added
 - Ability to have projects as subdirectories
 - Ability to have domains as more than two parts. (eg. mydomain.co.uk or sub.mydomain.co.uk)
 - Added Date support to report API endpoint
 - Added mongo indices to all entities

### Fixed
 - Error messages return a proper error code instead of bubbling to final error handler with 500 response.

### Changed
 - Updated formio to 1.16.3
