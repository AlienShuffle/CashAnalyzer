gcloud functions deploy 'getallyquotes' \
--runtime=nodejs16 \
--memory=512MB \
--region='us-central1' \
--source=. \
--entry-point='getAllyQuotes' \
--trigger-http \
--allow-unauthenticated