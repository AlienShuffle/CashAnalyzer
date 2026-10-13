# WSJ bond collectors

The TIPS and Treasury collectors emit quote JSON on stdout. Routine progress
and retry logging on stderr is enabled only when `DEBUG=true`; final errors
remain visible regardless of DEBUG.

```sh
DEBUG=true ./job-TIPS-update.sh
DEBUG=true ./job-treasuries-update.sh
```

Run deterministic logging and quote-parsing regression tests from the
repository root, without contacting WSJ or publishing data:

```sh
node --test wsjTIPS/test/debug-logging.test.mjs
```
