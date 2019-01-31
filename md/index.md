# [kubernetes.rocks](https://kubernetes.rocks)

Kubernetes in Google Kubernetes Engine (GKE)

A site that is a presentation about how to setup itself
[github.com/softhouse/kubernetes.rocks](https://github.com/softhouse/kubernetes.rocks)

Last updated 2019-01-07


## Agenda

We're going to set up a simple site using Google Kubernetes Engine (GKE) and kubernetes.

This presentation in fact.


## Overview

- Docker Overview
- Kubernetes
- Google Cloud Platform
- Create Cluster
- Deploy this presentation
- Deployment breakdown
- Add letsencrypt https using helm
- Failure zone using Kubernetes API
- Continous Build and Delivery

Note:
What you can do
What you need to do
What you need to know about kubernetes
And then we'll get down and dirty


## Code along

- Examples are written in bash
  - us git bash or linux subsystem for windows
- All commands can be copy pasted

```bash
echo "hello world"
# hello world
```



# What is Docker

- Docker is the de-facto standard for Linux containers
- Wraps up software in a complete filesystem that contains everything it needs to run
- An isolated part of a system kernel running an app with exact known contents


## What is Docker: Isolation

- Containerization, not Virtualization
 - No need to start an entire VM
- Requires a Linux (or windows) kernel
- Isolation
 - Own file system root
 - Users, processes, mounts and Networks
 - Resource limitations
 - Capabilities


### What is Docker: Exact Known Contents

- Every change creates a signed image layer
 - No need to rebuild unchanged layers
 - One layer used in multiple images and containers
- `Dockerfile` defines how to build and run
 - Basically written in Linux shell
 - Everything it needs to run
 - Each command creates one layer


## Dockerhub

- public docker registry
 - store and retrieve images
- Official and user supplied
 - Dockerfiles for most occasions
 - Docker is only as safe as what you run
- Cloud providers have private repos

Note: In your org, you'll need a private registry, unless you want to share your code, and docker can be data intensive


# Dockerfile

```
FROM node:9.11.1

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

ARG NODE_ENV
ENV NODE_ENV $NODE_ENV
COPY package.json /usr/src/app/
RUN npm install && npm cache clean --force
COPY . /usr/src/app

CMD [ "npm", "start" ]
```

Note: Basically shell script with some extra keywords


## Dockerfile - onbuild

```bash
FROM 9.11.1:onbuild
```
Is built from the following Dockerfile
```
FROM node:9.11.1

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

ONBUILD ARG NODE_ENV
ONBUILD ENV NODE_ENV $NODE_ENV
ONBUILD COPY package.json /usr/src/app/
ONBUILD RUN npm install && npm cache clean --force
ONBUILD COPY . /usr/src/app

CMD [ "npm", "start" ]
```

Note: Public onbuilds are out of fashion, but still useful in your own organization


## Dockerfile - layers

```bash
docker build .
```

```
FROM node:9.2.0
RUN mkdir -p /usr/src/app       ---> d711612781e5
WORKDIR /usr/src/app            ---> 58525bf0631d
ARG NODE_ENV                    ---> d57dc54ceef5
ENV NODE_ENV $NODE_ENV          ---> 6b40f62bd2f1
COPY package.json /usr/src/app/ ---> b912817f51d9
RUN npm install \
 && npm cache clean --force     ---> 536aff58dcfd
COPY . /usr/src/app             ---> d2431641a39f
CMD [ "npm", "start" ]          ---> 984c1aace979
```


## Dockerfile - cache
make a change in `index.html`

```bash
docker build .
```

```
RUN mkdir -p /usr/src/app       ---> using cache d711612781e5
WORKDIR /usr/src/app            ---> using cache 58525bf0631d
ARG NODE_ENV                    ---> using cache d57dc54ceef5
ENV NODE_ENV $NODE_ENV          ---> using cache 6b40f62bd2f1
COPY package.json /usr/src/app/ ---> using cache b912817f51d9
RUN npm install \
 && npm cache clean --force     ---> using cache 536aff58dcfd
COPY . /usr/src/app             ---> ab1ea84627a0
CMD [ "npm", "start" ]          ---> ab1ea84627a0
```

Note:

Cache is bound to the docker daemon (server host) performing the build
.dockerignore is important to avoid cache misses


### Dockerfile - multi stage builds

```bash
FROM golang:alpine3.7 AS my-build
ENV GOPATH /go
RUN apk add --no-cache git \
&& go get -u github.com/googlecloudplatform/gcsfuse

FROM alpine:3.7
RUN apk add --no-cache ca-certificates fuse mysql-client \
&& rm -rf /tmp/*
COPY --from=build /go/bin/gcsfuse /usr/local/bin
```
Can build a specific build phase:
```bash
docker build --target my-build
```
Note: All of this is executed inside containers so build systems don't need dependencies.


### Docker summary

- Runs an isolated process and filesystem
- Just add a Dockerfile to your repo
- Cryptographically signed software from repo to image
- Tons of good (and bad) examples on dockerhub
- How do we run in production? Kubernetes!

Note: There's a little bit more to it, but we'll cover that in the kubernetes part



## What is kubernetes

Open-source cloud-provider agnostic orchestration system for containerized applications.

- An API for running containers on a cluster of nodes
 - Define your product as abstract resources
 - Same definition on cloud and local cluster
- Built for google-scale with google-scale complexity in mind.


## Kubernetes - Components

An API for running containers on a cluster of nodes

- API - Both on master and nodes
- Scheduler - starts containers on nodes
- Controllers - acts on differences between wanted and actual state
  - kube controller - manages kubernetes resources
  - cloud controller - manages cloud resources
- etcd - data backing of cluster state


### Google Kubernetes Engine (GKE)

- Managed Kubernets on Google Cloud Platform
- Uses Google Compute Engine (GCE) Resources to run and monitor your cluster and containers.
- Built-in support for multiple zones and regions, endpoints, load balancers and other GCP services.
- Free Master nodes - only see and pay for worker nodes

Note: VMs, load balancers, disks etc will be visible as regular cloud resources



## Google Cloud Platform

**Google Cloud Platform (GCP)** is the public cloud offering by google

**Google Cloud** includes GCP and services offered by google such as gmail, g-suite and drive

Data stored in GCP is always yours


<!-- .slide: data-background="https://www.datacenterknowledge.com/sites/datacenterknowledge.com/files/wp-content/uploads/2008/08/google-cloud-platform-infra-map.jpg" data-background-size="contain" data-background-position="center" -->

Note: This is actually what GCP is. There are Regions and in each region there are redundancy zones


## GCP - Pricing and Quotas

Provides compute resources and managed services

- Pay as you go per minute for RAM, CPU, disk etc
  - 30% off consistently used resources
  - Promotes elastic infrastrucutre
- Quotas are limits for things that cost
 - Small quota requests are automatically approved
 - Trials have hard limits (8 CPU)


## GCP - Getting Started

Set up a GCP project and Install the tools you need to deploy this application.


### GCP - Getting Started: Project

1. Create a new project at [google cloud console](https://console.cloud.google.com)
1. Enable free trial or set up a billing account


### GCP - gcloud CLI

1. Install [google cloud SDK](https://cloud.google.com/sdk/downloads)
```bash
brew cask install google-cloud-sdk # for mac
alias gcloud='gcloud.cmd' #for git bash
```
1. Install components (Beta means not covered by SLA)
```bash
# run in cmd.exe not git bash for windows
gcloud components install kubectl beta
```
1. Select or create a GCP project to use
```bash
gcloud init
```

Note:

For windows, gcloud.cmd isn't aliased to gcloud by default, making copy-pasting code from the presentation a hassle unless you set an alias
For windows use the interactive installer, for linux, don't use apt/yum cause the gcloud update commands won't work
Commands can differ if they're prefixed by beta


## GCP quotas and GKE

kubernetes resources uses GCP resources:

* Resources are subject to quotas
 * Limit errors reported in [Web console](https://console.cloud.google.com)
 * Kubernetes commands stuck pending
* External IPs, CPU, backend-services, Disk etc
* Increased requests are generally auto-approved

[Quotas](https://console.cloud.google.com/iam-admin/quotas?usage=USED) used to view usage and increase quotas

Note:

If your kubernetes resources fail to initialize and are stuck in pending or similar, check for notifications at console.cloud.google.com



## Create a Cluster

You need a cluster to code along, can be either a GKE cluster or local development cluster


### GKE - Create A Cluster

Enable Services :
```bash
gcloud services enable container.googleapis.com
gcloud services enable containerregistry.googleapis.com
```
Create an autoscaling, multi-zone, preemptible cluster
```bash
gcloud beta container clusters create "my-cluster" \
    --scopes cloud-platform \
    --enable-autoscaling --max-nodes=3 --min-nodes=0 \
    --num-nodes 1 --machine-type g1-small \
    --node-locations=europe-north1-a,europe-north1-b,europe-north1-c \
    --disk-size 10 \
    --preemptible \
    --zone=europe-north1-a \
    --cluster-version=1.11.5-gke.5
```

beta commands not covered by SLA (preemptible)

Note:

Scope configures what the nodes in the cluster are allowed to do, and cannot be changed without creating a new node pool.
zones and regions: google cloud is a globally spanning network with datacenters in certain regions, within each datacenters are zones with separate networking, cooling, electricity etc. zonal outages can occur
num nodes is number of nodes per zone, so 3 nodes initially.
machine-type matches on in "gcloud compute machine-types list".


#### Docker (for windows and mac)

Docker includes local kubernetes cluster:

`Docker` -> `preferences` ->`kubernetes` -> `enable kubernetes`

* No Role Based Access Control (RBAC) support yet
* Need to [install own ingress controller](https://kubernetes.github.io/ingress-nginx/deploy/):

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/master/deploy/provider/cloud-generic.yaml
```


### Set kubernetes Context

`kubectl` commands are sent to the active context

GKE

```bash
gcloud container clusters get-credentials my-cluster --region europe-north1
```

Plain Kubernetes

```bash
kubectl config get-contexts
kubectl config use-context docker-for-desktop
```

Docker for desktop has a context menu for switching


#### Kubernetes (Standard) Dashboard

GKE recommends a proprietary [Kubernetes Engine](https://console.cloud.google.com/kubernetes/workload) GUI

- **GKE**: Added as an addon at cluster creation <br> `--addons=KubernetesDashboard`
- **local**: Added by executing:

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/dashboard/v1.10.1/src/deploy/recommended/kubernetes-dashboard.yaml
```

start a proxy and browse to [localhost:8001/...](http://localhost:8001/api/v1/namespaces/kube-system/services/https:kubernetes-dashboard:/proxy/)

```bash
kubectl proxy
```

How to get a token if file login doesn't work

```bash
kubectl get secret -o jsonpath='{.items[?(@.metadata.annotations.kubernetes\.io/service-account\.name == "default")].data.token}' | base64 --decode
```

Note: Logging in can be a bit of a pain. If kubeconfig file doesn't work, use a tokeb




## Deploy the presentation

Let's build the image deploy this presentation in kubernetes


## Build

Build and tag the docker image

```bash
GCLOUD_PROJECT=$(gcloud config get-value project)
NAME=kubernetes-rocks
VERSION=0.0.1
IMAGE=eu.gcr.io/${GCLOUD_PROJECT}/${NAME}:${VERSION}
docker build . -t ${IMAGE}
# IMAGE=eu.gcr.io/kubernetes-rocks/kubernetes-rocks:0.0.1
# for local development use IMAGE=${NAME}:${VERSION}
```
- Tag is a URL where to push and fetch the image


## Deploy the Image

List all the resources on the cluster
```bash
kubectl get all
# service/kubernetes   ClusterIP   10.96.0.1    <none>        443/TCP   5h56m
```
Let's run something and see what happens
```bash
kubectl run kubernetes-rocks --image=${IMAGE}
${NAME}:${VERSION}
# kubernetes-rocks:0.0.1
```


### Deploy the Image - What happened?

List all the resources on the cluster again

```bash
kubectl get all
# NAME                                    READY   STATUS    RESTARTS   AGE
# pod/kubernetes-rocks-7756c54769-d29hj   1/1     Running   0          16s
#
#
# NAME                               READY   UP-TO-DATE   AVAILABLE   AGE
# deployment.apps/kubernetes-rocks   1/1     1            1           16s
#
# NAME                                          DESIRED   CURRENT   READY   AGE
# replicaset.apps/kubernetes-rocks-7756c54769   1         1         1       16s
# ...
```

We've created a **pod**, a **replicaset** and a **deployment**


### Expose the Service

We need to expose the service to reach it outside the cluster

```bash
kubectl expose deploy kubernetes-rocks --port=80 --target-port=8000
# service/kubernetes-rocks exposed
```



## Kubernetes: Learning Curve

- Large scale production applications
 - Feels complex compared to docker-compose
 - Made for deployment, not development
 - Addresses problems you don't yet have
- Succinctly Documented at [kubernetes.io](https://kubernetes.io/docs)

Note:

For someone used to native docker's or docker-compose ease of use and intuitiveness, you're going to have a bad time.
Resources must be explicitly created always instead of created implicitly when needed as with docker.
Formats are meant for control in deployments, not ease of use in development
You'll need to read the documentation a couple of times for it to make sense


## Kubernetes: Resources

Application defined as a collection of resources
* `kubectl get`: Lists types
* `kubectl get type`: List resources of type
* `kubectl get type/name`: List specific resource
* `kubectl get type/name -o=yaml`:

Prints a resource in yaml notation

Note:
Here's the first odd thing about kubernetes, you need to specify -o yaml or json to actually get the active configuration of a resource.
The active configuration contains the current state of the resource, mixing information provided when setting up the resource and generated states in the cluster.


## Kubernetes: Resources
Created using commands or yaml/json files
* `kubectl create/expose/run ...`
* `kubectl apply/create -f file.yaml`
* Resources always defined in yaml/json spec
* Files are easier to version control
 * Reproducibility is key

Note:
Resources always result in a resource defined in yaml/json notation.



## Kubernetes: Resource Types

```
$ kubectl get
You must specify the type of resource to get. Valid resource types include:

    * configmaps (aka 'cm')
    * daemonsets (aka 'ds')
    * deployments (aka 'deploy')
    * horizontalpodautoscalers (aka 'hpa')
    * ingresses (aka 'ing')
    * jobs
    * namespaces (aka 'ns')
    * networkpolicies
    * nodes (aka 'no')
    * persistentvolumeclaims (aka 'pvc')
    * persistentvolumes (aka 'pv')
    * pods (aka 'po')
    * replicasets (aka 'rs')
    * secrets
    * serviceaccounts (aka 'sa')
    * services (aka 'svc')
    * statefulsets
```

Let's limit ourselves to the ones you need to get started including some ~~good practices~~ caveats


### Resources: Namespace

* Used to separate and organize resources
* User access can be granted on namespace level
```bash
kubectl get pods -n kube-system
```


#### Resources: Role-Based Access Control

configure policies through the Kubernetes API
* `[Cluster]Role`: grants access to resources
* `[Cluster]RoleBinding`: grants roles to user(s)

Cluster means cluster wide, otherwise namespace

First you need to grant admin role to your user:

```bash
kubectl create clusterrolebinding \
  your-user-cluster-admin-binding \
  --clusterrole=cluster-admin \
  --user=jonas.eckerstrom@softhouse.se
```
```bash
kubectl apply -f dashboard-rbac.yaml
```


### Resources: Secrets and ConfigMaps

Obfuscated (not encrypted) and plain configuration:

```bash
$ kubectl create secret tls tls-secret \
 --cert=tls.cert --key=tls.key
```

```bash
$ kubectl create secret generic google-application-creds \
 --from-file=./google-application-credentials.json
```

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: some-config
data:
  somekey: someValue
  filename.ext: |
    enemies=aliens
 ```

Provided to pods as environment variables or files

Note:
Secrets can be generic, tls or docker-registry, configmaps are always generic.
Files are updated almost immediately, environment vars aren't


### Resources: Ingress

Point of ingress to your services: http(s) load balancer
* tls secret configures and enables https
* Can install your own ingress controller
* Default GCP ingress controller
 * Scalable but functionally limited
 * Very slow to reconfigre at times ~15min

```yaml
  apiVersion: extensions/v1beta1
  kind: Ingress
  metadata:
    name: breakfast-rocks
  spec:
    tls:
      secretName: tls-secret
```

Note: Ingress is traffic going into your services, Egress is traffic leaving your services. In GCP you don't pay for Ingress.


### Resources: Ingress (spec ctd)

* Can route on host/path or default "backend"
* host routing doesn't configure cloud DNS

```yaml
        backend:
          serviceName: breakfast-rocks
          servicePort: 8000
        rules:
        - host: breakfast.kubernetes.rocks
          http:
            paths:
            - path: /*
              backend:
                serviceName: breakfast-rocks
                servicePort: 8000
```

```bash
kubectl apply -f ingress.yaml
```
Note:
default backend maps to a default "no service 404" service in kubernetes unless specified.
I'd recommend using host based routing since you can use query language to fetch hostname info and configure your dns zones automatically using scripts. No it's not automatically handled...



### Resources: Deployment

* Creates pod (container) and replicaset
```yaml
apiVersion: extensions/v1beta1
kind: Deployment
metadata:
    name: breakfast-rocks
spec:
    replicas: 2
    template:
      metadata:
        labels:
          name: breakfast-rocks
          version: 0.2
...
```

Note:
A deployment creates 3 resources, the deployment itself, replicaset and pod
metadata is mandatory, the name is the identifier used to map between resources. names are unique on a resource type level so we could keep the same names for everything, names have been made unique in this presentation for sake of clarity.


### Resources: Deployment (spec ctd)

* ReadinessProbe is mandatory for GKE LB
 * needs to  reply 200 or LB reports 503
 * Defaults to `/`
 * GCP requires port same as service

```yaml
        spec:
          containers:
          - name: breakfast-rocks
            image: node:alpine
            ports:
            - containerPort: 8000
            readinessProbe:
              httpGet:
                path: /healthz
                port: 8000
```

```bash
kubectl apply -f deployment.yaml
```

Note:
Second spec block (yes, there is a second spec block) is the container spec
Name is used to map to ingress
image specifies the image to run, no '.', needs to point to registry, one is included in gke. It's placeholder until we build and deploy our pod
specify environment, mounts etc here


### Resources: Deployment caveats

Deployment also creates pods and replicaset.

Only Removes Pods

Query using Go Template or JSONpath

```bash
kubectl get rs -o template --template '{{range .items}}\
{{if eq .status.replicas 0}}{{.metadata.name}} {{end}}{{end}}'
```

```bash
kubectl get rs -o jsonpath=\
'{.items[?(@.status.replicas == 0)].metadata.name}'
```

Note:
A deployment creates 3 resources, the deployment itself, replicaset and pod, but leaves the replicaset at the moment
If you re-apply your deployment (like we did) you'll eventually exhaust cluster resources due to unused replicasets
This is the prefect segway to tell a little bot about how to query resources, and some caveats with that too
JSONPath and go template is availble, all numbers must be implicitly cast to float so append decimals when querying...



### resources: Service

Creates service that defines services as pod ports

```yaml
kind: Service
apiVersion: v1
metadata:
  name: breakfast-rocks
spec:
  selector:
    name: breakfast-rocks
  ports:
  - port: 8000
  type: NodePort
```

* `NodePort` maps to ingress on random port
* `LoadBalancer` creates a TCP loadbalancer
* `ClusterIp` routes traffic using iptables

Note:
For https use ingress/nodeport and specify tls secret in ingress
For TCP use plain loadbalance
Both options will create a GCP google cloud load balancer



### Build & Deploy

Time to build an image and deploy it to the cluster


## Build
Image needs to be different for upgrade to happen

`VERSION` below

```bash
GCLOUD_PROJECT=$(gcloud config get-value project)
NAME=breakfast-rocks
VERSION=$(cat /dev/urandom | LC_ALL=C tr -dc 'a-z0-9' | fold -w 8 | head -n 1)
IMAGE=eu.gcr.io/${GCLOUD_PROJECT}/${NAME}:${VERSION}
```

Docker build and push

```bash
gcloud auth configure-docker # Once per client
docker build -t ${IMAGE} .
docker push ${IMAGE}
```

Note:
Address to gcloud registry is eu.gcr.io or gcr.io for US (don't mix registry and cluster regions, you'll get a registry error when pods pull images), followed by project, name and version
The version environment variable is just a one-liner to generate a random string in bash
Two options: cloud builder means you don't need local docker but you always send the complete build context (no local docker, but uploads more data). Classic docker means you build locally, but you'll only send the layers that diff in the image (local docker required, but smaller uploads, if you do proper Dockerfiles.
You can of course use any registry


## Deploy
Replace image

```bash
kubectl set image deployment/breakfast-rocks \
breakfast-rocks=${IMAGE}
```

Check the status

```bash
$ kubectl get pods
NAME                                       READY     STATUS              RESTARTS   AGE
breakfast-rocks-1717013009-93k6b   0/1       ContainerCreating   0          28s
breakfast-rocks-1717013009-njzvc   0/1       ContainerCreating   0          28s
breakfast-rocks-2040691132-r0d4b   0/1       Running             0          39m
```

Rolling upgrades by default!

Note:
If image is the same, nothing happens.
If you push something that makes the health check fail, the new containers will never take traffic
you can set how many remaining containers you want in the replicaset/deployment configuration



## Cloud DNS Zone

Crete managed zone

```
gcloud dns managed-zones create kubernetes-rocks \
  --dns-name=kubernetes.rocks \
  --description "kubernetes rocks"
```

Add described NS records or "set nameservers"

```
gcloud dns managed-zones describe kubernetes-rocks
nameServers:
- ns-cloud-e1.googledomains.com.
- ns-cloud-e2.googledomains.com.
- ns-cloud-e3.googledomains.com.
- ns-cloud-e4.googledomains.com.
```

Note:
Randomly assigns between a-e so make sure to describe each zone and not make assumptions


## Cloud DNS Records

DNS config not automatic in GCP

Ingress IP is ephemeral (randomly assigned)

```bash
$ kubectl get ing
NAME                              HOSTS              ADDRESS        PORTS     AGE
breakfast-rocks-ingress   kubernetes.rocks   35.190.10.52   80, 443   6d
```

```bash
gcloud dns record-sets transaction start -z=kubernetes-rocks
gcloud dns record-sets transaction add 35.190.10.52 \
  --name=kubernetes.rocks --ttl=300 --type=A \
  --zone=kubernetes-rocks
gcloud dns record-sets transaction execute -z=kubernetes-rocks
```

Note:
Transaction creates a temporary yaml in the current directoy(!) file so if you can't start a new session, delete the yaml
Currently cannot be run in git bash on windows, only windows cmd, yaay



## Recap (45 minute mark)
* Install gcloud and kubectl
* Enable APIs
* Create cluster and log in
* Create deployment and nodeport service
* Create ingress
* Create DNS zone for host
* Add A record to ingress ip



### Bonus: letsencrypt
Let's add letsencrypt tls using [kube-lego](https://github.com/jetstack/kube-lego) and [helm](https://github.com/kubernetes/helm)

Directly from kube-lego chart [README.md](https://github.com/kubernetes/charts/tree/master/stable/kube-lego)


## Helm
Kubernetes package manager
* charts - mustache templated yaml files
* template values from values.yaml
* release and upgrade handling
* charts can depend on charts
* private and public chart repositories

Dockerhub for kubernetes


## Cert-Manager: helm install
Initialize the tiller agent and grant permissions once per cluster:
```bash
kubectl apply -f helm-rbac.yaml
helm init --service-account tiller
# helm init --service-account default #for local kubernetes
```
Install the chart
```bash
helm install stable/cert-manager \
    --name cert-manager \
    --namespace kube-system \
    --set ingressShim.extraArgs='{--default-issuer-name=letsencrypt,--default-issuer-kind=ClusterIssuer}'
```


## Cert-Manager: Issuer

Cert-Manager adds a new resource type
```yaml
apiVersion: certmanager.k8s.io/v1alpha1
kind: ClusterIssuer
metadata:
  name: letsencrypt
spec:
  acme:
    server: https://acme-v01.api.letsencrypt.org/directory
    email: jonas.eckerstrom@softhouse.se
    privateKeySecretRef:
      name: letsencrypt-private-key
    http01: {}
```


## Cert-Manager Ingress
Add annotations to metadata block
```
    annotations:
      kubernetes.io/tls-acme: "true"
      kubernetes.io/ingress.class: "gce"
```
And a uniquely named secret name
```
    tls:
    - hosts:
      - kubernetes.rocks
      secretName: breakfast-rocks-tls
```


## Cert-Manager: Validation
Configuring GCE global load balancer is slow (15-20m)

Check that secrets have been created for accounts and certs:
```
kubectl get secrets
kube-lego-account             Opaque           
breakfast-rocks-tls   kubernetes.io/tls
```


## CAA Record
Add a CAA record specifying issuer
```
gcloud dns record-sets transaction start -z=kubernetes-rocks
gcloud dns record-sets transaction add "1 issue 'letsencrypt.org'" \
  --name=kubernetes.rocks --ttl=300 --type=CAA \
  --zone=kubernetes-rocks
gcloud dns record-sets transaction execute -z=kubernetes-rocks
```



### Bonus: Access kubernetes API
* Grant access to read API
* api available to pods on localhost:8001


## Add a sidecar
Append another container to deployment.yaml
```yaml
- name: kubectl
  image: gcr.io/google_containers/kubectl:v1.0.7
  args:
  - proxy
```
```bash
kubectl get pods
kubectl exec -it <pod name> -c kubectl -- /kubectl version --short --client
v1.0.7
```

Note:
-c kubectl means that we're running this command on the kubectl container in the pod
kubectl exec command seems to ignore entrypoints so /kubectl needs to be explicitly added.
-- tells the (outer/first) kubectl command to stop consuming args and pass them on to the command


## Test
curl the api from the presentation container
```
kubectl get pods
kubectl exec <pod> -c breakfast-rocks curl localhost:8001
{
 "paths": [
   "/api",
   "/api/v1",
   "/apis",
...
```


## Downward API
We can use the downward api to fetch information without using the kubectl api:
```
env:
- name: NODENAME
  valueFrom:
    fieldRef:
      fieldPath: spec.nodeName
```


### Which zone are we in?
```
kubectl exec <pod> -c breakfast-rocks curl localhost:8001
curl localhost:8001/api/v1/nodes/$NODENAME 2>/dev/null \
 | grep failure-domain.beta.kubernetes.io/zone
```



## Continous Build and Deployment
Build on push using Container Registry Build Triggers
* Works with google, github and bitbucket repos
* Always starts with empty build cache
  * Use latest as build cache (tag must exist)
```
gcloud container builds submit \
  --tag eu.gcr.io/${GCLOUD_PROJECT}/${NAME}:latest .
```


## Add Permissions to Cloud Builder
[project settings](https://console.cloud.google.com/iam-admin/iam/project)
list cloud builder account:
```
MEMBER=$(gcloud projects get-iam-policy $GCLOUD_PROJECT | \
sed -n 's/.*\(serviceAccount:.*cloudbuild\)/\1/p')
  serviceAccount:561729793625@cloudbuild.gserviceaccount.com
```
grant object viewer (pull cache) and container developer (deploy) permissions
```
gcloud projects add-iam-policy-binding $GCLOUD_PROJECT --role roles/storage.objectViewer --member=$MEMBER 
gcloud projects add-iam-policy-binding $GCLOUD_PROJECT --role roles/container.developer --member=$MEMBER
```


## Add trigger
[triggers](https://console.cloud.google.com/gcr/triggers) click `Add Trigger`:
1. Select repo source, google, github or bitbucket
1. Authenticate using ouath
1. Create trigger
  * Trigger type: branch or tag
  * Build config: cloudbuild.yaml
  * substitutions: *see next slide*


## Add trigger: substitutions
Slightly overkill, but allows for a generic yaml
* `_REPO_NAME`: kubernets-rocks
* `_DEPLOYMENT`: breakfast-rocks
* `_GCR`: eu.gcr.io
* `_CONTAINER_NAME`: breakfast-rocks
* `_CLUSTER`: my-cluster
* `_CLUSTER_ZONE`: europe-west1-b

click `Create trigger`


## Add cloudbuild.yaml
Pull latest to populate cache
```
steps:
- name: 'gcr.io/cloud-builders/docker'
  args: ['pull', '${_GCR}/$PROJECT_ID/${_REPO_NAME}:latest']
```
build using cache and tag both commit id and latest, 
```
- name: 'gcr.io/cloud-builders/docker'
  args: ["build", \
  "-t", "${_GCR}/$PROJECT_ID/${_REPO_NAME}:$COMMIT_SHA", \
  "-t", "${_GCR}/$PROJECT_ID/${_REPO_NAME}:latest", \
  '--cache-from', '${_GCR}/$PROJECT_ID/${_REPO_NAME}:latest', "."]
```


## Add cloudbuild.yaml
Push the image to avoid `ImagePullBackOff`
```
- name: 'gcr.io/cloud-builders/docker'
  args: ["push", "$_GCR/$PROJECT_ID/$_REPO_NAME:$COMMIT_SHA"]
```
Set the image of the deployment
```
- name: 'gcr.io/cloud-builders/kubectl'
  env: ['CLOUDSDK_COMPUTE_ZONE=$_CLUSTER_ZONE', \
        'CLOUDSDK_CONTAINER_CLUSTER=$_CLUSTER']
  args: ['set', 'image', 'deployment/${_DEPLOYMENT}', '${_CONTAINER_NAME}=${_GCR}/$PROJECT_ID/${_REPO_NAME}:$COMMIT_SHA']
```
Push latest
```
images: ['${_GCR}/$PROJECT_ID/${_REPO_NAME}:latest']
```


## Commit and push
```
git add .
git commit -m "Added cloudbuild.yaml"
git push origin master
```
Deployed!
```
kubectl get pods
  breakfast-rocks-2991560192-3rb72   2/2       Terminating   0          2m
  breakfast-rocks-764977494-fkspx    2/2       Running       0          20s
  breakfast-rocks-764977494-pk3bf    1/2       Running       0          20s
```
<!-- .element: class="slides-link" -->
