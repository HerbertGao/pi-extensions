# @herbertgao/pi-impeccable

## 0.6.0

### Minor Changes

- [#395](https://github.com/HerbertGao/pi-extensions/pull/395) [`43a108a`](https://github.com/HerbertGao/pi-extensions/commit/43a108ac173ed4d6fc137433a958ef43c1a64812) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Vendor the official Impeccable 4.10.0 Pi skill. The launcher pins engine 0.1.27. Context loads a long DESIGN.md as a map, and the first launcher failure is not retried. A user exit stays down for a minute and clears the live init flag, so a later inject on the same page can start Live. The missing-PRODUCT.md notice shows once, and hovering the live bar no longer widens it. Go still leaves a staged removal in the page.

## 0.5.0

### Minor Changes

- [#383](https://github.com/HerbertGao/pi-extensions/pull/383) [`34e9a94`](https://github.com/HerbertGao/pi-extensions/commit/34e9a9445806afbd5be85034fe32ceea1919f9eb) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Vendor the official Impeccable 4.9.2 Pi skill. The launcher pins engine 0.1.25. A critique reads the design-review rubric, and a new surface reads the world or comp playbook when that part applies. The local Go staged-removal fix is kept.

## 0.4.0

### Minor Changes

- [#377](https://github.com/HerbertGao/pi-extensions/pull/377) [`b02be94`](https://github.com/HerbertGao/pi-extensions/commit/b02be9410f637abc110fd2ee02def0f9d75fd419) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Vendor the official Impeccable 4.9.1 Pi skill. The launcher pins engine 0.1.24, and a GitHub HTTP 5xx during download says the outage is on GitHub's side. `/impeccable foundations` walks a product-foundations checklist. Hiding the live bar stops capturing clicks. The local Go staged-removal fix is kept.

## 0.3.0

### Minor Changes

- [#365](https://github.com/HerbertGao/pi-extensions/pull/365) [`e29681d`](https://github.com/HerbertGao/pi-extensions/commit/e29681dc3de160f3710545f573a5c28bb1988ca3) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Vendor the official Impeccable 4.8.2 Pi skill. The launcher pins engine 0.1.21 and skips a sibling binary from another engine version. The local Go staged-removal fix is kept: a connected live selection is not detached, so Undo and Discard can restore it.

## 0.2.0

### Minor Changes

- [#362](https://github.com/HerbertGao/pi-extensions/pull/362) [`47bf3d5`](https://github.com/HerbertGao/pi-extensions/commit/47bf3d5c5d482a4fcb1e60a994455a4fc6bbe5e4) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Vendor the official Impeccable 4.8.1 Pi skill. The launcher pins engine 0.1.19 and skips a sibling binary from another engine version. Live mode can stage removal of a picked element.

### Patch Changes

- [#362](https://github.com/HerbertGao/pi-extensions/pull/362) [`47bf3d5`](https://github.com/HerbertGao/pi-extensions/commit/47bf3d5c5d482a4fcb1e60a994455a4fc6bbe5e4) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Keep a staged Live removal in the page when Go cleans the selected element, so Undo and Discard can restore it.

## 0.1.1

### Patch Changes

- [#346](https://github.com/HerbertGao/pi-extensions/pull/346) [`641894f`](https://github.com/HerbertGao/pi-extensions/commit/641894ff5dc34a38ab41905f27a3077cc865ab91) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Document Pi 1.5.0 as the tested host and publish each package changelog so Pi can show Extension Updates after an update. Agency tools and clef keep the same TypeBox schemas, built from typebox because Pi 1.5 no longer re-exports Type. Peer ranges stay open. The BTW fullscreen handoff resolves `@narumitw/pi-tui-kit@0.68.1` inside the existing `^0.68.0` range.

## 0.1.0

### Minor Changes

- [#331](https://github.com/HerbertGao/pi-extensions/pull/331) [`12c8680`](https://github.com/HerbertGao/pi-extensions/commit/12c86808bf7084d4fab6f90d6bac17a2531585ce) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Vendor the official Impeccable 4.8.0 Pi skill as `@herbertgao/pi-impeccable` and include it in the aggregate package.
