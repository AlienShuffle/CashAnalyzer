#!/usr/bin/bash
cat $(basename $(pwd)) | ../lib/Fidelity-update-common-job.sh "$@"