## Support for template pre-compilation

I've included examples for the following:

- Coffeescript (directly via `coffee`)
- DoT (directly via `dottojs`)
- EJS (plugin)
- Handlebars (directly via `handlebars`)
- Jade (directly via `jade`)
- Mustache (plugin)
- Underscore templates (plugin)

These are generally triggered by passing a JSON descriptor to the `--command` option:

`--command <json>` / `.set('command', [ { expr: new RegExp('\.foo$'), cmd: '<cmd>' }, ... ])`: Advanced usage. You can apply a command to files with a particular extension.

JSON options:

- `cmd`: The command to run.
- `ext`: The command is run on files matching this extension.
- `expr`: The command is run on files matching this regular expression (passed to `new RegExp` and matched).
- `wrap`: Optional wrapping. Right now, only `exports` is supported; it wraps the result in `module.exports = <result>;`.

For example, for Coffeescript (e.g. files matching `.coffee`):

    --command '{ "ext":".coffee", "cmd": "coffee --compile --stdio" }'

Or for Jade (e.g. files matching `.jade`):

    --command '{ "ext":".jade", "wrap": "exports", "cmd": "jade --client --no-debug" }'

Sadly, some commands are not unixy: they don't support pipes. For those commands, you can use the automatic placeholders `<input>` and `<output>`. This alters how `glue` runs: it will replace the `<input>` string with the actual filename, and `<output>` with a temporary directory, from which the file is included into the build and then later removed.

For example, for Handlebars (e.g. files matching `.hbs`):

    --command '{ "ext":".hbs", "wrap": "exports", "cmd": "handlebars <input> --simple" }'

Handlebars requires an input file, but does not need an output file (can write to stdout but not read from stdin).

For example, for DoT (e.g. `.dot`):

    --command-dot "dottojs -s <input> -d <output>"

## Plugins for pre-compilation

What about [templating libraries](http://garann.github.io/template-chooser/) that don't have builtin precompilation support?

ejs:

    --command-ejs "~/precompile-ejs.js"

    console.log(ejs.compile(str, { client: true }));

underscore.js templates:

    console.log(_.template(str));

Mustache.js:

    console.log(Mustache.compile(stringTemplate));

## Using packages from other package managers

AMD/RequireJS to CommonJS conversion:

Component:

Bower:

## Exporting to AMD etc

UMD support documentation

## Generating obfuscated server side code
