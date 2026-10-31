---
name: swift-toolchain-prerequisite
description: Detect and explain the selected Apple, Linux, or Windows Swift toolchain prerequisite without installing it implicitly.
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
---

# Swift toolchain prerequisite

Use only after the Component lock selects Swift and exactly one Swift toolchain
realization. Detect before any model call or source generation; never install or modify
the host without separate authorization.

- For `swift-apple`, run `xcrun swiftc --version`. If it fails, report that Apple
  Command Line Tools or Xcode is optional OS software required by this realization and
  direct the user to <https://www.swift.org/install/macos/> and
  `xcode-select --install`.
- For `swift-linux`, run `swiftc --version`. Confirm that the distribution, release,
  and architecture are present in <https://www.swift.org/install/linux/>; otherwise
  fail as an unsupported combination. Follow that page's selected platform instructions
  only after installation is authorized.
- For `swift-windows`, run `swiftc.exe --version`. If it fails, report the Visual Studio
  C++ toolchain and Windows SDK prerequisites published at
  <https://www.swift.org/install/windows/>. Do not invoke WinGet without authorization.

Preserve the locked realization, exact probe argv, discovered executable identity, and
version in lifecycle evidence. Never fall back to another realization or weaken the
selected OS constraint.
