# React UI-framework Flavor

### Requirement: React requires JavaScript

When `implementation.ui-framework=react` is selected, the Component SHALL also
select `implementation.language-ecosystem=javascript`. Selecting React without
JavaScript, or alongside a conflicting language Flavor as the only language, SHALL
fail closed.

#### Scenario: React without JavaScript is rejected

- **WHEN** a Component selects `ui-react` and does not select JavaScript on the
  language axis
- **THEN** Flavor resolution fails closed with an unsatisfied target constraint

### Requirement: JSX technique; npm only via package-npm

The React Flavor SHALL contribute component/JSX structure, rendering, and local
state guidance. It SHALL NOT by itself declare or depend on an npm package. A
bundler remains build-system authority. Real npm packages (including `react`) are
admitted only when the `package-npm` Flavor is also selected, and then only as
a lockfile-pinned closure with detect-before-install.

#### Scenario: Generated UI stays dependency-free without package-npm

- **WHEN** `ui-react` is selected with `lang-javascript` and `package-npm` is not
  selected
- **THEN** generated modules use relative imports with file extensions and no
  `package.json` npm closure
