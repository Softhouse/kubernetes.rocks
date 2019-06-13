# [kubernetes.rocks](https://kubernetes.rocks)

Kubernetes in Google Kubernetes Engine (GKE)

A site that is a presentation about how to setup itself
[github.com/softhouse/kubernetes.rocks](https://github.com/softhouse/kubernetes.rocks)

Last updated 2019-02-25


## Agenda

We're going to set up a simple site using Google Kubernetes Engine (GKE) and kubernetes.

This presentation in fact.


## Overview

- Docker Overview
- Kubernetes
- Google Cloud Platform
- Create Cluster
- Deploy this presentation
- Kubernetes Resources breakdown
- Upgrade this presentation

Note:
What you can do
What you need to do
What you need to know about kubernetes
And then we'll get down and dirty



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


## Dockerfile

```dockerfile
FROM node:8.16.0

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

```dockerfile
FROM node:8.16.0-onbuild
```

Is built from the following Dockerfile

```dockerfile
FROM node:8.16.0-stretch

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

```dockerfile
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

make a change in say `index.html`

```bash
docker build .
```

```dockerfile
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

- **API:** Both on master and nodes
- **Scheduler:** starts containers on nodes
- **Controllers:** acts on differences between wanted and actual state
  - **kube controller:** manages inside the cluster
  - **cloud controller:** manages cloud resources
- **etcd** data backing of cluster state


### Google Kubernetes Engine (GKE)

- Managed Kubernets on Google Cloud Platform
- Uses Google Compute Engine (GCE) Resources to run and monitor your cluster and containers.
- Built-in support for multiple zones and regions.
- Free Master nodes: only see and pay for workers

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

- Resources are subject to quotas
  - Limit errors reported in [Web console](https://console.cloud.google.com)
  - Kubernetes commands stuck pending
- External IPs, CPU, backend-services, Disk etc
- Increased requests are generally auto-approved

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
    --region=europe-north1 \
    --cluster-version=1.11.7-gke.6
```

beta commands not covered by SLA (preemptible)

Note:

Scope configures what the nodes in the cluster are allowed to do, and cannot be changed without creating a new node pool.
zones and regions: google cloud is a globally spanning network with datacenters in certain regions, within each datacenters are zones with separate networking, cooling, electricity etc. zonal outages can occur
num nodes is number of nodes per zone, so 3 nodes initially.
machine-type matches on in "gcloud compute machine-types list".


#### Docker (for windows and mac)

Docker includes local kubernetes cluster:

`Whale Icon` -> `preferences` -> `kubernetes` -> `enable kubernetes`

- No Role Based Access Control (RBAC) support yet
- Need to [install own ingress controller](https://kubernetes.github.io/ingress-nginx/deploy/):

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/master/deploy/provider/cloud-generic.yaml
```

No cluster credentials? in admin cmd.exe execute:

```cmd
setx KUBECONFIG '%UserProfile%\.kube\config'
```

Note: remove when https://github.com/docker/for-win/issues/1649 is resolved


### How to switch between clusters

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

Test it locally

```bash
docker run -i --rm -p 8000:8000 ${IMAGE}
# press ctrl-c to stop the container when you're done
```

browse to http://localhost:8000


## Deploy the Image

List all the resources on the cluster

```bash
kubectl get all
  NAME                 TYPE        CLUSTER-IP    EXTERNAL-IP   PORT(S)   AGE
  service/kubernetes   ClusterIP   10.43.240.1   <none>        443/TCP   11m
```

Get credentials to push to google cloud

```bash
gcloud auth configure-docker
docker push ${IMAGE}
```

Let's run something and see what happens

```bash
kubectl run kubernetes-rocks --image=${IMAGE}
  deployment.apps "kubernetes-rocks" created
```


### Deploy the Image - What happened?

List all the resources on the cluster again

```bash
kubectl get all

  NAME                                    READY     STATUS    RESTARTS   AGE
  pod/kubernetes-rocks-5797f9c9c8-6nrc2   1/1       Running   0          25s

  NAME                               DESIRED   CURRENT   UP-TO-DATE   AVAILABLE   AGE
  deployment.apps/kubernetes-rocks   1         1         1            1           25s

  NAME                                          DESIRED   CURRENT   READY     AGE
  replicaset.apps/kubernetes-rocks-5797f9c9c8   1         1         1         25s
```

We've created a **pod**, a **replicaset** and a **deployment**


### Expose the Service

We need to expose the service outside the cluster

```bash
kubectl expose deployment kubernetes-rocks \
--port=80 --target-port=8000 --type=LoadBalancer
  service "kubernetes-rocks" exposed
```

We've created a **service**:

```bash
kubectl get service "kubernetes-rocks" -w
  
  NAME             TYPE          CLUSTER-IP      EXTERNAL-IP   PORT(S)        AGE
kubernetes-rocks   LoadBalancer  10.43.245.207   <pending>     80:32563/TCP   8s
...
kubernetes-rocks   LoadBalancer  10.43.245.207   35.228.168.2  80:32563/TCP   1m
```

Wait for an external IP and browse to it


## Quick Recap

- Created a high-availability Cluster
- Built and pushed a docker image
- Ran the image in the cluster (**Deployment**)
- Exposed the service using a loadbalancer (**Service**)

**Done!**



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

- `kubectl get`: Lists types
- `kubectl get type`: List resources of type
- `kubectl get type/name`: List specific resource
- `kubectl get type/name -o=yaml`:

Prints a resource in yaml notation

Note:
Here's the first odd thing about kubernetes, you need to specify -o yaml or json to actually get the active configuration of a resource.
The active configuration contains the current state of the resource, mixing information provided when setting up the resource and generated states in the cluster.


## Kubernetes: Resources (contd.)

Created using commands or yaml/json files

- `kubectl create/expose/run ...`
- `kubectl apply/create -f file.yaml`
- Resources always defined in yaml/json spec
- Files are easier to version control
  - Reproducibility is key

Note:
Resources always result in a resource defined in yaml/json notation.


## Kubernetes: Resource Types

```bash
$ kubectl get
You must specify the type of resource to get. Valid resource types include:

  * all  
  * certificatesigningrequests (aka 'csr')  
  * clusterrolebindings  
  * clusterroles  
  * componentstatuses (aka 'cs')  
  * configmaps (aka 'cm')  
  * controllerrevisions  
  * cronjobs  
  * customresourcedefinition (aka 'crd')  
  * daemonsets (aka 'ds')  
  * deployments (aka 'deploy')  
  * endpoints (aka 'ep')  
  * events (aka 'ev')  
  * horizontalpodautoscalers (aka 'hpa')  
  * ingresses (aka 'ing')  
  * jobs  
  * limitranges (aka 'limits')  
  * namespaces (aka 'ns')  
  * networkpolicies (aka 'netpol')  
  * nodes (aka 'no')  
  * persistentvolumeclaims (aka 'pvc')  
  * persistentvolumes (aka 'pv')  
  * poddisruptionbudgets (aka 'pdb')  
  * podpreset  
  * pods (aka 'po')  
  * podsecuritypolicies (aka 'psp')  
  * podtemplates  
  * replicasets (aka 'rs')  
  * replicationcontrollers (aka 'rc')  
  * resourcequotas (aka 'quota')  
  * rolebindings  
  * roles  
  * secrets  
  * serviceaccounts (aka 'sa')  
  * services (aka 'svc')  
  * statefulsets (aka 'sts')  
  * storageclasses (aka 'sc'
```

Let's look at the ones we just used:
**pod**, **service**, **deployment**, and **replicaset**


### Resources: Pod

Pods run one or more images

- shares network stack and host node

```bash
kubectl get pods
  NAME                                READY     STATUS    RESTARTS   AGE
  kubernetes-rocks-5797f9c9c8-6nrc2   1/1       Running   0          43m
```

You can exec commands just like docker:

```bash
kubectl exec -it kubernetes-rocks-5797f9c9c8-6nrc2 sh
  /usr/src/app # exit
```


### Resources: Replicaset

maintains a stable set of running replica Pods

```bash
kubectl get rs
  NAME                          DESIRED   CURRENT   READY     AGE
  kubernetes-rocks-5797f9c9c8   1         1         1         49m
```

Scaling is easy

```bash
kubectl scale --replicas 3 deployment kubernetes-rocks
```

```bash
kubectl get rs
NAME                          DESIRED   CURRENT   READY     AGE
kubernetes-rocks-5797f9c9c8   3         3         3         1h
```

Why do we scale? Performance and availability!


### Resources: Deployment

Deployment is a replica set and pod spec in disguise

```bash
kubectl get deployment kubernetes-rocks -o yaml
```

The first spec is the replicaset

```yaml
apiVersion: extensions/v1beta1
kind: Deployment
metadata:
    name: kubernetes-rocks
spec:
    replicas: 3
    template:
      metadata:
        labels:
          run: kubernetes-rocks
...
```

Note:
A deployment creates 3 resources, the deployment itself, replicaset and pod
metadata is mandatory, the name is the identifier used to map between resources. names are unique on a resource type level so we could keep the same names for everything, names have been made unique in this presentation for sake of clarity.


### Resources: Deployment (spec ctd)

The second half is your pod spec

```yaml
        spec:
          containers:
          - name: kubernetes-rocks
            imagePullPolicy: IfNotPresent
            image: eu.gcr.io/kubernetes-rocks/kubernetes-rocks:0.0.1
#           ports:
#           - containerPort: 8000
#           readinessProbe:
#             httpGet:
#               path: /
#               port: 8000
```

- ReadinessProbe should be mandatory
  - needs to reply 200 for LB to forward traffic
  - GKE requires port same as service

Note:
Second spec block (yes, there is a second spec block) is the container spec
Name is used to map to ingress
image specifies the image to run, no '.', needs to point to registry, one is included in gke. It's placeholder until we build and deploy our pod
specify environment, mounts etc here


### Health Checks are Important!

- Only reply 200 if ready for traffic
- Don't make expensive health checks
- More ways than just plain http

```yaml
        spec:
          containers:
          - name: kubernetes-rocks
            imagePullPolicy: IfNotPresent
            image: eu.gcr.io/ericsson-demo-231407/kubernetes-rocks:0.0.1
#           readinessProbe:
#             httpGet:
#               path: /
#               port: 8000
#           initialDelaySeconds: 5
#           periodSeconds: 10
#           httpHeaders:
#           - name: Custom-Header
#             value: Awesome

```


### resources: Service

```bash
kubectl get service kubernetes-rocks -o yaml
```

```yaml
kind: Service
apiVersion: v1
metadata:
  name: kubernetes-rocks
spec:
  selector:
    run: kubernetes-rocks
  ports:
  - port: 80
    targetPort: 8000
  type: LoadBalancer
```

- **NodePort:** maps to random port on host
- **LoadBalancer:** creates a TCP loadbalancer
- **ClusterIp:** cluster internal service name

Note:
For https use ingress/nodeport and specify tls secret in ingress
For TCP use plain loadbalance
Both options will create a GCP google cloud load balancer


### Resources: Secrets and ConfigMaps

Don't build configuration into images:

```bash
kubectl create secret generic my-config \
 --from-file=./google-application-credentials.json
```

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: my-config
data:
  some-key: someValue
  google-application-credentials.json: |
    {
    "type": "service_account",
    ...
```

```bash
kubectl create secret tls foo-secret \
 --key /tmp/tls.key --cert /tmp/tls.crt
```

Note:
Secrets can be generic, tls or docker-registry, configmaps are always generic.
Files are updated almost immediately, environment vars aren't


### Pod Configuration

Provided to pods as environment variables or files

```yaml
      - name: kubernetes-rocks
        env:
        - name: SOME_ENV
          valueFrom:
            configMapKeyRef:
              name: my-config
              key: some-key
        volumeMounts:
        - name: config-volume
          mountPath: /etc/config
      volumes:
      - name: config-volume
      configMap:
        name: my-config
```

Mounted ConfigMaps are updated automatically


### Resources: Ingress

A specialized http(s) loadbalaner

- Handles https configuration and termination
- http host and path to service mapping
- GCP Ingress is scalable but slow to reconfigure
- Custom ingress controllers (nginx, haproxy, etc)

```yaml
  apiVersion: extensions/v1beta1
  kind: Ingress
  metadata:
    name: kubernetes-rocks
  spec:
    tls:
      secretName: foo-secret
...
```

Note: Ingress is traffic going into your services, Egress is traffic leaving your services. In GCP you don't pay for Ingress.


### Resources: Ingress (spec ctd)

* Can route on host/path or default "backend"
* host routing doesn't configure cloud DNS

```yaml
        backend:
          serviceName: kubernetes-rocks
          servicePort: 80
        rules:
        - host: kubernetes.rocks
          http:
            paths:
            - path: /*
              backend:
                serviceName: kubernetes-rocks
                servicePort: 80
```

```bash
kubectl delete service kubernetes-rocks
kubectl apply -f k8s/ingress.yaml k8s/service.yaml
```

Note:
default backend maps to a default "no service 404" service in kubernetes unless specified.
I'd recommend using host based routing since you can use query language to fetch hostname info and configure your dns zones automatically using scripts. No it's not automatically handled...



## Upgrade

Build and tag a new docker image

```bash
GCLOUD_PROJECT=$(gcloud config get-value project)
NAME=kubernetes-rocks
VERSION=0.0.2
IMAGE=eu.gcr.io/${GCLOUD_PROJECT}/${NAME}:${VERSION}
docker build . -t ${IMAGE}
# IMAGE=eu.gcr.io/kubernetes-rocks/kubernetes-rocks:0.0.2
# for local development use IMAGE=${NAME}:${VERSION}
```

Update the **image** of the **container** named kubernetes-rocks in the **deployment** kubernetes-rocks

```bash
kubectl set image deployment/kubernetes-rocks \
kubernetes-rocks=${IMAGE} --record
```


## Check the result

```bash
kubectl get pods

  kubernetes-rocks-79496-57dww   1/1   ImagePullBackOff   1m
  kubernetes-rocks-79496-b5hdn   1/1   ImagePullBackOff   1m
  kubernetes-rocks-9bc79-7fsdc   1/1   Running            8h
  kubernetes-rocks-9bc79-2szcc   0/1   Terminating        8h
```

- Rolling upgrades by default
- But what's wrong?
- Site is still up!

```bash
docker push ${IMAGE}
```


## And roll back

Check your history

```bash
kubectl rollout history deployment/kubernetes-rocks
REVISION  CHANGE-CAUSE
1   kubectl set image ... kubernetes-rocks:0.0.1 --record=true
2   kubectl set image ... kubernetes-rocks:0.0.2 --record=true
```

And pick where you want to go

```bash
kubectl rollout undo deployment/kubernetes-rocks \
 --to-revision=1
  deployment.apps "kubernetes-rocks"
```



## Recap (45 minute mark)

- Installed gcloud and docker
- Enabled APIs
- Created cluster and log in
- Created deployment and exposed service
- Created ingress
- Upgraded and rolled back



## Bonus: Cloud DNS Zone

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
kubernetes-rocks-ingress   kubernetes.rocks   35.190.10.52   80, 443   6d
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
