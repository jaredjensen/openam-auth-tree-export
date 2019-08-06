#!/bin/bash

kubectl patch cronjobs org-engine -n org-system  -p '{"spec" : {"suspend" : true }}'
kubectl scale --replicas=0 deploy/amster --namespace fr-platform
helm delete --purge userstore openam
kubectl delete pvc db-userstore-0 --namespace fr-platform
kubectl scale --replicas=1 deploy/amster --namespace fr-platform
kubectl patch cronjobs org-engine -n org-system  -p '{"spec" : {"suspend" : false }}'