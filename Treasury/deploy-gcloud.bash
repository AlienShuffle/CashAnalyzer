gcloud functions deploy 'gettbillquotes' \
--runtime=nodejs16 \
--region='us-central1' \
--source=. \
--entry-point='getTbillQuotes' \
--trigger-http \
--allow-unauthenticated