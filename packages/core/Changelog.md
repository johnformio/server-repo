## [Unreleased: 2.4.0-rc.1]

### Changed

- Regression | Nested Form | Components in Nested forms should not validate hidden components without Validate When Hidden = true
- FIO-8347: Added ability to skip mask validation
- FIO-8273 fixed advanced logic for data components
- FIO-9028: update README
- Refactor the component paths to ensure we are always referencing the correct path
- FIO-9321 fixed onlyAlailableItems validation for select Boxes
- FIO-8640: Fixes an issue where rowIndex is undefined in custom validation
- FIO-9266,FIO-9267,FIO-9268: Fixes an issue where nested forms will be not validated if there are no data provided
- FIO-8552: add linting/formatting

## 2.3.0

### Changed

- Official Release

## 2.3.0-rc.23

### Changed

- FIO-9021: Fixed eachComponentData iteration for nested forms

## 2.3.0-rc.22

### Changed

- FIO-9344 fixed require validation for day component
- FIO-9329: fix issue where validateWhenHidden now validates hidden and conditionally hidden components

## 2.3.0-rc.21

### Changed

- FIO-9280 updated validation of value property
- FIO-9299: ensure eachComponent does not mutate a component's path

## 2.3.0-rc.20

### Changed

- FIO-9308: Fixed the paths with nested forms by ensuring we are always dealing with the absolute paths with clearOnHide, conditions, filters, and validations

## 2.3.0-rc.19

### Changed

- FIO-9255: fixed an issue where nested forms lose data after submission if some parent has conditional components

## 2.3.0-rc.18

### Changed

- FIO-9261: fixed an issue where empty multiple value for url and datetime causes validation errors

## 2.3.0-rc.17

### Changed

- FIO-9201: Fix DataTable in quick inline embed issues

## 2.3.0-rc.16

### Changed

- FIO-9201: Fix DataTable in quick inline embed issues

## 2.3.0-rc.15

### Changed

- FIO-9244: fixed an issue where Radio component with Allow only available values checked does not submit

## 2.3.0-rc.14

### Changed

- FIO-9189: fixed an issue where data is lost after submission for the conditionally visible field when the condition is based on select resource
- FIO-9219: condition is not equal to based on select box

## 2.3.0-rc.13

### Changed

- FIO-9186: fixed an issue where front-end validation is skipped for the components inside layout component inside editGrid
- FIO-8632: Fixes an issue where required validation is not triggered for multiple value components like Select if it has no values added

## 2.3.0-rc.12

### Changed

- FIO-9086: use for validation only dataFormat (data storage format)
- FIO-9202: fixed an issue where the data for the component inside fieldset insdie wizard is lost after submission
- FIO-9220: remove hiddenChildren

### Changed

## 2.3.0-rc.11

### Changed

- FIO-9160: added support of different condition formats for selectboxes

## 2.3.0-rc.10

### Changed

- FIO-9143 fixed getValidationFormat error

## 2.3.0-rc.9

### Changed

- FIO-8731: Update fix to nested hidden components
- FIO-9002: fix issue with conditionally hidden duplicate nested form paths

## 2.3.0-rc.8

### Changed

- FIO-8723: Clear values from submission for hidden comp with clearOnHide flag
- FIO-8954: added Allow only available values validation for Data Source Type = URL
- FIO-9085: Fix address submission logic

## 2.3.0-rc.7

### Changed

- FIO-9059: fixed an issue where the string type returns for textarea with json type

## 2.3.0-rc.6

### Changed

- FIO-9033 tagpad data is not saved

## 2.3.0-rc.5

### Changed

- FIO-9085: Fix components data removed from submission when conditional set for Address component value
- FIO-8414: Fix required validation not working in Data Grid

## 2.3.0-rc.4

### Changed

- FIO-8986 fixed nornalization for day with default value and hidden fields
- FIO-9055: separate rowPath from componentPath in getComponentActualValue fn

## 2.3.0-rc.3

### Changed

- FIO-8986 fixed validation for Day component with two hidden fields
- FIO-8798: update normalization for day component
- FIO-8626: Updated conditionally hidden logic
- Increment minor version

## 2.3.0-rc.1

### Changed

- updated thresholds to current values
- FIO-8450: Fix custom error message for unique validation
- FIO-8598 fixed normalization of radio component values depending on storage type
- FIO-8650 -- returning empty array for empty edit grids
- FIO-8477: Fix the timezones issue in formatDate function

## 2.2.3-rc.2

### Changed

- FIO-8912-fix-for-upstream-tests

## 2.2.3-rc.1

### Changed

- FIO-8810: fixed an issue where user unables to resubmit (change) the form with several levels of nested forms with required fields
- chore: fix formiojs tests
- FIO-8912: update validateMultiple to account for model types

## 2.2.2

### Changed

- Official Release

## 2.2.2-rc.5

### Changed

- FIO-8885 & FIO-8886: use strict equality check for conditional component paths rather than Array.prototype.includes

## 2.2.2-rc.4

### Changed

- FIO-8798: updated day component validation
- FIO-8901: Fixed incorrect handling of excessive rows in nested array model

## 2.2.2-rc.3

### Changed

- FIO-8848 fixed validation for TextArea with Save as Json

## 2.2.2-rc.2

### Changed

- FIO-8769 added check for the simpleConditional properties state

## 2.2.2-rc.1

### Changed

- FIO-8807: fixed an issue where conditionals based on selectBoxes component do not work

## 2.2.1

### Changed

- Official Release

## 2.2.1-rc.1

### Changed

- FIO-8778: add case for map component model type in filter; add tests

## 2.2.0

### Changed

- Official Release

## 2.2.0-rc.9

- FIO-8731: Update fix to nested hidden components

## 2.2.0-rc.8

### Changed

- FIO-8731: Fixes component gets validated when being in a hidden parent

## 2.2.0-rc.7

### Changed

- FIO-8597: fixed an issue with an empty array value for a number component with multiple values enabled
- FIO-8730: Fix submission has hidden fields when 'Clear value when hidden' is checked
- FIO-8537: Fixing the filter processor to handle nested component data properly
- fixing child components being displayed when they should be removed when clearOnHide is set

## 2.2.0-rc.6

### Changed

- FIO-7733: update most form params to optional

## 2.2.0-rc.5

### Changed

- FIO-8639 fixed validation for select component if onlyAvailableItems is set to false
- FIO-8645: added tests and translations for validateRequiredDay

## 2.2.0-rc.4

### Changed

- FIO-8650 -- returning empty array for empty edit grids

## 2.2.0-rc.3

### Changed

- Updated the build for recent changes.

## 2.2.0-rc.2

### Changed

- updated thresholds to current values
- FIO-8450: Fix custom error message for unique validation
- FIO-8598 fixed normalization of radio component values depending on storage type

## 2.2.0-rc.1

### Changed

- FIO-8177: fix unsetting empty array values
- FIO-8185: Fixing issues with EditGrid and DataGrid clearOnHide with Conditionally visible elements
- FIO-8178: correctly add "validator" param to interpolated error object
- FIO-8121: Fix json and custom validation errors response
- FIO-8128: allow export of dist minified js
- FIO-8143: update eachComponent to be able to return proper pathing
- FIO-8210: fix nested form validation
- change filter processor to be more verbose and have compModelType in scope (replaces pull #78)
- FIO 7488: improve error handling
- Fixed required validation considering false value falsy (pull #31)
- Revert "Merge pull request #31 from ralfeis/master"
- FIO-8037: fixed an issue where number component can be sent text through API
- FIO-7964: add resource-based select component validation
- FIO-8218: Fix tests for PR 79
- FIO-8218: add tests for FIO-8210
- Fix/implement pattern message
- FIO-8128: adds includeAll flag to eachComponentData and eachComponentDataAsync
- FIO-7507: publish-dev-tag-to-npm
- FIO-8264: update validate required
- FIO-8336 fix validation on multiple values
- FIO-8037: added number component normalization
- FIO-8288: do not validate dates in textfield components with calendar widgets
- FIO-8254 fixed available values validation error for Select component
- FIO-8281: fixed sync validation error for select component with url data src
- update validate required recursion to not recurse when nested data type
- FIO-7675: remove Map Key From Core (cycled out)
- FIO-8027 added Cloudflare Turnstile as a captcha Provider
- Fixing the truncate multiple spaces so it does not mutate the data in the validation system
- FIO-8354: fallback to passing response in argument if response.body is undefined
- Changes to the Experimental Exports, and changes for 5.x Renderer
- Experimental component changes
- FIO-8597: fixed an issue with a blank value for a number component with multiple values enabled
- FIO-8512: fixed an issue where conditionally visible data inside layout components inside editGrid/dataGrid is unset on server side
- FIO-8316 invalid data submitted in nested form
- fix path/import issue with JSONLogicEvaluator

## 2.0.0-rc.24

### Changed

- FIO-8106: add default storeas value to tags
- FIO-8106: add invalidDate error translation

## 2.0.0-rc.23

### Changed

- Fix: JSONLogic validations should get same context as calculations

## 2.0.0-rc.22

### Changed

- FIO-7146: gh actions for repository
- FIO-8100: add clearhidden processor to cover logic, conditions, and custom
- FIO-8101: always process json validation even if value is falsy
- FIO-8107: correct small error in normalize processor

## 2.0.0-rc.21

### Changed

- FIO-8092: update isEmpty to isComponentDataEmpty and account for differing component data types

## 2.0.0-rc.20

### Changed

- FIO-8086: don't multiple validate select components
- FIO-8079: add stricter time validation

## 2.0.0-rc.19

### Changed

- FIO-8047: add dereferencing processor for datatable comp

## 2.0.0-rc.18

### Changed

- FIO-8055: validate components that include custom validations, even when their data is empty
- FIO-8049: fix value prop in evaluations
- FIO-8040: add functions from formiojs
- restructure conditional processor to fix conditional components in emails

## 2.0.0-rc.17

### Changed

- FIO-8023: Fixing issues with the parent traversal on deeply nested components within nested forms

## 2.0.0-rc.16

- FIO-7884: Fixed issues with processing data within nested form data structures

## 2.0.0-rc.14

### Changed

- FIO-7884: Fixed an issue with nested form data where it would not set correctly
- FIO-7938: Fixing issues where components within Array components (like datagrid) would get the path of the first index assigned and would never update again
- FIO-7958: add asynchronous rule set
- FIO-7958: fix typo in normalize processor fn
- FIO-7998: add validate captcha rule
- FIO-7991: Fixing the time validation to use the dataFormat for validation, which is what the client passes along to the server
- skip processing if row is null or undefined

## 2.0.0-rc.13

- FIO-7958: add normalize processor fn and derive context.value rather than mutate it directly

## 2.0.0-rc.11

- FIO-7883: include premium components in 'multiple' validation conditional
- FIO-7885: Make the core validator run the skipValidation checks similar to renderer checks
- fix calculation for nested forms
- FIO-7938: Fixing the fetch process to evaluate properly on the server
- FIO-7874: Fixed issues with 'Invalid Time' when submitting a time component
- FIO-7733: move unused 'experimental' features to a new folder and remove them f
- Processor changes to work with other forms and validation processes
- scopes updated and other little updates
- Adding processors for server-side data processing
- Ensure we do not 'append' jwt tokens but set them

## 2.0.0-rc.10

### Breaking Changes

- This version of the renderer will now produce different "binary" build files. The following are created.

  - dist/formio.core.js => The complete core binary. This used to be "dist/index.js".
  - dist/formio.base.js => The base components of the core library. This used to be "dist/base/index.js"
  - dist/formio.components.js => The extended components classes of the core library. This used to be "dist/components/index.js"
  - dist/formio.model.js => This is the data model base classes for the renderer. This used to be "dist/model/index.js"
  - dist/formio.modules.js => The different modules such as "jsonlogic" used when rendering. This used to be "dist/modules/index.js"
  - dist/formio.js => The Formio SDK => this used to be "dist/sdk/index.js"
  - dist/formio.utils.js => The Formio Utils library => this used to be "dist/utils/index.js"
  - dist/formio.template.js => The template handling library => this used to be "dist/template/index.js"
  - dist/formio.process.js => The processing engine, such as validation => this used to be "dist/process/index.js"

- This version introduces the "processors" concept to our core library. This will become the "core" validation engine and data processing engine for
  our renderer as well as server side logic.

- This version introduces the "template" handling logic so that it can be used by other libraries to manage templates.

## 1.3.0-rc.22

### Fixed

- FIO-7462: fix failing tests

## 1.3.0-rc.20

### Changed

- Adding form and instance proxies

## 1.3.0-rc.18

### Fixed

- revert accidental deletion of templateSettings

## 1.3.0-rc.16

### Fixed

- Adding exports to libraries.

## 1.3.0-rc.14

### Fixed

- Issue with invalid alias when loading a form with form revision.

## 1.3.0-rc.13

### Fixed

- FIO-6832: fixed issue where submission used wrong \_fvid

### Changed

- Upgrade all dependencies to latest versions.

## 1.3.0-rc.9

- Upgrade all dependencies to latest versions.

## 1.3.0-rc.8

## 1.3.0-rc.7

### Fixed

- Fixed the ejs.js template import.

## 1.3.0-rc.6

### Changed

- Fixed the export lib to contain relative paths for easy import.

## 1.3.0-rc.5

### Changed

- Fixing the lib to contain production build of js files.

## 1.3.0-rc.4

### Changed

- "main" in package.json changed to "dist" to support imports into other libraries.

## 1.3.0-rc.2 - 1.3.0-rc.3

### Changed

- Experiment with typescript paths and imports.

## 1.3.0-rc.1

### Changed

- Added types for core formio entities
- Missing commits from formio.js implemented

## 1.2.0

### Fixed

- FIO-6123: Added an array cleanup to the removeAttachedListeners method and wrote test for it

## 1.1.0

### Changed

- FIO-5147: Added a check for an empty value

## 1.0.0

### Changed

- Official Release

## 1.0.0-rc.5

### Fixed

- FIO-3999: Fixed Data Table loading for IE11

## 1.0.0-rc.2

### Fixed

- FIO-599: Fixes no values on pdf download for components inside nested form
- FIO-2849: Fix: Evaluator does not interpolate expressions with optional chaining properly

## 0.0.8

### Changed

- Added override method.

## 0.0.7

### Changed

- Refactored array types.

## 0.0.6

### Changed

- Added a Components.render method.

## 0.0.5

### Changed

- How certain packages are imported.

## 0.0.4

### Chaanged

- Added unwind functionality and more functions to the utils.

## 0.0.3

### Changed

- Added some date conversion methods.

## 0.0.2

### Changed

- Many refactorings and added data handling and basic inputs.

## 0.0.1

### Changed

- Initial commit.
