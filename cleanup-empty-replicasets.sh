#!/usr/bin/env bash

rs=$(kubectl get rs -o=template --template '{{range .items}}{{if eq .status.replicas 0.0}}{{.metadata.name}} {{end}}{{end}}')
if [[ ${#rs} -gt 0 ]]; then
  echo $rs | xargs kubectl delete rs
fi