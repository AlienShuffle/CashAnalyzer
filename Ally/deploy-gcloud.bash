gcloud functions deploy 'getallyquotes' \
--runtime=nodejs16 \
--region='us-central1' \
--source=. \
--entry-point='getAllyQuotes' \
--trigger-http \
--allow-unauthenticated