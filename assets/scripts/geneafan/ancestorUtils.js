import _ from 'lodash';
import familyTreeDataStore from './stores/familyTreeDataStore';

function createAncestorMap(edges) {
    const ancestorMap = new Map();
    edges.forEach(edge => {
        if (!ancestorMap.has(edge.target)) {
            ancestorMap.set(edge.target, {});
        }
        if (edge.relation === "father") {
            ancestorMap.get(edge.target).fid = edge.source;
        } else if (edge.relation === "mother") {
            ancestorMap.get(edge.target).mid = edge.source;
        }
    });
    return ancestorMap;
}

function traceAncestors(id, ancestorMap) {
    let ancestors = [];
    let queue = [id];
    let visited = new Set();

    while (queue.length > 0) {
        const currentId = queue.shift();
        if (!visited.has(currentId)) {
            visited.add(currentId);
            ancestors.push(currentId);
            const parents = ancestorMap.get(currentId) || {};
            if (parents.fid) queue.push(parents.fid);
            if (parents.mid) queue.push(parents.mid);
        }
    }

    return ancestors;
}

export function getOldestAncestorOf(individualId, prioritize = "both") {
    let ancestorMap = familyTreeDataStore.getAncestorMapCache;
    if (ancestorMap.size === 0) {
        const genealogyGraph = familyTreeDataStore.getGenealogyGraph;
        ancestorMap = createAncestorMap(genealogyGraph.edges);
        familyTreeDataStore.setAncestorMapCache(ancestorMap);
    }
    
    let currentId = individualId;
    let queue = [currentId];
    let visited = new Set();
    let oldestAncestor = currentId;

    while (!_.isEmpty(queue)) {
        currentId = queue.shift();
        if (visited.has(currentId)) continue;
        visited.add(currentId);

        const parents = ancestorMap.get(currentId);
        if (!parents) continue;

        switch (prioritize) {
            case 'father':
                if (parents.fid) queue.push(parents.fid);
                break;
            case 'mother':
                if (parents.mid) queue.push(parents.mid);
                break;
            case 'both':
                _.forEach(['fid', 'mid'], parentType => {
                    if (parents[parentType]) queue.push(parents[parentType]);
                });
                break;
        }

        oldestAncestor = currentId;
    }
    return oldestAncestor;
}

function closestAncestor(graph, id1, id2) {
    let ancestorMap = familyTreeDataStore.getAncestorMapCache;
    if (ancestorMap.size === 0) {
        ancestorMap = createAncestorMap(graph.edges);
        familyTreeDataStore.setAncestorMapCache(ancestorMap);
    }

    const ancestors1 = new Set(traceAncestors(id1, ancestorMap));
    const ancestors2 = new Set(traceAncestors(id2, ancestorMap));

    for (let ancestor of ancestors1) {
        if (ancestors2.has(ancestor)) {
            return ancestor;
        }
    }
    return null;
}

function shortestPath(graph, start, end) {
    const adjacencyList = new Map();
    graph.edges.forEach(edge => {
        if (!adjacencyList.has(edge.source)) {
            adjacencyList.set(edge.source, []);
        }
        adjacencyList.get(edge.source).push(edge.target);
    });

    let queue = [start];
    let visited = new Set();
    let parentMap = new Map();

    while (queue.length > 0) {
        let current = queue.shift();
        if (current === end) {
            let path = [];
            while (current !== start) {
                path.unshift(current);
                current = parentMap.get(current);
            }
            path.unshift(start);
            return path;
        }
        visited.add(current);

        const neighbors = adjacencyList.get(current) || [];
        for (let neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                queue.push(neighbor);
                parentMap.set(neighbor, current);
            }
        }
    }
    
    return null;
}

export function commonAncestryGraph(id1, id2) {
    console.time('commonAncestryGraph');
    const graph = familyTreeDataStore.getGenealogyGraph;
    let commonAncestorId = closestAncestor(graph, id1, id2);
    if (!commonAncestorId) {
        console.log('No ancestors found for ' + id1 + ' ' + id2);
        return null;
    } else {
        console.log('Closest ancestor is ' + graph.nodes.find(node => node.id === commonAncestorId).name + ' with id ' + commonAncestorId);
    }

    let edges1 = shortestPath(graph, commonAncestorId, id1);
    let edges2 = shortestPath(graph, commonAncestorId, id2);
    let commonAncestryGraph = _.union(edges1, edges2);
    familyTreeDataStore.setCommonAncestryGraphData(commonAncestryGraph);
    console.timeEnd('commonAncestryGraph');
    return [...edges1, ...edges2];
}