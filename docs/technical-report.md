# Informe Técnico — Pipeline CI/CD con Seguridad y Monitoreo
## EFEFIC-FDVP20261-CI-CD-U3

**Estudiante:** [Tu nombre completo]
**Fecha:** [Fecha de entrega]
**Módulo:** Unidad 3 — Implementación CI/CD con Seguridad y Monitoreo
**Repositorio:** https://github.com/TU-USUARIO/EFEFIC-FDVP20261-CI-CD-U3

---

## 1. Descripción del Flujo CI/CD

### 1.1 Pipeline de Integración Continua — GitHub Actions

El pipeline CI se activa automáticamente con cada `push` a las ramas `main` o `develop`, y en cada Pull Request hacia `main`. Está definido en `.github/workflows/ci.yml` y consta de 5 jobs con la siguiente dependencia:

```
Job 1: Build & Test  ──┬──► Job 2: SonarQube
                        └──► Job 3: Snyk
                              └──► Job 4: Docker Push
                                    └──► Job 5: MCP Check
```

| Job | Herramienta | Acción |
|---|---|---|
| 1 — Build & Test | Maven | `mvn compile` → `mvn test` → `mvn package` → genera `.jar` |
| 2 — SonarQube | SonarCloud | Análisis estático, cobertura JaCoCo, Quality Gate |
| 3 — Snyk | Snyk | CVEs en `pom.xml` y en imagen Docker → SARIF a GitHub |
| 4 — Docker | Docker Hub | Build multi-stage → push con tag `latest` + SHA |
| 5 — MCP Check | MCP K8s | Consulta `get_pods` y `rollout_status` al clúster |

### 1.2 Pipeline de Despliegue Continuo — Jenkins

Jenkins corre como pod dentro del mismo clúster Kubernetes, lo que le da acceso nativo via `ServiceAccount`. El pipeline CD está definido en `jenkins/Jenkinsfile` con 7 stages:

1. **Inicio** — limpieza de workspace y checkout del código
2. **Verificar Imagen** — confirma que la imagen existe en Docker Hub
3. **Preparar K8s** — crea el namespace `devops-lab` si no existe
4. **Desplegar Herramientas** — aplica YAMLs de Jenkins, SonarQube, MCP, Prometheus, Grafana (solo primera ejecución)
5. **Desplegar Aplicación** — `kubectl apply` + rolling update con `kubectl set image`
6. **MCP Verificar** — consulta `get_pods`, `rollout_status` y `cluster_health` al MCP K8s Server
7. **Smoke Test** — prueba `/actuator/health` desde dentro del clúster

---

## 2. Herramientas Utilizadas y Justificación

| Herramienta | Rol | Justificación |
|---|---|---|
| **GitHub Actions** | CI Automation | Integrado nativamente en GitHub, sin infraestructura adicional. Runners gratuitos. Ideal para disparar el pipeline en cada commit. |
| **Jenkins** | CD Orchestration | Flexibilidad total. Plugins robustos para K8s. Al correr dentro del clúster, tiene acceso nativo sin configuración extra de redes. |
| **Maven** | Build Tool | Estándar en proyectos Java/Spring Boot. Gestiona dependencias, compilación, tests y empaquetado en un solo comando. JaCoCo integrado para cobertura. |
| **SonarQube/Cloud** | Análisis Estático | Detecta bugs, vulnerabilidades, code smells y deuda técnica antes de llegar a producción. Quality Gate previene regressions. |
| **Snyk** | Seguridad Deps | Especializado en CVEs en librerías de terceros. Base de datos actualizada diariamente. Resultados en GitHub Security (SARIF). |
| **Docker** | Containerización | Build reproducible con multi-stage (imagen de producción mínima sin Maven ni JDK). |
| **Kubernetes** | Orquestación | Gestión declarativa, rolling updates sin downtime, self-healing, resource limits. Docker Desktop lo incluye nativamente. |
| **Prometheus** | Métricas | Pull-based con service discovery via anotaciones K8s. Estándar de facto. |
| **Grafana** | Visualización | Dashboards ricos, alertas configurables, datasource Prometheus preconfigurado via provisioning. |
| **MCP K8s Server** | Observabilidad | Servidor MCP local que expone herramientas K8s al pipeline y a Claude Desktop. Innovación DevOps con IA. |

---

## 3. Evidencia de Seguridad

### 3.1 Análisis SonarQube

> **[INSERTAR CAPTURA: dashboard SonarQube/SonarCloud con el proyecto devops-app]**

| Métrica | Resultado |
|---|---|
| Quality Gate | ✅ Passed / ❌ Failed |
| Bugs | X |
| Vulnerabilidades | X |
| Security Hotspots | X |
| Code Smells | X |
| Cobertura de Código | XX% |
| Líneas de Código | XXX |

**Hallazgos principales:**
- [Describir hallazgo 1 y acción tomada]
- [Describir hallazgo 2 y acción tomada]

**Recomendaciones:**
- [Recomendación 1]
- [Recomendación 2]

### 3.2 Análisis Snyk

> **[INSERTAR CAPTURA: tab GitHub Security → Code scanning con resultados Snyk]**

| Severidad | Cantidad | Descripción |
|---|---|---|
| Crítica | X | [Dependencia afectada] |
| Alta | X | [Dependencia afectada] |
| Media | X | [Dependencia afectada] |
| Baja | X | [Dependencia afectada] |

**Recomendaciones:**
- Actualizar `[dependencia]` de versión `X.X` a `Y.Y` para corregir `CVE-XXXX-XXXX`
- Revisar dependencias transitivas innecesarias

---

## 4. Evidencia de Monitoreo

### 4.1 Prometheus — Targets Activos

> **[INSERTAR CAPTURA: http://localhost:30093/targets mostrando devops-app UP]**

**Targets monitoreados:**
- `devops-app:8080/actuator/prometheus` — Estado: UP
- `mcp-k8s-server:3100/metrics` — Estado: UP
- `prometheus:9090` — Estado: UP

### 4.2 Grafana — Dashboard JVM

> **[INSERTAR CAPTURA: dashboard Grafana con métricas JVM activas]**

**Métricas visualizadas:**

| Métrica | Valor Observado |
|---|---|
| JVM Heap Used | XX MB |
| JVM Non-Heap | XX MB |
| CPU Usage | XX% |
| HTTP Requests/sec | XX req/s |
| HTTP Error Rate | X% |
| Pod Status | Running |

### 4.3 Grafana — Alertas Configuradas

> **[INSERTAR CAPTURA: sección de alertas en Grafana]**

**Alertas activas:**
- `PodNotReady` — se activa si algún pod lleva >2 min sin estar Ready
- `JvmMemoryHigh` — se activa si el heap JVM supera el 85% de su máximo

---

## 5. Reflexión sobre Eficiencia Operativa

La implementación de este pipeline CI/CD representa un cambio fundamental en la cultura de entrega de software.

**Antes del pipeline (enfoque manual):**
- Los desarrolladores construían y probaban solo en su máquina local
- El despliegue se hacía manualmente con comandos docker run, generando inconsistencias entre entornos
- Los problemas de seguridad se descubrían tardíamente, cuando ya estaban en producción
- No había visibilidad del comportamiento de la aplicación en tiempo real

**Después del pipeline (enfoque DevOps):**
- Cada `git push` dispara automáticamente build, tests y análisis de seguridad
- Los problemas de calidad y seguridad se detectan en minutos, no en días
- El despliegue es reproducible, versionado y declarativo (infraestructura como código)
- Las métricas en Grafana permiten tomar decisiones basadas en datos reales

**Impacto medible:**
- Tiempo de detección de vulnerabilidades: reducido de días a minutos
- Tiempo de despliegue: reducido de horas a minutos (rolling update automatizado)
- Consistencia de entornos: 100% garantizada (todo containerizado con K8s)
- Visibilidad operativa: dashboard en tiempo real con alertas proactivas

**Aprendizajes del módulo ABP:**
La metodología de Aprendizaje Basado en Proyectos permitió no solo conocer las herramientas de forma aislada, sino integrarlas en un flujo coherente y funcional que refleja las prácticas reales de equipos DevOps maduros. La integración de seguridad como parte del pipeline (DevSecOps) y el monitoreo continuo son pilares que elevan significativamente la calidad y confiabilidad del software entregado.

---

## 6. Instrucciones de Reproducción

```bash
# 1. Clonar
git clone https://github.com/TU-USUARIO/EFEFIC-FDVP20261-CI-CD-U3.git
cd EFEFIC-FDVP20261-CI-CD-U3

# 2. Editar TU-USUARIO en k8s/deployment.yaml

# 3. Desplegar en Kubernetes (Docker Desktop)
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml   -n devops-lab
kubectl apply -f k8s/deployment.yaml  -n devops-lab
kubectl apply -f k8s/service.yaml     -n devops-lab
kubectl apply -f k8s/tools/           -n devops-lab
kubectl apply -f k8s/monitoring/      -n devops-lab

# 4. Verificar
kubectl get all -n devops-lab
```

**Ver guía completa:** `docs/GUIA-PASO-A-PASO.md`
