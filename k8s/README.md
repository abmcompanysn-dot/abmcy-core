# ABMCY Core — déploiement k3s

Ce dossier remplace `docker-compose.yml` comme méthode de déploiement sur le
VPS (4 CPU / 6 Go RAM). **`docker-compose.yml` n'est pas supprimé** — il reste
à la racine du repo pour référence/rollback, mais il n'est plus le chemin de
déploiement recommandé à partir de maintenant. Vous pouvez le retirer
vous-même une fois `k8s/` validé en production.

Le `Dockerfile` à la racine du repo reste inchangé et sert toujours à builder
l'image de l'API — k3s le réutilise tel quel.

## 1. Installer k3s sur le VPS

```bash
curl -sfL https://get.k3s.io | sh -
```

k3s installe automatiquement :
- un cluster Kubernetes complet en un seul binaire
- **Traefik** comme Ingress Controller par défaut
- **local-path-provisioner** comme StorageClass par défaut (`local-path`),
  utilisé par le PVC de Postgres

Vérifier que le nœud est prêt :

```bash
sudo k3s kubectl get nodes
```

Pour éviter de taper `sudo k3s kubectl` à chaque fois, configurez `kubectl` :

```bash
mkdir -p ~/.kube
sudo k3s kubectl config view --raw > ~/.kube/config
chmod 600 ~/.kube/config
export KUBECONFIG=~/.kube/config
# puis utilisez directement `kubectl ...`
```

## 2. Installer cert-manager

cert-manager n'est PAS inclus dans k3s — il faut l'installer séparément
(une seule fois par cluster) :

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
```

Attendre que les pods soient prêts :

```bash
kubectl get pods -n cert-manager --watch
```

Puis créer le `ClusterIssuer` Let's Encrypt (édité au préalable si besoin,
notamment l'email de contact dans `k8s/cluster-issuer.yaml`) :

```bash
kubectl apply -f k8s/cluster-issuer.yaml
```

> Le `ClusterIssuer` n'est pas inclus dans `kustomization.yaml` : il est
> cluster-scoped et ne doit être appliqué qu'une fois, après que
> cert-manager tourne. Voir le commentaire dans `k8s/kustomization.yaml`.

## 3. Builder l'image et la charger dans k3s

k3s utilise **containerd** (pas le Docker daemon classique) comme runtime.
Deux options :

### Option A — image locale chargée directement (le plus simple pour un VPS
mono-nœud, pas besoin d'un registry)

```bash
# Sur le VPS (ou en local puis transfert du .tar sur le VPS)
docker build -t abmcy/core-api:latest .
docker save abmcy/core-api:latest -o /tmp/core-api.tar
sudo k3s ctr images import /tmp/core-api.tar
```

Vérifier que l'image est bien connue de containerd :

```bash
sudo k3s ctr images ls | grep core-api
```

> À chaque nouvelle version du code, il faut rebuilder l'image, refaire un
> `docker save` / `k3s ctr images import`, puis redémarrer les pods
> (`kubectl rollout restart deployment/api -n abmcy`) pour qu'ils repartent
> sur la nouvelle image (le tag `latest` ne se re-pull pas tout seul avec
> `imagePullPolicy: IfNotPresent`).

### Option B — registry (recommandé si vous CI/CD plus tard, ou déployez
sur plusieurs nœuds)

```bash
docker build -t registry.example.com/abmcy/core-api:latest .
docker push registry.example.com/abmcy/core-api:latest
```

Puis mettre à jour `image:` dans `k8s/api-deployment.yaml` avec le chemin du
registry et repasser `imagePullPolicy` à `Always` (ou un tag versionné
immuable plutôt que `latest`).

## 4. Créer le vrai Secret Kubernetes

**Ne jamais commiter de vraies valeurs.** `k8s/secrets-example.yaml` ne
contient que des placeholders et n'est pas déployé par `kustomization.yaml`.

Le fichier `.env` (déjà présent à la racine du repo, non commité) contient
les clés suivantes : `APP_ENV`, `PORT`, `DATABASE_URL`, `POSTGRES_PASSWORD`,
`JWT_SECRET`, `CONFIG_ENCRYPTION_KEY`, `ADMIN_API_KEY`, `CORS_ORIGINS`.

Depuis la migration vers `internal/platformconfig`, les clés de service
(Cloudflare R2, Resend, CinetPay) ne sont **plus** des variables d'env — elles
se configurent depuis le dashboard admin (page Configuration) une fois l'API
démarrée, et sont stockées chiffrées en base (table `platform_config`,
chiffrées avec `CONFIG_ENCRYPTION_KEY`). Le Secret Kubernetes `abmcy-secrets`
n'a donc besoin que des clés réellement consommées par
`k8s/api-deployment.yaml` et `k8s/postgres-statefulset.yaml` (`APP_ENV`,
`PORT` et `CORS_ORIGINS` sont déjà fixés en dur dans le Deployment, pas
besoin de les mettre dans le Secret).

Méthode recommandée — créer le Secret directement depuis `.env` :

```bash
kubectl create namespace abmcy --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic abmcy-secrets \
  --namespace abmcy \
  --from-literal=POSTGRES_PASSWORD="$(grep '^POSTGRES_PASSWORD=' .env | cut -d= -f2-)" \
  --from-literal=DATABASE_URL="$(grep '^DATABASE_URL=' .env | cut -d= -f2-)" \
  --from-literal=JWT_SECRET="$(grep '^JWT_SECRET=' .env | cut -d= -f2-)" \
  --from-literal=CONFIG_ENCRYPTION_KEY="$(grep '^CONFIG_ENCRYPTION_KEY=' .env | cut -d= -f2-)" \
  --from-literal=ADMIN_API_KEY="$(grep '^ADMIN_API_KEY=' .env | cut -d= -f2-)"
```

> Vérifiez bien que `DATABASE_URL` dans `.env` pointe vers le host `postgres`
> (le nom du Service k8s, ex: `postgres://abmcy_app:xxx@postgres:5432/abmcy?sslmode=disable`)
> et non `localhost` — sinon adaptez la valeur avant de créer le secret.

Alternative : copier `k8s/secrets-example.yaml` vers un fichier non commité
(ex: `k8s/secrets.local.yaml`, à ajouter dans `.gitignore`), y mettre les
vraies valeurs, puis `kubectl apply -f k8s/secrets.local.yaml`.

Une fois l'API démarrée et joignable, configurez R2/Resend/CinetPay depuis
le dashboard admin (`ad.abmcy.com` → Configuration) — aucune commande
`kubectl` supplémentaire n'est nécessaire pour ces clés-là, et les modifier
plus tard ne demande ni redéploiement ni redémarrage du pod.

## 5. Déployer

```bash
kubectl apply -k k8s/
```

Cela crée : le namespace `abmcy`, le ConfigMap d'init SQL, le StatefulSet +
Service Postgres, le Deployment + Service API, et l'Ingress Traefik.

Vérifier le déploiement :

```bash
kubectl get all -n abmcy
kubectl get pvc -n abmcy
kubectl get ingress -n abmcy
kubectl get certificate -n abmcy   # géré par cert-manager, doit passer à READY=True
```

Le premier démarrage du pod Postgres exécute automatiquement
`migrations/0001_init.sql` (via le ConfigMap monté dans
`/docker-entrypoint-initdb.d/`) — uniquement si le PVC est neuf.

## 6. Voir les logs

```bash
# Logs de l'API, tous les pods (2 replicas), en continu
kubectl logs -n abmcy -l app=api -f

# Logs de Postgres
kubectl logs -n abmcy -l app=postgres -f

# Statut détaillé d'un pod qui ne démarre pas
kubectl describe pod -n abmcy <nom-du-pod>
```

## 7. Mettre à jour l'API après un changement de code

```bash
docker build -t abmcy/core-api:latest .
docker save abmcy/core-api:latest -o /tmp/core-api.tar
sudo k3s ctr images import /tmp/core-api.tar
kubectl rollout restart deployment/api -n abmcy
kubectl rollout status deployment/api -n abmcy
```

## Résumé de l'architecture

```
Internet (HTTPS, api.abmcy.com)
        |
   Traefik (Ingress, installé avec k3s)
        |  cert TLS géré par cert-manager (Let's Encrypt)
        v
   Service "api" (ClusterIP:8080)
        |
   Deployment "api" (2 pods, binaire Go stateless)
        |
   Service "postgres" (ClusterIP headless:5432)
        |
   StatefulSet "postgres" (1 pod, PVC local-path 5Gi)
```

## Fichiers de ce dossier

| Fichier | Rôle |
|---|---|
| `namespace.yaml` | Namespace `abmcy` |
| `postgres-init-configmap.yaml` | Contenu de `migrations/0001_init.sql` |
| `postgres-statefulset.yaml` | StatefulSet + Service Postgres |
| `api-deployment.yaml` | Deployment de l'API Go |
| `api-service.yaml` | Service ClusterIP de l'API |
| `ingress.yaml` | Exposition HTTPS via Traefik |
| `cluster-issuer.yaml` | Émetteur Let's Encrypt (cert-manager), appliqué à part |
| `secrets-example.yaml` | Exemple de Secret — placeholders uniquement, jamais déployé tel quel |
| `kustomization.yaml` | Point d'entrée `kubectl apply -k k8s/` |
