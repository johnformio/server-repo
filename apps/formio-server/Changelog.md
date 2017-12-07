# Change Log 
All notable changes to this project will be documented in this file

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

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
