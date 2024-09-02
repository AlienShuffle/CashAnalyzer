gcloud functions deploy 'getusfrquotes' \
--runtime=nodejs16 \
--memory=512MB \
--region='us-central1' \
--source=. \
--entry-point='getUSFRQuotes' \
--trigger-http \
--allow-unauthenticated