#!/usr/bin/bash
#
# Pull a result from EDGAR with the agent key set so we work okay.
#
query="{\"operationName\":\"GetModToken\",\"variables\":{},\"query\":\"query GetModToken {\\n  getModToken {\\n    accessToken\\n    tokenType\\n    ts\\n    __typename\\n  }\\n}\"}"
#echo $query
token=$(curl --header 'Content-Type: application/json' \
    -sSL "https://www.reuters.com/service/graphql" \
    -d "$query" |
    jq -r '.data.getModToken.accessToken')
echo token=$token
ticker=FDLXX
xid=$(curl -sSL \
    "https://content.markitcdn.com/api.markitondemand.com/apiman-gateway/MOD/chartworks-xref/1.0/xref/exact?inputs=%5B%7B%22symbol%22%3A%22${ticker}.O%22%7D%5D&access_token=${token}" |
    jq -r '.data.items[0].xid')
echo xid=$xid

content="{{\"days\":60,\"dataNormalized\":false,\"dataPeriod\":\"Day\",\"dataInterval\":1,\"realtime\":true,\"yFormat\":\"0.###\",\"timeServiceFormat\":\"JSON\",\"returnDateType\":\"ISO8601\",\"rulerIntradayStart\":31,\"rulerIntradayStop\":3,\"rulerInterdayStart\":12783,\"rulerInterdayStop\":365,\"elements\":[{{\"Label\":\"ff0a004c\",\"Type\":\"price\",\"Symbol\":\"${xid}\",\"OverlayIndicators\":[],\"Params\":{{}}}}]}}"

curl -sSL "https://content.markitcdn.com/api.markitondemand.com/apiman-gateway/MOD/chartworks-data/1.0/chartapi/series?access_token=${token}" \
    --header 'Content-Type: application/json' -d "$content"
