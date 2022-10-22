gcloud functions deploy 'gettreasuryquotes' \
--runtime=nodejs16 \
--region='us-central1' \
--source=. \
--entry-point='getTreasuryQuotes' \
--trigger-http \
--allow-unauthenticated