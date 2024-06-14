#!/bin/bash

echo "$1" | base64 -d > manifest/configmap.yaml
