#!/usr/bin/bash

echo "owner,generalOwner,currentOwner,emptyLotCnt,homeLotCnt,previousLotCnt,relatedLots,previousLots"
jq -r '.[] | [.owner,.generalOwner,.currentOwner,.emptyLotCnt,.homeLotCnt,.previousLotCnt,(.relatedLots|join(";")),(.previousLots|join(";"))] | @csv'
