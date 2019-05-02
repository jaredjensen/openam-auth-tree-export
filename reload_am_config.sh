#!/bin/bash

kubectl scale --replicas=0 deploy/org-engine -n org-system
helm delete --purge amster configstore openam
kubectl delete pvc db-configstore-0 -n fr-platform
kubectl scale --replicas=1 deploy/org-engine -n org-system