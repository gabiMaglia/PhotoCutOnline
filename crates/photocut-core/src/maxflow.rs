//! Boykov–Kolmogorov style max-flow / min-cut on a grid graph.
//!
//! Implemented from scratch (no external maxflow crate) so the engine carries
//! no copyleft dependencies. Each pixel is a node; there is an implicit source
//! (foreground) and sink (background). Terminal capacities are the data term,
//! neighbor capacities are the smoothness term.

/// Las capacidades se cuantizan a enteros (×SCALE) al entrar. El max-flow
/// con capacidades en coma flotante NO está garantizado que termine: los
/// residuos de cancelación generan aumentos infinitesimales sin fin (lo
/// sufrimos con imágenes con ruido). Con enteros, cada aumento empuja ≥ 1
/// unidad y la terminación es incondicional.
const SCALE: f64 = 65536.0;

#[inline]
fn quant(v: f64) -> i64 {
    (v.max(0.0) * SCALE).round() as i64
}

const SOURCE: i32 = -1;
const SINK: i32 = -2;
const NONE: i32 = -3;
/// Marcador de "mi padre es el terminal" (raíz legítima del árbol).
/// Crucial: un huérfano también tiene `parent == NONE`; sin este marcador un
/// huérfano con tr_cap residual se valida como raíz en `origin_dist`, se
/// crean ciclos de punteros parent y `augment` no termina jamás.
const TERMINAL: i32 = -4;

struct Arc {
    to: usize,
    next: i32,    // index of next arc out of the same node, or -1
    cap: i64,     // residual capacity (unidades cuantizadas)
}

pub struct MaxFlow {
    n: usize,
    arcs: Vec<Arc>,
    first: Vec<i32>,       // first outgoing arc per node
    tr_cap: Vec<i64>,      // >0 => residual to SOURCE, <0 => residual to SINK
    parent: Vec<i32>,      // arc index used to reach this node in the tree
    tree: Vec<i32>,        // SOURCE, SINK or NONE
    dist: Vec<u32>,
    active: std::collections::VecDeque<usize>,
    orphans: Vec<usize>,
    time: u32,
    ts: Vec<u32>,
}

impl MaxFlow {
    pub fn new(n: usize, edge_hint: usize) -> Self {
        MaxFlow {
            n,
            arcs: Vec::with_capacity(edge_hint * 2),
            first: vec![-1; n],
            tr_cap: vec![0; n],
            parent: vec![NONE; n],
            tree: vec![NONE; n],
            dist: vec![0; n],
            active: std::collections::VecDeque::new(),
            orphans: Vec::new(),
            time: 0,
            ts: vec![0; n],
        }
    }

    /// Add terminal capacities: `to_source` connects node->SOURCE,
    /// `to_sink` connects node->SINK. We collapse them into a single signed value.
    pub fn add_terminal(&mut self, node: usize, to_source: f64, to_sink: f64) {
        self.tr_cap[node] += quant(to_source) - quant(to_sink);
    }

    /// Add an undirected edge between `a` and `b` with the given capacities.
    pub fn add_edge(&mut self, a: usize, b: usize, cap_ab: f64, cap_ba: f64) {
        let i = self.arcs.len() as i32;
        self.arcs.push(Arc { to: b, next: self.first[a], cap: quant(cap_ab) });
        self.first[a] = i;
        let j = self.arcs.len() as i32;
        self.arcs.push(Arc { to: a, next: self.first[b], cap: quant(cap_ba) });
        self.first[b] = j;
    }

    fn sister(arc: i32) -> i32 {
        arc ^ 1
    }

    pub fn compute(&mut self) -> f64 {
        let mut flow: i64 = 0;
        // init trees from terminal capacities
        for i in 0..self.n {
            self.ts[i] = 0;
            self.dist[i] = 1;
            if self.tr_cap[i] != 0 {
                self.tree[i] = if self.tr_cap[i] > 0 { SOURCE } else { SINK };
                self.parent[i] = TERMINAL;
                self.active.push_back(i);
            } else {
                self.tree[i] = NONE;
            }
        }

        loop {
            let mid = self.grow();
            if mid < 0 {
                break;
            }
            self.time += 1;
            let pushed = self.augment(mid);
            if pushed <= 0 {
                // defensa: sin progreso, saturar el arco medio para no ciclar
                self.arcs[mid as usize].cap = 0;
            }
            flow += pushed;
            self.adopt_orphans();
        }
        flow as f64 / SCALE
    }

    // returns an arc index where the two trees meet, or -1 if none
    fn grow(&mut self) -> i32 {
        while let Some(&p) = self.active.front() {
            if self.tree[p] == NONE {
                self.active.pop_front();
                continue;
            }
            let mut a = self.first[p];
            while a != -1 {
                let cap = if self.tree[p] == SOURCE {
                    self.arcs[a as usize].cap
                } else {
                    self.arcs[Self::sister(a) as usize].cap
                };
                if cap > 0 {
                    let q = self.arcs[a as usize].to;
                    if self.tree[q] == NONE {
                        self.tree[q] = self.tree[p];
                        self.parent[q] = Self::sister(a);
                        self.ts[q] = self.ts[p];
                        self.dist[q] = self.dist[p] + 1;
                        self.active.push_back(q);
                    } else if self.tree[q] != self.tree[p] {
                        // found a path connecting source & sink
                        return if self.tree[p] == SOURCE { a } else { Self::sister(a) };
                    }
                    // NOTA: la re-parentación heurística que había aquí
                    // ("ts[q] <= ts[p] && dist[q] > dist[p]") puede crear
                    // CICLOS de punteros parent con timestamps viejos y colgar
                    // los paseos de augment(). Es solo una optimización de
                    // longitud de ruta; se elimina por corrección.
                }
                a = self.arcs[a as usize].next;
            }
            self.active.pop_front();
        }
        -1
    }

    fn augment(&mut self, mid: i32) -> i64 {
        // bottleneck: walk from mid toward source and sink
        let mut bottleneck = self.arcs[mid as usize].cap;

        // toward source
        let mut node = self.arcs[Self::sister(mid) as usize].to;
        let mut guard = 0usize;
        loop {
            guard += 1;
            if guard > self.n + 2 {
                // volcar la cadena para diagnóstico
                let mut chain = Vec::new();
                let mut nn = self.arcs[Self::sister(mid) as usize].to;
                for _ in 0..40 {
                    chain.push((nn, self.parent[nn], self.tree[nn]));
                    let pa = self.parent[nn];
                    if pa < 0 { break; }
                    nn = self.arcs[pa as usize].to;
                }
                panic!("CICLO en augment/bottleneck-source, node={} chain={:?}", node, chain);
            }
            let a = self.parent[node];
            if a == TERMINAL || a == NONE {
                break;
            }
            let r = self.arcs[Self::sister(a) as usize].cap;
            if r < bottleneck {
                bottleneck = r;
            }
            node = self.arcs[a as usize].to;
        }
        if self.tr_cap[node] < bottleneck {
            bottleneck = self.tr_cap[node];
        }

        // toward sink
        let mut node = self.arcs[mid as usize].to;
        let mut guard = 0usize;
        loop {
            guard += 1;
            if guard > self.n + 2 { panic!("CICLO en augment/bottleneck-sink, node={}", node); }
            let a = self.parent[node];
            if a == TERMINAL || a == NONE {
                break;
            }
            let r = self.arcs[a as usize].cap;
            if r < bottleneck {
                bottleneck = r;
            }
            node = self.arcs[a as usize].to;
        }
        if -self.tr_cap[node] < bottleneck {
            bottleneck = -self.tr_cap[node];
        }

        // push flow: middle arc
        self.arcs[mid as usize].cap -= bottleneck;
        self.arcs[Self::sister(mid) as usize].cap += bottleneck;

        // toward source side
        let mut node = self.arcs[Self::sister(mid) as usize].to;
        let mut guard = 0usize;
        loop {
            guard += 1;
            if guard > self.n + 2 { panic!("CICLO en augment/push-source"); }
            let a = self.parent[node];
            if a == TERMINAL || a == NONE {
                self.tr_cap[node] -= bottleneck;
                if self.tr_cap[node] == 0 {
                    // CLAVE: limpiar parent al orfanar una raíz. Si conserva
                    // TERMINAL, origin_dist valida cadenas que pasan por ella
                    // misma y la adopción crea ciclos (augment no termina).
                    self.parent[node] = NONE;
                    self.orphans.push(node);
                }
                break;
            }
            self.arcs[a as usize].cap += bottleneck;
            let s_arc = Self::sister(a) as usize;
            self.arcs[s_arc].cap -= bottleneck;
            if self.arcs[s_arc].cap == 0 {
                self.orphans.push(node);
                self.parent[node] = NONE;
            }
            node = self.arcs[a as usize].to;
        }

        // toward sink side
        let mut node = self.arcs[mid as usize].to;
        let mut guard = 0usize;
        loop {
            guard += 1;
            if guard > self.n + 2 { panic!("CICLO en augment/push-sink"); }
            let a = self.parent[node];
            if a == TERMINAL || a == NONE {
                self.tr_cap[node] += bottleneck;
                if self.tr_cap[node] == 0 {
                    self.parent[node] = NONE; // ver nota arriba: raíz orfanada
                    self.orphans.push(node);
                }
                break;
            }
            self.arcs[Self::sister(a) as usize].cap += bottleneck;
            self.arcs[a as usize].cap -= bottleneck;
            if self.arcs[a as usize].cap == 0 {
                self.orphans.push(node);
                self.parent[node] = NONE;
            }
            node = self.arcs[a as usize].to;
        }

        bottleneck
    }

    fn adopt_orphans(&mut self) {
        while let Some(node) = self.orphans.pop() {
            self.process_orphan(node);
        }
    }

    fn process_orphan(&mut self, node: usize) {
        let tree = self.tree[node];
        // try to find a valid new parent
        let mut a = self.first[node];
        let mut best_parent = NONE;
        let mut best_dist = u32::MAX;
        while a != -1 {
            let cap = if tree == SOURCE {
                self.arcs[Self::sister(a) as usize].cap
            } else {
                self.arcs[a as usize].cap
            };
            let q = self.arcs[a as usize].to;
            if cap > 0 && self.tree[q] == tree {
                if let Some(d) = self.origin_dist(q, tree) {
                    if d < best_dist {
                        best_dist = d;
                        // `a` ya es el arco node→q (hijo→padre), que es la
                        // convención de `parent`. Usar sister(a) crea un
                        // SELF-LOOP (arcs[sister(a)].to == node) y los paseos
                        // de augment se quedan girando en el nodo para siempre.
                        best_parent = a;
                    }
                }
            }
            a = self.arcs[a as usize].next;
        }

        if best_parent != NONE {
            self.parent[node] = best_parent;
            self.ts[node] = self.time;
            self.dist[node] = best_dist + 1;
            return;
        }

        // no parent: free the node and re-scan neighbors
        let mut a = self.first[node];
        while a != -1 {
            let q = self.arcs[a as usize].to;
            if self.tree[q] == tree {
                let cap = if tree == SOURCE {
                    self.arcs[Self::sister(a) as usize].cap
                } else {
                    self.arcs[a as usize].cap
                };
                if cap > 0 {
                    self.active.push_back(q);
                }
                // parent[q] puede ser TERMINAL/NONE: solo los arcos reales (>= 0).
                // parent[q] es el arco q→su-padre, así que `.to == node` ya
                // pregunta "¿q es hijo de node?" (sin sister, misma inversión
                // que el self-loop de arriba).
                if self.parent[q] >= 0 && self.arcs[self.parent[q] as usize].to == node {
                    self.orphans.push(q);
                    self.parent[q] = NONE;
                }
            }
            a = self.arcs[a as usize].next;
        }
        self.tree[node] = NONE;
        self.parent[node] = NONE;
    }

    // Distancia al terminal siguiendo parents; None si la cadena está rota
    // o cicla. SIN caché de timestamps: una caché aquí se queda obsoleta
    // cuando un ancestro se vuelve huérfano dentro de la misma ronda de
    // adopción y termina validando cadenas que pasan por el propio huérfano,
    // creando ciclos de punteros parent (augment deja de terminar).
    fn origin_dist(&mut self, mut node: usize, _tree: i32) -> Option<u32> {
        let mut d = 0u32;
        loop {
            let a = self.parent[node];
            d += 1;
            if a == TERMINAL {
                return Some(d);
            }
            if a == NONE {
                return None;
            }
            node = self.arcs[a as usize].to;
            if d > self.n as u32 {
                return None; // ciclo defensivo
            }
        }
    }

    /// After `compute`, returns true if the node is on the SOURCE (foreground) side.
    pub fn is_source(&self, node: usize) -> bool {
        self.tree[node] == SOURCE
    }
}
