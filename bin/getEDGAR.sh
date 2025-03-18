#!/usr/bin/bash
#
# Pull a result from EDGAR with the agent key set so we work okay.
#
curl --header 'User-Agent: alan@gebele.com' -sSL "$@"