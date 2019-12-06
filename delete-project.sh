#!/bin/bash

# Connect to saas project
gcloud container clusters get-credentials fr-saas-feature-test --zone us-west1-c --project fr-saas-feature-test

# Forward to saas-api
make saas-api-port
# POD_NAME=$$(kubectl get pods -n saas-public --selector=app=saas-api -o jsonpath='{.items[0].metadata.name}') && \
#   kubectl port-forward -n saas-public $$POD_NAME 8889:8080

# Delete the project
curl -X DELETE http://localhost:8889/v1/project/$1

echo Remember to re-connect to your GCP project