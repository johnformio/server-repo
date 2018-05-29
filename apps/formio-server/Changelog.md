# Change Log
All notable changes to this project will be documented in this file

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

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
