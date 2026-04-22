#!/usr/bin/bash

echo "lot,pid,parcel,location,generalOwner,address,lake,acres,yearBuilt,livingArea,valuationImprove,valuationLand,valuationTotal,valuationYear,saleDate,salePrice"
jq -r '.[] | [.lot,.pid,.parcel,.location,.generalOwner,.address,.lake,.acres,.yearBuilt,.livingArea,.valuationImprove,.valuationLand,.valuationTotal,.valuationYear,.saleDate,.salePrice] | @csv'
