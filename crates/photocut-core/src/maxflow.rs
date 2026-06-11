//! Boykov–Kolmogorov style max-flow / min-cut on a grid graph.
//!
//! Implemented from scratch (no external maxflow crate) so the engine carries
//! no copyleft dependencies. Each pixel is a node; there is an implicit source
//! (foreground) and sink (background). Terminal capacities are the data term,
//! neighbor capacities are the smoothness term.

const SOURCE: i32 = -1;
const SINK: i32 = -2;
const NONE: i32 = -3;

struct Arc {
    to: usize,
    next: i32,    // index of next arc out of the same node, or -1
    cap: f64,     // residual capacity
}

pub struct MaxFlow {
    n: usize,
    arcs: Vec<Arc>,
    first: Vec<i32>,       // first outgoing arc per node
    tr_cap: Vec<f64>,      // >0 => residual to SOURCE, <0 => residual to SINK
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
            tr_cap: vec![0.0; n],
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
        self.tr_cap[node] += to_source - to_sink;
    }

    /// Add an undirected edge between `a` and `b` with the given capacities.
    pub fn add_edge(&mut self, a: usize, b: usize, cap_ab: f64, cap_ba: f64) {
        let i = self.arcs.len() as i32;
        self.arcs.push(Arc { to: b, next: self.first[a], cap: cap_ab });
        self.first[a] = i;
        let j = self.arcs.len() as i32;
        self.arcs.push(Arc { to: a, next: self.first[b], cap: cap_ba });
        self.first[b] = j;
    }

    fn sister(arc: i32) -> i32 {
        arc ^ 1
    }

    pub fn compute(&mut self) -> f64 {
        let mut flow = 0.0;
        // init trees from terminal capacities
        for i in 0..self.n {
            self.ts[i] = 0;
            self.dist[i] = 1;
            if self.tr_cap[i] != 0.0 {
                self.tree[i] = if self.tr_cap[i] > 0.0 { SOURCE } else { SINK };
                self.parent[i] = NONE;
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
            flow += self.augment(mid);
            self.adopt_orphans();
        }
        flow
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
                if cap > 0.0 {
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
                    } else if self.ts[q] <= self.ts[p] && self.dist[q] > self.dist[p] {
                        self.parent[q] = Self::sister(a);
                        self.ts[q] = self.ts[p];
                        self.dist[q] = self.dist[p] + 1;
                    }
                }
                a = self.arcs[a as usize].next;
            }
            self.active.pop_front();
        }
        -1
    }

    fn augment(&mut self, mid: i32) -> f64 {
        // bottleneck: walk from mid toward source and sink
        let mut bottleneck = self.arcs[mid as usize].cap;

        // toward source
        let mut node = self.arcs[Self::sister(mid) as usize].to;
        loop {
            let a = self.parent[node];
            if a == NONE {
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
        loop {
            let a = self.parent[node];
            if a == NONE {
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
        loop {
            let a = self.parent[node];
            if a == NONE {
                self.tr_cap[node] -= bottleneck;
                if self.tr_cap[node] == 0.0 {
                    self.orphans.push(node);
                }
                break;
            }
            self.arcs[a as usize].cap += bottleneck;
            self.arcs[Self::sister(a) as usize].cap -= bottleneck;
            if self.arcs[Self::sister(a) as usize].cap == 0.0 {
                self.orphans.push(node);
                self.parent[node] = NONE;
            }
            node = self.arcs[a as usize].to;
        }

        // toward sink side
        let mut node = self.arcs[mid as usize].to;
        loop {
            let a = self.parent[node];
            if a == NONE {
                self.tr_cap[node] += bottleneck;
                if self.tr_cap[node] == 0.0 {
                    self.orphans.push(node);
                }
                break;
            }
            self.arcs[Self::sister(a) as usize].cap += bottleneck;
            self.arcs[a as usize].cap -= bottleneck;
            if self.arcs[a as usize].cap == 0.0 {
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
            if cap > 0.0 && self.tree[q] == tree {
                if let Some(d) = self.origin_dist(q, tree) {
                    if d < best_dist {
                        best_dist = d;
                        best_parent = Self::sister(a);
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
                if cap > 0.0 {
                    self.active.push_back(q);
                }
                if self.parent[q] != NONE && self.arcs[Self::sister(self.parent[q]) as usize].to == node {
                    self.orphans.push(q);
                    self.parent[q] = NONE;
                }
            }
            a = self.arcs[a as usize].next;
        }
        self.tree[node] = NONE;
        self.parent[node] = NONE;
    }

    // distance to terminal following parents; None if it loops or hits a free node
    fn origin_dist(&mut self, mut node: usize, tree: i32) -> Option<u32> {
        let mut d = 0u32;
        loop {
            if self.ts[node] == self.time {
                return Some(self.dist[node] + d);
            }
            let a = self.parent[node];
            d += 1;
            if a == NONE {
                if self.tr_cap[node] != 0.0
                    && ((tree == SOURCE && self.tr_cap[node] > 0.0)
                        || (tree == SINK && self.tr_cap[node] < 0.0))
                {
                    self.ts[node] = self.time;
                    self.dist[node] = 1;
                    return Some(d);
                }
                return None;
            }
            node = self.arcs[a as usize].to;
            if d > self.n as u32 {
                return None;
            }
        }
    }

    /// After `compute`, returns true if the node is on the SOURCE (foreground) side.
    pub fn is_source(&self, node: usize) -> bool {
        self.tree[node] == SOURCE
    }
}
