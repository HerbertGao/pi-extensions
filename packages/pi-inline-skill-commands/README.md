# @herbertgao/pi-inline-skill-commands

Use Pi's native `/skill:name` commands within a larger prompt. At token boundaries, autocomplete lists only skills and completion preserves the surrounding text. Submitting expands the skill and retains the text before and after the command.

```text
Please use /skill:pdf-tools to extract report.pdf
```

Commands at the start of the prompt remain entirely native. This package does not add `/<name>` aliases or a second skill list, so it does not duplicate Pi's native skill entries. Ordinary commands such as `/model` remain start-only. URL and path slashes do not trigger skill completion.

## Install

```bash
pi install npm:@herbertgao/pi-inline-skill-commands
```

For a local checkout:

```bash
pi install /absolute/path/to/pi-extensions/packages/pi-inline-skill-commands
```

Restart Pi or run `/reload` after installation. The package is standalone and is not included in the `@herbertgao/pi-extensions` aggregate.

## Compatibility

Pi currently filters `/` out of extension-provided autocomplete trigger characters. To provide automatic mid-text completion anyway, this package patches `CustomEditor` once and calls its private autocomplete trigger. It does not replace the active editor factory, so editor customizations from other packages remain in place. That internal dependency can break when Pi changes its editor. If the private trigger is unavailable, mid-text Tab completion and submission-time expansion still work.

Skill discovery and the native start-of-prompt behavior use Pi's public APIs. Submission expansion reconstructs a snapshot of configured, default-directory, and package skills. Pi does not expose the active resource loader to extensions, so CLI-only `--skill` paths and skill paths injected dynamically by other extensions are not expanded by this package. Use the same `/reload` workflow after changing skills as with native skill commands.

## License

[MIT](LICENSE)
