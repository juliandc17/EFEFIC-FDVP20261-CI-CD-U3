#!/usr/bin/env node
/**
 * MCP K8s Server — EFEFIC-FDVP20261-CI-CD-U3
 * Expone 6 herramientas Kubernetes via MCP (Model Context Protocol)
 *
 * Modos:
 *   stdio  → para Claude Desktop: node server.js
 *   HTTP   → para pipeline CI/CD: HTTP_MODE=true PORT=3100 node server.js
 */

const { execSync } = require('child_process');
const http = require('http');
const readline = require('readline');

function kubectl(cmd) {
  try {
    return execSync(`kubectl ${cmd}`, { encoding: 'utf8', timeout: 15000 });
  } catch (e) { return `ERROR: ${e.message}`; }
}

function kubectlJson(cmd) {
  try {
    return JSON.parse(execSync(`kubectl ${cmd} -o json`, { encoding: 'utf8', timeout: 15000 }));
  } catch (e) { return { error: e.message }; }
}

// ── 6 Tools disponibles ──────────────────────────────────────
const TOOLS = {
  get_pods: {
    description: 'Lista pods en un namespace con su estado, readiness y restarts',
    inputSchema: {
      type: 'object',
      properties: {
        namespace: { type: 'string', default: 'devops-lab' },
        label: { type: 'string', description: 'Filtro label selector, ej: app=devops-app' },
      },
    },
    handler({ namespace = 'devops-lab', label = '' }) {
      const data = kubectlJson(`get pods -n ${namespace} ${label ? '-l ' + label : ''}`);
      if (data.error) return data.error;
      const pods = (data.items || []).map(p => ({
        name: p.metadata.name,
        status: p.status.phase,
        ready: p.status.conditions?.find(c => c.type === 'Ready')?.status === 'True',
        restarts: p.status.containerStatuses?.[0]?.restartCount ?? 0,
        image: p.spec.containers[0]?.image,
        node: p.spec.nodeName,
      }));
      return JSON.stringify({ namespace, total: pods.length, pods }, null, 2);
    },
  },

  get_deployments: {
    description: 'Lista deployments con réplicas deseadas vs disponibles',
    inputSchema: { type: 'object', properties: { namespace: { type: 'string', default: 'devops-lab' } } },
    handler({ namespace = 'devops-lab' }) {
      const data = kubectlJson(`get deployments -n ${namespace}`);
      if (data.error) return data.error;
      const deps = (data.items || []).map(d => ({
        name: d.metadata.name,
        desired: d.spec.replicas,
        ready: d.status.readyReplicas ?? 0,
        available: d.status.availableReplicas ?? 0,
        image: d.spec.template.spec.containers[0]?.image,
      }));
      return JSON.stringify({ namespace, deployments: deps }, null, 2);
    },
  },

  get_services: {
    description: 'Lista servicios con tipo y puertos',
    inputSchema: { type: 'object', properties: { namespace: { type: 'string', default: 'devops-lab' } } },
    handler({ namespace = 'devops-lab' }) {
      const data = kubectlJson(`get services -n ${namespace}`);
      if (data.error) return data.error;
      const svcs = (data.items || []).map(s => ({
        name: s.metadata.name,
        type: s.spec.type,
        clusterIP: s.spec.clusterIP,
        ports: s.spec.ports?.map(p => `${p.port}:${p.nodePort || '-'}/${p.protocol}`),
      }));
      return JSON.stringify({ namespace, services: svcs }, null, 2);
    },
  },

  pod_logs: {
    description: 'Obtiene los últimos logs de un pod',
    inputSchema: {
      type: 'object',
      required: ['pod_name'],
      properties: {
        pod_name: { type: 'string' },
        namespace: { type: 'string', default: 'devops-lab' },
        lines: { type: 'number', default: 50 },
      },
    },
    handler({ pod_name, namespace = 'devops-lab', lines = 50 }) {
      const flag = pod_name.includes('=') ? `-l ${pod_name}` : pod_name;
      return kubectl(`logs ${flag} -n ${namespace} --tail=${lines}`);
    },
  },

  cluster_health: {
    description: 'Resumen general del clúster: nodos, namespaces, conteo de pods por estado',
    inputSchema: { type: 'object', properties: {} },
    handler() {
      const nodes = kubectlJson('get nodes');
      const nodesSummary = (nodes.items || []).map(n => ({
        name: n.metadata.name,
        status: n.status.conditions?.find(c => c.type === 'Ready')?.status === 'True' ? 'Ready' : 'NotReady',
      }));
      const podCounts = kubectl('get pods -A --no-headers 2>/dev/null').split('\n')
        .reduce((acc, line) => {
          const status = line.trim().split(/\s+/)[3];
          if (status) acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {});
      return JSON.stringify({ nodes: nodesSummary, podStatusCounts: podCounts }, null, 2);
    },
  },

  rollout_status: {
    description: 'Estado del rollout de un deployment + historial de versiones',
    inputSchema: {
      type: 'object',
      required: ['deployment'],
      properties: {
        deployment: { type: 'string' },
        namespace: { type: 'string', default: 'devops-lab' },
      },
    },
    handler({ deployment, namespace = 'devops-lab' }) {
      const status = kubectl(`rollout status deployment/${deployment} -n ${namespace} --timeout=60s`);
      const history = kubectl(`rollout history deployment/${deployment} -n ${namespace}`);
      return `=== Rollout Status ===\n${status}\n=== History ===\n${history}`;
    },
  },
};

// ── MCP Protocol ─────────────────────────────────────────────
function handleMcp(msg) {
  const { id, method, params } = msg;
  if (method === 'initialize') {
    return { jsonrpc: '2.0', id, result: {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'mcp-k8s-server', version: '1.0.0' },
    }};
  }
  if (method === 'tools/list') {
    return { jsonrpc: '2.0', id, result: {
      tools: Object.entries(TOOLS).map(([name, t]) => ({
        name, description: t.description, inputSchema: t.inputSchema,
      })),
    }};
  }
  if (method === 'tools/call') {
    const tool = TOOLS[params?.name];
    if (!tool) return { jsonrpc: '2.0', id, error: { code: -32601, message: `Tool not found: ${params?.name}` } };
    try {
      const result = tool.handler(params?.arguments || {});
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: String(result) }] } };
    } catch (e) {
      return { jsonrpc: '2.0', id, error: { code: -32603, message: e.message } };
    }
  }
  return { jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown method: ${method}` } };
}

// ── Modo HTTP (para pipeline) ─────────────────────────────────
if (process.env.HTTP_MODE === 'true') {
  const PORT = parseInt(process.env.PORT || '3100');
  http.createServer((req, res) => {
    if (req.url === '/metrics') {
      const pods = kubectlJson('get pods -n devops-lab');
      const running = (pods.items || []).filter(p => p.status.phase === 'Running').length;
      const total = (pods.items || []).length;
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end([
        '# HELP k8s_pods_running Running pods in devops-lab',
        '# TYPE k8s_pods_running gauge',
        `k8s_pods_running{namespace="devops-lab"} ${running}`,
        '# HELP k8s_pods_total Total pods in devops-lab',
        '# TYPE k8s_pods_total gauge',
        `k8s_pods_total{namespace="devops-lab"} ${total}`,
      ].join('\n'));
      return;
    }
    if (req.method === 'POST' && req.url === '/mcp') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const response = handleMcp(JSON.parse(body));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
        } catch { res.writeHead(400); res.end('Bad Request'); }
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', tools: Object.keys(TOOLS) }));
  }).listen(PORT, () => console.log(`MCP K8s Server HTTP :${PORT}`));
} else {
  // ── Modo stdio (para Claude Desktop) ───────────────────────
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', line => {
    try {
      process.stdout.write(JSON.stringify(handleMcp(JSON.parse(line.trim()))) + '\n');
    } catch { /* ignorar líneas malformadas */ }
  });
  process.stderr.write('MCP K8s Server (stdio)\n');
}
