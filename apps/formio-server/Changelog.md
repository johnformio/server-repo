# Change Log
All notable changes to this project will be documented in this file

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

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
