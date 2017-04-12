# Change Log 
All notable changes to this project will be documented in this file

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased]
### Added
 - Template import / export tests
 - External token support to skip dynamic user permission loading

### Changed
 - Template action import / export names to be in the format of "form:action"

### Fixed

### Removed

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