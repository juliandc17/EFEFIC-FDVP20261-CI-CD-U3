#!/bin/bash
# ════════════════════════════════════════════════════════════════
# SCRIPT DE EJEMPLO — Cómo crear los Secrets de Kubernetes
# ⚠️  NO subir al repo con valores reales
#     Este archivo es solo una GUÍA — los valores reales
#     los ingresas TÚ en la terminal (nunca en un archivo)
# ════════════════════════════════════════════════════════════════

# 1. Secret para Grafana
kubectl create secret generic grafana-credentials \
  --from-literal=admin-user=admin \
  --from-literal=admin-password=CAMBIA_ESTA_PASSWORD \
  -n devops-lab

# 2. Verificar que los secrets se crearon (no muestra los valores)
kubectl get secrets -n devops-lab

# 3. Los secrets se guardan encriptados en etcd de Kubernetes
#    y NUNCA aparecen en texto plano en el repositorio
