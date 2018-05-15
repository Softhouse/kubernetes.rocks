<!-- .slide: data-background="resources/index.jpg" -->

# [breakfast.kubernetes.rocks](https://breakfast.kubernetes.rocks)
Kubernetes in Google Kubernetes Engine (GKE)

A site that is a presentation about how to setup itself
[github.com/softhouse/kubernetes.rocks](http://github.com/softhouse/breakfast.kubernetes.rocks)

Last updated 2018-05-08


## Agenda

We're going to set up a simple site using Google Kubernetes Engine (GKE) and kubernetes.

This presentation in fact.


## Overview
- Docker Overview
- Prerequisites
- Kubernetes and GKE Crash Course
- Create Cluster
- Deploy this presentation
- Add letsencrypt https using helm
- Failure zone using Kubernetes API
- Continous Build and Delivery

Note:
What you can do
What you need to do
What you need to know about kubernetes
And then we'll get down and dirty


# What is Docker 
- Docker is the de-facto standard for Linux containers
- Wraps up a piece of software in a complete filesystem that contains everything it needs to run
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

Note: In your org, you'll need a private registry, since docker is data intensive


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
FROM golang:alpine3.7 as build
ENV GOPATH /go
RUN apk add --no-cache git \
&& go get -u github.com/googlecloudplatform/gcsfuse

FROM alpine:3.7
RUN apk add --no-cache ca-certificates fuse mysql-client \
&& rm -rf /tmp/*
COPY --from=build /go/bin/gcsfuse /usr/local/bin
```

Note: All of this is executed inside containers so build systems don't need dependencies.


### Docker summary

- Runs an isolated process and filesystem
- Just add a Dockerfile to your repo
- Cryptographically signed software from repo to image
- Tons of good (and bad) examples on dockerhub
- You run them im kubernetes :)

Note: There's a little bit more to it, but we'll cover that in the kubernetes part



## GKE - Prerequisites

Limitations on what kind of software you can deploy, setting up a GCP project and installing the software you need to deploy this application.


### GKE - Prerequisites: Application

- Containers only
- Docker containers only
- Linux containers only


### GKE - Prerequisites: Project

1. Create a new project at [google cloud console](https://console.cloud.google.com)
1. Enable free trial or set up a billing account
1. Click container engine and enable it or execute
```bash
gcloud services enable container.googleapis.com
gcloud services enable containerregistry.googleapis.com
```
1. Wait for container engine to become available

Note:

Remembering which apis to enable can be a hassle, recommend writing down the full name or even yet, include a small script


### GKE - Prerequisites: Tools

1. Download and install [google cloud SDK](https://cloud.google.com/sdk/downloads)
```bash
cask install google-cloud-sdk # for mac
alias gcloud='gcloud.cmd' #for git bash
```
1. Install components (Beta not covered by SLA)
```bash
gcloud components install kubectl beta
# cmd.exe not git bash for windows
```
1. Log in (second line optional, if you're having issues)
```bash
gcloud init
gcloud auth application-default login
gcloud config set compute/zone europe-west1-b
```

Note:

For windows, gcloud.cmd isn't aliased to gcloud by default, making copy-pasting code from the presentation a hassle unless you set an alias
For windows use the interactive installer, for linux, don't use apt/yum cause the gcloud update commands won't work
Commands differ if they're prefixed by beta



### Create A Cluster
Create an autoscaling cluster with nodes in 3 zones:

```bash
gcloud beta container clusters create "my-cluster" \
    --scopes cloud-platform \
    --enable-autoscaling --max-nodes=3 --min-nodes=0 \
    --num-nodes 1 --machine-type f1-micro \
    --node-locations=\
      europe-west1-b,europe-west1-c,europe-west1-d \
    --disk-size 10 \
    --preemptible \
    --cluster-version=1.9.7-gke.0
```

preemptible is ~80% off with built-in failure testing :)

beta commands not covered by SLA

Note:

Scope configures what the nodes in the cluster are allowed to do, and cannot be changed without creating a new node pool.
num nodes is number of nodes per zone, so 3 nodes initially.
machine-type matches on in "gcloud compute machine-types list".


## cluster version?

Does not default to latest available version

List available upgrades:

```
gcloud container get-server-config

```

And upgrade, master first:

```
gcloud container clusters upgrade \
 --cluster-version=1.9.7-gke.0 my-cluster --master
gcloud container clusters upgrade \
 --cluster-version=1.9.7-gke.0 my-cluster
```


### Set kubernetes context to cluster
`kubectl` commands are sent to the active context

Adds the gke context to config and activates it

```
gcloud container clusters get-credentials my-cluster
```

To manually switch contexts

```
kubectl config get-contexts
kubectl config use-context <context>
```


## Kubernetes Dashboard

Start a proxy to access a GUI http://localhost:8001/ui

Not Recommended in GKE, use [Kubernetes Engine](https://console.cloud.google.com/kubernetes/workload) GUI

```
kubectl proxy &
```



# Kubernetes and GKE Crash Course

Bare minimum :)


## Kubernetes

* Open-source cloud-provider agnostic orchestration system for containerized applications.
 * Define your product as abstract resources
 * Same definition on cloud and local providers
* Built for google-scale with google-scale complexity in mind.


### Google Kubernetes Engine (GKE)

* Managed Kubernets on Google Cloud Platform
* Uses Google Compute Engine (GCE) Resources to run monitor your cluster and containers.
* Built-in support for multiple zones and regions, endpoints, load balancers and other GCP services.


## GKE and GCP quotas

kubernetes resources uses GCP resources:
* Subject to quotas
 * Limit errors reported in [Web console](https://console.cloud.google.com)
 * Kubernetes commands successful but pending forever
* External IPs, CPU, backend-services, Disk etc
* Increased requests are generally auto-approved

Note:

If your kubernetes resources fail to initialize and are stuck in pending or similar, check for notifications at console.cloud.google.com


## Kubernetes: Learning Curve

- Large scale production applications
 - Initially feels complex for small deployments
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

Note:
Resources always result in a resource defined in yaml/json notation.


## Kubernetes: Resource Types

```
$ kubectl get
You must specify the type of resource to get. Valid resource types include:

    * clusters (valid only for federation apiservers)
    * componentstatuses (aka 'cs')
    * configmaps (aka 'cm')
    * daemonsets (aka 'ds')
    * deployments (aka 'deploy')
    * endpoints (aka 'ep')
    * events (aka 'ev')
    * horizontalpodautoscalers (aka 'hpa')
    * ingresses (aka 'ing')
    * jobs
    * limitranges (aka 'limits')
    * namespaces (aka 'ns')
    * networkpolicies
    * nodes (aka 'no')
    * persistentvolumeclaims (aka 'pvc')
    * persistentvolumes (aka 'pv')
    * pods (aka 'po')
    * podsecuritypolicies (aka 'psp')
    * podtemplates
    * replicasets (aka 'rs')
    * replicationcontrollers (aka 'rc')
    * resourcequotas (aka 'quota')
    * secrets
    * serviceaccounts (aka 'sa')
    * services (aka 'svc')
    * statefulsets
    * storageclasses
    * thirdpartyresources
```

Let's limit ourselves to the ones you need to get started including some ~~good practices~~ caveats


### Namespace

* Used to separate and organize resources
* User access can be granted on namespace level
```
kubectl get pods -n kube-system
```


### Role-Based Access Control

configure policies through the Kubernetes API
* `[Cluster]Role`: grants access to resources
* `[Cluster]RoleBinding`: grants roles to user(s)

Cluster means cluster wide, otherwise namespace

Enabled in kubernetes 1.8 by default:

```
kubectl apply -f dashboard-rbac.yaml
```


### Resource: Secrets and ConfigMaps

Obfuscated (not encrypted) and plain configuration:

```
$ kubectl create secret tls tls-secret \
 --cert=tls.cert --key=tls.key
```

```
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
            image: nbrown/revealjs
            ports:
            - containerPort: 8000
            readinessProbe:
              httpGet:
                path: /
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
  name: hello-world
spec:
  selector:
    app: hello-world
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

```
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

```
kubectl set image deployment/breakfast-rocks \
breakfast-rocks=${IMAGE}
```

Check the status

```
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

```
$ kubectl get ing
NAME                              HOSTS              ADDRESS        PORTS     AGE
breakfast-rocks-ingress   kubernetes.rocks   35.190.10.52   80, 443   6d
```

```
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


## kube-lego: values.yaml

Download default values.yaml from [github](https://github.com/kubernetes/charts/blob/master/stable/kube-lego/values.yaml):

```
config:
  LEGO_EMAIL: jonaseck@gmail.com
  ## Let's Encrypt API endpoint
  LEGO_URL: https://acme-v01.api.api.letsencrypt.org/directory
  ## Production: https://acme-v01.api.letsencrypt.org/directory
  ## Staging: https://acme-staging.api.letsencrypt.org/directory
```


## kube-lego: helm install
Initialize the tiller agent and grant permissions once per cluster:
```
kubectl apply -f helm-rbac.yaml
helm init --service-account tiller
# helm init --service-account default #for local kubernetes
```
Install the chart
```
helm install stable/kube-lego -f kube-lego.values.yaml
```


## kube-lego: Ingress
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


## kube-lego: GKE health check
Sometimes randomly picks request path from other hs:
Nodeport mapping port used as identifier in GCE
```
kubectl get svc | grep kube-lego
  kube-lego-gce    8080:30217/TCP
```
Find the health check
```
compute health-checks list | grep 30217
  k8s-be-30217--0e502c18fbf266a2  HTTP
```
List request path and update to `/healthz` if needed
```
gcloud compute health-checks describe k8s-be-30217--0e502c18fbf266a2 | grep requestPath
  requestPath: /some-other-path
gcloud compute health-checks update http k8s-be-30217--0e502c18fbf266a2 --request-path=/healthz
```


## kube-lego: Validation
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
* Add a kubectl sidecar that runs kubectl proxy
* api available to pods on localhost:8001


## Add a sidecar
Append another container to deployment.yaml
```
- name: kubectl
  image: gcr.io/google_containers/kubectl:v1.0.7
  args:
  - proxy
```
```
kubectl get pods
kubectl exec -it <pod name> -c kubectl -- /kubectl version --short --client
v0.18.0-120-gaeb4ac55ad12b1-dirty
```
Image is old, let's update to your current version

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
