#!/usr/bin/bash
cat $(basename $(pwd)) | ../bin/Fidelity-update-common-job.sh "$@"