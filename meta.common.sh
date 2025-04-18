# this is an include file for general parameters.
export oldestDate="12/31/2019"
#
# Fund list related generated data files shared across the environment.
CIKmap="../data/CIK-map.json"
companyMap="../data/company-map.json"
fiscalYearFile="../data/fiscalYearFile.csv"
fundsList="../data/funds-list.txt"
fundsMetaFile="../data/fundsMeta.json"
[ -d "../data" ] || mkdir "../data"
