# @herbertgao/pi-agency

## 0.1.1

### Patch Changes

- [#287](https://github.com/HerbertGao/pi-extensions/pull/287) [`3a0deb9`](https://github.com/HerbertGao/pi-extensions/commit/3a0deb96297aa6da94fe40724a3945ef16c34497) Thanks [@HerbertGao](https://github.com/HerbertGao)! - Stop bundling resume-from and lower the Node engines floor to `>=22.19.0`, matching Pi. Node 24 was copied from resume-from's engines field; these packages do not use a Node 24-only API. Pi's bundled Node 22 can install the current release instead of silently selecting an older one.
